export type JudgmentEvent = {
  id: string;
  ts: string;
  agent_id: string;
  agent_role: string;
  tool: string;
  action: string;
  decision: "ALLOW" | "DENY";
  reason: string;
  policy_id: string;
  policy_tags: string[];
  context: Record<string, string>;
};

export type ActivityResponse = {
  items: JudgmentEvent[];
  next_cursor: string | null;
  has_more: boolean;
};

export type LegacyLog = {
  time: string;
  tool: string;
  status: string;
};

export type DecisionDistribution = {
  allow_pct: number;
  deny_pct: number;
  total_count: number;
};

export type AgentDenyRate = {
  agent: string;
  deny_pct: number;
};

export type Agent = {
  id: string;
  name: string;
  display_name: string;
  role: string;
  status: "active" | "banned";
  last_seen: string | null;
  allow_24h: number;
  deny_24h: number;
  banned_reason?: string;
  banned_at?: string;
};

export type BlockReasonEntry = {
  reason: string;
  count: number;
  pct: number;
};

export type BlockLayerEntry = {
  layer: string;
  count: number;
  pct: number;
};

export type ToolRiskEntry = {
  tool: string;
  total: number;
  deny_count: number;
  deny_pct: number;
};

export type MetricsOverview = {
  total_events: number;
  allow_count: number;
  deny_count: number;
  deny_rate: number;
  active_agents: number;
  period: string;
};

export type MetricsAgent = {
  agent_id: string;
  total: number;
  allow_count: number;
  deny_count: number;
  deny_rate: number;
};

export type MetricsReason = {
  reason: string;
  count: number;
  pct: number;
};

export type AgentTimelineEntry = {
  agent: string;
  entries: {
    ts: string;
    decision: string;
    is_ban?: boolean;
  }[];
};

export interface HeatmapCell {
  allow: number;
  deny: number;
  deny_rate: number;
  total: number;
}

export interface HeatmapAgent {
  agent_id: string;
  display_name: string;
  role: string;
  status: "active" | "banned";
  summary_deny_rate: number;
  summary_total: number;
  summary_deny: number;
  last_5m_deny: number;
  cells: (HeatmapCell | null)[];
}

export interface HeatmapResponse {
  window: string;
  bucket_size: string;
  bucket_starts: string[];
  agents: HeatmapAgent[];
}
