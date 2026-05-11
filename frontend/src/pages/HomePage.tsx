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

  const startSession = async () => {
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
          <span>The council</span>
          <span className="sep" />
          <span>persona router</span>
        </div>
        <h1>
          Convene a <em>council</em> of voices, set a subject, watch them argue it out.
        </h1>
        <p>
          {agents.length || "Dozens of"} personas — Feynman, Jobs, Buffett, Marx, Mao, MrBeast and more — packaged with sources, licenses, and behavioural boundaries.
          Pick a few, give them a topic, run the round.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={startSession} disabled={starting}>
            {starting ? "Opening session…" : "Open a session →"}
          </button>
          <Link to="/personas" className="btn btn-ghost">
            Browse the directory
          </Link>
        </div>
      </section>

      <section className="section tight container">
        <div className="feature-grid">
          <div className="feature">
            <div className="feature-icon">§</div>
            <h3>Persona-backed</h3>
            <p>Each voice ships with source, license, evidence and behavioural boundaries — not just a prompt.</p>
          </div>
          <div className="feature">
            <div className="feature-icon">¶</div>
            <h3>Multi-voice rounds</h3>
            <p>Summon several personas at once with <span className="mono">@handle</span>, then run rounds where each speaks in turn.</p>
          </div>
          <div className="feature">
            <div className="feature-icon">★</div>
            <h3>Provider-agnostic</h3>
            <p>OpenAI-compatible LLM executor. {health?.llm.enabled ? `Currently routing through ${health.llm.provider}.` : "Set DEEPSEEK_API_KEY (or OPENAI_API_KEY) to go live."}</p>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="section-head">
          <div>
            <div className="eyebrow accent">Featured voices</div>
            <h2>Six of the {agents.length} on call tonight.</h2>
          </div>
          <Link to="/personas" className="btn-link">
            See all {agents.length} →
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
                    ? `Speaks on ${agent.domains.slice(0, 3).join(" · ")}.`
                    : "A voice in the directory.")}
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
        <span>multi-voice console · {agents.length} personas loaded</span>
      </footer>
    </>
  );
}
