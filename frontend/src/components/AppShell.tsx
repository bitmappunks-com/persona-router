import { NavLink, Outlet } from "react-router-dom";
import { avatarUrl } from "./Avatar";
import { useAppState } from "../state";

export function AppShell() {
  const { health } = useAppState();
  const llm = health?.llm;
  return (
    <div className="wx-app">
      <aside className="wx-nav" aria-label="主导航">
        <NavLink to="/" className="wx-nav-brand" aria-label="Persona Router">
          <span className="wx-nav-avatar">
            <img src={avatarUrl("persona_router")} alt="" />
          </span>
        </NavLink>
        <NavLink
          to="/chats"
          className={({ isActive }) => `wx-nav-item ${isActive ? "active" : ""}`}
          title="聊天"
        >
          <IconChats />
          <span className="wx-nav-label">聊天</span>
        </NavLink>
        <NavLink
          to="/contacts"
          className={({ isActive }) => `wx-nav-item ${isActive ? "active" : ""}`}
          title="通讯录"
        >
          <IconContacts />
          <span className="wx-nav-label">通讯录</span>
        </NavLink>
        <div className="wx-nav-spacer" />
        <div className="wx-nav-status" title={llm?.enabled ? `${llm.provider} · ${llm.model}` : "mock 模式"}>
          <span className={`wx-status-dot ${llm?.enabled ? "live" : "mock"}`} />
        </div>
      </aside>
      <Outlet />
    </div>
  );
}

function IconChats() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function IconContacts() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
