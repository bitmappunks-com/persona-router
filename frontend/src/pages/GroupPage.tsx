import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { Avatar, avatarUrl } from "../components/Avatar";
import { MembersDrawer } from "../components/MembersDrawer";
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

export function GroupPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { agents, health } = useAppState();

  const [session, setSession] = useState<SessionData | null>(null);
  const [active, setActive] = useState<string[]>([]);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [composer, setComposer] = useState("");
  const [status, setStatus] = useState<StatusState>({ message: "", isError: false });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sentMessages, setSentMessages] = useState<string[]>([]);
  const [streaming, setStreaming] = useState<StreamingRound | null>(null);
  const [drawerAgent, setDrawerAgent] = useState<Agent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
        if (!id) {
          navigate("/", { replace: true });
          return;
        }
        const data = await api.getSession(id);
        setSession(data);
        setActive([...data.active_agent_ids]);
        setRounds([]);
        setSentMessages([]);
        setComposer("");
        setStreaming(null);
        setStatus({ message: "", isError: false });
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate, handleError]);

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
      setStatus({ message: canStream ? "生成中…" : "发送中…", isError: false });
      let userText = "";
      let messageText = "";
      try {
        if (kind === "round") {
          const trimmed = composer.trim();
          if (!trimmed) {
            setStatus({ message: "写一句话再发吧", isError: true });
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
          setStatus({ message: "", isError: false });
          return;
        }

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
        setStatus({ message: "", isError: false });
      } catch (error) {
        setStreaming(null);
        handleError(error);
      } finally {
        setBusy(false);
      }
    },
    [active.length, activeAgents, composer, handleError, health, session],
  );

  const onSelectAgent = useCallback((agent: Agent) => {
    setDrawerAgent(agent);
    setDrawerOpen(true);
  }, []);

  if (loading) {
    return (
      <section className="landing-empty">
        <div className="landing-pulse" />
        <h2>打开群聊…</h2>
      </section>
    );
  }

  const groupTitle = session?.topic;
  const memberCount = activeAgents.length;

  return (
    <>
      <div className={`chat-pane ${drawerOpen ? "with-drawer" : ""}`}>
        <header className="chat-head">
          <div className="chat-head-main">
            <h1 className={`chat-title ${groupTitle ? "" : "empty"}`}>
              {groupTitle || "新群组"}
            </h1>
            <div className="chat-subline">
              {memberCount > 0 ? (
                <>
                  <button
                    className="chat-members-summary"
                    type="button"
                    onClick={() => setDrawerOpen((v) => !v)}
                  >
                    {activeAgents.slice(0, 6).map((agent) => (
                      <span key={agent.agent_id} className="chat-member-dot" title={agent.display_name}>
                        <img src={avatarUrl(agent.handle)} alt="" />
                      </span>
                    ))}
                    <span className="chat-member-count">{memberCount} 人在群</span>
                  </button>
                </>
              ) : (
                <button type="button" className="chat-add-cta" onClick={() => setDrawerOpen(true)}>
                  + 拉人进群
                </button>
              )}
              {session ? (
                <span className="chat-session-id mono">·{session.session_id.replace(/^sess_/, "").slice(0, 8)}</span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className="chat-drawer-toggle"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-pressed={drawerOpen}
            title={drawerOpen ? "收起成员栏" : "展开成员栏"}
          >
            {drawerOpen ? "›" : "‹"}
          </button>
        </header>

        <div className="chat-scroll" ref={transcriptRef}>
          {blocks.length === 0 ? (
            <div className="chat-empty">
              <div className="ornament">💬</div>
              <h2>{memberCount > 0 ? "发条消息试试" : "先从右边拉人进群"}</h2>
              <p>{memberCount > 0 ? "调度员会先摆出事实，然后大家自由发言。" : "拉好人之后发消息，调度员先发言，其他人按各自角色接话。"}</p>
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
                    onSelect={onSelectAgent}
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
              disabled={memberCount === 0 || busy}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  if (!busy && memberCount > 0) void submitMessage("round");
                }
              }}
            />
            <div className="composer-actions">
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
                {busy ? "…" : "发送"}
              </button>
            </div>
          </div>
          {status.message ? (
            <div className={`composer-status ${status.isError ? "error" : ""} ${busy ? "busy" : ""}`}>
              <span className="dot" />
              <span>{status.message}</span>
            </div>
          ) : null}
        </form>
      </div>

      <MembersDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        allAgents={agents}
        active={active}
        onToggle={toggleAgent}
        onClearAll={() => void pushActive([])}
        selectedAgent={drawerAgent}
        onSelectAgent={setDrawerAgent}
      />
    </>
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
