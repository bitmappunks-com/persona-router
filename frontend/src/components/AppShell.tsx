import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { api, type SessionSummary } from "../api";
import { avatarUrl } from "./Avatar";
import { useAppState } from "../state";

export function AppShell() {
  const { health } = useAppState();
  const navigate = useNavigate();
  const params = useParams();
  const currentId = params.id;

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    try {
      const list = await api.listSessions();
      setSessions(list);
    } catch {
      // ignore — empty list is fine for empty repo
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, currentId]);

  const createGroup = useCallback(async () => {
    setCreating(true);
    try {
      const { session } = await api.createSession();
      await reload();
      navigate(`/g/${session.session_id}`);
    } catch {
      setCreating(false);
    } finally {
      setCreating(false);
    }
  }, [navigate, reload]);

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [sessions],
  );

  const llm = health?.llm;
  return (
    <div className="chat-app">
      <aside className="groups-rail" aria-label="群组列表">
        <header className="rail-header">
          <div className="rail-brand">
            <span className="brand-mark">
              <img src={avatarUrl("persona_router")} alt="" />
            </span>
            <div>
              <div className="rail-title">Persona</div>
              <div className="rail-sub">群聊</div>
            </div>
          </div>
          <button
            type="button"
            className="rail-add"
            onClick={createGroup}
            disabled={creating}
            title="新建群组"
            aria-label="新建群组"
          >
            +
          </button>
        </header>

        <div className="rail-status">
          <span className={`status-dot ${llm?.enabled ? "live" : "mock"}`} />
          <span className="status-label">
            {llm?.enabled ? `${llm.provider} · ${llm.model}` : "mock 模式"}
          </span>
        </div>

        <nav className="groups-list">
          {sorted.length === 0 ? (
            <button type="button" className="rail-empty" onClick={createGroup} disabled={creating}>
              <span>还没有群组</span>
              <span className="mono">点这里 +</span>
            </button>
          ) : (
            sorted.map((s) => (
              <NavLink
                key={s.session_id}
                to={`/g/${s.session_id}`}
                className={({ isActive }) => `group-row ${isActive ? "active" : ""}`}
              >
                <span className="group-row-mark">
                  <img src={avatarUrl(`group:${s.session_id}`)} alt="" />
                </span>
                <span className="group-row-body">
                  <span className="group-row-title">{s.topic || "新群组"}</span>
                  <span className="group-row-meta">
                    {s.member_count} 人 · 第 {s.round_index} 轮
                  </span>
                </span>
              </NavLink>
            ))
          )}
        </nav>
      </aside>

      <main className="chat-main">
        <Outlet />
      </main>
    </div>
  );
}
