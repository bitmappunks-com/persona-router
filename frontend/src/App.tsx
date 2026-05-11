import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { ActiveStrip } from "./components/ActiveStrip";
import { AgentList } from "./components/AgentList";
import { Composer } from "./components/Composer";
import { Inspector } from "./components/Inspector";
import { Transcript } from "./components/Transcript";
import type {
  Agent,
  HealthInfo,
  RoundData,
  SessionData,
} from "./types";

interface StatusState {
  message: string;
  isError: boolean;
}

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [session, setSession] = useState<SessionData | null>(null);
  const [active, setActive] = useState<string[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [topic, setTopic] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusState>({ message: "Loading", isError: false });
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<HealthInfo | null>(null);

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
        const [agentList, created, healthInfo] = await Promise.all([
          api.listAgents(),
          api.createSession(),
          api.health().catch(() => null),
        ]);
        setAgents(agentList);
        setSession(created.session);
        setActive([...created.session.active_agent_ids]);
        setHealth(healthInfo);
        setStatus({
          message: healthInfo?.llm.enabled
            ? `Ready · ${healthInfo.llm.provider ?? "llm"}/${healthInfo.llm.model}`
            : `Mock mode · ${healthInfo?.llm.hint ?? "set DEEPSEEK_API_KEY for real LLM"}`,
          isError: false,
        });
      } catch (error) {
        handleError(error);
      }
    })();
  }, [handleError]);

  const pushActive = useCallback(
    async (next: string[]) => {
      setActive(next);
      if (!session) return;
      const handles = next
        .map((id) => agents.find((agent) => agent.agent_id === id)?.handle)
        .filter((handle): handle is string => Boolean(handle));
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
        ? active.filter((id) => id !== agent.agent_id)
        : [...active, agent.agent_id];
      void pushActive(next);
    },
    [active, pushActive],
  );

  const submitRound = useCallback(
    async (kind: "round" | "next") => {
      if (!session) return;
      setBusy(true);
      setStatus({ message: "Running round", isError: false });
      try {
        let payload;
        if (kind === "round") {
          const trimmed = topic.trim();
          if (!trimmed) {
            setStatus({ message: "Write a topic first", isError: true });
            setBusy(false);
            return;
          }
          const mentions = activeAgents.map((agent) => `@${agent.handle}`).join(" ");
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
          ? `· ${health.llm.provider ?? "llm"}/${health.llm.model}`
          : "· mock";
        setStatus({ message: `Round complete ${llmLabel}`, isError: false });
      } catch (error) {
        handleError(error);
      } finally {
        setBusy(false);
      }
    },
    [activeAgents, handleError, health, session, topic],
  );

  const inspectorAgent = selected || activeAgents[0] || null;
  const sessionLabel = session ? session.session_id : "creating session";
  const topicTitle = session?.topic || "Choose agents, then start a topic";
  const canNext = rounds.length > 0 && active.length > 0 && !busy;

  return (
    <main className="shell">
      <section className="left-rail" aria-label="Agent control panel">
        <div className="brand">
          <div className="mark" aria-hidden="true">
            PR
          </div>
          <div>
            <h1>Persona Router</h1>
            <p>{sessionLabel}</p>
          </div>
        </div>
        <AgentList
          agents={agents}
          active={active}
          selectedId={selected?.agent_id ?? null}
          query={query}
          onQueryChange={setQuery}
          onToggle={toggleAgent}
        />
      </section>

      <section className="workspace" aria-label="Conversation workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Active discussion</p>
            <h2>{topicTitle}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            title="Next round"
            aria-label="Next round"
            disabled={!canNext}
            onClick={() => void submitRound("next")}
          >
            ↻
          </button>
        </header>

        <ActiveStrip
          activeAgents={activeAgents}
          onRemove={(agentId) => void pushActive(active.filter((id) => id !== agentId))}
          onClear={() => void pushActive([])}
        />

        <Transcript rounds={rounds} agents={agents} onSelectAgent={setSelected} />

        <Composer
          topic={topic}
          onTopicChange={setTopic}
          status={status.message}
          isError={status.isError}
          isBusy={busy}
          onSubmit={() => void submitRound("round")}
        />
      </section>

      <Inspector agent={inspectorAgent} />
    </main>
  );
}
