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
import { useT } from "../i18n";
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

export function ChatPane() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { agents, health } = useAppState();
  const t = useT();

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

  // Visible members = everyone except dispatcher (dispatcher shows inline as a system card)
  const visibleMembers = useMemo(
    () => activeAgents.filter((a) => a.handle !== "dispatcher"),
    [activeAgents],
  );

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
          navigate("/chats", { replace: true });
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
      if (kind === "round" && visibleMembers.length === 0) {
        setStatus({ message: t("chat.add_members_first"), isError: true });
        return;
      }
      const canStream = !!health?.llm.enabled;
      setBusy(true);
      setStatus({ message: canStream ? t("chat.streaming") : t("chat.sending"), isError: false });
      let userText = "";
      let messageText = "";
      try {
        if (kind === "round") {
          const trimmed = composer.trim();
          if (!trimmed) {
            setStatus({ message: t("chat.write_first"), isError: true });
            setBusy(false);
            return;
          }
          const mentions = activeAgents.map((a) => `@${a.handle}`).join(" ");
          messageText = trimmed.includes("@") ? trimmed : `${mentions} ${trimmed}`.trim();
          userText = trimmed;
        } else {
          userText = `(${t("chat.continue")})`;
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
    [activeAgents, composer, handleError, health, session, t, visibleMembers.length],
  );

  const onSelectAgent = useCallback((agent: Agent) => {
    setDrawerAgent(agent);
    setDrawerOpen(true);
  }, []);

  if (loading) {
    return (
      <section className="wx-chat-pane">
        <div className="wx-empty-pane">
          <div className="wx-empty-mark">⏳</div>
          <h2>{t("chat.opening")}</h2>
        </div>
      </section>
    );
  }

  const isDirect = session?.kind === "direct";
  const directAgent =
    isDirect && session?.direct_handle
      ? agents.find((a) => a.handle === session.direct_handle)
      : null;
  const isSingleChat = isDirect || visibleMembers.length === 1;
  const groupTitle = isDirect
    ? directAgent?.display_name || session?.name || t("chat.new_chat")
    : session?.name || session?.topic
    ? session.name || session.topic || ""
    : visibleMembers.length === 1
    ? visibleMembers[0].display_name
    : visibleMembers.length === 0
    ? t("chat.new_chat")
    : t("chat.group_chat_count", { count: visibleMembers.length });

  return (
    <section className="wx-chat-pane">
      <header className="wx-chat-head">
        <div className="wx-chat-head-main">
          <h1 className="wx-chat-title">{groupTitle}</h1>
          <div className="wx-chat-subtitle">
            {isDirect ? (
              <span className="wx-chat-direct-handle">@{directAgent?.handle || session?.direct_handle || ""}</span>
            ) : visibleMembers.length === 0 ? (
              <button type="button" className="wx-text-link" onClick={() => setDrawerOpen(true)}>
                {t("chat.add_members")}
              </button>
            ) : (
              <button type="button" className="wx-chat-members" onClick={() => setDrawerOpen((v) => !v)}>
                {visibleMembers.slice(0, 6).map((a) => (
                  <span key={a.agent_id} className="wx-chat-member-dot" title={a.display_name}>
                    <img src={avatarUrl(a.handle)} alt="" />
                  </span>
                ))}
                <span className="wx-chat-member-count">{t("chat.members_count", { count: visibleMembers.length })}</span>
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          className="wx-chat-action"
          onClick={() => setDrawerOpen((v) => !v)}
          title={t("chat.member_info")}
          aria-label={t("chat.member_info")}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
        </button>
      </header>

      <div className="wx-chat-scroll" ref={transcriptRef}>
        {blocks.length === 0 ? (
          <div className="wx-chat-empty">
            <div className="ornament">💬</div>
            <p>{visibleMembers.length > 0 ? t("chat.empty_messages_with_members") : t("chat.empty_messages_no_members")}</p>
          </div>
        ) : (
          blocks.map((block) => (
            <div className="wx-chat-block" key={`${block.round_index}-${block.pending ? "live" : "done"}`}>
              <div className="wx-chat-time">{t("chat.round_n", { n: block.round_index })} · {nowHM()}</div>
              {block.user_text ? (
                <div className="wx-bubble-row me">
                  <div className="wx-bubble wx-bubble-me">{block.user_text}</div>
                  <span className="wx-bubble-avatar">
                    <img src={avatarUrl("user:me")} alt="" />
                  </span>
                </div>
              ) : null}
              {block.turns.map((turn) => (
                <WxBubble
                  key={`${turn.round_index}-${turn.agent_id}-${turn.trigger}`}
                  turn={turn}
                  agent={agents.find((a) => a.agent_id === turn.agent_id)}
                  onSelect={onSelectAgent}
                  streaming={Boolean(block.pending && turn.metadata && (turn.metadata as { streaming?: boolean }).streaming)}
                  showName={!isSingleChat || turn.handle === "dispatcher"}
                />
              ))}
              {block.pending && block.turns.length === 0 ? (
                <div className="wx-chat-note">{t("chat.waiting_reply")}</div>
              ) : null}
              {block.needs_verification && !block.pending ? (
                <div className="wx-chat-note">{t("chat.fact_warn")}</div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <form
        className="wx-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void submitMessage("round");
        }}
      >
        <textarea
          rows={2}
          placeholder={visibleMembers.length > 0 ? t("chat.placeholder") : t("chat.placeholder_empty_group")}
          value={composer}
          onChange={(event) => setComposer(event.target.value)}
          disabled={visibleMembers.length === 0 || busy}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (!busy && visibleMembers.length > 0) void submitMessage("round");
            }
          }}
        />
        <div className="wx-composer-actions">
          <button
            type="button"
            className="wx-btn-text"
            disabled={rounds.length === 0 || active.length === 0 || busy}
            onClick={() => void submitMessage("next")}
            title={t("chat.continue")}
          >
            ↻ {t("chat.continue")}
          </button>
          <button className="wx-btn primary small" type="submit" disabled={busy || visibleMembers.length === 0}>
            {busy ? "…" : t("chat.send")}
          </button>
        </div>
        {status.message ? (
          <div className={`wx-status ${status.isError ? "error" : ""} ${busy ? "busy" : ""}`}>
            <span className="dot" />
            <span>{status.message}</span>
          </div>
        ) : null}
      </form>

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
    </section>
  );
}

function WxBubble({
  turn,
  agent,
  onSelect,
  streaming,
  showName,
}: {
  turn: TurnData;
  agent?: Agent;
  onSelect: (agent: Agent) => void;
  streaming: boolean;
  showName: boolean;
}) {
  const paragraphs = turn.content.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const name = agent?.display_name || turn.handle || turn.agent_id;
  const isHost = turn.trigger === "host" || agent?.handle === "dispatcher";
  const isEmpty = !turn.content.trim();

  if (isHost) {
    return (
      <WxDispatcher
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
    <div className="wx-bubble-row other">
      <button
        type="button"
        className="wx-bubble-avatar"
        onClick={() => {
          if (agent) onSelect(agent);
        }}
      >
        {agent ? <Avatar agent={agent} size="sm" /> : <span className="avatar size-sm" />}
      </button>
      <div className="wx-bubble-stack">
        {showName ? <div className="wx-bubble-name">{name}</div> : null}
        <div className={`wx-bubble wx-bubble-other ${streaming ? "is-streaming" : ""}`}>
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
  );
}

function WxDispatcher({
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
  const t = useT();
  const [open, setOpen] = useState(streaming);
  useEffect(() => {
    if (streaming) setOpen(true);
  }, [streaming]);
  const wordCount = turn.content.replace(/\s+/g, "").length;
  return (
    <div className="wx-system-row">
      <button
        type="button"
        className={`wx-system-toggle ${open ? "open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="chevron">▸</span>
        <span className="wx-system-label">
          {name} · {t("chat.system_dispatcher")}
          {streaming ? ` · ${t("chat.streaming")}` : wordCount > 0 ? ` · ${wordCount}` : ""}
        </span>
      </button>
      {open ? (
        <div className="wx-system-card" onClick={() => agent && onSelect(agent)}>
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
      ) : null}
    </div>
  );
}

function nowHM(): string {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
