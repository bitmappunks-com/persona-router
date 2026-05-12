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
        <div className="eyebrow accent">成员名录</div>
        <h2 className="serif" style={{ fontSize: 36, marginTop: 8 }}>
          {ready ? "查无此人。" : "加载中…"}
        </h2>
        {ready ? (
          <p style={{ marginTop: 12, color: "var(--muted)" }}>
            <Link to="/personas" className="btn-link">
              ← 返回名录
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
          ← 名录
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
              <h3>擅长领域</h3>
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
              <h3>行为边界</h3>
              <ul>
                {agent.runtime_boundaries!.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="persona-block">
            <button className="btn btn-primary" onClick={summon} disabled={opening}>
              {opening ? "正在拉进群…" : `拉 @${agent.handle} 进群 →`}
            </button>
          </div>
        </div>

        <aside className="dossier-side">
          <h3>资料档案</h3>
          <div className="dossier-grid">
            <div className="dossier-row">
              <dt>许可证</dt>
              <dd>{license}</dd>
            </div>
            <div className="dossier-row">
              <dt>来源</dt>
              <dd>
                {repo ? (
                  <a href={repo} target="_blank" rel="noreferrer">
                    {repo.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <em>未提供</em>
                )}
              </dd>
            </div>
            <div className="dossier-row">
              <dt>提交</dt>
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
              <dt>导入日期</dt>
              <dd>{importedOn || <em>—</em>}</dd>
            </div>
            <div className="dossier-row">
              <dt>分类</dt>
              <dd>{source.upstream_category || source.source_category || <em>—</em>}</dd>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
