# Judgment UI 速度改善設計書

## 1. 目的

Judgment UI の Activity Log / Governance Insights の **体感速度を最大化** する。

現状の課題:
- ページ遷移時に全データ fetch 完了まで Loading... テキストのみ表示される
- フィルタ切替でデータ再取得時に画面がチラつく
- Detail ページから Back した際に再 fetch が走る
- Governance Insights で全 API 完了まで何も表示されない

目標:
- Skeleton UI による即時フィードバック（データ到着前に構造を表示）
- キャッシュによるフィルタ切替・再訪問の高速化
- prefetch による Detail 遷移の高速化

## 2. 技術選定

**TanStack Query v5** (`@tanstack/react-query`) を採用する。

選定理由:
- React 標準の `useEffect` + `useState` パターンを置き換え、キャッシュ・再取得・ステール管理を宣言的に実現
- `keepPreviousData` によりフィルタ切替時のチラつきを防止
- `queryClient.prefetchQuery` によるホバー時の先読み
- Next.js App Router のクライアントコンポーネントと組み合わせ可能

## 3. アーキテクチャ

### 3.1 QueryClientProvider

`layout.tsx` に `QueryClientProvider` を追加する。QueryClient インスタンスは `src/lib/query-client.ts` でシングルトンとして生成する。

```
layout.tsx
  └── QueryClientProvider (provider={queryClient})
        └── SidebarProvider
              └── TopBar + Sidebar + main
```

QueryClient のデフォルト設定:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

### 3.2 カスタム hooks

既存の `lib/api.ts` の関数は **変更しない**。ラッパー hooks を `src/lib/hooks.ts` に作成する。

| hook 名 | 呼び出す api.ts 関数 | staleTime | 用途 |
|---|---|---|---|
| `useActivityQuery` | `getActivity()` | 30s | Activity Log メインデータ |
| `useAgentsQuery` | `getAgents()` | 30s | Agent タイル・ドロップダウン |
| `useJudgmentDetail` | `getJudgment(id)` | 60s | Judgment Detail |
| `useMetricsOverview` | `getMetricsOverview()` | 60s | Governance: System Status |
| `useMetricsAgents` | `getMetricsAgents()` | 60s | Governance: Agent-wise Deny Rate |
| `useMetricsReasons` | `getMetricsReasons()` | 60s | Governance: Block Reason |
| `useBlockLayers` | `getBlockLayerBreakdown()` | 60s | Governance: Block Layer |
| `useToolRisks` | `getToolRiskProfile()` | 60s | Governance: Tool Risk |
| `useBehaviorHeatmap` | `getBehaviorHeatmap()` | 60s | Governance: Heatmap |

### 3.3 キャッシュ戦略

| データ種別 | staleTime | gcTime | 理由 |
|---|---|---|---|
| Activity / Agents | 30s | 5min | リアルタイム性が高いため短めのstale |
| Metrics / Heatmap | 60s | 5min | 集計データのため多少古くても可 |

- `gcTime`（旧 cacheTime）: 5分。画面遷移後もキャッシュを保持し、戻った際に即時表示
- `keepPreviousData`: フィルタ変更時に前のデータを表示し続け、新データ到着で差し替え

## 4. Activity Log 改善

### 4.1 Skeleton UI

データ fetch 中は以下の Skeleton を即時表示する:

- **KPI カード**: 4枚のカード枠 + `animate-pulse bg-gray-200` のプレースホルダー
- **Agent タイル**: 横スクロール行に3枚の pulse タイル
- **テーブル行**: 5行分の pulse 行（5列 x 5行）

### 4.2 useActivityQuery + useAgentsQuery

```typescript
// Activity Log ページ
const { data: activityData, isLoading: activityLoading } = useActivityQuery({
  limit: 125,
  cursor: null,
});
const { data: agents, isLoading: agentsLoading } = useAgentsQuery();
```

- `isLoading` が true の間は Skeleton を表示
- データ到着後に Skeleton をデータ表示に差し替え
- 既存のフィルタ・ソート・ページネーション・BAN/Export 機能は **完全に維持**

### 4.3 Detail prefetch on hover

テーブル行ホバー時に `queryClient.prefetchQuery` で Detail データを先読みする:

```typescript
const queryClient = useQueryClient();

const handleRowHover = (id: string) => {
  queryClient.prefetchQuery({
    queryKey: ["judgment", id],
    queryFn: () => getJudgment(id),
    staleTime: 60_000,
  });
};
```

### 4.4 行クリック遷移の確実化

