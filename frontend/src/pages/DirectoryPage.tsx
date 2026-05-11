import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { useAppState } from "../state";

type RiskFilter = "all" | "low" | "medium" | "high";

export function DirectoryPage() {
  const { agents } = useAppState();
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState<RiskFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((agent) => {
      const haystack = `${agent.handle} ${agent.display_name} ${(agent.domains || []).join(" ")}`.toLowerCase();
      const matchesQuery = !q || haystack.includes(q);
      const matchesRisk = risk === "all" || (agent.risk_level || "medium") === risk;
      return matchesQuery && matchesRisk;
    });
  }, [agents, query, risk]);

  return (
    <section className="section container">
      <div className="section-head">
        <div>
          <div className="eyebrow accent">Directory</div>
          <h2>{agents.length} voices in the registry.</h2>
        </div>
        <div className="eyebrow muted">{filtered.length} matching</div>
      </div>

      <div className="directory-toolbar">
        <input
          className="search-input"
          type="search"
          placeholder="Search by name, handle, or domain"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="filter-group" role="tablist">
          {(["all", "low", "medium", "high"] as RiskFilter[]).map((option) => (
            <button
              key={option}
              type="button"
              className={risk === option ? "active" : ""}
              onClick={() => setRisk(option)}
            >
              {option === "all" ? "All risk" : `${option} risk`}
            </button>
          ))}
        </div>
      </div>

      <div className="persona-grid">
        {filtered.map((agent) => (
          <Link
            key={agent.agent_id}
            to={`/personas/${agent.handle}`}
            className="persona-card fade-in"
          >
            <div className="persona-card-top">
              <Avatar agent={agent} size="lg" />
              <div>
                <div className="persona-card-name">{agent.display_name}</div>
                <div className="persona-card-handle">@{agent.handle}</div>
              </div>
            </div>
            <div className="persona-card-stance">
              {agent.stance ||
                (agent.domains && agent.domains.length > 0
                  ? `Speaks on ${agent.domains.slice(0, 3).join(" · ")}.`
                  : "A voice in the directory.")}
            </div>
            <div className="persona-card-meta">
              <span className={`chip tone-${(agent.risk_level || "medium").toLowerCase()}`}>
                {agent.risk_level || "medium"} risk
              </span>
              {(agent.domains || []).slice(0, 2).map((d) => (
                <span key={d} className="chip">
                  {d}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
