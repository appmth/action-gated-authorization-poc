"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { getActivity, getJudgment, banAgent, unbanAgent } from "@/lib/api";
import { useActivityQuery, useAgentsQuery } from "@/lib/hooks";
import type { JudgmentEvent, Agent } from "@/lib/types";
import {
  SkeletonKPICards,
  SkeletonAgentTiles,
  SkeletonTableRows,
} from "@/components/Skeleton";

type DecisionFilterType = "ALL" | "ALLOW" | "DENY";
type SortColumn = "time" | "agent" | "decision" | null;
type SortDirection = "asc" | "desc";

export default function JudgmentMapPage() {
  return (
    <Suspense fallback={<div className="p-4 md:p-6 lg:p-8"><p className="text-gray-500">Loading...</p></div>}>
      <JudgmentMapContent />
    </Suspense>
  );
}

const PREFETCH_SIZE = 125;

function JudgmentMapContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  // TanStack Query for initial data
  const { data: activityData, isLoading: activityLoading } = useActivityQuery({
    limit: PREFETCH_SIZE,
    cursor: null,
  });
  const { data: agentsData, isLoading: agentsLoading } = useAgentsQuery();

  const isLoading = activityLoading || agentsLoading;

  // Local state for accumulated items (needed for load-more pagination)
  const [extraItems, setExtraItems] = useState<JudgmentEvent[]>([]);
  const [serverCursor, setServerCursor] = useState<string | null>(null);
  const [serverHasMore, setServerHasMore] = useState(false);

  // Sync server cursor from initial query data
  useEffect(() => {
    if (activityData) {
      setServerCursor(activityData.next_cursor);
      setServerHasMore(activityData.has_more);
    }
  }, [activityData]);

  // Combined items: query data + extra loaded items
  const allItems = [
    ...(activityData?.items ?? []),
    ...extraItems,
  ];
  const agents = agentsData ?? [];

  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [filterTool, setFilterTool] = useState<string | null>(null);
  const [filterReason, setFilterReason] = useState<string | null>(null);
  const [openKebabId, setOpenKebabId] = useState<string | null>(null);
  const [banModalState, setBanModalState] = useState<{
    isOpen: boolean;
    step: 1 | 2;
    agent: Agent | null;
    reason: string;
    customReason: string;
    confirmText: string;
    error: string | null;
  }>({
    isOpen: false,
    step: 1,
    agent: null,
    reason: "PII overreach",
    customReason: "",
    confirmText: "",
    error: null,
  });

  // Filter & sort states
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilterType>("ALL");
  const [highRiskOnly, setHighRiskOnly] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Pagination state (client-side paging over pre-fetched data)
  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const kebabRef = useRef<HTMLDivElement>(null);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [toolDropdownOpen, setToolDropdownOpen] = useState(false);
  const agentDropdownRef = useRef<HTMLDivElement>(null);
  const toolDropdownRef = useRef<HTMLDivElement>(null);

  // Set lastUpdated when data arrives
  useEffect(() => {
    if (activityData) {
      setLastUpdated(new Date());
    }
  }, [activityData]);

  // Track whether a URL-read is in progress to prevent infinite loops
  const isUrlReadRef = useRef(false);

  // Read URL search params for cross-page filtering
  useEffect(() => {
    isUrlReadRef.current = true;
    const agentParam = searchParams.get("agent");
    const toolParam = searchParams.get("tool");
    const reasonParam = searchParams.get("reason");
    const decisionParam = searchParams.get("decision");
    if (agentParam) setSelectedAgent(agentParam);
    if (toolParam) setFilterTool(toolParam);
    if (reasonParam) setFilterReason(reasonParam);
    if (decisionParam === "ALLOW" || decisionParam === "DENY") setDecisionFilter(decisionParam);
    // Allow state updates to flush before re-enabling URL-write
    setTimeout(() => { isUrlReadRef.current = false; }, 0);
  }, [searchParams]);

  // Sync filter state to URL
  useEffect(() => {
    if (isUrlReadRef.current) return;

    const params = new URLSearchParams();
    if (selectedAgent) params.set("agent", selectedAgent);
    if (filterTool) params.set("tool", filterTool);
    if (filterReason) params.set("reason", filterReason);
    if (decisionFilter !== "ALL") params.set("decision", decisionFilter);

    const queryString = params.toString();
    const newUrl = queryString ? `/activity?${queryString}` : "/activity";

    // Only update if URL would actually change
    const currentQuery = searchParams.toString();
    if (queryString !== currentQuery) {
      router.replace(newUrl, { scroll: false });
    }
  }, [selectedAgent, filterTool, filterReason, decisionFilter, router, searchParams]);

  // Reset page index when filters change
  useEffect(() => {
    setPageIndex(0);
  }, [selectedAgent, decisionFilter, filterTool, filterReason, highRiskOnly]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (kebabRef.current && !kebabRef.current.contains(event.target as Node)) {
        setOpenKebabId(null);
      }
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(event.target as Node)) {
        setAgentDropdownOpen(false);
      }
      if (toolDropdownRef.current && !toolDropdownRef.current.contains(event.target as Node)) {
        setToolDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Live Mode interval (invalidate queries to re-fetch)
  useEffect(() => {
    if (isLiveMode) {
      liveIntervalRef.current = setInterval(() => {
        setExtraItems([]);
        queryClient.invalidateQueries({ queryKey: ["activity"] });
        queryClient.invalidateQueries({ queryKey: ["agents"] });
      }, 3000);
    } else {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
    }
    return () => {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
    };
  }, [isLiveMode, queryClient]);

  // Compute high-risk agent IDs
  const highRiskAgentIds = agents
    .filter((a) => {
      const total = a.allow_24h + a.deny_24h;
      return total > 0 && (a.deny_24h / total) * 100 >= 50;
    })
    .map((a) => a.id);

  // Client-side filter pipeline (all filtering done on pre-fetched data)
  const filteredJudgments = allItems.filter((j) => {
    if (selectedAgent && j.agent_role !== selectedAgent && j.agent_id !== selectedAgent) return false;
    if (filterTool && j.tool !== filterTool) return false;
    if (filterReason && !j.reason.includes(filterReason)) return false;
    if (decisionFilter !== "ALL" && j.decision !== decisionFilter) return false;
    if (highRiskOnly && !highRiskAgentIds.includes(j.agent_id)) return false;
    return true;
  });

  // Sort
  const sortedJudgments = [...filteredJudgments];
  if (sortColumn) {
    sortedJudgments.sort((a, b) => {
      let cmp = 0;
      if (sortColumn === "time") {
        cmp = new Date(a.ts).getTime() - new Date(b.ts).getTime();
      } else if (sortColumn === "agent") {
        cmp = a.agent_role.localeCompare(b.agent_role);
      } else if (sortColumn === "decision") {
        cmp = a.decision.localeCompare(b.decision);
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }

  // Client-side pagination over filtered+sorted results
  const totalFiltered = sortedJudgments.length;
  const totalPages = Math.ceil(totalFiltered / pageSize);
  const pageJudgments = sortedJudgments.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const canGoNewer = pageIndex > 0;
  const canGoOlder = pageIndex + 1 < totalPages || serverHasMore;

  // Snapshot stats (over all filtered items, not just current page)
  const totalCount = filteredJudgments.length;
  const allowCount = filteredJudgments.filter((j) => j.decision === "ALLOW").length;
  const denyCount = filteredJudgments.filter((j) => j.decision === "DENY").length;
  const denyRate = totalCount > 0 ? Math.round((denyCount / totalCount) * 100) : 0;

  // Unique tools for dropdown (from all pre-fetched items)
  const uniqueTools = Array.from(new Set(allItems.map((j) => j.tool)));

  const clearFilters = () => {
    setSelectedAgent(null);
    setFilterTool(null);
    setFilterReason(null);
    setDecisionFilter("ALL");
    setHighRiskOnly(false);
    setPageIndex(0);
    router.push("/activity");
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setExtraItems([]);
    setPageIndex(0);
    await queryClient.invalidateQueries({ queryKey: ["activity"] });
    await queryClient.invalidateQueries({ queryKey: ["agents"] });
    setIsRefreshing(false);
  };

  const handleOlder = async () => {
    if (pageIndex + 1 < totalPages) {
      setPageIndex((prev) => prev + 1);
    } else if (serverHasMore && serverCursor) {
      setIsLoadingMore(true);
      try {
        const moreData = await getActivity({ limit: PREFETCH_SIZE, cursor: serverCursor });
        setExtraItems((prev) => [...prev, ...moreData.items]);
        setServerCursor(moreData.next_cursor);
        setServerHasMore(moreData.has_more);
        setPageIndex((prev) => prev + 1);
      } finally {
        setIsLoadingMore(false);
      }
    }
  };

  const handleNewer = () => {
    if (pageIndex > 0) {
      setPageIndex((prev) => prev - 1);
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPageIndex(0);
  };

  const handleSort = (column: "time" | "agent" | "decision") => {
    if (sortColumn === column) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortColumn(null);
        setSortDirection("asc");
      }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleExportCSV = () => {
    const header = "Time,Agent,Tool,Action,Decision,Reason";
    const rows = filteredJudgments.map((j) => {
      const time = formatTime(j.ts);
      const reason = j.reason.replace(/"/g, '""');
      return `${time},"${j.agent_role}","${j.tool}","${j.action}","${j.decision}","${reason}"`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "activity-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const sortIndicator = (column: "time" | "agent" | "decision") => {
    if (sortColumn !== column) return null;
    return sortDirection === "asc" ? " \u25B2" : " \u25BC";
  };

  const handleBanClick = (agent: Agent) => {
    setBanModalState({
      isOpen: true,
      step: 1,
      agent,
      reason: "PII overreach",
      customReason: "",
      confirmText: "",
      error: null,
    });
    setOpenKebabId(null);
  };

  const handleUnban = async (agentId: string) => {
    try {
      await unbanAgent(agentId);
      await queryClient.invalidateQueries({ queryKey: ["agents"] });
      await queryClient.invalidateQueries({ queryKey: ["activity"] });
      setOpenKebabId(null);
    } catch (error) {
      console.error("Unban failed:", error);
    }
  };

  const handleBanSubmit = async () => {
    if (!banModalState.agent) return;

    const finalReason =
      banModalState.reason === "Other"
        ? banModalState.customReason
        : banModalState.reason;

    try {
      await banAgent(banModalState.agent.id, finalReason);
      setBanModalState((prev) => ({ ...prev, isOpen: false }));
      await queryClient.invalidateQueries({ queryKey: ["agents"] });
      await queryClient.invalidateQueries({ queryKey: ["activity"] });
    } catch (error) {
      setBanModalState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Ban failed",
      }));
    }
  };

  const formatLastSeen = (lastSeen: string | null): string => {
    if (!lastSeen) return "--:--";
    const date = new Date(lastSeen);
    return date.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // Prefetch judgment detail on row hover
  const handleRowHover = (id: string) => {
    queryClient.prefetchQuery({
      queryKey: ["judgment", id],
      queryFn: () => getJudgment(id),
      staleTime: 60_000,
    });
  };

  const denyRateColorClass = denyRate >= 50 ? "text-red-600" : denyRate >= 30 ? "text-orange-600" : "text-gray-900";

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">AI Agent Activity Log</h1>
        {lastUpdated && (
          <span className="text-xs text-gray-400 whitespace-nowrap">
            Last updated: {lastUpdated.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
          </span>
        )}
      </div>

      {/* Snapshot Summary */}
      <div data-testid="snapshot-summary" className="mb-6">
        {isLoading ? (
          <SkeletonKPICards />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div data-testid="snapshot-total" className="bg-white border border-gray-200 rounded-lg p-4 h-[80px] flex flex-col justify-center">
              <div className="text-sm text-gray-500">Total</div>
              <div className="text-2xl font-bold text-gray-900">{totalCount}</div>
            </div>
            <div data-testid="snapshot-allow" className="bg-white border border-gray-200 rounded-lg p-4 h-[80px] flex flex-col justify-center">
              <div className="text-sm text-gray-500">Allow</div>
              <div className="text-2xl font-bold text-green-600">{allowCount}</div>
            </div>
            <div data-testid="snapshot-deny" className="bg-white border border-gray-200 rounded-lg p-4 h-[80px] flex flex-col justify-center">
              <div className="text-sm text-gray-500">Deny</div>
              <div className="text-2xl font-bold text-red-600">{denyCount}</div>
            </div>
            <div data-testid="snapshot-deny-rate" className="bg-white border border-gray-200 rounded-lg p-4 h-[80px] flex flex-col justify-center">
              <div className="text-sm text-gray-500">Deny Rate</div>
              <div className={`text-2xl font-bold ${denyRateColorClass}`}>{denyRate}%</div>
            </div>
          </div>
        )}
      </div>

      {/* Agent Tiles Row */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Agents</h2>
      {isLoading ? (
        <div className="mb-6">
          <SkeletonAgentTiles />
        </div>
      ) : (
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          {/* All Agents Tile (Filter Clear) - always first */}
          <div
            data-testid="clear-agent-filter"
            onClick={() => setSelectedAgent(null)}
            className={`relative border rounded-lg p-4 cursor-pointer min-w-[140px] flex flex-col items-center justify-center gap-2 transition-all duration-150 ${
              selectedAgent === null
                ? "bg-blue-50 border-blue-200 shadow-sm"
                : "bg-white border-gray-200 hover:bg-gray-50"
            }`}
          >
            <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              {/* Top-left agent */}
              <rect x="1" y="1" width="9" height="9" rx="2" />
              <circle cx="4" cy="5" r="1" fill="currentColor" />
              <circle cx="8" cy="5" r="1" fill="currentColor" />
              {/* Top-right agent */}
              <rect x="14" y="1" width="9" height="9" rx="2" />
              <circle cx="17" cy="5" r="1" fill="currentColor" />
              <circle cx="21" cy="5" r="1" fill="currentColor" />
              {/* Bottom-left agent */}
              <rect x="1" y="14" width="9" height="9" rx="2" />
              <circle cx="4" cy="18" r="1" fill="currentColor" />
              <circle cx="8" cy="18" r="1" fill="currentColor" />
              {/* Bottom-right agent */}
              <rect x="14" y="14" width="9" height="9" rx="2" />
              <circle cx="17" cy="18" r="1" fill="currentColor" />
              <circle cx="21" cy="18" r="1" fill="currentColor" />
            </svg>
            <span className={`text-sm font-semibold ${selectedAgent === null ? "text-blue-700" : "text-gray-600"}`}>
              All Agents
            </span>
            {selectedAgent === null && (
              <span className="text-[10px] text-blue-500">Showing All</span>
            )}
          </div>

          {/* Agent Tiles */}
          {agents.map((agent) => {
            const total24h = agent.allow_24h + agent.deny_24h;
            const denyRate = total24h > 0 ? Math.round((agent.deny_24h / total24h) * 100) : 0;
            const isMediumRisk = denyRate >= 30 && denyRate < 50;
            const isHighRisk = denyRate >= 50;
            const isBanned = agent.status === "banned";
            const isSelected = selectedAgent === agent.id;

            let riskBorderClass = "border-gray-200";
            if (isBanned) {
              riskBorderClass = "border-gray-400 border-2";
            } else if (isHighRisk) {
              riskBorderClass = "border-red-400 border-2";
            } else if (isMediumRisk) {
              riskBorderClass = "border-orange-400 border-2";
            }

            const bgClass = isSelected ? "bg-gray-50" : isBanned ? "bg-gray-50" : "bg-white";

            return (
            <div
              key={agent.id}
              onClick={() => setSelectedAgent(agent.id)}
              aria-selected={isSelected}
              className={`relative border rounded-lg p-4 cursor-pointer min-w-[270px] transition-all duration-150 ${bgClass} ${riskBorderClass} ${
                isSelected ? "shadow-md scale-[1.01]" : ""
              } ${isBanned ? "opacity-60" : ""}`}
            >
              {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-md" />
              )}
              {isSelected && (
                <span
                  data-testid="selected-badge"
                  className="absolute top-2 left-5 text-[11px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-sm border border-blue-300 shadow-sm"
                >
                  Selected
                </span>
              )}
              <div className="absolute top-2 right-2" ref={openKebabId === agent.id ? kebabRef : null}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenKebabId(openKebabId === agent.id ? null : agent.id);
                  }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="8" cy="3" r="1.5" fill="currentColor" />
                    <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                    <circle cx="8" cy="13" r="1.5" fill="currentColor" />
                  </svg>
                </button>

                {openKebabId === agent.id && (
                  <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[150px]">
                    {agent.status === "active" ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBanClick(agent);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                        >
                          Ban Agent
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAgent(agent.id);
                            setOpenKebabId(null);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          View Audit
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnban(agent.id);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-gray-50"
                        >
                          Unban Agent
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAgent(agent.id);
                            setOpenKebabId(null);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          View Audit
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className={`flex flex-col gap-2 ${isSelected ? "pt-7" : ""}`}>
                <div className="flex items-start justify-between pr-6">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="8" width="18" height="12" rx="2" />
                      <circle cx="9" cy="14" r="1.5" fill="currentColor" />
                      <circle cx="15" cy="14" r="1.5" fill="currentColor" />
                      <path d="M12 2v6" />
                      <circle cx="12" cy="2" r="1" fill="currentColor" />
                    </svg>
                    <span className="font-semibold text-gray-900">
                      {agent.display_name}
                    </span>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    ROLE: {agent.role}
                  </span>
                </div>

                <div className={`text-sm font-medium ${isHighRisk ? "text-red-600" : "text-gray-600"}`}>
                  Deny Rate: {denyRate}%
                </div>

                <div className="flex gap-2 items-center">
                  <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded">
                    ALLOW {agent.allow_24h}
                  </span>
                  <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded">
                    DENY {agent.deny_24h}
                  </span>
                </div>

                <div className="text-xs text-gray-500">
                  last seen {formatLastSeen(agent.last_seen)}
                </div>

                <div>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      agent.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {agent.status === "active" ? "Active" : "Banned"}
                  </span>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Control Bar */}
      <div data-testid="control-bar" className="bg-gray-50 border border-gray-200 rounded-lg p-3 md:p-4 mb-6">
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {/* Decision Filter */}
          <div data-testid="decision-filter" className="flex rounded-lg overflow-hidden border border-gray-300">
            <button
              data-testid="decision-filter-all"
              onClick={() => setDecisionFilter("ALL")}
              className={`px-3 py-1.5 text-xs font-medium ${
                decisionFilter === "ALL" ? "bg-gray-800 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              All
            </button>
            <button
              data-testid="decision-filter-allow"
              onClick={() => setDecisionFilter("ALLOW")}
              className={`px-3 py-1.5 text-xs font-medium border-l border-gray-300 ${
                decisionFilter === "ALLOW" ? "bg-green-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              Allow
            </button>
            <button
              data-testid="decision-filter-deny"
              onClick={() => setDecisionFilter("DENY")}
              className={`px-3 py-1.5 text-xs font-medium border-l border-gray-300 ${
                decisionFilter === "DENY" ? "bg-red-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              Deny
            </button>
          </div>

          <div className="hidden md:block w-px h-6 bg-gray-300" />

          {/* Agent & Tool Custom Dropdowns */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Agent Dropdown */}
            <div ref={agentDropdownRef} className="relative" data-testid="agent-dropdown">
              <button
                type="button"
                onClick={() => { setAgentDropdownOpen(!agentDropdownOpen); setToolDropdownOpen(false); }}
                className="flex items-center justify-between gap-2 min-w-[140px] text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white shadow-sm hover:bg-gray-50 cursor-pointer"
              >
                <span className="truncate">
                  {selectedAgent ? (agents.find(a => a.id === selectedAgent)?.display_name || selectedAgent) : "All Agents"}
                </span>
                <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${agentDropdownOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>
              {agentDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-white border border-gray-200 rounded-md shadow-lg z-20 max-h-60 overflow-y-auto">
                  <div
                    onClick={() => { setSelectedAgent(null); setAgentDropdownOpen(false); }}
                    className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 ${selectedAgent === null ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"}`}
                  >
                    All Agents
                  </div>
                  {agents.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => { setSelectedAgent(a.id); setAgentDropdownOpen(false); }}
                      className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 ${selectedAgent === a.id ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"}`}
                    >
                      {a.display_name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tool Dropdown */}
            <div ref={toolDropdownRef} className="relative" data-testid="tool-dropdown">
              <button
                type="button"
                onClick={() => { setToolDropdownOpen(!toolDropdownOpen); setAgentDropdownOpen(false); }}
                className="flex items-center justify-between gap-2 min-w-[140px] text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white shadow-sm hover:bg-gray-50 cursor-pointer"
              >
                <span className="truncate">
                  {filterTool || "All Tools"}
                </span>
                <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${toolDropdownOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>
              {toolDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-white border border-gray-200 rounded-md shadow-lg z-20 max-h-60 overflow-y-auto">
                  <div
                    onClick={() => { setFilterTool(null); setToolDropdownOpen(false); }}
                    className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 ${filterTool === null ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"}`}
                  >
                    All Tools
                  </div>
                  {uniqueTools.map((t) => (
                    <div
                      key={t}
                      onClick={() => { setFilterTool(t); setToolDropdownOpen(false); }}
                      className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 ${filterTool === t ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"}`}
                    >
                      {t}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="hidden md:block w-px h-6 bg-gray-300" />

          {/* High Risk Only Toggle */}
          <label data-testid="high-risk-toggle" className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={highRiskOnly}
              onChange={(e) => setHighRiskOnly(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-xs text-gray-700">High Risk</span>
          </label>

          {/* Spacer */}
          <div className="hidden md:block flex-1" />

          {/* Actions: Live / Refresh / Export */}
          <div className="flex items-center gap-2 md:gap-3">
            <label data-testid="live-mode-toggle" className="flex items-center gap-1.5 cursor-pointer">
              <span className="text-xs text-gray-700">Live</span>
              <div
                className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${
                  isLiveMode ? "bg-green-500" : "bg-gray-300"
                }`}
                onClick={() => setIsLiveMode(!isLiveMode)}
              >
                <div
                  className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                    isLiveMode ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </div>
            </label>

            <div className="w-px h-6 bg-gray-300" />

            <button
              data-testid="refresh-button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-200 rounded disabled:opacity-50"
            >
              <svg
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 2v6h-6M3 12a9 9 0 0115.36-6.36L21 8M3 22v-6h6M21 12a9 9 0 01-15.36 6.36L3 16" />
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <div className="hidden sm:block w-px h-6 bg-gray-300" />

            <button
              data-testid="export-csv"
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-200 rounded"
            >
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Chip Bar */}
      {(selectedAgent || filterTool || filterReason || decisionFilter !== "ALL") && (
        <div data-testid="filter-chips" className="flex flex-wrap items-center gap-2 mb-4">
          {selectedAgent && (
            <span data-testid="filter-chip-agent" className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
              Agent: {agents.find(a => a.id === selectedAgent)?.display_name || selectedAgent}
              <button onClick={() => setSelectedAgent(null)} className="ml-1 text-gray-400 hover:text-gray-600 cursor-pointer">&times;</button>
            </span>
          )}
          {filterTool && (
            <span data-testid="filter-chip-tool" className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
              Tool: {filterTool}
              <button onClick={() => setFilterTool(null)} className="ml-1 text-gray-400 hover:text-gray-600 cursor-pointer">&times;</button>
            </span>
          )}
          {decisionFilter !== "ALL" && (
            <span data-testid="filter-chip-decision" className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
              Decision: {decisionFilter}
              <button onClick={() => setDecisionFilter("ALL")} className="ml-1 text-gray-400 hover:text-gray-600 cursor-pointer">&times;</button>
            </span>
          )}
          {filterReason && (
            <span data-testid="filter-chip-reason" className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
              Reason: {filterReason}
              <button onClick={() => setFilterReason(null)} className="ml-1 text-gray-400 hover:text-gray-600 cursor-pointer">&times;</button>
            </span>
          )}
        </div>
      )}

      {/* Recent Activity Heading */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Activity</h2>

      {/* Judgment Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th
                data-testid="sort-time"
                onClick={() => handleSort("time")}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              >
                Time{sortIndicator("time")}
              </th>
              <th
                data-testid="sort-agent"
                onClick={() => handleSort("agent")}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              >
                Agent{sortIndicator("agent")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tool
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th
                data-testid="sort-decision"
                onClick={() => handleSort("decision")}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              >
                Decision{sortIndicator("decision")}
              </th>
            </tr>
          </thead>
          {isLoading ? (
            <SkeletonTableRows rows={5} />
          ) : (
            pageJudgments.map((j) => {
              const isDeny = j.decision === "DENY";
              const rowBg = isDeny ? "bg-red-50" : "";
              const groupHover = isDeny ? "group-hover:bg-red-100" : "group-hover:bg-gray-100";
              return (
                <tbody key={j.id} className="group cursor-pointer" onMouseEnter={() => handleRowHover(j.id)} onClick={() => router.push(`/judgments/${j.id}`)}>
                  <tr className={`${rowBg} ${groupHover} border-t border-gray-200`}>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {formatTime(j.ts)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {j.agent_role}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">
                      {j.tool}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">
                      {j.action}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          j.decision === "ALLOW"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-200 text-red-900"
                        }`}
                      >
                        {j.decision}
                      </span>
                    </td>
                  </tr>
                  <tr className={`${rowBg} ${groupHover}`}>
                    <td colSpan={5} className="px-4 pb-3 pt-0 text-xs text-gray-500">
                      {j.reason}
                    </td>
                  </tr>
                </tbody>
              );
            })
          )}
        </table>
      </div>

      {/* Pagination Bar (hidden during Live mode) */}
      {!isLiveMode && (
        <div data-testid="pagination-bar" className="flex items-center justify-between mt-4 px-2">
          <button
            data-testid="pagination-newer"
            onClick={handleNewer}
            disabled={!canGoNewer || isLoadingMore}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            &larr; Newer
          </button>

          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">
              {totalFiltered > 0
                ? `${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, totalFiltered)} of ${totalFiltered}`
                : "No results"}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Page size:</span>
              {[25, 50, 100].map((size) => (
                <button
                  key={size}
                  data-testid={`page-size-${size}`}
                  onClick={() => handlePageSizeChange(size)}
                  className={`px-2 py-1 text-xs rounded ${
                    pageSize === size
                      ? "bg-gray-800 text-white"
                      : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <button
            data-testid="pagination-older"
            onClick={handleOlder}
            disabled={!canGoOlder || isLoadingMore}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isLoadingMore ? "Loading..." : "Older →"}
          </button>
        </div>
      )}

      {/* BAN Modal */}
      {banModalState.isOpen && banModalState.agent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            {banModalState.step === 1 ? (
              <>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="text-yellow-500">&#x26A0;&#xFE0F;</span>
                  Ban Agent: {banModalState.agent.display_name}
                </h2>
                <div className="mb-6">
                  <p className="text-gray-700 mb-2">この操作により:</p>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    <li>このagentの /authorize リクエストはすべて DENY になります</li>
                    <li>理由: &quot;agent is banned&quot;</li>
                  </ul>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() =>
                      setBanModalState((prev) => ({ ...prev, isOpen: false }))
                    }
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() =>
                      setBanModalState((prev) => ({ ...prev, step: 2 }))
                    }
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    次へ
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-4">
                  BAN 理由と確認
                </h2>

                {banModalState.error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {banModalState.error}
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    BAN 理由 (必須):
                  </label>
                  <select
                    value={banModalState.reason}
                    onChange={(e) =>
                      setBanModalState((prev) => ({
                        ...prev,
                        reason: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="PII overreach">PII overreach</option>
                    <option value="Policy violation">Policy violation</option>
                    <option value="Suspicious pattern">Suspicious pattern</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {banModalState.reason === "Other" && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      理由を入力:
                    </label>
                    <input
                      type="text"
                      value={banModalState.customReason}
                      onChange={(e) =>
                        setBanModalState((prev) => ({
                          ...prev,
                          customReason: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      placeholder="理由を入力してください"
                    />
                  </div>
                )}

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    確認のため「BAN」と入力してください:
                  </label>
                  <input
                    type="text"
                    value={banModalState.confirmText}
                    onChange={(e) =>
                      setBanModalState((prev) => ({
                        ...prev,
                        confirmText: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    placeholder="BAN"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() =>
                      setBanModalState((prev) => ({ ...prev, isOpen: false }))
                    }
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleBanSubmit}
                    disabled={
                      banModalState.confirmText !== "BAN" ||
                      (banModalState.reason === "Other" &&
                        !banModalState.customReason.trim())
                    }
                    className={`px-4 py-2 rounded text-white ${
                      banModalState.confirmText === "BAN" &&
                      (banModalState.reason !== "Other" ||
                        banModalState.customReason.trim())
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-gray-300 cursor-not-allowed"
                    }`}
                  >
                    BAN 実行
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
