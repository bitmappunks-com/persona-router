import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { api, type SessionSummary } from "../api";
import { avatarUrl } from "../components/Avatar";

export function ChatsTab() {
  const navigate = useNavigate();
  const params = useParams();
  const currentId = params.id;

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

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
    return sessions.filter((s) =>
      (s.topic || "").toLowerCase().includes(q) || s.session_id.toLowerCase().includes(q),
    );
  }, [sessions, query]);

  const createGroup = useCallback(async () => {
    setCreating(true);
    try {
      const { session } = await api.createSession();
      await reload();
      navigate(`/chats/${session.session_id}`);
    } finally {
      setCreating(false);
    }
  }, [navigate, reload]);

  return (
    <>
      <aside className="wx-list" aria-label="聊天列表">
        <header className="wx-list-head">
          <div className="wx-search">
            <input
              type="search"
              placeholder="搜索"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="wx-list-add"
            onClick={createGroup}
            disabled={creating}
            title="发起聊天"
            aria-label="发起聊天"
          >
            +
          </button>
        </header>
        <div className="wx-list-scroll">
          {filtered.length === 0 ? (
            <div className="wx-list-empty">
              <p>还没有聊天</p>
              <button type="button" className="wx-text-link" onClick={createGroup} disabled={creating}>
                发起新聊天
              </button>
            </div>
          ) : (
            filtered.map((s) => (
              <NavLink
                key={s.session_id}
                to={`/chats/${s.session_id}`}
                className={({ isActive }) => `wx-list-row ${isActive ? "active" : ""}`}
              >
                <span className="wx-list-avatar">
                  <img src={avatarUrl(`group:${s.session_id}`)} alt="" />
                </span>
                <div className="wx-list-body">
                  <div className="wx-list-row-top">
                    <span className="wx-list-title">{s.topic || "新聊天"}</span>
                    <span className="wx-list-time">{formatTime(s.updated_at)}</span>
                  </div>
                  <div className="wx-list-snippet">
                    {s.member_count > 1 ? `${s.member_count} 人 · ` : ""}
                    {s.round_index > 0 ? `第 ${s.round_index} 轮` : "尚无消息"}
                  </div>
                </div>
              </NavLink>
            ))
          )}
        </div>
      </aside>
      <main className="wx-detail">
        <Outlet />
      </main>
    </>
  );
}

function formatTime(iso: string): string {
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
    if (isYesterday) return "昨天";
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  } catch {
    return "";
  }
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
