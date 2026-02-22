import type {
  JudgmentEvent,
  ActivityResponse,
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
import {
  judgmentEvents,
  legacyLogs,
  decisionDistribution,
  agentDenyRates,
  mockAgents,
  mockBlockReasons,
  mockBlockLayers,
  mockToolRisks,
  mockAgentTimeline,
  mockMetricsOverview,
  mockMetricsAgents,
  mockMetricsReasons,
  mockHeatmapResponse,
} from "./mock-data";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const FETCH_TIMEOUT = 3000;

function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...options, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
}

export async function getJudgments(): Promise<JudgmentEvent[]> {
  if (!API_URL) return judgmentEvents;
  try {
    const res = await fetchWithTimeout(`${API_URL}/judgments`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return judgmentEvents;
  }
}

export async function getActivity(params: {
  limit?: number;
  cursor?: string | null;
  decision?: string | null;
  agent_id?: string | null;
  tool?: string | null;
} = {}): Promise<ActivityResponse> {
  const fallback: ActivityResponse = {
    items: judgmentEvents,
    next_cursor: null,
    has_more: false,
  };
  if (!API_URL) return fallback;
  try {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.cursor) searchParams.set("cursor", params.cursor);
    if (params.decision) searchParams.set("decision", params.decision);
    if (params.agent_id) searchParams.set("agent_id", params.agent_id);
    if (params.tool) searchParams.set("tool", params.tool);
    const qs = searchParams.toString();
    const url = `${API_URL}/activity${qs ? `?${qs}` : ""}`;
    const res = await fetchWithTimeout(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return fallback;
  }
}

export async function getJudgment(
  id: string
): Promise<JudgmentEvent | undefined> {
  if (!API_URL) return judgmentEvents.find((e) => e.id === id);
  try {
    const res = await fetchWithTimeout(`${API_URL}/judgments/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return judgmentEvents.find((e) => e.id === id);
  }
}

export function getLegacyLogs(): LegacyLog[] {
  return legacyLogs;
}

export async function getDecisionDistribution(): Promise<DecisionDistribution> {
  if (!API_URL) return decisionDistribution;
  try {
    const res = await fetchWithTimeout(`${API_URL}/metrics/decision-distribution`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return decisionDistribution;
  }
}

export async function getAgentDenyRate(): Promise<AgentDenyRate[]> {
  if (!API_URL) return agentDenyRates;
  try {
    const res = await fetchWithTimeout(`${API_URL}/metrics/agent-deny-rate`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return agentDenyRates;
  }
}

export async function getAgents(): Promise<Agent[]> {
  if (!API_URL) return mockAgents;
  try {
    const res = await fetchWithTimeout(`${API_URL}/agents`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return mockAgents;
  }
}

export async function banAgent(agentId: string, reason: string): Promise<{ status: string; agent_id: string; reason: string }> {
  const res = await fetchWithTimeout(`${API_URL}/agents/${agentId}/ban`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Ban failed" }));
    throw new Error(error.detail || "Ban failed");
  }
  return await res.json();
}

export async function unbanAgent(agentId: string): Promise<{ status: string; agent_id: string }> {
  const res = await fetchWithTimeout(`${API_URL}/agents/${agentId}/unban`, {
    method: "POST",
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Unban failed" }));
    throw new Error(error.detail || "Unban failed");
  }
  return await res.json();
}

export async function getBlockReasonBreakdown(): Promise<BlockReasonEntry[]> {
  if (!API_URL) return mockBlockReasons;
  try {
    const res = await fetchWithTimeout(`${API_URL}/metrics/block-reason-breakdown`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return mockBlockReasons;
  }
}

export async function getBlockLayerBreakdown(): Promise<BlockLayerEntry[]> {
  if (!API_URL) return mockBlockLayers;
  try {
    const res = await fetchWithTimeout(`${API_URL}/metrics/block-layer-breakdown`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return mockBlockLayers;
  }
}

export async function getToolRiskProfile(): Promise<ToolRiskEntry[]> {
  if (!API_URL) return mockToolRisks;
  try {
    const res = await fetchWithTimeout(`${API_URL}/metrics/tool-risk-profile`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return mockToolRisks;
  }
}

export async function getAgentTimeline(): Promise<AgentTimelineEntry[]> {
  if (!API_URL) return mockAgentTimeline;
  try {
    const res = await fetchWithTimeout(`${API_URL}/metrics/agent-timeline`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return mockAgentTimeline;
  }
}

export async function getMetricsOverview(): Promise<MetricsOverview> {
  if (!API_URL) return mockMetricsOverview;
  try {
    const res = await fetchWithTimeout(`${API_URL}/metrics/overview`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return mockMetricsOverview;
  }
}

export async function getMetricsAgents(): Promise<MetricsAgent[]> {
  if (!API_URL) return mockMetricsAgents;
  try {
    const res = await fetchWithTimeout(`${API_URL}/metrics/agents`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return mockMetricsAgents;
  }
}

export async function getMetricsReasons(): Promise<MetricsReason[]> {
  if (!API_URL) return mockMetricsReasons;
  try {
    const res = await fetchWithTimeout(`${API_URL}/metrics/reasons`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return mockMetricsReasons;
  }
}

export async function getBehaviorHeatmap(): Promise<HeatmapResponse> {
  if (!API_URL) return mockHeatmapResponse;
  try {
    const res = await fetchWithTimeout(`${API_URL}/metrics/behavior_heatmap`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return mockHeatmapResponse;
  }
}
