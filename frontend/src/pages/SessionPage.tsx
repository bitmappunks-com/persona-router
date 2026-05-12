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

interface StreamingTurn {
  agent_id: string;
  handle: string;
  display_name: string;
  trigger: string;
  content: string;
  done: boolean;
}

interface StreamingRound {
  round_index: number;
  user_text: string;
  turns: StreamingTurn[];
  needs_verification: boolean;
  done: boolean;
}

interface ChatBlock {
  round_index: number;
  user_text: string;
  needs_verification: boolean;
  turns: TurnData[];
  pending?: boolean;
}

export function SessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { agents, health } = useAppState();

  const [session, setSession] = useState<SessionData | null>(null);
  const [active, setActive] = useState<string[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [composer, setComposer] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusState>({ message: "就绪", isError: false });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sentMessages, setSentMessages] = useState<string[]>([]);
  const [streaming, setStreaming] = useState<StreamingRound | null>(null);

  const transcriptRef = useRef<HTMLDivElement>(null);

  const activeAgents = useMemo(() => {
    const set = new Set(active);
    return agents.filter((agent) => set.has(agent.agent_id));
  }, [active, agents]);

  const blocks = useMemo<ChatBlock[]>(() => {
    const base: ChatBlock[] = rounds.map((round, i) => ({
      round_index: round.round_index,
      user_text: sentMessages[i] ?? session?.topic ?? "",
      needs_verification: round.needs_verification,
      turns: round.turns,
    }));
    if (streaming) {
      const liveTurns: TurnData[] = streaming.turns.map((t) => ({
        round_index: streaming.round_index,
        agent_id: t.agent_id,
        handle: t.handle,
        trigger: t.trigger,
        content: t.content,
        metadata: { streaming: !t.done },
      }));
      base.push({
        round_index: streaming.round_index,
        user_text: streaming.user_text,
        needs_verification: streaming.needs_verification,
        turns: liveTurns,
        pending: !streaming.done,
      });
    }
    return base;
  }, [rounds, sentMessages, session?.topic, streaming]);

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
          : "mock 模式";
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
  }, [blocks]);

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

  const submitMessage = useCallback(
    async (kind: "round" | "next") => {
      if (!session) return;
      if (kind === "round" && active.length === 0) {
        setStatus({ message: "先把人拉进群再发", isError: true });
        return;
      }
      const canStream = !!health?.llm.enabled;
      setBusy(true);
      setStatus({ message: canStream ? "正在生成…" : "发送中…", isError: false });
      let userText = "";
      let messageText = "";
      try {
        if (kind === "round") {
          const trimmed = composer.trim();
          if (!trimmed) {
            setStatus({ message: "先写点什么再发", isError: true });
            setBusy(false);
            return;
          }
          const mentions = activeAgents.map((a) => `@${a.handle}`).join(" ");
          messageText = trimmed.includes("@") ? trimmed : `${mentions} ${trimmed}`.trim();
          userText = trimmed;
        } else {
          userText = "（继续聊一轮）";
        }

        if (!canStream) {
          const payload =
            kind === "round"
              ? await api.runRound(session.session_id, messageText)
              : await api.nextRound(session.session_id);
          setSentMessages((prev) => [...prev, userText]);
          if (kind === "round") setComposer("");
          setSession(payload.session);
          setActive([...payload.session.active_agent_ids]);
          setRounds((prev) => [...prev, payload.round]);
          setStatus({ message: `第 ${payload.round.round_index} 轮 · mock`, isError: false });
          return;
        }

        // Streaming path
        setSentMessages((prev) => [...prev, userText]);
        if (kind === "round") setComposer("");
        const events =
          kind === "round"
            ? api.streamRound(session.session_id, messageText)
            : api.streamNext(session.session_id);

        let finalTurns: TurnData[] = [];
        let needsVerification = false;
        let roundIndex = 0;

        for await (const event of events) {
          if (event.event === "round_start") {
            roundIndex = event.round_index;
            setStreaming({
              round_index: event.round_index,
              user_text: userText,
              turns: [],
              needs_verification: false,
              done: false,
            });
          } else if (event.event === "turn_start") {
            setStreaming((prev) =>
              prev
                ? {
                    ...prev,
                    turns: [
                      ...prev.turns,
                      {
                        agent_id: event.agent_id,
                        handle: event.handle,
                        display_name: event.display_name,
                        trigger: event.trigger,
                        content: "",
                        done: false,
                      },
                    ],
                  }
                : prev,
            );
          } else if (event.event === "token") {
            setStreaming((prev) => {
              if (!prev) return prev;
              const turns = prev.turns.map((t) =>
                t.agent_id === event.agent_id && !t.done
                  ? { ...t, content: t.content + event.delta }
                  : t,
              );
              return { ...prev, turns };
            });
          } else if (event.event === "turn_end") {
            setStreaming((prev) => {
              if (!prev) return prev;
              const turns = prev.turns.map((t) =>
                t.agent_id === event.agent_id
                  ? { ...t, content: event.content, done: true }
                  : t,
              );
              return { ...prev, turns };
            });
            finalTurns.push({
              round_index: event.round_index,
              agent_id: event.agent_id,
              handle: event.handle,
              trigger: event.trigger,
              content: event.content,
              metadata: event.metadata,
            });
          } else if (event.event === "round_end") {
            needsVerification = event.needs_verification;
            roundIndex = event.round_index;
            setStreaming((prev) => (prev ? { ...prev, needs_verification: event.needs_verification, done: true } : prev));
          } else if (event.event === "session") {
            setSession(event.session);
            setActive([...event.session.active_agent_ids]);
          } else if (event.event === "error") {
            throw new Error(event.detail);
          }
        }

        setRounds((prev) => [
          ...prev,
          {
            round_index: roundIndex,
            needs_verification: needsVerification,
            boundary_downgraded: needsVerification,
            turns: finalTurns,
          },
        ]);
        setStreaming(null);
        const llmLabel = `${health?.llm.provider ?? "llm"} · ${health?.llm.model ?? ""}`;
        setStatus({ message: `第 ${roundIndex} 轮 · ${llmLabel}`, isError: false });
      } catch (error) {
        setStreaming(null);
        handleError(error);
      } finally {
        setBusy(false);
      }
    },
    [active.length, activeAgents, composer, handleError, health, session],
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
  const groupTitle = session?.topic;
  const memberCount = activeAgents.length;

  if (loading) {
    return (
      <section className="section container">
        <div className="eyebrow muted">正在打开群聊…</div>
      </section>
    );
  }

  return (
    <div className="session">
      <aside className="session-rail" aria-label="成员列表">
        <div className="session-rail-head">
          <div className="eyebrow" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span>群成员</span>
            <span className="mono" style={{ color: "var(--muted-2)" }}>{memberCount}</span>
          </div>
          <input
            className="rail-search"
            type="search"
            placeholder="搜索可拉进群的成员"
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
                title={isActive ? "踢出群组" : "拉进群组"}
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

      <main className="session-stage" aria-label="群聊对话">
        <header className="stage-head">
          <div className="eyebrow accent">群聊</div>
          <h1 className={`stage-title ${groupTitle ? "" : "empty"}`}>
            {groupTitle || (memberCount > 0 ? "拉好人了，发一条消息看看大家怎么说" : "先从左边拉成员进群")}
          </h1>
          {memberCount > 0 ? (
            <div className="cast-strip-inline" aria-label="群组成员">
              {activeAgents.map((agent) => (
                <button
                  key={agent.agent_id}
                  type="button"
                  className="member-chip"
                  title={`踢出 @${agent.handle}`}
                  onClick={() => void pushActive(active.filter((x) => x !== agent.agent_id))}
                >
                  <Avatar agent={agent} size="xs" />
                  <span className="member-chip-name">{agent.display_name}</span>
                  <span className="member-chip-cross">×</span>
                </button>
              ))}
              <button
                type="button"
                className="member-chip-clear"
                onClick={() => void pushActive([])}
                title="清空群成员"
              >
                清空
              </button>
            </div>
          ) : null}
        </header>

        <div className="chat-scroll" ref={transcriptRef}>
          {blocks.length === 0 ? (
            <div className="empty-chat">
              <div className="ornament">💬</div>
              <h2>新群组，还没人说话</h2>
              <p>从左边拉成员进群，然后发一条消息。</p>
            </div>
          ) : (
            blocks.map((block) => (
              <div className="chat-block" key={`${block.round_index}-${block.pending ? "live" : "done"}`}>
                {block.user_text ? (
                  <div className="bubble-row user">
                    <div className="bubble bubble-user">
                      <div className="bubble-text">{block.user_text}</div>
                    </div>
                  </div>
                ) : null}
                {block.turns.map((turn) => (
                  <ChatBubble
                    key={`${turn.round_index}-${turn.agent_id}-${turn.trigger}`}
                    turn={turn}
                    agent={agents.find((a) => a.agent_id === turn.agent_id)}
                    onSelect={setSelected}
                    streaming={Boolean(block.pending && turn.metadata && (turn.metadata as { streaming?: boolean }).streaming)}
                  />
                ))}
                {block.pending && block.turns.length === 0 ? (
                  <div className="bubble-note">…正在等待回复</div>
                ) : null}
                {block.needs_verification && !block.pending ? (
                  <div className="bubble-note">⚠ 涉及时效/事实问题，建议外部核实</div>
                ) : null}
              </div>
            ))
          )}
        </div>

        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            void submitMessage("round");
          }}
        >
          <div className="composer-shell">
            <textarea
              rows={2}
              placeholder={memberCount > 0 ? "发消息到群里 …" : "先拉成员进群"}
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              disabled={memberCount === 0}
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={rounds.length === 0 || active.length === 0 || busy}
                onClick={() => void submitMessage("next")}
                title="不带新消息，让大家继续聊"
              >
                ↻ 继续
              </button>
              <button className="btn btn-primary" type="submit" disabled={busy || memberCount === 0}>
                {busy ? "发送中…" : "发送 →"}
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

      <aside className="session-side" aria-label="成员资料">
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          成员资料
        </div>
        {!inspectorAgent ? (
          <p className="empty">点群里任一头像查看来源、许可证、边界。</p>
        ) : (
          <SideCard agent={inspectorAgent} />
        )}
      </aside>
    </div>
  );
}

