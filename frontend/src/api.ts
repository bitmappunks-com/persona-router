import type {
  Agent,
  HealthInfo,
  RoundResponse,
  SessionData,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : response.statusText;
    throw new Error(detail);
  }
  return payload as T;
}

export const api = {
  health: () => request<HealthInfo>("/health"),
  listAgents: () => request<Agent[]>("/agents"),
  createSession: () =>
    request<{ session: SessionData }>("/sessions", { method: "POST" }),
  getSession: (sessionId: string) =>
    request<SessionData>(`/sessions/${sessionId}`),
  setActive: (sessionId: string, handles: string[]) =>
    request<SessionData>(`/sessions/${sessionId}/active`, {
      method: "POST",
      body: JSON.stringify({ handles }),
    }),
  runRound: (sessionId: string, text: string) =>
    request<RoundResponse>(`/sessions/${sessionId}/round`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  nextRound: (sessionId: string) =>
    request<RoundResponse>(`/sessions/${sessionId}/next`, { method: "POST" }),
};
