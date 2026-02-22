# UI Consistency Fix Design Document

## 1. Purpose

Fix visual inconsistencies, data alignment issues, and missing UX behaviors in Judgment UI's Governance Insights and Activity Log pages. This document defines the exact changes needed to bring the UI to demo-ready quality.

## 2. Scope

### In Scope
- Agent Risk Heatmap layout and data display fixes
- Activity Log icon and badge spacing fixes
- Behavior section: show all agents, fix stat spacing
- Filter state URL synchronization
- Visual hierarchy improvements (hover feedback, number emphasis)
- Backend: behavior_heatmap endpoint to return all registered agents

### Explicitly Out of Scope
- New features or pages
- Performance improvements (already implemented via TanStack Query + Skeleton)
- Refactoring of existing architecture
- Changes to TanStack Query hooks, api.ts, or types.ts structure

## 3. Existing Architecture (Preserved)

The following are already implemented and must not be modified:

| Component | Status |
|---|---|
| TanStack Query v5 with staleTime/gcTime | Implemented (hooks.ts) |
| Skeleton-first loading | Implemented (Skeleton.tsx) |
| Prefetch on hover (judgment detail) | Implemented (activity/page.tsx) |
| keepPreviousData for filter changes | Implemented (hooks.ts) |
| Mock data fallback on API failure | Implemented (api.ts) |
| Backend Firestore aggregation for all metrics | Implemented (service-a/main.py) |

## 4. Changes

### 4.1 Agent Risk Heatmap (Governance Insights)

**File**: `judgment-ui/src/app/governance/page.tsx`

#### 4.1.1 High-risk threshold consistency

Current code has two different thresholds:
- Line 67: `metricsAgents.filter((r) => r.deny_rate >= 50).length` (SYSTEM STATUS)
- Line 427: `heatmap.agents.filter((a) => a.summary_deny_rate > 50)` (Heatmap warning)

**Fix**: Change line 427 threshold from `> 50` to `>= 50` to match SYSTEM STATUS.

#### 4.1.2 Right column stat layout

Current (lines 538-555): 4 stats stacked vertically with `gap-2` in 80px row height.

**Fix**: Use a structured two-column layout for each stat line:
- Label (left, fixed width `w-[32px]`, `text-gray-400`)
- Value (right, `font-semibold`, right-aligned)
- Reduce vertical gap from `gap-2` to `gap-1` to fit better in 80px
- OR increase ROW_HEIGHT to 90px

#### 4.1.3 Bottom margin

Add `mb-8` to the BEHAVIOR section outer container (line 370) to match other sections' spacing.

### 4.2 Activity Log UI Consistency

**File**: `judgment-ui/src/app/activity/page.tsx`

#### 4.2.1 All Agents icon

Current (lines 421-435): A custom SVG with two box shapes, antenna dots, and legs. Not clearly recognizable as "multiple agents".

**Fix**: Replace with a clearer multi-agent icon. Options:
- Two overlapping robot/agent silhouettes
- A 2x2 grid of small agent icons
- Keep the dual-robot motif but make it more recognizable (larger, clearer shapes)

The icon should be 24x24 (`w-6 h-6`) in `text-blue-500`.

#### 4.2.2 Selected badge spacing

Current (lines 474-483): `absolute top-2 left-5` badge can overlap with the agent display_name below.

**Fix**: When `isSelected` is true, add `pt-7` (or `mt-5`) to the content container (the `<div className="flex flex-col gap-2">` at line 557) to push content below the badge. This ensures the "Selected" badge and the agent name never overlap.

#### 4.2.3 Last updated (no change needed)

Current implementation (lines 371-374) already matches requirements: English text, `text-xs text-gray-400`, positioned at right side of title.

### 4.3 Behavior Section: All Agents

#### 4.3.1 Backend change

**File**: `service-a/main.py`, function `get_behavior_heatmap` (lines 1423-1539)

After the aggregation loop (line 1485), add a step to merge in all agents from the in-memory `agents` dict that don't yet have entries in `agent_data`:

```python
# After line 1485 (after "# Build response"):
# Ensure all registered agents appear in the heatmap
for agent_id, agent_info in agents.items():
    if agent_id not in agent_data:
        agent_data[agent_id] = {
            "cells": [{} for _ in range(24)],
            "total_allow": 0,
            "total_deny": 0,
            "last_5m_deny": 0,
        }
```

