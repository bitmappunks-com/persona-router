import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { Avatar } from "../components/Avatar";
import { useAppState } from "../state";

export function ContactDetail() {
  const { handle = "" } = useParams();
  const { agents, ready } = useAppState();
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);

  const agent = agents.find((a) => a.handle === handle);

  if (!agent) {
    return (
      <section className="wx-detail-pane">
        <div className="wx-detail-body">
          <p className="wx-empty">{ready ? "查无此人" : "加载中…"}</p>
          <Link to="/contacts" className="wx-text-link">
            ← 返回通讯录
          </Link>
        </div>
      </section>
    );
  }

  const source = agent.source || {};
  const repo = source.source_repository || source.upstream_repository || "";
  const commit = source.source_commit || source.upstream_commit || "";
  const license = source.license_status || "license_unknown";

  const startSingleChat = async () => {
    setOpening(true);
    try {
      const { session } = await api.createSession();
      await api.setActive(session.session_id, [agent.handle]);
      navigate(`/chats/${session.session_id}`);
    } catch {
      setOpening(false);
    }
  };

  return (
    <section className="wx-detail-pane">
      <header className="wx-detail-head">
        <span className="wx-detail-title">个人资料</span>
      </header>
      <div className="wx-detail-body">
        <div className="wx-profile-card">
          <Avatar agent={agent} size="xl" />
          <div className="wx-profile-name-block">
            <div className="wx-profile-name">{agent.display_name}</div>
            <div className="wx-profile-handle">@{agent.handle}</div>
          </div>
          <div className="wx-profile-chips">
            <span className={`wx-chip tone-${(agent.risk_level || "medium").toLowerCase()}`}>
              {agent.risk_level || "medium"} 风险
            </span>
            {(agent.domains || []).slice(0, 3).map((d) => (
              <span key={d} className="wx-chip">
                {d}
              </span>
            ))}
          </div>
        </div>

        {agent.stance ? (
          <div className="wx-profile-section">
            <div className="wx-profile-label">个性签名</div>
            <p className="wx-profile-stance">「{agent.stance}」</p>
          </div>
        ) : null}

        {(agent.runtime_boundaries || []).length > 0 ? (
          <div className="wx-profile-section">
            <div className="wx-profile-label">行为边界</div>
            <ul className="wx-profile-boundaries">
              {agent.runtime_boundaries!.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="wx-profile-section">
          <div className="wx-profile-label">资料</div>
          <dl className="wx-profile-dossier">
            <div>
              <dt>许可证</dt>
              <dd>{license}</dd>
            </div>
            <div>
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
            <div>
              <dt>提交</dt>
              <dd>
                {commit ? (
                  <code className="mono">{commit.slice(0, 12)}</code>
                ) : (
                  <em>—</em>
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="wx-profile-actions">
          <button type="button" className="wx-btn primary" onClick={startSingleChat} disabled={opening}>
            {opening ? "正在创建…" : "发起单聊"}
          </button>
        </div>
      </div>
    </section>
  );
}
