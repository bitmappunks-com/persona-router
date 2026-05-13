import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { api, type SessionSummary } from "../api";
import { avatarUrl } from "../components/Avatar";
import { CreateGroupModal } from "../components/CreateGroupModal";
import { useAppState } from "../state";
import { useT, useI18n } from "../i18n";

export function ChatsTab() {
  const navigate = useNavigate();
  const params = useParams();
  const currentId = params.id;
  const { agents } = useAppState();
  const t = useT();
  const { lang } = useI18n();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      setSessions(await api.listSessions());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, currentId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      const title = sessionTitle(s, agents);
      if (!q) return true;
      return (
        (title || "").toLowerCase().includes(q) ||
        (s.topic || "").toLowerCase().includes(q) ||
        s.session_id.toLowerCase().includes(q)
      );
    });
  }, [sessions, query, agents]);

  const directChats = useMemo(() => filtered.filter((s) => s.kind === "direct"), [filtered]);
  const groupChats = useMemo(() => filtered.filter((s) => s.kind !== "direct"), [filtered]);

  const createGroup = useCallback(
    async (handles: string[], name: string | null) => {
      const { session } = await api.createSession({ kind: "group", name, handles });
      await reload();
      setModalOpen(false);
      navigate(`/chats/${session.session_id}`);
    },
    [navigate, reload],
  );

  return (
    <>
      <aside className="wx-list" aria-label={t("nav.chats")}>
        <header className="wx-list-head">
          <div className="wx-search">
            <input
              type="search"
              placeholder={t("list.search")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="wx-list-add"
            onClick={() => setModalOpen(true)}
            title={t("list.new_chat")}
            aria-label={t("list.new_chat")}
          >
            +
          </button>
        </header>
        <div className="wx-list-scroll">
          {filtered.length === 0 ? (
            <div className="wx-list-empty">
              <p>{t("list.empty_chats")}</p>
              <button type="button" className="wx-text-link" onClick={() => setModalOpen(true)}>
                {t("list.empty_chats_cta")}
              </button>
            </div>
          ) : (
            <>
              {directChats.length > 0 ? (
                <section>
                  <div className="wx-section-head">{t("section.direct_chats")}</div>
                  {directChats.map((s) => (
                    <ChatRow key={s.session_id} session={s} agents={agents} lang={lang} t={t} />
                  ))}
                </section>
              ) : null}
              {groupChats.length > 0 ? (
                <section>
                  <div className="wx-section-head">{t("section.group_chats")}</div>
                  {groupChats.map((s) => (
                    <ChatRow key={s.session_id} session={s} agents={agents} lang={lang} t={t} />
                  ))}
                </section>
              ) : null}
            </>
          )}
        </div>
      </aside>
      <main className="wx-detail">
        <Outlet />
      </main>

      <CreateGroupModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={createGroup}
      />
    </>
  );
}

function ChatRow({
  session,
  agents,
  lang,
  t,
}: {
  session: SessionSummary;
  agents: ReturnType<typeof useAppState>["agents"];
  lang: "zh" | "en";
  t: ReturnType<typeof useT>;
}) {
  const title = sessionTitle(session, agents) || t("chat.new_chat");
  const subtitle =
    session.round_index > 0
      ? t("chat.round_n", { n: session.round_index })
      : t("chat.no_messages");
  const avatarSeed = session.kind === "direct" && session.direct_handle
    ? session.direct_handle
    : `group:${session.session_id}`;
  return (
    <NavLink
      to={`/chats/${session.session_id}`}
      className={({ isActive }) => `wx-list-row ${isActive ? "active" : ""}`}
    >
      <span className="wx-list-avatar">
        <img src={avatarUrl(avatarSeed)} alt="" />
      </span>
      <div className="wx-list-body">
        <div className="wx-list-row-top">
          <span className="wx-list-title">{title}</span>
          <span className="wx-list-time">{formatTime(session.updated_at, lang)}</span>
        </div>
        <div className="wx-list-snippet">
          {session.kind === "group" && session.member_count > 1 ? `${session.member_count} · ` : ""}
          {subtitle}
        </div>
      </div>
    </NavLink>
  );
}

function sessionTitle(
  s: SessionSummary,
  agents: ReturnType<typeof useAppState>["agents"],
): string {
  if (s.kind === "direct" && s.direct_handle) {
    const agent = agents.find((a) => a.handle === s.direct_handle);
    return agent?.display_name || s.direct_handle;
  }
  return s.name || s.topic || "";
}

function formatTime(iso: string, lang: "zh" | "en"): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(now.getDate() - 1);
    const isYesterday =
      d.getFullYear() === oneDayAgo.getFullYear() &&
      d.getMonth() === oneDayAgo.getMonth() &&
      d.getDate() === oneDayAgo.getDate();
    if (isYesterday) return lang === "zh" ? "昨天" : "Yesterday";
    if (lang === "zh") return `${d.getMonth() + 1}月${d.getDate()}日`;
    return `${d.toLocaleString(undefined, { month: "short", day: "numeric" })}`;
  } catch {
    return "";
  }
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
