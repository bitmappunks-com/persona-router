import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { api, type SessionSummary } from "../api";
import { avatarUrl } from "../components/Avatar";
import { CreateGroupModal } from "../components/CreateGroupModal";
import { useAppState } from "../state";
import { useT, useI18n } from "../i18n";
import type { Agent } from "../types";

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
  const [showArchived, setShowArchived] = useState(false);

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
    if (!q) return sessions;
    return sessions.filter((s) => {
      const title = sessionTitle(s, agents).toLowerCase();
      return (
        title.includes(q) ||
        (s.topic || "").toLowerCase().includes(q) ||
        s.session_id.toLowerCase().includes(q) ||
        (s.last_snippet || "").toLowerCase().includes(q)
      );
    });
  }, [sessions, query, agents]);

  const active = useMemo(() => filtered.filter((s) => !s.archived), [filtered]);
  const archived = useMemo(() => filtered.filter((s) => s.archived), [filtered]);

  const directChats = useMemo(
    () => active.filter((s) => s.kind === "direct").sort(byLastActiveDesc),
    [active],
  );
  const groupChats = useMemo(
    () => active.filter((s) => s.kind !== "direct").sort(byLastActiveDesc),
    [active],
  );
  const archivedSorted = useMemo(() => [...archived].sort(byLastActiveDesc), [archived]);

  const createGroup = useCallback(
    async (handles: string[], name: string | null) => {
      const { session } = await api.createSession({ kind: "group", name, handles });
      await reload();
      setModalOpen(false);
      navigate(`/chats/${session.session_id}`);
    },
    [navigate, reload],
  );

  const setArchived = useCallback(
    async (session_id: string, value: boolean) => {
      try {
        await api.patchSession(session_id, { archived: value });
        await reload();
        if (value && params.id === session_id) {
          navigate("/chats", { replace: true });
        }
      } catch {
        /* ignore */
      }
    },
    [navigate, params.id, reload],
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
            title={t("list.new_group")}
            aria-label={t("list.new_group")}
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
                <section className="wx-section">
                  <div className="wx-section-head">{t("section.direct_chats")} · {directChats.length}</div>
                  {directChats.map((s) => (
                    <ChatRow
                      key={s.session_id}
                      session={s}
                      agents={agents}
                      lang={lang}
                      t={t}
                      onArchive={() => void setArchived(s.session_id, true)}
                    />
                  ))}
                </section>
              ) : null}
              {groupChats.length > 0 ? (
                <section className="wx-section">
                  <div className="wx-section-head">{t("section.group_chats")} · {groupChats.length}</div>
                  {groupChats.map((s) => (
                    <ChatRow
                      key={s.session_id}
                      session={s}
                      agents={agents}
                      lang={lang}
                      t={t}
                      onArchive={() => void setArchived(s.session_id, true)}
                    />
                  ))}
                </section>
              ) : null}
              {archivedSorted.length > 0 ? (
                <section className="wx-section archived">
                  <button
                    type="button"
                    className="wx-archive-toggle"
                    onClick={() => setShowArchived((v) => !v)}
                  >
                    <span className="chevron">{showArchived ? "▾" : "▸"}</span>
                    <span>
                      {showArchived
                        ? t("list.archived_hide")
                        : t("list.archived_show", { count: archivedSorted.length })}
                    </span>
                  </button>
                  {showArchived
                    ? archivedSorted.map((s) => (
                        <ChatRow
                          key={s.session_id}
                          session={s}
                          agents={agents}
                          lang={lang}
                          t={t}
                          onArchive={() => void setArchived(s.session_id, false)}
                          archived
                        />
                      ))
                    : null}
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
  onArchive,
  archived = false,
}: {
  session: SessionSummary;
  agents: Agent[];
  lang: "zh" | "en";
  t: ReturnType<typeof useT>;
  onArchive: () => void;
  archived?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const title = sessionTitle(session, agents) || t("chat.new_chat");
  const subtitle = session.last_snippet
    ? session.last_snippet
    : session.round_index > 0
    ? t("chat.round_n", { n: session.round_index })
    : t("list.no_messages");
  const avatarSeed = session.kind === "direct" && session.direct_handle
    ? session.direct_handle
    : `group:${session.session_id}`;
  return (
    <div className="wx-row-wrap" ref={menuRef}>
      <NavLink
        to={`/chats/${session.session_id}`}
        className={({ isActive }) =>
          `wx-list-row ${isActive ? "active" : ""} ${archived ? "archived" : ""}`
        }
      >
        <span className="wx-list-avatar">
          <img src={avatarUrl(avatarSeed)} alt="" />
        </span>
        <div className="wx-list-body">
          <div className="wx-list-row-top">
            <span className="wx-list-title">{title}</span>
            <span className="wx-list-time">{formatTime(session.last_active_at, lang)}</span>
          </div>
          <div className="wx-list-snippet">
            {session.kind === "group" && session.member_count > 1 ? `${session.member_count} · ` : ""}
            {subtitle}
          </div>
        </div>
      </NavLink>
      <button
        type="button"
        className="wx-row-menu-btn"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
        title={t("row.more")}
        aria-label={t("row.more")}
      >
        ⋯
      </button>
      {menuOpen ? (
        <div className="wx-row-menu">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onArchive();
            }}
          >
            {archived ? t("row.unarchive") : t("row.archive")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function sessionTitle(s: SessionSummary, agents: Agent[]): string {
  if (s.kind === "direct" && s.direct_handle) {
    const agent = agents.find((a) => a.handle === s.direct_handle);
    return agent?.display_name || s.direct_handle;
  }
  return s.name || s.topic || "";
}

function byLastActiveDesc(a: SessionSummary, b: SessionSummary): number {
  return b.last_active_at.localeCompare(a.last_active_at);
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
    return d.toLocaleString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
