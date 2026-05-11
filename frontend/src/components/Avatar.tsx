import type { Agent } from "../types";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

interface Props {
  agent: Agent;
  size?: Size;
}

export function avatarUrl(seed: string): string {
  return `https://bmp.blockinsight.top/?t=${encodeURIComponent(seed)}`;
}

export function Avatar({ agent, size = "md" }: Props) {
  const seed = agent.handle || agent.agent_id || "unknown";
  return (
    <span className={`avatar size-${size}`} aria-hidden="true">
      <img src={avatarUrl(seed)} alt="" loading="lazy" />
    </span>
  );
}
