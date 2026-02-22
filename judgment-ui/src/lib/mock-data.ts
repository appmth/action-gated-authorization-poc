import type {
  JudgmentEvent,
  LegacyLog,
  DecisionDistribution,
  AgentDenyRate,
  Agent,
  BlockReasonEntry,
  BlockLayerEntry,
  ToolRiskEntry,
  AgentTimelineEntry,
  MetricsOverview,
  MetricsAgent,
  MetricsReason,
  HeatmapResponse,
} from "./types";

// --- Judgment Map 用データ（5件、ALLOW/DENY混在） ---

export const judgmentEvents: JudgmentEvent[] = [
  {
    id: "j-001",
    ts: "2026-02-01T12:03:10+09:00",
    agent_id: "agent-a",
    agent_role: "assistant",
    tool: "benefit",
    action: "update",
    decision: "DENY",
    reason:
      "給付ステータスの更新は、人的確認が必要な操作として定義されているため、assistant ロールでは実行できません。",
    policy_id: "P-UPDATE-001",
    policy_tags: ["money", "human-required"],
    context: {
      resident_id: "****a92f",
      target: "benefit_status",
    },
  },
  {
    id: "j-002",
    ts: "2026-02-01T12:05:22+09:00",
    agent_id: "agent-b",
    agent_role: "admin",
    tool: "benefit",
    action: "update",
    decision: "ALLOW",
    reason:
      "admin ロールによる給付ステータス更新。条件付き承認（監査ログ記録対象）。",
    policy_id: "P-UPDATE-001",
    policy_tags: ["money", "human-required"],
    context: {
      resident_id: "****a92f",
      target: "benefit_status",
      approved_by: "supervisor-1",
    },
  },
  {
    id: "j-003",
    ts: "2026-02-01T12:07:45+09:00",
    agent_id: "agent-a",
    agent_role: "assistant",
    tool: "resident",
    action: "read",
    decision: "ALLOW",
    reason:
      "住民情報の参照は assistant ロールに許可されています。範囲は担当地区に限定。",
    policy_id: "P-READ-001",
    policy_tags: ["pii", "read-only"],
    context: {
      resident_id: "****b3e1",
      scope: "district-5",
    },
  },
  {
    id: "j-004",
    ts: "2026-02-01T12:10:30+09:00",
    agent_id: "agent-a",
    agent_role: "assistant",
    tool: "notify",
    action: "send",
    decision: "ALLOW",
    reason:
      "通知送信は assistant ロールに許可されています。監査対象として記録。",
    policy_id: "P-NOTIFY-001",
    policy_tags: ["notify", "audit-target"],
    context: {
      resident_id: "****c7d4",
      channel: "email",
    },
  },
  {
    id: "j-005",
    ts: "2026-02-01T12:12:55+09:00",
    agent_id: "agent-a",
    agent_role: "assistant",
    tool: "resident",
    action: "read",
    decision: "ALLOW",
    reason:
      "住民情報の参照は assistant ロールに許可されています。範囲は担当地区に限定（2件目）。",
    policy_id: "P-READ-001",
    policy_tags: ["pii", "read-only"],
    context: {
      resident_id: "****d9f2",
      scope: "district-5",
    },
  },
];

// --- Legacy Log 用データ（10件、無機質なレコード） ---

export const legacyLogs: LegacyLog[] = [
  { time: "12:03:10", tool: "update_benefit_status", status: "success" },
  { time: "12:03:15", tool: "update_benefit_status", status: "success" },
  { time: "12:03:20", tool: "read_resident_record", status: "success" },
  { time: "12:03:28", tool: "send_notification", status: "success" },
  { time: "12:03:35", tool: "update_benefit_status", status: "success" },
  { time: "12:03:42", tool: "read_resident_record", status: "success" },
  { time: "12:03:50", tool: "update_benefit_status", status: "success" },
  { time: "12:03:58", tool: "read_resident_record", status: "success" },
  { time: "12:04:05", tool: "send_notification", status: "success" },
  { time: "12:04:12", tool: "update_benefit_status", status: "success" },
];

// --- Graph 用データ（集計済み定数） ---

export const decisionDistribution: DecisionDistribution = {
  allow_pct: 68,
  deny_pct: 32,
  total_count: 20,
};

export const agentDenyRates: AgentDenyRate[] = [
  { agent: "cs-night", deny_pct: 80 },
  { agent: "assistant", deny_pct: 62 },
  { agent: "admin", deny_pct: 12 },
];

