import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export function SessionNewPage() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      try {
        const { session } = await api.createSession();
        navigate(`/session/${session.session_id}`, { replace: true });
      } catch (error) {
        navigate("/", { replace: true });
      }
    })();
  }, [navigate]);
  return (
    <section className="section container">
      <div className="eyebrow muted">Opening a fresh session…</div>
    </section>
  );
}
