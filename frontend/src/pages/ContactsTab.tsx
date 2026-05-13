import { useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { avatarUrl } from "../components/Avatar";
import { useAppState } from "../state";
import { useT } from "../i18n";
import type { Agent } from "../types";

export function ContactsTab() {
  const { agents } = useAppState();
  const t = useT();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((agent) => {
      const haystack = `${agent.handle} ${agent.display_name} ${(agent.domains || []).join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [agents, query]);

  const grouped = useMemo(() => groupByLetter(filtered), [filtered]);

  return (
    <>
      <aside className="wx-list" aria-label={t("nav.contacts")}>
        <header className="wx-list-head">
          <div className="wx-search">
            <input
              type="search"
              placeholder={t("list.search")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </header>
        <div className="wx-list-scroll">
          {grouped.length === 0 ? (
            <div className="wx-list-empty">
              <p>{t("list.empty_no_match")}</p>
            </div>
          ) : (
            grouped.map(({ letter, items }) => (
              <section key={letter} className="wx-contacts-section">
                <div className="wx-contacts-letter">{letter}</div>
                {items.map((agent) => (
                  <NavLink
                    key={agent.agent_id}
                    to={`/contacts/${agent.handle}`}
                    className={({ isActive }) => `wx-list-row contact ${isActive ? "active" : ""}`}
                  >
                    <span className="wx-list-avatar">
                      <img src={avatarUrl(agent.handle)} alt="" />
                    </span>
                    <div className="wx-list-body">
                      <span className="wx-list-title">{agent.display_name}</span>
                      <span className="wx-list-snippet">@{agent.handle}</span>
                    </div>
                  </NavLink>
                ))}
              </section>
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

function groupByLetter(agents: Agent[]): { letter: string; items: Agent[] }[] {
  const map = new Map<string, Agent[]>();
  for (const agent of agents) {
    const first = (agent.handle || agent.display_name || "?")[0];
    const letter = /[a-z]/i.test(first) ? first.toUpperCase() : "中";
    const bucket = map.get(letter) || [];
    bucket.push(agent);
    map.set(letter, bucket);
  }
  const sorted = [...map.entries()].sort((a, b) => {
    if (a[0] === "中") return 1;
    if (b[0] === "中") return -1;
    return a[0].localeCompare(b[0]);
  });
  return sorted.map(([letter, items]) => ({
    letter,
    items: items.sort((a, b) => a.display_name.localeCompare(b.display_name)),
  }));
}
