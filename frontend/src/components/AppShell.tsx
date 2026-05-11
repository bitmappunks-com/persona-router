import { NavLink, Outlet } from "react-router-dom";
import { avatarUrl } from "./Avatar";
import { useAppState } from "../state";

export function AppShell() {
  const { health } = useAppState();
  const llm = health?.llm;
  return (
    <div className="app">
      <header className="appbar">
        <NavLink to="/" className="brand">
          <span className="brand-mark">
            <img src={avatarUrl("persona_router")} alt="" />
          </span>
          <span className="brand-name">Persona Router</span>
        </NavLink>
        <nav className="nav">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/personas">Directory</NavLink>
          <NavLink to="/session">Council</NavLink>
        </nav>
        <div className="appbar-right">
          <span className={`status-pill ${llm?.enabled ? "live" : ""}`}>
            <span className="dot" />
            {llm?.enabled ? `${llm.provider ?? "llm"} · ${llm.model}` : "mock"}
          </span>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
