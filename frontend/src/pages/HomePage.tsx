import { Link, useNavigate } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { useAppState } from "../state";
import { api } from "../api";
import { useState } from "react";

export function HomePage() {
  const { agents, health } = useAppState();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const featured = agents.slice(0, 6);

  const startGroup = async () => {
    setStarting(true);
    try {
      const { session } = await api.createSession();
      navigate(`/session/${session.session_id}`);
    } catch (error) {
      setStarting(false);
    }
  };

  return (
    <>
      <section className="hero container">
        <div className="hero-eyebrow">
          <span>Persona Router</span>
          <span className="sep" />
          <span>群聊式多人格</span>
        </div>
        <h1>
          建一个 <em>群</em>，把想听的人拉进来，一起聊。
        </h1>
        <p>
          {agents.length || "几十"} 个人格成员 —— Feynman、Jobs、Buffett、Marx、MrBeast 等等 —— 每个都带源、许可证、行为边界。
          新建群组、添加成员、发条消息，看大家怎么回。
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={startGroup} disabled={starting}>
            {starting ? "正在新建群组…" : "新建群组 →"}
          </button>
          <Link to="/personas" className="btn btn-ghost">
            浏览成员名录
          </Link>
        </div>
      </section>

      <section className="section tight container">
        <div className="feature-grid">
          <div className="feature">
            <div className="feature-icon">§</div>
            <h3>有据可查</h3>
            <p>每个成员都打包了原始资料、许可证、证据和行为边界，不只是一句 prompt。</p>
          </div>
          <div className="feature">
            <div className="feature-icon">¶</div>
            <h3>群聊式对话</h3>
            <p>用 <span className="mono">@handle</span> 把多人拉进群，发一条消息，他们按顺序在群里回。</p>
          </div>
          <div className="feature">
            <div className="feature-icon">★</div>
            <h3>多模型可换</h3>
            <p>OpenAI 兼容协议接口。{health?.llm.enabled ? `当前接的是 ${health.llm.provider}。` : "在 .env 设 DEEPSEEK_API_KEY 或 OPENAI_API_KEY 即可上线。"}</p>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="section-head">
          <div>
            <div className="eyebrow accent">推荐成员</div>
            <h2>{agents.length} 位待邀，先看 6 个。</h2>
          </div>
          <Link to="/personas" className="btn-link">
            查看全部 {agents.length} →
          </Link>
        </div>
        <div className="persona-grid">
          {featured.map((agent) => (
            <Link
              key={agent.agent_id}
              to={`/personas/${agent.handle}`}
              className="persona-card fade-in"
            >
              <div className="persona-card-top">
                <Avatar agent={agent} size="lg" />
                <div>
                  <div className="persona-card-name">{agent.display_name}</div>
                  <div className="persona-card-handle">@{agent.handle}</div>
                </div>
              </div>
              <div className="persona-card-stance">
                {agent.stance ||
                  (agent.domains && agent.domains.length > 0
                    ? `擅长：${agent.domains.slice(0, 3).join(" · ")}`
                    : "名录中的一位成员。")}
              </div>
              <div className="persona-card-meta">
                {(agent.domains || []).slice(0, 3).map((d) => (
                  <span key={d} className="chip">
                    {d}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="footer container">
        <span className="brand-name serif">Persona Router</span>
        <span>群聊式多人格 · {agents.length} 名成员可拉</span>
      </footer>
    </>
  );
}