This ensures agents with zero events in the last 24h still appear in the heatmap with all-null cells.

#### 4.3.2 Frontend: Right column stat spacing

Same fix as 4.1.2. The right column stat layout improvement applies here.

#### 4.3.3 Mock data update

**File**: `judgment-ui/src/lib/mock-data.ts`

Update `mockHeatmapResponse.agents` to include all agents from `mockAgents` (currently the mock has 3 agents in heatmap but only 3 in mockAgents -- these happen to match, so no mock change needed for now).

### 4.4 Filter URL Synchronization

**File**: `judgment-ui/src/app/activity/page.tsx`

#### 4.4.1 Sync state to URL

Add a `useEffect` that updates URL query params when filter state changes:

```typescript
useEffect(() => {
  const params = new URLSearchParams();
  if (selectedAgent) params.set("agent", selectedAgent);
  if (filterTool) params.set("tool", filterTool);
  if (filterReason) params.set("reason", filterReason);
  if (decisionFilter !== "ALL") params.set("decision", decisionFilter);

  const queryString = params.toString();
  const newUrl = queryString ? `/activity?${queryString}` : "/activity";
  router.replace(newUrl, { scroll: false });
}, [selectedAgent, filterTool, filterReason, decisionFilter, router]);
```

**Important**: Use `router.replace()` (not `router.push()`) to avoid polluting browser history with every filter change. Pass `{ scroll: false }` to prevent scroll reset.

#### 4.4.2 Initial URL read (no change needed)

The existing `useEffect` at lines 114-122 reads URL params on mount. This is correct and should be preserved.

#### 4.4.3 clearFilters (no change needed)

`clearFilters()` at lines 217-225 resets all state and navigates to `/activity`. This is correct.

#### 4.4.4 Potential infinite loop prevention

The URL-read effect (4.4.2) sets state, which triggers the URL-write effect (4.4.1), which could cause an infinite loop. To prevent this:
- The URL-write effect should check if the URL would actually change before calling `router.replace()`
- OR: Remove the URL-read effect and instead initialize state from `searchParams` directly (since searchParams is available synchronously in the component)

### 4.5 Visual Hierarchy Improvements

**File**: `judgment-ui/src/app/governance/page.tsx`

#### 4.5.1 Clickable row hover feedback

Current clickable rows use `cursor-pointer hover:opacity-80`. Replace with:

- Agent-wise Deny Rate: `cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors`
- Block Reason Breakdown: same
- Tool-wise Risk Profile: same

Add a subtle right-arrow chevron on hover:
```html
<svg className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
  <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" fill="none" />
</svg>
```

Wrap each clickable row in a `group` class to enable the chevron hover.

#### 4.5.2 Number emphasis (optional, low priority)

SYSTEM STATUS cards already use `text-2xl font-bold`. This is sufficient for the demo. No change needed.

## 5. Files Changed

| File | Change Type | Description |
|---|---|---|
| `judgment-ui/src/app/governance/page.tsx` | Modify | Heatmap threshold fix, stat layout, hover feedback, bottom margin |
| `judgment-ui/src/app/activity/page.tsx` | Modify | All Agents icon, Selected badge spacing, URL sync |
| `service-a/main.py` | Modify | behavior_heatmap: include all registered agents |

## 6. Files NOT Changed

| File | Reason |
|---|---|
| `judgment-ui/src/lib/api.ts` | No API changes needed |
| `judgment-ui/src/lib/hooks.ts` | No hook changes needed |
| `judgment-ui/src/lib/types.ts` | No type changes needed |
| `judgment-ui/src/lib/mock-data.ts` | Mock data matches current needs |
| `judgment-ui/src/components/Skeleton.tsx` | Skeleton components are correct |

## 7. Testing

### Visual verification
- Heatmap card alignment matches OVERVIEW and RISK PROFILE cards
- Right column stats are readable (not cramped)
- All Agents icon is recognizable
- Selected badge does not overlap agent name
- Clickable rows have visible hover feedback

### Functional verification
- All registered agents appear in heatmap (even with zero events)
- High Risk Agents count in SYSTEM STATUS matches heatmap warning count
- Filter changes update URL query params
- Page refresh preserves filter state from URL
- clearFilters resets URL to /activity

### Existing tests
- Run `cd judgment-ui && npx playwright test --project=chromium` to verify no regressions
