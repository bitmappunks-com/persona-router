import { useMemo, useState } from "react";
import { Avatar } from "./Avatar";
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
      {open ? <div className="drawer-scrim" onClick={onClose} aria-hidden="true" /> : null}
      <aside className={`drawer ${open ? "open" : ""}`} aria-label="群成员管理" aria-hidden={!open}>
        {selectedAgent ? (
          <PersonaDetail
            agent={selectedAgent}
            isInGroup={activeSet.has(selectedAgent.agent_id)}
            onBack={() => onSelectAgent(null)}
            onToggle={() => onToggle(selectedAgent)}
          />
        ) : (
          <div className="drawer-body">
            <header className="drawer-head">
              <h3>群成员</h3>
              <button type="button" className="drawer-close" onClick={onClose} aria-label="关闭">
                ×
              </button>
            </header>

            <section className="drawer-section">
              <div className="drawer-section-head">
                <span>当前在群 · {activeAgents.length}</span>
                {activeAgents.length > 0 ? (
                  <button type="button" className="drawer-clear" onClick={onClearAll}>
                    清空
                  </button>
                ) : null}
              </div>
              <div className="drawer-active-list">
                {activeAgents.length === 0 ? (
                  <p className="drawer-empty">还没拉人。下面搜索后点 + 拉进群。</p>
                ) : (
                  activeAgents.map((agent) => (
                    <div key={agent.agent_id} className="drawer-active-row">
                      <button
                        type="button"
                        className="drawer-active-main"
                        onClick={() => onSelectAgent(agent)}
                        title="查看资料"
                      >
                        <Avatar agent={agent} size="sm" />
                        <span>
                          <span className="drawer-name">{agent.display_name}</span>
                          <span className="drawer-handle">@{agent.handle}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="drawer-kick"
                        onClick={() => onToggle(agent)}
                        title="踢出群组"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="drawer-section">
              <div className="drawer-section-head">
                <span>可邀请 · {filteredCandidates.length}</span>
              </div>
              <input
                className="drawer-search"
                type="search"
                placeholder="搜索 @handle / 姓名 / 领域"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="drawer-candidate-list">
                {filteredCandidates.map((agent) => (
                  <div key={agent.agent_id} className="drawer-candidate-row">
                    <button
                      type="button"
                      className="drawer-candidate-main"
                      onClick={() => onSelectAgent(agent)}
                      title="查看资料"
                    >
                      <Avatar agent={agent} size="sm" />
                      <span>
                        <span className="drawer-name">{agent.display_name}</span>
                        <span className="drawer-handle">@{agent.handle}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="drawer-add"
                      onClick={() => onToggle(agent)}
                      title="拉进群"
                    >
                      +
                    </button>
                  </div>
                ))}
                {filteredCandidates.length === 0 ? (
                  <p className="drawer-empty">没有匹配的成员了。</p>
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
  const source = agent.source || {};
  const repo = source.source_repository || source.upstream_repository || "";
  const commit = source.source_commit || source.upstream_commit || "";
  const license = source.license_status || "license_unknown";
  return (
    <div className="drawer-body">
      <header className="drawer-head">
        <button type="button" className="drawer-back" onClick={onBack}>
          ‹ 返回
        </button>
        <h3>成员资料</h3>
      </header>

      <div className="persona-card-stage">
        <Avatar agent={agent} size="xl" />
        <div className="persona-card-name">{agent.display_name}</div>
        <div className="persona-card-handle">@{agent.handle}</div>
        <div className="persona-card-chips">
          <span className={`chip tone-${(agent.risk_level || "medium").toLowerCase()}`}>
            {agent.risk_level || "medium"} 风险
          </span>
          {(agent.domains || []).slice(0, 3).map((d) => (
            <span key={d} className="chip">
              {d}
            </span>
          ))}
        </div>
        {agent.stance ? <p className="persona-card-stance-quote">「{agent.stance}」</p> : null}
        <button
          type="button"
          className={`btn ${isInGroup ? "btn-ghost" : "btn-primary"}`}
          onClick={onToggle}
        >
          {isInGroup ? "踢出群组" : "拉进群组"}
        </button>
      </div>

      {(agent.runtime_boundaries || []).length > 0 ? (
        <section className="drawer-section">
          <div className="drawer-section-head">行为边界</div>
          <ul className="persona-boundaries">
            {agent.runtime_boundaries!.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="drawer-section">
        <div className="drawer-section-head">资料档案</div>
        <dl className="drawer-dossier">
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
      </section>
    </div>
  );
}
