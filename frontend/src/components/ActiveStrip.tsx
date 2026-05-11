import type { Agent } from "../types";

interface Props {
  activeAgents: Agent[];
  onRemove: (agentId: string) => void;
  onClear: () => void;
}

export function ActiveStrip({ activeAgents, onRemove, onClear }: Props) {
  return (
    <section className="active-strip" aria-label="Active agents">
      <div>
        <span className="strip-label">Active</span>
        <div className="chips">
          {activeAgents.map((agent) => (
            <button
              key={agent.agent_id}
              type="button"
              className="chip"
              title={`Deactivate @${agent.handle}`}
              onClick={() => onRemove(agent.agent_id)}
            >
              @{agent.handle} ×
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="secondary-button"
        disabled={activeAgents.length === 0}
        onClick={onClear}
      >
        Clear
      </button>
    </section>
  );
}