function ChatBubble({
  turn,
  agent,
  onSelect,
  streaming = false,
}: {
  turn: TurnData;
  agent?: Agent;
  onSelect: (agent: Agent) => void;
  streaming?: boolean;
}) {
  const paragraphs = turn.content.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const name = agent?.display_name || turn.handle || turn.agent_id;
  const isEmpty = !turn.content.trim();
  const isHost = turn.trigger === "host" || agent?.handle === "dispatcher";

  if (isHost) {
    return (
      <DispatcherBubble
        turn={turn}
        agent={agent}
        onSelect={onSelect}
        streaming={streaming}
        paragraphs={paragraphs}
        name={name}
        isEmpty={isEmpty}
      />
    );
  }

  return (
    <div className="bubble-row agent">
      <button
        type="button"
        className="bubble-avatar"
        onClick={() => {
          if (agent) onSelect(agent);
        }}
        aria-label={`查看 ${name} 的资料`}
      >
        {agent ? <Avatar agent={agent} size="sm" /> : <span className="avatar size-sm" />}
      </button>
      <div className="bubble-stack">
        <div className="bubble-byline">
          <span className="bubble-name">{name}</span>
          <span className="bubble-handle">@{agent?.handle || turn.handle || turn.agent_id}</span>
          {streaming ? <span className="bubble-typing">正在输入…</span> : null}
        </div>
        <div className={`bubble bubble-agent ${streaming ? "is-streaming" : ""}`}>
          <div className="bubble-text">
            {isEmpty && streaming ? (
              <span className="typing-dots" aria-hidden="true">
                <span /><span /><span />
              </span>
            ) : paragraphs.length > 0 ? (
              paragraphs.map((para, i) => <p key={i}>{para}</p>)
            ) : (
              <p>{turn.content}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DispatcherBubble({
  turn,
  agent,
  onSelect,
  streaming,
  paragraphs,
  name,
  isEmpty,
}: {
  turn: TurnData;
  agent?: Agent;
  onSelect: (agent: Agent) => void;
  streaming: boolean;
  paragraphs: string[];
  name: string;
  isEmpty: boolean;
}) {
  const [open, setOpen] = useState(streaming);
  useEffect(() => {
    if (streaming) setOpen(true);
  }, [streaming]);
  const wordCount = turn.content.replace(/\s+/g, "").length;
  return (
    <div className="bubble-row agent dispatcher">
      <button
        type="button"
        className="bubble-avatar"
        onClick={() => {
          if (agent) onSelect(agent);
        }}
        aria-label={`查看 ${name} 的资料`}
      >
        {agent ? <Avatar agent={agent} size="sm" /> : <span className="avatar size-sm" />}
      </button>
      <div className="bubble-stack">
        <button
          type="button"
          className={`dispatcher-toggle ${open ? "open" : ""}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="chevron" aria-hidden="true">▸</span>
          <span className="dispatcher-label">{name} · 调度准备</span>
          {streaming ? (
            <span className="bubble-typing">生成中…</span>
          ) : (
            <span className="dispatcher-meta">{wordCount > 0 ? `${wordCount} 字 · 点击${open ? "收起" : "展开"}` : "（空）"}</span>
          )}
        </button>
        {open ? (
          <div className={`bubble bubble-dispatcher ${streaming ? "is-streaming" : ""}`}>
            <div className="bubble-text">
              {isEmpty && streaming ? (
                <span className="typing-dots" aria-hidden="true">
                  <span /><span /><span />
                </span>
              ) : paragraphs.length > 0 ? (
                paragraphs.map((para, i) => <p key={i}>{para}</p>)
              ) : (
                <p>{turn.content}</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
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
        {agent.risk_level || "medium"} 风险
      </span>
      <dl>
        <div>
          <dt>许可证</dt>
          <dd>{source.license_status || "license_unknown"}</dd>
        </div>
        <div>
          <dt>来源</dt>
          <dd>
            {repo ? (
              <a href={repo} target="_blank" rel="noreferrer">
                {repo.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              <em>未提供</em>
            )}
          </dd>
        </div>
        <div>
          <dt>提交</dt>
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
          <dt>擅长领域</dt>
          <dd>{(agent.domains || []).join(" · ") || <em>—</em>}</dd>
        </div>
      </dl>
    </div>
  );
}
