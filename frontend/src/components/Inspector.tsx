import type { Agent } from "../types";

interface Props {
  agent: Agent | null;
}

export function Inspector({ agent }: Props) {
  if (!agent) {
    return (
      <aside className="inspector" aria-label="Source inspector">
        <div className="panel-head">
          <h2>Source</h2>
          <span>none</span>
        </div>
        <div className="source-card">
          <p>Select an agent to inspect source, license, risk, and boundaries.</p>
        </div>
      </aside>
    );
  }

  const source = agent.source || {};
  const repo = source.source_repository || source.upstream_repository || "";
  const commit = source.source_commit || source.upstream_commit || "not provided";
  const license = source.license_status || "license_unknown";
  const domains = (agent.domains || []).join(", ") || "none";
  const boundaries = (agent.runtime_boundaries || []).slice(0, 2).join(" ");

  return (
    <aside className="inspector" aria-label="Source inspector">
      <div className="panel-head">
        <h2>Source</h2>
        <span>{agent.risk_level || "medium"}</span>
      </div>
      <div className="source-card">
        <dl>
          <dt>Agent</dt>
          <dd>
            {agent.display_name} <span className="handle">@{agent.handle}</span>
          </dd>
          <dt>License</dt>
          <dd>{license}</dd>
          <dt>Repository</dt>
          <dd>
            {repo ? (
              <a href={repo} target="_blank" rel="noreferrer">
                {repo}
              </a>
            ) : (
              "not provided"
            )}
          </dd>
          <dt>Commit</dt>
          <dd>{commit}</dd>
          <dt>Domains</dt>
          <dd>{domains}</dd>
          <dt>Boundaries</dt>
          <dd>{boundaries}</dd>
        </dl>
      </div>
    </aside>
  );
}
