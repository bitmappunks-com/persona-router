import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { Avatar } from "../components/Avatar";
import { useAppState } from "../state";
import type {
  Agent,
  RoundData,
  SessionData,
  TurnData,
} from "../types";

interface StatusState {
  message: string;
  isError: boolean;
}

const ROMAN: [number, string][] = [
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

function toRoman(n: number): string {
  if (n <= 0) return "—";
  let value = n;
  let out = "";
  for (const [v, s] of ROMAN) {
    while (value >= v) {
      out += s;
      value -= v;
    }
  }
  return out;
}

export function SessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { agents, health } = useAppState();

  const [session, setSession] = useState<SessionData | null>(null);
  const [active, setActive] = useState<string[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [topic, setTopic] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusState>({ message: "Ready", isError: false });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const transcriptRef = useRef<HTMLDivElement>(null);

  const activeAgents = useMemo(() => {
    const set = new Set(active);
    return agents.filter((agent) => set.has(agent.agent_id));
  }, [active, agents]);

  const handleError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    setStatus({ message, isError: true });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (!id || id === "new") {
          const { session: created } = await api.createSession();
          navigate(`/session/${created.session_id}`, { replace: true });
          return;
        }
        const data = await api.getSession(id);
        setSession(data);
        setActive([...data.active_agent_ids]);
        const llmLabel = health?.llm.enabled
          ? `${health.llm.provider ?? "llm"} · ${health.llm.model}`
          : "mock mode";
        setStatus({ message: llmLabel, isError: false });
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rounds]);

  const pushActive = useCallback(
    async (next: string[]) => {
      setActive(next);
      if (!session) return;
      const handles = next
        .map((idx) => agents.find((agent) => agent.agent_id === idx)?.handle)
        .filter((h): h is string => Boolean(h));
      try {
        const updated = await api.setActive(session.session_id, handles);
        setSession(updated);
        setActive([...updated.active_agent_ids]);
      } catch (error) {
        handleError(error);
      }
    },
    [agents, handleError, session],
  );

  const toggleAgent = useCallback(
    (agent: Agent) => {
      setSelected(agent);
      const next = active.includes(agent.agent_id)
        ? active.filter((x) => x !== agent.agent_id)
        : [...active, agent.agent_id];
      void pushActive(next);
    },
    [active, pushActive],
  );

  const submitRound = useCallback(
    async (kind: "round" | "next") => {
      if (!session) return;
      setBusy(true);
      setStatus({ message: "Transmitting", isError: false });
      try {
        let payload;
        if (kind === "round") {
          const trimmed = topic.trim();
          if (!trimmed) {
            setStatus({ message: "Write tonight's subject first", isError: true });
            setBusy(false);
            return;
          }
          const mentions = activeAgents.map((a) => `@${a.handle}`).join(" ");
          const text = trimmed.includes("@") ? trimmed : `${mentions} ${trimmed}`.trim();
          payload = await api.runRound(session.session_id, text);
        } else {
          payload = await api.nextRound(session.session_id);
        }
        setSession(payload.session);
        setActive([...payload.session.active_agent_ids]);
        setRounds((prev) => [...prev, payload.round]);
        if (kind === "round") {
          setTopic(payload.session.topic || "");
        }
        const llmLabel = health?.llm.enabled
          ? `${health.llm.provider ?? "llm"} · ${health.llm.model}`
          : "mock";
        setStatus({ message: `Round ${payload.round.round_index} · ${llmLabel}`, isError: false });
      } catch (error) {
        handleError(error);
      } finally {
        setBusy(false);
      }
    },
    [activeAgents, handleError, health, session, topic],
  );

  const filteredAgents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((agent) => {
      const haystack = `${agent.handle} ${agent.display_name} ${(agent.domains || []).join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [agents, query]);

  const inspectorAgent = selected || activeAgents[0] || null;
  const topicTitle = session?.topic;

  if (loading) {
    return (
      <section className="section container">
        <div className="eyebrow muted">Opening session…</div>
      </section>
    );
  }

  return (
    <div className="session">
      <aside className="session-rail" aria-label="Agent directory">
        <div className="session-rail-head">
          <span className="eyebrow">Directory</span>
          <input
            className="rail-search"
            type="search"
            placeholder="search the council"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="rail-list">
          {filteredAgents.map((agent) => {
            const isActive = active.includes(agent.agent_id);
            return (
              <button
                key={agent.agent_id}
                type="button"
                className={`rail-row ${isActive ? "active" : ""}`}
                onClick={() => toggleAgent(agent)}
              >
                <Avatar agent={agent} size="sm" />
                <div>
                  <div className="rail-row-name">{agent.display_name}</div>
                  <div className="rail-row-handle">@{agent.handle}</div>
                </div>
                <span className="rail-row-toggle" />
              </button>
            );
          })}
        </div>
      </aside>

      <main className="session-stage" aria-label="Conversation workspace">
        <header className="stage-head">
          <div className="eyebrow accent">Tonight's session</div>
          <h1 className={`stage-title ${topicTitle ? "" : "empty"}`}>
            {topicTitle || "Choose voices, set a subject, run a round."}
          </h1>
        </header>

        <section className="cast-strip" aria-label="Active agents">
          <span className="label">Cast</span>
          {activeAgents.length === 0 ? (
            <span className="empty">No voices selected — pick at least one from the directory.</span>
          ) : (
            activeAgents.map((agent) => (
              <button
                key={agent.agent_id}
                type="button"
                className="cast-chip"
                title={`Deactivate @${agent.handle}`}
                onClick={() => void pushActive(active.filter((x) => x !== agent.agent_id))}
              >
                <Avatar agent={agent} size="xs" />
                <span className="name">{agent.display_name}</span>
                <span className="cross">×</span>
              </button>
            ))
          )}
          {activeAgents.length > 0 ? (
            <button
              type="button"
              className="btn-link"
              style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.08em" }}
              onClick={() => void pushActive([])}
            >
              Clear
            </button>
          ) : null}
        </section>

        <div className="transcript" ref={transcriptRef}>
          {rounds.length === 0 ? (
            <div className="empty-transcript">
              <div className="ornament">§</div>
              <h2>The page is empty.</h2>
              <p>Pick voices, write a subject, and the first round will land here.</p>
            </div>
          ) : (
            rounds.map((round) => (
              <section className="round" key={round.round_index}>
                <header className="round-head">
                  <span className="num">{toRoman(round.round_index)}</span>
                  <span>Round {round.round_index}</span>
                  <span className="rule" />
                  {round.needs_verification ? <span className="verify">needs verification</span> : null}
                </header>
                {round.turns.map((turn) => (
                  <TurnCard
                    key={`${turn.round_index}-${turn.agent_id}-${turn.trigger}`}
                    turn={turn}
                    agent={agents.find((a) => a.agent_id === turn.agent_id)}
                    onSelect={setSelected}
                  />
                ))}
              </section>
            ))
          )}
        </div>

        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            void submitRound("round");
          }}
        >
          <div className="composer-shell">
            <textarea
              rows={2}
              placeholder="Tonight's subject — e.g. 讨论一下产品发布会为什么容易变成形式主义"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={rounds.length === 0 || active.length === 0 || busy}
                onClick={() => void submitRound("next")}
                title="Continue with the same cast"
              >
                ↻ Next
              </button>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? "Running…" : "Run round →"}
              </button>
            </div>
          </div>
          <div
            className={`composer-status ${status.isError ? "error" : ""} ${busy ? "busy" : ""}`}
          >
            <span className="dot" />
            <span>{status.message}</span>
          </div>
        </form>
      </main>

      <aside className="session-side" aria-label="Source dossier">
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Dossier
        </div>
        {!inspectorAgent ? (
          <p className="empty">Select a voice for source, license, and boundaries.</p>
        ) : (
          <SideCard agent={inspectorAgent} />
        )}
      </aside>
    </div>
  );
}

function TurnCard({
  turn,
  agent,
  onSelect,
}: {
  turn: TurnData;
  agent?: Agent;
  onSelect: (agent: Agent) => void;
}) {
  const paragraphs = turn.content.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  return (
    <article
      className="turn"
      onClick={() => {
        if (agent) onSelect(agent);
      }}
    >
      {agent ? <Avatar agent={agent} size="md" /> : <span className="avatar size-md" aria-hidden="true">·</span>}
      <div className="turn-body">
        <div className="turn-head">
          <span className="turn-name">{agent?.display_name || turn.handle || turn.agent_id}</span>
          <span className="turn-handle">@{agent?.handle || turn.handle || turn.agent_id}</span>
          <span className="turn-trigger">{turn.trigger}</span>
        </div>
        <div className="turn-text">
          {paragraphs.length > 0 ? (
            paragraphs.map((para, i) => <p key={i}>{para}</p>)
          ) : (
            <p>{turn.content}</p>
          )}
        </div>
      </div>
    </article>
  );
}

function SideCard({ agent }: { agent: Agent }) {
  const source = agent.source || {};
  const repo = source.source_repository || source.upstream_repository || "";
  const commit = source.source_commit || source.upstream_commit || "";
  return (
    <div className="card">
      <div className="top">
        <Avatar agent={agent} size="md" />
        <div>
          <div className="name">{agent.display_name}</div>
          <div className="handle">@{agent.handle}</div>
        </div>
      </div>
      <span className={`chip tone-${(agent.risk_level || "medium").toLowerCase()}`}>
        {agent.risk_level || "medium"} risk
      </span>
      <dl>
        <div>
          <dt>License</dt>
          <dd>{source.license_status || "license_unknown"}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>
            {repo ? (
              <a href={repo} target="_blank" rel="noreferrer">
                {repo.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              <em>not provided</em>
            )}
          </dd>
        </div>
        <div>
          <dt>Commit</dt>
          <dd>
            {commit ? (
              <code className="mono" style={{ fontSize: 11 }}>
                {commit.slice(0, 12)}
              </code>
            ) : (
              <em>—</em>
            )}
          </dd>
        </div>
        <div>
          <dt>Domains</dt>
          <dd>{(agent.domains || []).join(" · ") || <em>—</em>}</dd>
        </div>
      </dl>
    </div>
  );
}
