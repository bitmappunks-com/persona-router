import { useEffect, useRef } from "react";
import type { Agent, RoundData, TurnData } from "../types";

interface Props {
  rounds: RoundData[];
  agents: Agent[];
  onSelectAgent: (agent: Agent) => void;
}

export function Transcript({ rounds, agents, onSelectAgent }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [rounds]);

  if (rounds.length === 0) {
    return (
      <section className="transcript" aria-live="polite">
        <div className="empty-state">
          <div className="empty-grid" aria-hidden="true" />
          <h3>Start with mentions or active agents.</h3>
          <p>Pick two or more people on the left, write a subject, then run a round.</p>
        </div>
      </section>
    );
  }

  return (
    <section ref={scrollerRef} className="transcript" aria-live="polite">
      {rounds.map((round) => (
        <section key={round.round_index} className="round">
          <div className="round-title">
            Round {round.round_index}
            {round.needs_verification ? " · needs verification" : ""}
          </div>
          {round.turns.map((turn) => (
            <TurnCard
              key={`${turn.round_index}-${turn.agent_id}-${turn.trigger}`}
              turn={turn}
              agent={agents.find((item) => item.agent_id === turn.agent_id)}
              onSelectAgent={onSelectAgent}
            />
          ))}
        </section>
      ))}
    </section>
  );
}

function TurnCard({
  turn,
  agent,
  onSelectAgent,
}: {
  turn: TurnData;
  agent?: Agent;
  onSelectAgent: (agent: Agent) => void;
}) {
  return (
    <article
      className="turn"
      onClick={() => {
        if (agent) onSelectAgent(agent);
      }}
    >
      <div className="turn-head">
        <h3>{agent?.display_name || turn.handle || turn.agent_id}</h3>
        <span className="badge">{turn.trigger}</span>
      </div>
      <p>{turn.content}</p>
    </article>
  );
}
