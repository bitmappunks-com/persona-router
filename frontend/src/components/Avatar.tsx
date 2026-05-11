import type { Agent } from "../types";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

interface Props {
  agent: Agent;
  size?: Size;
}

function glyph(agent: Agent): string {
  const source = (agent.display_name || agent.handle || "?").trim();
  if (!source) return "?";
  const first = source[0];
  return /[a-z]/i.test(first) ? first.toUpperCase() : first;
}

function tone(agent: Agent): "low" | "medium" | "high" {
  const r = (agent.risk_level || "medium").toLowerCase();
  if (r === "low") return "low";
  if (r === "high") return "high";
  return "medium";
}

export function Avatar({ agent, size = "md" }: Props) {
  return (
    <span className={`avatar size-${size} tone-${tone(agent)}`} aria-hidden="true">
      {glyph(agent)}
    </span>
  );
}
