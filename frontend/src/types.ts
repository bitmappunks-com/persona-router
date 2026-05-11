export interface Agent {
  agent_id: string;
  handle: string;
  display_name: string;
  domains: string[];
  risk_level?: string;
  source?: Record<string, string | undefined>;
  runtime_boundaries?: string[];
  dialogue?: Record<string, unknown>;
}

export interface SessionData {
  session_id: string;
  available_agent_ids: string[];
  active_agent_ids: string[];
  topic?: string;
  round_index: number;
  turns: TurnData[];
  mention_activation_mode: string;
}

export interface TurnData {
  round_index: number;
  agent_id: string;
  handle?: string;
  trigger: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RoundData {
  round_index: number;
  needs_verification: boolean;
  boundary_downgraded: boolean;
  turns: TurnData[];
}

export interface RoundResponse {
  session: SessionData;
  round: RoundData;
}

export interface HealthInfo {
  status: string;
  llm: {
    enabled: boolean;
    model: string;
    temperature: number;
    api_key_set: boolean;
    sdk_installed: boolean;
    provider: string | null;
    ready: boolean;
    hint: string | null;
  };
}
