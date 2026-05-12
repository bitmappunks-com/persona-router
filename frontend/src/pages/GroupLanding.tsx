import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export function GroupLanding() {
  const navigate = useNavigate();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    (async () => {
      try {
        const list = await api.listSessions();
        if (list.length > 0) {
          navigate(`/g/${list[0].session_id}`, { replace: true });
          return;
        }
        const { session } = await api.createSession();
        navigate(`/g/${session.session_id}`, { replace: true });
      } catch {
        // stay on landing showing error
      }
    })();
  }, [navigate]);

  return (
    <section className="landing-empty">
      <div className="landing-pulse" aria-hidden="true" />
      <h2>正在打开群聊…</h2>
      <p>第一次来会自动建一个空群。</p>
    </section>
  );
}
