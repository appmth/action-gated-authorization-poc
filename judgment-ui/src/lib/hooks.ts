import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import type { JudgmentEvent } from "./types";
import {
  getActivity,
  getAgents,
  getJudgment,
  getMetricsOverview,
  getMetricsAgents,
  getMetricsReasons,
  getBlockLayerBreakdown,
  getToolRiskProfile,
  getBehaviorHeatmap,
} from "./api";

export function useActivityQuery(params: {
  limit?: number;
  cursor?: string | null;
  decision?: string | null;
  agent_id?: string | null;
  tool?: string | null;
} = {}) {
  return useQuery({
    queryKey: ["activity", params],
    queryFn: () => getActivity(params),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useAgentsQuery() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: () => getAgents(),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useJudgmentDetail(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["judgment", id],
    queryFn: () => getJudgment(id),
    staleTime: 60 * 1000,
    enabled: !!id,
    initialData: () => {
      const queries = queryClient.getQueriesData<{ items: JudgmentEvent[] }>({ queryKey: ["activity"] });
      for (const [, data] of queries) {
        const found = data?.items?.find((item) => item.id === id);
        if (found) return found;
      }
      return undefined;
    },
  });
}

export function useMetricsOverview() {
  return useQuery({
    queryKey: ["metrics", "overview"],
    queryFn: () => getMetricsOverview(),
    staleTime: 60 * 1000,
  });
}

export function useMetricsAgents() {
  return useQuery({
    queryKey: ["metrics", "agents"],
    queryFn: () => getMetricsAgents(),
    staleTime: 60 * 1000,
  });
}

export function useMetricsReasons() {
  return useQuery({
    queryKey: ["metrics", "reasons"],
    queryFn: () => getMetricsReasons(),
    staleTime: 60 * 1000,
  });
}

export function useBlockLayers() {
  return useQuery({
    queryKey: ["metrics", "blockLayers"],
    queryFn: () => getBlockLayerBreakdown(),
    staleTime: 60 * 1000,
  });
}

export function useToolRisks() {
  return useQuery({
    queryKey: ["metrics", "toolRisks"],
    queryFn: () => getToolRiskProfile(),
    staleTime: 60 * 1000,
  });
}

export function useBehaviorHeatmap() {
  return useQuery({
    queryKey: ["metrics", "heatmap"],
    queryFn: () => getBehaviorHeatmap(),
    staleTime: 60 * 1000,
  });
}