export const mockAgents: Agent[] = [
  {
    id: "assistant",
    name: "assistant",
    display_name: "アシスタント",
    role: "Frontdesk",
    status: "active",
    last_seen: "2026-02-09T03:12:00Z",
    allow_24h: 5,
    deny_24h: 8,
  },
  {
    id: "admin",
    name: "admin",
    display_name: "管理者",
    role: "Backoffice",
    status: "active",
    last_seen: "2026-02-09T02:45:00Z",
    allow_24h: 8,
    deny_24h: 1,
  },
  {
    id: "cs-night",
    name: "cs-night",
    display_name: "夜間CS",
    role: "Frontdesk",
    status: "banned",
    last_seen: "2026-02-09T01:30:00Z",
    allow_24h: 1,
    deny_24h: 4,
    banned_reason: "Suspicious pattern",
    banned_at: "2026-02-09T01:35:00Z",
  },
];

export const mockBlockReasons: BlockReasonEntry[] = [
  { reason: "Denied: purpose must be 'inquiry'", count: 4, pct: 50 },
  { reason: "Agent banned: Suspicious pattern", count: 2, pct: 25 },
  { reason: "Denied: after hours access", count: 2, pct: 25 },
];

export const mockBlockLayers: BlockLayerEntry[] = [
  { layer: "L1 Judgment", count: 7, pct: 70 },
  { layer: "L2 Envoy", count: 2, pct: 20 },
  { layer: "L3 Tool", count: 1, pct: 10 },
];

export const mockToolRisks: ToolRiskEntry[] = [
  { tool: "benefit", total: 5, deny_count: 4, deny_pct: 80 },
  { tool: "resident", total: 15, deny_count: 4, deny_pct: 27 },
];

export const mockAgentTimeline: AgentTimelineEntry[] = [
  {
    agent: "assistant",
    entries: [
      { ts: "2026-02-09T01:00:00Z", decision: "ALLOW" },
      { ts: "2026-02-09T01:15:00Z", decision: "ALLOW" },
      { ts: "2026-02-09T01:30:00Z", decision: "DENY" },
      { ts: "2026-02-09T01:45:00Z", decision: "DENY" },
      { ts: "2026-02-09T02:00:00Z", decision: "DENY" },
      { ts: "2026-02-09T02:15:00Z", decision: "ALLOW" },
      { ts: "2026-02-09T02:30:00Z", decision: "DENY" },
      { ts: "2026-02-09T02:45:00Z", decision: "DENY" },
      { ts: "2026-02-09T03:00:00Z", decision: "DENY" },
      { ts: "2026-02-09T03:10:00Z", decision: "DENY" },
      { ts: "2026-02-09T03:12:00Z", decision: "ALLOW" },
    ],
  },
  {
    agent: "admin",
    entries: [
      { ts: "2026-02-09T01:15:00Z", decision: "ALLOW" },
      { ts: "2026-02-09T01:45:00Z", decision: "ALLOW" },
      { ts: "2026-02-09T02:00:00Z", decision: "ALLOW" },
      { ts: "2026-02-09T02:30:00Z", decision: "ALLOW" },
      { ts: "2026-02-09T02:45:00Z", decision: "DENY" },
      { ts: "2026-02-09T03:00:00Z", decision: "ALLOW" },
    ],
  },
  {
    agent: "cs-night",
    entries: [
      { ts: "2026-02-09T00:30:00Z", decision: "ALLOW" },
      { ts: "2026-02-09T01:00:00Z", decision: "DENY" },
      { ts: "2026-02-09T01:15:00Z", decision: "DENY" },
      { ts: "2026-02-09T01:30:00Z", decision: "DENY" },
      { ts: "2026-02-09T01:35:00Z", decision: "DENY", is_ban: true },
      { ts: "2026-02-09T01:45:00Z", decision: "DENY" },
      { ts: "2026-02-09T02:00:00Z", decision: "DENY" },
    ],
  },
];

export const mockMetricsOverview: MetricsOverview = {
  total_events: 20,
  allow_count: 14,
  deny_count: 6,
  deny_rate: 32,
  active_agents: 3,
  period: "last_24h",
};

export const mockMetricsAgents: MetricsAgent[] = [
  { agent_id: "cs-night", total: 5, allow_count: 1, deny_count: 4, deny_rate: 80 },
  { agent_id: "assistant", total: 13, allow_count: 5, deny_count: 8, deny_rate: 62 },
  { agent_id: "admin", total: 9, allow_count: 8, deny_count: 1, deny_rate: 12 },
];

export const mockMetricsReasons: MetricsReason[] = [
  { reason: "Denied: purpose must be 'inquiry'", count: 4, pct: 50 },
  { reason: "Agent banned: Suspicious pattern", count: 2, pct: 25 },
  { reason: "Denied: after hours access", count: 2, pct: 25 },
];

// Generate 24 bucket_starts for heatmap mock (24h window, 1h buckets)
function generateBucketStarts(): string[] {
  const now = new Date();
  const starts: string[] = [];
  for (let i = 23; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 3600 * 1000);
    t.setMinutes(0, 0, 0);
    starts.push(t.toISOString().replace(/\.\d{3}Z$/, "Z"));
  }
  return starts;
}