テーブル行クリックでの Detail ページ遷移を確実にするため、`<tbody>` に `onClick` ハンドラを設定する。

**課題**: 各 `<td>` 内に個別の `<Link>` を配置する方式では、セル間の隙間（border / padding）をクリックした際に遷移が発動しない。ユーザーが複数回クリックしないと遷移できないことがある。

**対応**:
1. `<tbody>` に `onClick={() => router.push(`/judgments/${j.id}`)}` を追加
2. 各 `<td>` 内の `<Link>` ラッパーを削除し、テキストのみ表示
3. `<tbody>` の `cursor-pointer` は維持（既存）

```tsx
<tbody
  key={j.id}
  className="group cursor-pointer"
  onMouseEnter={() => handleRowHover(j.id)}
  onClick={() => router.push(`/judgments/${j.id}`)}
>
  <tr className={`${rowBg} ${groupHover} border-t border-gray-200`}>
    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
      {formatTime(j.ts)}
    </td>
    {/* ... 他のセルも同様に Link を除去 */}
  </tr>
</tbody>
```

### 4.5 Detail 即時表示（initialData from Activity cache）

Activity Log からの遷移時、Detail ページの初期表示を高速化するため、`useJudgmentDetail` hook に `initialData` を追加する。

**仕組み**: Activity List 取得時にキャッシュされた items の中から該当 ID を検索し、見つかれば API 応答を待たずに即時表示する。バックグラウンドで最新データを fetch し差し替える。

```typescript
// hooks.ts
export function useJudgmentDetail(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["judgment", id],
    queryFn: () => getJudgment(id),
    staleTime: 60 * 1000,
    enabled: !!id,
    initialData: () => {
      const queries = queryClient.getQueriesData<{ items: JudgmentEvent[] }>({
        queryKey: ["activity"],
      });
      for (const [, data] of queries) {
        const found = data?.items?.find((item) => item.id === id);
        if (found) return found;
      }
      return undefined;
    },
  });
}
```

**効果**:
- Activity Log → Detail 遷移: API 応答を待たず即時表示（cache hit）
- 直接 URL アクセス: 従来通り API から fetch + Skeleton 表示
- prefetch（hover）との併用: prefetch 完了済みなら cache hit、未完了なら initialData fallback

### 4.6 Back navigation 即時復帰

Detail ページから Back した際、Activity Log のデータはキャッシュから即時復帰する。staleTime 内であれば再 fetch は走らない。

## 5. Governance Insights 改善

### 5.1 セクション単位の段階表示

各セクション（System Status / Overview / Governance Insight / Risk Profile / Behavior）ごとに独立した `useQuery` hook を使用する。

```
System Status  → useMetricsOverview + useAgentsQuery
Overview       → useMetricsOverview + useMetricsAgents
Gov Insight    → useMetricsReasons + useBlockLayers
Risk Profile   → useToolRisks
Behavior       → useBehaviorHeatmap
```

各セクションは独立してロード完了し、先に完了したセクションから表示される。

### 5.2 各セクション Skeleton

| セクション | Skeleton 構成 |
|---|---|
| System Status | 4枚のカード枠 + pulse |
| Overview | 2カラムグリッド + pulse 矩形 |
| Governance Insight | 2カラムグリッド + pulse 矩形 |
| Risk Profile | pulse バー x 3 |
| Behavior | pulse 矩形（ヒートマップ placeholder） |

### 5.3 キャッシュで再訪問の高速化

Activity Log から Governance Insights に遷移した際、gcTime 内であればキャッシュデータで即時表示。バックグラウンドで再検証（staleTime 超過時）。

## 6. 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `package.json` | `@tanstack/react-query` を dependencies に追加 |
| `src/lib/query-client.ts` | **新規**: QueryClient シングルトン + QueryProvider コンポーネント |
| `src/app/layout.tsx` | QueryProvider でラップ |
| `src/lib/hooks.ts` | **新規**: カスタム hooks (useActivityQuery, useAgentsQuery, etc.) |
| `src/components/Skeleton.tsx` | **新規**: Skeleton コンポーネント群 |
| `src/app/activity/page.tsx` | useActivityQuery + useAgentsQuery + Skeleton UI + prefetch on hover |
| `src/app/judgments/[id]/page.tsx` | Server Component → Client Component (useJudgmentDetail) |
| `src/app/governance/page.tsx` | セクション別 useQuery + 段階 Skeleton |
| `src/lib/api.ts` | **変更なし** |
| `src/lib/mock-data.ts` | **変更なし** |
| `src/lib/types.ts` | **変更なし** |
