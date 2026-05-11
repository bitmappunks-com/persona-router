import type { Agent } from "../types";

interface Props {
  agents: Agent[];
  active: string[];
  selectedId: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  onToggle: (agent: Agent) => void;
}

function Badge({ text, tone }: { text: string; tone?: string }) {
  return <span className={`badge ${tone ?? ""}`.trim()}>{text}</span>;
}

export function AgentList({
  agents,
  active,
  selectedId,
  query,
  onQueryChange,
  onToggle,
}: Props) {
  const filtered = agents.filter((agent) => {
    const haystack = `${agent.handle} ${agent.display_name} ${(agent.domains || []).join(" ")}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });
  return (
    <>
      <label className="search-box">
        <span>Find agent</span>
        <input
          type="search"
          placeholder="@feynman, jobs, investing"
          autoComplete="off"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      <div className="panel-head">
        <h2>Agents</h2>
        <span>{`${filtered.length}/${agents.length}`}</span>
      </div>
      <div className="agent-list" aria-live="polite">
        {filtered.map((agent) => {
          const isActive = active.includes(agent.agent_id);
          const isSelected = selectedId === agent.agent_id;
          const risk = agent.risk_level || "medium";
          const license = agent.source?.license_status || "license_unknown";
          return (
            <button
              key={agent.agent_id}
              type="button"
              className={[
                "agent-row",
                isActive ? "active" : "",
                isSelected ? "selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onToggle(agent)}
            >
              <span className="toggle-dot" aria-hidden="true" />
              <span>
                <span className="agent-title">
                  <strong>{agent.display_name}</strong>
                  <span className="handle">@{agent.handle}</span>
                </span>
                <span className="badges">
                  <Badge text={risk} tone={risk} />
                  <Badge text={license} />
                  {(agent.domains || []).slice(0, 2).map((domain) => (
                    <Badge key={domain} text={domain} />
                  ))}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
