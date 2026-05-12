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

export type StreamEvent =
  | { event: "round_start"; round_index: number; topic: string }
  | { event: "turn_start"; agent_id: string; handle: string; display_name: string; trigger: string }
  | { event: "token"; agent_id: string; delta: string }
  | { event: "turn_end"; round_index: number; agent_id: string; handle: string; trigger: string; content: string; metadata: Record<string, unknown> }
  | { event: "round_end"; round_index: number; needs_verification: boolean; boundary_downgraded: boolean; turns: Array<Record<string, unknown>> }
  | { event: "session"; session: SessionData }
  | { event: "error"; detail: string };

async function* streamSSE(path: string, init: RequestInit): AsyncGenerator<StreamEvent, void, void> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    ...init,
  });
  if (!response.ok || !response.body) {
    let detail = response.statusText;
    try {
      const payload = await response.json();
      if (payload && typeof payload === "object" && "detail" in payload) {
        detail = String((payload as { detail: unknown }).detail);
      }
    } catch {
      // body wasn't JSON; keep statusText
    }
    throw new Error(detail);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const dataLine = rawEvent
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (dataLine) {
        const json = dataLine.slice(6);
        try {
          yield JSON.parse(json) as StreamEvent;
        } catch {
          // skip malformed chunk
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
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
  streamRound: (sessionId: string, text: string) =>
    streamSSE(`/sessions/${sessionId}/round/stream`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  streamNext: (sessionId: string) =>
    streamSSE(`/sessions/${sessionId}/next/stream`, { method: "POST" }),
};
