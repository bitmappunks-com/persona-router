import { NavLink, Outlet } from "react-router-dom";
import { avatarUrl } from "./Avatar";
import { useAppState } from "../state";
import { useI18n } from "../i18n";

export function AppShell() {
  const { health } = useAppState();
  const { lang, setLang, t } = useI18n();
  const llm = health?.llm;
  const nextLang = lang === "zh" ? "en" : "zh";
  return (
    <div className="wx-app">
      <aside className="wx-nav" aria-label={t("nav.brand")}>
        <NavLink to="/" className="wx-nav-brand" aria-label={t("nav.brand")}>
          <span className="wx-nav-avatar">
            <img src={avatarUrl("persona_router")} alt="" />
          </span>
        </NavLink>
        <NavLink
          to="/chats"
          className={({ isActive }) => `wx-nav-item ${isActive ? "active" : ""}`}
          title={t("nav.chats")}
        >
          <IconChats />
        </NavLink>
        <NavLink
          to="/contacts"
          className={({ isActive }) => `wx-nav-item ${isActive ? "active" : ""}`}
          title={t("nav.contacts")}
        >
          <IconContacts />
        </NavLink>
        <div className="wx-nav-spacer" />
        <button
          type="button"
          className="wx-nav-lang"
          onClick={() => setLang(nextLang)}
          title={t("lang.label")}
          aria-label={t("lang.label")}
        >
          {lang === "zh" ? "中" : "EN"}
        </button>
        <div className="wx-nav-status" title={llm?.enabled ? `${llm.provider} · ${llm.model}` : t("status.mock")}>
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