export const mockHeatmapResponse: HeatmapResponse = {
  window: "24h",
  bucket_size: "1h",
  bucket_starts: generateBucketStarts(),
  agents: [
    {
      agent_id: "cs-night",
      display_name: "\u591c\u9593\u5bfe\u5fdc\u30a8\u30fc\u30b8\u30a7\u30f3\u30c8",
      role: "Frontdesk",
      status: "banned",
      summary_deny_rate: 85.7,
      summary_total: 42,
      summary_deny: 36,
      last_5m_deny: 2,
      cells: [
        { allow: 1, deny: 3, deny_rate: 75.0, total: 4 },
        { allow: 0, deny: 2, deny_rate: 100.0, total: 2 },
        { allow: 1, deny: 4, deny_rate: 80.0, total: 5 },
        null,
        { allow: 0, deny: 3, deny_rate: 100.0, total: 3 },
        { allow: 1, deny: 5, deny_rate: 83.3, total: 6 },
        { allow: 0, deny: 2, deny_rate: 100.0, total: 2 },
        null,
        { allow: 1, deny: 3, deny_rate: 75.0, total: 4 },
        { allow: 0, deny: 4, deny_rate: 100.0, total: 4 },
        { allow: 1, deny: 2, deny_rate: 66.7, total: 3 },
        { allow: 0, deny: 1, deny_rate: 100.0, total: 1 },
        null,
        { allow: 0, deny: 2, deny_rate: 100.0, total: 2 },
        { allow: 1, deny: 1, deny_rate: 50.0, total: 2 },
        null,
        null,
        { allow: 0, deny: 1, deny_rate: 100.0, total: 1 },
        { allow: 0, deny: 1, deny_rate: 100.0, total: 1 },
        null,
        null,
        { allow: 0, deny: 1, deny_rate: 100.0, total: 1 },
        { allow: 1, deny: 1, deny_rate: 50.0, total: 2 },
        null,
      ],
    },
    {
      agent_id: "benefit-assistant",
      display_name: "\u7d66\u4ed8\u7a93\u53e3\u30a8\u30fc\u30b8\u30a7\u30f3\u30c8",
      role: "Frontdesk",
      status: "active",
      summary_deny_rate: 48.0,
      summary_total: 25,
      summary_deny: 12,
      last_5m_deny: 0,
      cells: [
        { allow: 2, deny: 1, deny_rate: 33.3, total: 3 },
        null,
        { allow: 1, deny: 1, deny_rate: 50.0, total: 2 },
        { allow: 3, deny: 2, deny_rate: 40.0, total: 5 },
        null,
        { allow: 1, deny: 2, deny_rate: 66.7, total: 3 },
        null,
        { allow: 2, deny: 0, deny_rate: 0.0, total: 2 },
        null,
        { allow: 1, deny: 1, deny_rate: 50.0, total: 2 },
        null,
        null,
        { allow: 1, deny: 2, deny_rate: 66.7, total: 3 },
        null,
        { allow: 1, deny: 1, deny_rate: 50.0, total: 2 },
        null,
        { allow: 1, deny: 1, deny_rate: 50.0, total: 2 },
        null,
        null,
        { allow: 0, deny: 1, deny_rate: 100.0, total: 1 },
        null,
        null,
        null,
        null,
      ],
    },
    {
      agent_id: "benefit-admin",
      display_name: "\u7d66\u4ed8\u7ba1\u7406\u30a8\u30fc\u30b8\u30a7\u30f3\u30c8",
      role: "Backoffice",
      status: "active",
      summary_deny_rate: 10.0,
      summary_total: 30,
      summary_deny: 3,
      last_5m_deny: 0,
      cells: [
        { allow: 3, deny: 0, deny_rate: 0.0, total: 3 },
        { allow: 2, deny: 0, deny_rate: 0.0, total: 2 },
        { allow: 1, deny: 1, deny_rate: 50.0, total: 2 },
        { allow: 2, deny: 0, deny_rate: 0.0, total: 2 },
        null,
        { allow: 3, deny: 0, deny_rate: 0.0, total: 3 },
        { allow: 1, deny: 0, deny_rate: 0.0, total: 1 },
        { allow: 2, deny: 0, deny_rate: 0.0, total: 2 },
        null,
        { allow: 2, deny: 1, deny_rate: 33.3, total: 3 },
        { allow: 1, deny: 0, deny_rate: 0.0, total: 1 },
        null,
        { allow: 2, deny: 0, deny_rate: 0.0, total: 2 },
        { allow: 1, deny: 0, deny_rate: 0.0, total: 1 },
        null,
        { allow: 2, deny: 1, deny_rate: 33.3, total: 3 },
        { allow: 1, deny: 0, deny_rate: 0.0, total: 1 },
        null,
        { allow: 1, deny: 0, deny_rate: 0.0, total: 1 },
        { allow: 1, deny: 0, deny_rate: 0.0, total: 1 },
        null,
        { allow: 1, deny: 0, deny_rate: 0.0, total: 1 },
        null,
        null,
      ],
    },
  ],
};
