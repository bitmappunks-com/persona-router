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
          <div className="eyebrow accent">成员名录</div>
          <h2>{agents.length} 位待邀成员。</h2>
        </div>
        <div className="eyebrow muted">命中 {filtered.length} 位</div>
      </div>

      <div className="directory-toolbar">
        <input
          className="search-input"
          type="search"
          placeholder="按姓名、handle、领域搜索"
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
              {option === "all" ? "全部" : option === "low" ? "低风险" : option === "medium" ? "中风险" : "高风险"}
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
                  ? `擅长：${agent.domains.slice(0, 3).join(" · ")}`
                  : "名录中的一位成员。")}
            </div>
            <div className="persona-card-meta">
              <span className={`chip tone-${(agent.risk_level || "medium").toLowerCase()}`}>
                {agent.risk_level || "medium"} 风险
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
