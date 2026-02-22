"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  useMetricsOverview,
  useMetricsAgents,
  useMetricsReasons,
  useBlockLayers,
  useToolRisks,
  useBehaviorHeatmap,
  useAgentsQuery,
} from "@/lib/hooks";
import type {
  HeatmapResponse,
  HeatmapCell,
} from "@/lib/types";
import {
  SkeletonSystemStatus,
  SkeletonMetricCard,
  SkeletonHeatmap,
} from "@/components/Skeleton";

export default function GraphPage() {
  const router = useRouter();

  // Individual hooks for staged loading
  const { data: overview, isLoading: overviewLoading } = useMetricsOverview();
  const { data: rawMetricsAgents, isLoading: metricsAgentsLoading } = useMetricsAgents();
  const { data: rawMetricsReasons, isLoading: metricsReasonsLoading } = useMetricsReasons();
  const { data: blockLayers, isLoading: blockLayersLoading } = useBlockLayers();
  const { data: toolRisks, isLoading: toolRisksLoading } = useToolRisks();
  const { data: heatmap, isLoading: heatmapLoading } = useBehaviorHeatmap();
  const { data: agents, isLoading: agentsLoading } = useAgentsQuery();

  // Sort data after loading
  const metricsAgents = rawMetricsAgents
    ? [...rawMetricsAgents].sort((a, b) => b.deny_rate - a.deny_rate)
    : [];
  const metricsReasons = rawMetricsReasons
    ? [...rawMetricsReasons].sort((a, b) => b.count - a.count)
    : [];
  const sortedToolRisks = toolRisks
    ? [...toolRisks].sort((a, b) => b.deny_pct - a.deny_pct)
    : [];

  // System Status depends on overview + agents + metricsAgents
  const systemStatusLoading = overviewLoading || agentsLoading || metricsAgentsLoading;

  // Donut chart calculations (only when data available)
  const allowPct = overview && overview.total_events > 0
    ? Math.round((overview.allow_count / overview.total_events) * 100)
    : 0;
  const denyPct = overview && overview.total_events > 0
    ? Math.round((overview.deny_count / overview.total_events) * 100)
    : 0;
  const total = allowPct + denyPct;
  const allowFraction = total > 0 ? allowPct / total : 0;
  const denyFraction = total > 0 ? denyPct / total : 0;
  const circumference = 2 * Math.PI * 40;
  const allowArc = circumference * allowFraction;
  const denyArc = circumference * denyFraction;

  const activeAgents = agents ? agents.filter((a) => a.status === "active").length : 0;
  const bannedAgents = agents ? agents.filter((a) => a.status === "banned").length : 0;
  const globalDenyRate = overview?.deny_rate ?? 0;
  const highRiskAgents = metricsAgents.filter((r) => r.deny_rate >= 50).length;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Governance Insights</h1>
        <p className="text-sm text-gray-500">Last 24h</p>
      </div>

      {/* SYSTEM STATUS */}
      <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        SYSTEM STATUS
      </div>
      {systemStatusLoading ? (
        <div className="mb-6">
          <SkeletonSystemStatus />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Active Agents</div>
              <div className="text-2xl font-bold text-gray-900">{activeAgents}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Banned Agents</div>
              <div className={`text-2xl font-bold ${bannedAgents > 0 ? "text-red-600" : "text-gray-900"}`}>
                {bannedAgents}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Global Deny Rate</div>
              <div className={`text-2xl font-bold ${globalDenyRate >= 50 ? "text-red-600" : "text-gray-900"}`}>
                {globalDenyRate}%
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">High Risk Agents</div>
              <div className={`text-2xl font-bold ${highRiskAgents > 0 ? "text-red-600" : "text-gray-900"}`}>
                {highRiskAgents}
              </div>
            </div>
          </div>

          {/* Anomaly Warning Banner */}
          {globalDenyRate > 50 && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-6">
              <span className="text-sm text-yellow-800 font-medium">
                Anomaly Detected: Global deny rate exceeds 50%
              </span>
            </div>
          )}
        </>
      )}

      {/* OVERVIEW */}
      <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        OVERVIEW
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 1. Decision Distribution */}
        {overviewLoading ? (
          <SkeletonMetricCard />
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-base font-medium mb-6">Decision Distribution</h2>
            <div className="flex items-center justify-center gap-8">
              <div className="relative">
                <svg width="180" height="180" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="20"
                    strokeDasharray={`${denyArc} ${circumference - denyArc}`}
                    strokeDashoffset={circumference * 0.25}
                    transform="rotate(0 50 50)"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="20"
                    strokeDasharray={`${allowArc} ${circumference - allowArc}`}
                    strokeDashoffset={circumference * 0.25 - denyArc}
                    transform="rotate(0 50 50)"
                  />
                  <text
                    x="50"
                    y="48"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="14"
                    fontWeight="600"
                    fill="#ef4444"
                  >
                    {denyPct}%
                  </text>
                  <text
                    x="50"
                    y="58"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="9"
                    fill="#6b7280"
                  >
                    Deny Rate
                  </text>
                </svg>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                  <span className="text-sm text-gray-700">
                    ALLOW: {allowPct}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                  <span className="text-sm text-gray-700">
                    DENY: {denyPct}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Agent-wise Deny Rate */}
        {metricsAgentsLoading || agentsLoading ? (
          <SkeletonMetricCard />
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-base font-medium mb-6">Agent-wise Deny Rate</h2>
            <div className="space-y-5">
              {metricsAgents.map((ma) => {
                const matchedAgent = agents?.find((a) => a.name === ma.agent_id || a.id === ma.agent_id);
                const isBanned = matchedAgent?.status === "banned";
                const isHighRisk = ma.deny_rate >= 50;
                return (
                  <div
                    key={ma.agent_id}
                    className={`group cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors ${isBanned ? "opacity-40" : ""}`}
                    onClick={() => router.push(`/activity?agent=${encodeURIComponent(ma.agent_id)}`)}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-sm ${isHighRisk && !isBanned ? "text-red-600 font-bold" : isBanned ? "text-gray-400" : "text-gray-700"}`}>
                        {ma.agent_id}{isBanned ? " (Banned)" : ""}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className={`text-sm font-medium ${isHighRisk && !isBanned ? "text-red-600 font-bold" : "text-gray-900"}`}>
                          {ma.deny_rate}%
                        </span>
                        <svg className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-4">
                      <div
                        className={`${isBanned ? "bg-gray-300" : isHighRisk ? "bg-red-600" : "bg-red-400"} h-4 rounded-full transition-all`}
                        style={{ width: `${ma.deny_rate}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* GOVERNANCE INSIGHT */}
      <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        GOVERNANCE INSIGHT
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 3. Block Reason Breakdown */}
        {metricsReasonsLoading ? (
          <SkeletonMetricCard />
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-base font-medium mb-6">Block Reason Breakdown</h2>
            <div className="space-y-4">
              {metricsReasons.map((reason, idx) => (
                <div
                  key={idx}
                  className="group cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
                  onClick={() => router.push(`/activity?reason=${encodeURIComponent(reason.reason)}`)}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-700 truncate mr-2">
                      {reason.reason}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                        {reason.count} ({reason.pct}%)
                      </span>
                      <svg className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div
                      className="bg-orange-400 h-3 rounded-full transition-all"
                      style={{ width: `${reason.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Block Layer Breakdown */}
        {blockLayersLoading ? (
          <SkeletonMetricCard />
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-base font-medium mb-6">Block Layer Breakdown</h2>
            <div className="space-y-6">
              <div className="w-full h-8 flex rounded-full overflow-hidden">
                {(blockLayers ?? []).map((layer, idx) => {
                  const bgColor =
                    layer.layer === "L1 Judgment"
                      ? "bg-blue-500"
                      : layer.layer === "L2 Envoy"
                      ? "bg-yellow-500"
                      : "bg-purple-500";
                  return (
                    <div
                      key={idx}
                      className={`${bgColor} h-full`}
                      style={{ width: `${layer.pct}%` }}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-4">
                {(blockLayers ?? []).map((layer, idx) => {
                  const bgColor =
                    layer.layer === "L1 Judgment"
                      ? "bg-blue-500"
                      : layer.layer === "L2 Envoy"
                      ? "bg-yellow-500"
                      : "bg-purple-500";
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${bgColor}`} />
                      <span className="text-sm text-gray-700">
                        {layer.layer}: {layer.pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RISK PROFILE */}
      <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        RISK PROFILE
      </div>
      {toolRisksLoading ? (
        <div className="mb-8">
          <SkeletonMetricCard />
        </div>
      ) : (
        <div className="mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-base font-medium mb-6">Tool-wise Risk Profile</h2>
            <div className="space-y-5">
              {sortedToolRisks.map((risk, idx) => (
                <div
                  key={idx}
                  className="group cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
                  onClick={() => router.push(`/activity?tool=${encodeURIComponent(risk.tool)}`)}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-700 font-medium">
                      {risk.tool}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-900">
                        {risk.deny_count}/{risk.total} ({risk.deny_pct}%)
                      </span>
                      <svg className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-4">
                    <div
                      className="bg-red-500 h-4 rounded-full transition-all"
                      style={{ width: `${risk.deny_pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BEHAVIOR */}
      <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        BEHAVIOR
      </div>
      {heatmapLoading ? (
        <SkeletonHeatmap />
      ) : (
        <div className="mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-base font-medium mb-1">
              Agent Risk Heatmap
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Deny rate by agent and time bucket (Last 24h)
            </p>
            {heatmap ? (
              <AgentRiskHeatmap heatmap={heatmap} />
            ) : (
              <div className="text-sm text-gray-500">No data</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getCellColor(denyRate: number): string {
  if (denyRate <= 10) return "bg-green-500";
  if (denyRate <= 30) return "bg-lime-400";
  if (denyRate <= 50) return "bg-yellow-400";
  if (denyRate <= 70) return "bg-orange-500";
  return "bg-red-500";
}

function formatBucketRange(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const h = d.getHours();
    const nextH = (h + 1) % 24;
    return `${String(h).padStart(2, "0")}:00 - ${String(nextH).padStart(2, "0")}:00`;
  } catch {
    return "";
  }
}

function AgentRiskHeatmap({ heatmap }: { heatmap: HeatmapResponse }) {
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);

  // Scroll to rightmost (Now) on mount
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.scrollLeft = gridRef.current.scrollWidth;
    }
  }, []);

  if (heatmap.agents.length === 0) {
    return <div className="text-sm text-gray-500">No data</div>;
  }

  const ROW_HEIGHT = 80;
  const CELL_SIZE = 28;
  const highRiskAgentNames = heatmap.agents
    .filter((a) => a.summary_deny_rate >= 50)
    .map((a) => a.display_name || a.agent_id);

  // Column labels: show at indices 0, 6, 12, 18, 23
  const labelIndices = [0, 6, 12, 18, 23];
  const labelTexts = ["-24h", "-18h", "-12h", "-6h", "Now"];

  return (
    <div>
      {/* High Risk Warning */}
      {highRiskAgentNames.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4" data-testid="heatmap-warning">
          <span className="text-sm text-yellow-800 font-medium">
            High Risk Agents (deny rate &gt; 50%): {highRiskAgentNames.join(", ")}
          </span>
        </div>
      )}

      <div className="overflow-y-auto max-h-[600px]">
        <div className="flex">
          {/* Left Column: Agent Labels */}
          <div className="flex-shrink-0 w-[240px] min-w-[200px]">
            {/* Header spacer for column labels */}
            <div style={{ height: "24px" }} />
            {heatmap.agents.map((agent) => (
              <div
                key={agent.agent_id}
                className={`flex flex-col justify-center pr-3 ${agent.status === "banned" ? "bg-red-50 border-l-4 border-l-red-500" : ""}`}
                style={{ height: `${ROW_HEIGHT}px` }}
              >
                <div className="flex items-center gap-1.5">
                  {agent.status === "banned" && (
                    <svg className="w-3.5 h-3.5 flex-shrink-0 text-red-600" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 1l3 7-3 7-3-7z" />
                    </svg>
                  )}
                  <span
                    className="text-sm font-medium text-gray-700 cursor-pointer hover:text-blue-600 truncate"
                    onClick={() =>
                      router.push(`/activity?agent=${encodeURIComponent(agent.agent_id)}`)
                    }
                  >
                    {agent.display_name || agent.agent_id}
                  </span>
                  {agent.status === "banned" && (
                    <span className="inline-flex px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-600 rounded flex-shrink-0">
                      BANNED
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">{agent.role}</span>
              </div>
            ))}
          </div>

          {/* Center Column: Heatmap Grid */}
          <div className="flex-1 min-w-0 overflow-x-auto" ref={gridRef} data-testid="heatmap-grid">
            {/* Column labels row */}
            <div
              className="grid items-end"
              style={{
                height: "24px",
                minWidth: `${24 * CELL_SIZE}px`,
                gridTemplateColumns: `repeat(24, ${CELL_SIZE}px)`,
              }}
            >
              {heatmap.bucket_starts.map((_bs, idx) => {
                const labelIdx = labelIndices.indexOf(idx);
                return (
                  <div
                    key={idx}
                    className="flex items-end justify-center"
                  >
                    {labelIdx >= 0 && (
                      <span className={`text-[10px] ${idx === 23 ? "text-blue-600 font-bold" : "text-gray-400"}`}>
                        {labelTexts[labelIdx]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Agent rows */}
            {heatmap.agents.map((agent) => (
              <div
                key={agent.agent_id}
                className={`flex items-center ${agent.status === "banned" ? "bg-red-50" : ""}`}
                style={{ height: `${ROW_HEIGHT}px`, minWidth: `${24 * CELL_SIZE}px` }}
              >
                {agent.cells.map((cell, cellIdx) => (
                  <HeatmapCellView
                    key={cellIdx}
                    cell={cell}
                    agentName={agent.display_name || agent.agent_id}
                    bucketStart={heatmap.bucket_starts[cellIdx] || ""}
                    size={CELL_SIZE}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Right Column: Summary Stats */}
          <div className="flex-shrink-0 w-[220px] min-w-[200px]">
            {/* Header spacer */}
            <div style={{ height: "24px" }} />
            {heatmap.agents.map((agent) => (
              <div
                key={agent.agent_id}
                className={`flex flex-col justify-center gap-1 pl-3 ${agent.status === "banned" ? "bg-red-50 border-l-4 border-l-red-500" : ""}`}
                style={{ height: `${ROW_HEIGHT}px` }}
              >
                <div className="flex items-center text-xs">
                  <span className="w-[32px] text-gray-400">Total</span>
                  <span className="font-semibold text-gray-700">{agent.summary_total}</span>
                </div>
                <div className="flex items-center text-xs">
                  <span className="w-[32px] text-gray-400">Deny</span>
                  <span className="font-semibold text-gray-700">{agent.summary_deny}</span>
                </div>
                <div className="flex items-center text-xs">
                  <span className="w-[32px] text-gray-400">Rate</span>
                  <span className={`font-semibold ${agent.summary_deny_rate >= 50 ? "text-red-600" : "text-gray-700"}`}>{agent.summary_deny_rate}%</span>
                </div>
                <div className="flex items-center text-xs">
                  <span className="w-[32px] text-gray-400">5m</span>
                  <span className="font-semibold text-gray-700">{agent.last_5m_deny}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-3">
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-500" />
          <span>0-10%</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-lime-400" />
          <span>10-30%</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-yellow-400" />
          <span>30-50%</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-orange-500" />
          <span>50-70%</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-500" />
          <span>70-100%</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-gray-200" />
          <span>N/A</span>
        </div>
        <div className="flex items-center gap-1">
          <svg className="w-3 h-3 text-red-600" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1l3 7-3 7-3-7z" />
          </svg>
          <span>Banned</span>
        </div>
      </div>
    </div>
  );
}

function HeatmapCellView({
  cell,
  agentName,
  bucketStart,
  size,
}: {
  cell: HeatmapCell | null;
  agentName: string;
  bucketStart: string;
  size: number;
}) {
  if (cell === null) {
    return (
      <div
        className="flex-shrink-0 m-[1px] rounded-sm bg-gray-200"
        style={{ width: `${size - 2}px`, height: `${size - 2}px` }}
      />
    );
  }

  const colorClass = getCellColor(cell.deny_rate);
  const isLowConfidence = cell.total < 10;

  return (
    <div className="flex-shrink-0 relative group" style={{ width: `${size}px`, height: `${size}px`, padding: "1px" }}>
      <div
        className={`w-full h-full rounded-sm ${colorClass} ${isLowConfidence ? "opacity-60" : ""}`}
      >
        {isLowConfidence && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-white opacity-80" />
          </div>
        )}
      </div>
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none" data-testid="heatmap-tooltip">
        <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
          <div className="font-semibold mb-1">{agentName}</div>
          <div className="text-gray-300">{formatBucketRange(bucketStart)}</div>
          <div className="mt-1">Allow: {cell.allow}, Deny: {cell.deny}</div>
          <div>Deny Rate: {cell.deny_rate}%</div>
          <div>Sample: {cell.total}{isLowConfidence ? " (low sample)" : ""}</div>
        </div>
      </div>
    </div>
  );
}
