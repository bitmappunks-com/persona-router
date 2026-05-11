import { Link, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { Avatar } from "../components/Avatar";
import { api } from "../api";
import { useAppState } from "../state";

export function PersonaPage() {
  const { handle = "" } = useParams();
  const { agents, ready } = useAppState();
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);

  const agent = agents.find((item) => item.handle === handle);

  if (!agent) {
    return (
      <section className="section container narrow">
        <div className="eyebrow accent">Directory</div>
        <h2 className="serif" style={{ fontSize: 36, marginTop: 8 }}>
          {ready ? "No such voice." : "Loading…"}
        </h2>
        {ready ? (
          <p style={{ marginTop: 12, color: "var(--muted)" }}>
            <Link to="/personas" className="btn-link">
              ← Back to the directory
            </Link>
          </p>
        ) : null}
      </section>
    );
  }

  const summon = async () => {
    setOpening(true);
    try {
      const { session } = await api.createSession();
      await api.setActive(session.session_id, [agent.handle]);
      navigate(`/session/${session.session_id}`);
    } catch (error) {
      setOpening(false);
    }
  };

  const source = agent.source || {};
  const repo = source.source_repository || source.upstream_repository || "";
  const commit = source.source_commit || source.upstream_commit || "";
  const license = source.license_status || "license_unknown";
  const importedOn = source.imported_on || "";

  return (
    <section className="section container">
      <div className="eyebrow accent" style={{ marginBottom: 6 }}>
        <Link to="/personas" className="btn-link" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
          ← Directory
        </Link>
      </div>

      <div className="persona-detail">
        <div>
          <header className="persona-detail-head">
            <Avatar agent={agent} size="xl" />
            <div>
              <h1 className="persona-detail-name">{agent.display_name}</h1>
              <div className="persona-detail-handle">
                <span>@{agent.handle}</span>
                <span className={`chip tone-${(agent.risk_level || "medium").toLowerCase()}`}>
                  {agent.risk_level || "medium"} risk
                </span>
              </div>
            </div>
          </header>

          {agent.stance ? <p className="persona-stance">"{agent.stance}"</p> : null}

          {(agent.domains || []).length > 0 ? (
            <div className="persona-block">
              <h3>Domains</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {agent.domains.map((d) => (
                  <span key={d} className="chip accent">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {(agent.runtime_boundaries || []).length > 0 ? (
            <div className="persona-block">
              <h3>Boundaries</h3>
              <ul>
                {agent.runtime_boundaries!.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="persona-block">
            <button className="btn btn-primary" onClick={summon} disabled={opening}>
              {opening ? "Opening session…" : `Open a session with @${agent.handle} →`}
            </button>
          </div>
        </div>

        <aside className="dossier-side">
          <h3>Dossier</h3>
          <div className="dossier-grid">
            <div className="dossier-row">
              <dt>License</dt>
              <dd>{license}</dd>
            </div>
            <div className="dossier-row">
              <dt>Source</dt>
              <dd>
                {repo ? (
                  <a href={repo} target="_blank" rel="noreferrer">
                    {repo.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <em>not provided</em>
                )}
              </dd>
            </div>
            <div className="dossier-row">
              <dt>Commit</dt>
              <dd>
                {commit ? (
                  <code className="mono" style={{ fontSize: 12 }}>
                    {commit.slice(0, 12)}
                  </code>
                ) : (
                  <em>—</em>
                )}
              </dd>
            </div>
            <div className="dossier-row">
              <dt>Imported</dt>
              <dd>{importedOn || <em>—</em>}</dd>
            </div>
            <div className="dossier-row">
              <dt>Category</dt>
              <dd>{source.upstream_category || source.source_category || <em>—</em>}</dd>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
