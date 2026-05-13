import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { Avatar } from "../components/Avatar";
import { useAppState } from "../state";
import { useT } from "../i18n";

export function ContactDetail() {
  const { handle = "" } = useParams();
  const { agents, ready } = useAppState();
  const navigate = useNavigate();
  const t = useT();
  const [opening, setOpening] = useState(false);

  const agent = agents.find((a) => a.handle === handle);

  if (!agent) {
    return (
      <section className="wx-detail-pane">
        <div className="wx-detail-body">
          <p className="wx-empty">{ready ? t("contact.not_found") : t("loading")}</p>
          <Link to="/contacts" className="wx-text-link">
            {t("contact.back")}
          </Link>
        </div>
      </section>
    );
  }

  const source = agent.source || {};
  const repo = source.source_repository || source.upstream_repository || "";
  const commit = source.source_commit || source.upstream_commit || "";
  const license = source.license_status || "license_unknown";

  const startDirect = async () => {
    setOpening(true);
    try {
      const { session } = await api.openDirect(agent.handle);
      navigate(`/chats/${session.session_id}`);
    } catch {
      setOpening(false);
    }
  };

  const riskKey = `contact.risk_${(agent.risk_level || "medium").toLowerCase()}`;

  return (
    <section className="wx-detail-pane">
      <header className="wx-detail-head">
        <span className="wx-detail-title">{t("contact.profile")}</span>
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
              {t(riskKey)}
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
            <div className="wx-profile-label">{t("contact.signature")}</div>
            <p className="wx-profile-stance">「{agent.stance}」</p>
          </div>
        ) : null}

        {(agent.runtime_boundaries || []).length > 0 ? (
          <div className="wx-profile-section">
            <div className="wx-profile-label">{t("contact.boundaries")}</div>
            <ul className="wx-profile-boundaries">
              {agent.runtime_boundaries!.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="wx-profile-section">
          <div className="wx-profile-label">{t("contact.dossier")}</div>
          <dl className="wx-profile-dossier">
            <div>
              <dt>{t("contact.license")}</dt>
              <dd>{license}</dd>
            </div>
            <div>
              <dt>{t("contact.source")}</dt>
              <dd>
                {repo ? (
                  <a href={repo} target="_blank" rel="noreferrer">
                    {repo.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <em>{t("contact.not_provided")}</em>
                )}
              </dd>
            </div>
            <div>
              <dt>{t("contact.commit")}</dt>
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
          <button type="button" className="wx-btn primary" onClick={startDirect} disabled={opening}>
            {opening ? t("contact.opening") : t("contact.send_message")}
          </button>
        </div>
      </div>
    </section>
  );
}
