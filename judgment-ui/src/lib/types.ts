/** Judgment の一覧表示用*/
export type JudgmentSummary = {
    request_id: string;
    action: string;
    result: 'ALLOW' | 'DENY';
    reason_short: string;
    created_at: string;
};

/** Judgment の詳細 */
export type JudgmentDetail = {
  request_id: string;
  created_at: string;
  action: string;
  context: {
    purpose: string;
    time: string;
    data_sensitivity: string;
  };
  plan_raw?: string;
  decision: {
    allow: boolean;
    reason: string;
  };
  reason_short: string;
  policy_version?: string;
  rule_id?: string;
  pep_enforcement: {
    pdp_called: boolean;
    tool_called: boolean;
    side_effects: 'none' | 'unknown';
  };
  tool_result?: {
    status_code: number;
    latency_ms: number;
    data?: unknown;
  };
  trace: TraceStep[];
};

export type TraceStep = {
  step: string;
  at: string;
  status: 'completed' | 'blocked' | 'skipped';
  note?: string;
};
