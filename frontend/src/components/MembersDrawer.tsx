import { useMemo, useState } from "react";
import { Avatar } from "./Avatar";
import { useT } from "../i18n";
import type { Agent } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  allAgents: Agent[];
  active: string[];
  onToggle: (agent: Agent) => void;
  onClearAll: () => void;
  selectedAgent: Agent | null;
  onSelectAgent: (agent: Agent | null) => void;
}

export function MembersDrawer({
  open,
  onClose,
  allAgents,
  active,
  onToggle,
  onClearAll,
  selectedAgent,
  onSelectAgent,
}: Props) {
  const t = useT();
  const [query, setQuery] = useState("");

  const activeSet = useMemo(() => new Set(active), [active]);
  const activeAgents = useMemo(
    () => allAgents.filter((a) => activeSet.has(a.agent_id)),
    [activeSet, allAgents],
  );

  const filteredCandidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allAgents.filter((agent) => {
      if (activeSet.has(agent.agent_id)) return false;
      if (!q) return true;
      const haystack = `${agent.handle} ${agent.display_name} ${(agent.domains || []).join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [activeSet, allAgents, query]);

  return (
    <>
      {open ? <div className="wx-drawer-scrim" onClick={onClose} aria-hidden="true" /> : null}
      <aside className={`wx-drawer ${open ? "open" : ""}`} aria-label="群成员管理" aria-hidden={!open}>
        {selectedAgent ? (
          <PersonaDetail
            agent={selectedAgent}
            isInGroup={activeSet.has(selectedAgent.agent_id)}
            onBack={() => onSelectAgent(null)}
            onToggle={() => onToggle(selectedAgent)}
          />
        ) : (
          <div className="wx-drawer-body">
            <header className="wx-drawer-head">
              <h3>{t("drawer.title")}</h3>
              <button type="button" className="wx-drawer-close" onClick={onClose} aria-label={t("drawer.close")}>
                ×
              </button>
            </header>

            <section className="wx-drawer-section">
              <div className="wx-drawer-section-head">
                <span>{t("drawer.current_in_group", { count: activeAgents.length })}</span>
                {activeAgents.length > 0 ? (
                  <button type="button" className="wx-drawer-clear" onClick={onClearAll}>
                    {t("drawer.clear_all")}
                  </button>
                ) : null}
              </div>
              <div className="wx-drawer-list">
                {activeAgents.length === 0 ? (
                  <p className="wx-drawer-empty">{t("drawer.empty_active")}</p>
                ) : (
                  activeAgents.map((agent) => (
                    <div key={agent.agent_id} className="wx-drawer-row">
                      <button
                        type="button"
                        className="wx-drawer-main"
                        onClick={() => onSelectAgent(agent)}
                      >
                        <Avatar agent={agent} size="sm" />
                        <span>
                          <span className="wx-drawer-name">{agent.display_name}</span>
                          <span className="wx-drawer-handle">@{agent.handle}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="wx-drawer-iconbtn wx-drawer-kick"
                        onClick={() => onToggle(agent)}
                        title={t("drawer.kick")}
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="wx-drawer-section">
              <div className="wx-drawer-section-head">
                <span>{t("drawer.invitable", { count: filteredCandidates.length })}</span>
              </div>
              <input
                className="wx-drawer-search"
                type="search"
                placeholder={t("drawer.search_placeholder")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="wx-drawer-list">
                {filteredCandidates.map((agent) => (
                  <div key={agent.agent_id} className="wx-drawer-row">
                    <button
                      type="button"
                      className="wx-drawer-main"
                      onClick={() => onSelectAgent(agent)}
                    >
                      <Avatar agent={agent} size="sm" />
                      <span>
                        <span className="wx-drawer-name">{agent.display_name}</span>
                        <span className="wx-drawer-handle">@{agent.handle}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="wx-drawer-iconbtn wx-drawer-add"
                      onClick={() => onToggle(agent)}
                      title={t("drawer.invite")}
                    >
                      +
                    </button>
                  </div>
                ))}
                {filteredCandidates.length === 0 ? (
                  <p className="wx-drawer-empty">{t("drawer.empty_candidates")}</p>
                ) : null}
              </div>
            </section>
          </div>
        )}
      </aside>
    </>
  );
}

function PersonaDetail({
  agent,
  isInGroup,
  onBack,
  onToggle,
}: {
  agent: Agent;
  isInGroup: boolean;
  onBack: () => void;
  onToggle: () => void;
}) {
  const t = useT();
  const source = agent.source || {};
  const repo = source.source_repository || source.upstream_repository || "";
  const commit = source.source_commit || source.upstream_commit || "";
  const license = source.license_status || "license_unknown";
  const riskKey = `contact.risk_${(agent.risk_level || "medium").toLowerCase()}`;
  return (
    <div className="wx-drawer-body">
      <header className="wx-drawer-head">
        <button type="button" className="wx-drawer-back" onClick={onBack}>
          {t("drawer.back")}
        </button>
        <h3>{t("drawer.profile_title")}</h3>
      </header>

      <div className="wx-drawer-profile">
        <Avatar agent={agent} size="xl" />
        <div className="wx-profile-name">{agent.display_name}</div>
        <div className="wx-profile-handle">@{agent.handle}</div>
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
        {agent.stance ? <p className="wx-profile-stance">「{agent.stance}」</p> : null}
        <button
          type="button"
          className={`wx-btn ${isInGroup ? "" : "primary"}`}
          onClick={onToggle}
        >
          {isInGroup ? t("drawer.kick") : t("drawer.invite")}
        </button>
      </div>

      {(agent.runtime_boundaries || []).length > 0 ? (
        <section className="wx-drawer-section">
          <div className="wx-profile-label">{t("contact.boundaries")}</div>
          <ul className="wx-profile-boundaries">
            {agent.runtime_boundaries!.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="wx-drawer-section">
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
      </section>
    </div>
  );
}
