# Judgment UI 設計書

Judgment UI は、AI Agent の認可判断（Judgments）を可視化し、「なぜその判断になったのか」を人間が確認・監査するための管理画面です。

## 1. 役割

- **判断の可視化**: 同じ行動でも Agent / 文脈で結果が変わることを一目で伝える
- **説明責任**: 各判断について「なぜ Allow / Deny になったのか」を1件単位で完全に説明する
- **運用像の提示**: 判断の傾向（Allow/Deny 比率、Agent 別 Deny Rate）を俯瞰する

## 2. 共通レイアウト（Global Shell）

GCP Console / Auth0 Dashboard と同等の「管理基盤としての安心感」を提供する共通構造。

```
┌──────────────────────────────────────────────────┐
│ [logo] Judgment          Project: ...    user ◯  │
│ AI Governance Platform                           │
└──────────────────────────────────────────────────┘
┌───────────────┬──────────────────────────────────┐
│ Sidebar       │ Main Content                     │
│ OVERVIEW      │                                  │
│  ▸ Activity Log     │                            │
│  ▸ Governance Insights │                         │
│               │                                  │
└───────────────┴──────────────────────────────────┘
```

### Favicon
- `<link rel="icon" href="/judgment-ui-favicon.svg" type="image/svg+xml">` を Next.js metadata の `icons` で設定（`layout.tsx`）
- ファビコンファイル: `public/judgment-ui-favicon.svg`

### Top Bar (`TopBar.tsx`)
- 背景: `bg-gray-900`（ダーク系）
- **左側: ブランドブロック**（2行構成）
  - 1行目: SVGロゴ（32px, `src="/judgment-ui-favicon.svg"`）+ 「Judgment」（`font-bold`）
  - 2行目: 「AI Governance Platform」（`text-sm text-gray-400`）
- **右側**: 「Project: Government AI Oversight」ラベル（`text-sm text-gray-300`）+ ユーザーアイコン
- **ユーザーアイコン**: 右端に配置。クリック可能な円形アイコン
  - クリックでドロップダウンメニュー表示
  - ユーザー名: `admin user`（固定）
  - メール: `admin@example.com`（固定）
  - テーマ切替・プロファイルリンクは不要
  - ドロップダウン外クリックで閉じる

### Sidebar (`Sidebar.tsx`)
- ブランドブロックなし（ロゴ・プロダクト名は TopBar に移動）
- セクション見出し: 「OVERVIEW」（旧「JUDGMENT」から変更）
- ナビゲーション:
  - **Activity Log** (`/activity`) -- 旧 `/map` からリネーム
  - **Governance Insights** (`/governance`) -- 旧 `/graph` からリネーム
- 現在ページのハイライト表示（`isActive` 判定）
- 幅: 固定 `w-60`

### レスポンシブ対応

3段階のブレークポイントで対応。Tailwind CSS のブレークポイントを使用する。

| ブレークポイント | Tailwind | 幅 | 表示 |
|---|---|---|---|
| Mobile | (default) | < 640px | サイドバー非表示（ハンバーガーメニューでオーバーレイ表示）|
| Tablet | `sm:` / `md:` | 640px - 1023px | サイドバー非表示（同上）|
| Desktop | `lg:` | >= 1024px | サイドバー常時表示（`w-60` 固定）|

- `SidebarContext.tsx`: サイドバー開閉状態を TopBar と Sidebar で共有する React Context
- TopBar: ハンバーガーボタン (`lg:hidden`) でサイドバーを開閉
- Sidebar: モバイル/タブレットでは `fixed` オーバーレイ + バックドロップ + スライドアニメーション。ナビリンクリック時に自動クローズ

#### 各画面のレスポンシブ対応方針

Global Shell（TopBar / Sidebar）は実装済み。以下は **各画面内コンテンツ** のレスポンシブ対応方針を定める。

##### Activity Log (`/activity`) のレスポンシブ対応

**Snapshot Summary（KPI カード）**
- 現状: `grid grid-cols-2 sm:grid-cols-4` — **対応済み**
- Last updated: `whitespace-nowrap` で折り返し防止済み

**Agent タイル行**
- 現状: `overflow-x-auto` + `min-w-[270px]` 固定 — 横スクロールのみ
- **改善方針**: Mobile では `min-w-[200px]` に縮小し、タイル内の情報を2行に折り返す。または `min-w-[270px]` を維持し横スクロールを許容する（PoC のため横スクロールで可）

**Control Bar（フィルタ行）** — **要対応（現状レスポンシブ指定なし）**
- Desktop（`md:` 以上）: 現状通り1行横並び
- Mobile（`md:` 未満）: `flex-wrap gap-2` でフィルタ群を折り返し配置
  - DecisionFilter（ALL/ALLOW/DENY）: 1行目に配置
  - Agent ドロップダウン + Tool ドロップダウン: 2行目に配置（`w-full` で横幅いっぱい、または `flex-1` で均等分割）
  - High Risk Only トグル: 3行目に配置
  - 右側アクション群（Live / Refresh / Export）: 最下行に配置
  - divider（`w-px h-6`）は Mobile では非表示（`hidden md:block`）

**Activity Table** — **要対応（現状は `overflow-x-auto` のみ）**
- Desktop: 現状通り5列テーブル（Time / Agent / Tool / Action / Decision）
- Mobile（`md:` 未満）: 以下のいずれかで対応
  - **案A（横スクロール維持）**: 現状の `overflow-x-auto` を維持。テーブル幅 `min-w-[600px]` を指定し、確実にスクロール可能にする（PoC のため最小工数で可）
  - **案B（カード表示）**: `<table>` を非表示にし、カード形式（1件1カード、各フィールドをラベル+値の縦並び）で表示する
  - **推奨**: PoC のため **案A** で十分
- Reason 2行目: Mobile でも `colspan` 全幅表示を維持

**Pagination Bar** — **要対応（現状レスポンシブ指定なし）**
- Desktop: 現状通り `flex items-center justify-between` で1行
- Mobile（`sm:` 未満）: `flex-col gap-2` で縦積みに変更
  - 1行目: ページ情報テキスト（`Page X of Y`）
  - 2行目: ページサイズ切り替えボタン群
  - 3行目: 前へ/次へボタン

##### Governance Insights (`/governance`) のレスポンシブ対応

**System Status カード**
- 現状: `grid grid-cols-2 md:grid-cols-4` — **対応済み**

**Overview / Governance Insight セクション**
- 現状: `grid grid-cols-1 lg:grid-cols-2` — **対応済み**

**Agent Risk Heatmap** — **要対応（固定幅カラムが非対応）**
- Desktop: 現状通り3カラム（Left 240px / Center flex:1, scroll / Right 220px）
- Tablet（`md:` 未満）: Left カラムを `w-[160px]` に縮小、Right カラムを `w-[160px]` に縮小
- Mobile（`sm:` 未満）: `overflow-x-auto` で横スクロールを許容（3カラム構造を維持）

##### Judgment Detail (`/judgments/[id]`) のレスポンシブ対応

- 現状: `flex flex-col sm:flex-row` でラベル+値の縦/横切り替え済み — **対応済み**

##### Legacy Log View (`/legacy-logs`) のレスポンシブ対応

- 現状: `overflow-x-auto` — **対応済み**（3列のため Mobile でも横スクロールで十分）

## 3. 画面構成

### A. Activity Log (`/activity`) -- メイン画面

AI Agent の判断履歴を時系列テーブルで一覧表示する。デモの中核画面。

- **ページタイトル**: 「AI Agent Activity Log」（旧「Judgment Map」からリネーム）
- **Last updated**: ヘッダー右側に `text-xs text-gray-400` で表示（例: `Last updated: 03:15:40`）

#### Agent タイル行（Snapshot Summary 直下、Control Bar 直前）

セクション見出し `<h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Agents</h2>` を表示し、横1行に flex で Agent タイルを並べる。

##### 選択ロジック

- `selectedAgentId: string | null` を唯一の信頼ソース（single source of truth）として使用
- `null` → 全エージェント表示（フィルタなし）
- `agentId` → そのエージェントのみ表示
- タイル選択・ドロップダウン変更・フィルタチップ dismiss・URL パラメータ読み込み、すべてが `selectedAgentId` を更新する

##### All Agents タイル（タイル行左端）

- タイル行の**左端**（個別Agentタイルの前）に「All Agents」タイルを常時表示
- タイルは常に表示される（`selectedAgent` の状態に関わらず非表示にしない）
- テキスト: 「All Agents」+アイコン（ユーザーグループSVG）
- `selectedAgent === null` 時（アクティブ状態）: `bg-blue-50 border-blue-200 shadow-sm` + 「Showing All」サブテキスト
- `selectedAgent !== null` 時（非アクティブ状態）: `bg-white border-gray-200 hover:bg-gray-50`
- クリック: `setSelectedAgent(null)`
- `data-testid="clear-agent-filter"`
- 最小幅: `min-w-[140px]`（個別タイルの `min-w-[270px]` より小さい）

##### 各 Agent タイル

- **各タイルの最小幅**: `min-w-[270px]`
- **各タイルの構成**:
  - AIアイコン: Agent名の左にAIアイコンを表示（インラインSVG robot/AIアイコン、またはフォールバックとして「🤖」）
  - Agent名: `display_name（論理名）/ name（物理名）` 例: `アシスタント / assistant`
  - Roleラベル: `Frontdesk` / `Backoffice`
  - 直近24h Allow/Deny カウント（小バッジ、警告絵文字⚠️なし）
  - **Deny Rate 表示**: `deny_24h / (allow_24h + deny_24h) * 100` をクライアントサイドで計算し `XX%` で表示
  - Last seen（最終確認時刻）
  - ステータスピル: `Active`（緑 `bg-green-100`）/ `Banned`（赤 `bg-red-100`）
- **枠線はリスク状態専用**（選択で変更しない）:
  - LOW (denyRate < 30%): `border-gray-200`
  - MEDIUM (30% <= denyRate < 50%): `border-orange-400 border-2`
  - HIGH (denyRate >= 50%): `border-red-400 border-2`
  - BANNED: `border-gray-400 border-2`
- **Banned Agent のタイル**: `opacity-60 bg-gray-50`（グレーアウト）で表示
- **選択中タイル（SELECTED）**: 枠線は変更せず、以下で表現
  - `bg-gray-50`（背景を薄いグレーに）
  - `shadow-md`（影を付与）
  - `scale-[1.01]`（微拡大でリフト感）
  - 左端に4pxのインジケーターバー（`absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-md`）
  - **「Selected」バッジ**: カード左上（左インジケーターバーの右）に目立つバッジ表示
    - Position: `absolute top-2 left-5`
    - Style: `text-[11px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-sm border border-blue-300 shadow-sm`
    - `data-testid="selected-badge"`
    - 非選択時は非表示
  - `aria-selected="true"`（アクセシビリティ属性）
- **複合状態の例**: HIGH + SELECTED = 赤枠維持 + bg-gray-50 背景 + 左インジケーターバー + 「Selected」バッジ + scale-[1.01] + aria-selected="true"
- **クリック**: テーブルを `agent_id` でフィルタ

##### タイルとドロップダウンの完全同期

- タイル選択 → dropdown 値も更新
- dropdown 変更 → タイル選択も更新
- All Agents タイル押下 → 両方クリア
- フィルタチップ Agent dismiss → 両方クリア
- `selectedAgentId` を唯一の信頼ソースとする（別の state 変数を持たない）

##### Agent タイル状態マトリクス

| 要素 | 表現 |
|---|---|
| リスク | 枠線色（赤/橙/灰） |
| 選択 | 左バー(4px, 青) + bg-gray-50 背景 + 「Selected」バッジ（左上、青色） + shadow-md + scale-[1.01] |

| リスク状態 | 非選択時の枠線 | 選択時の枠線 | 選択時の追加表現 |
|---|---|---|---|
| LOW | `border-gray-200` | `border-gray-200` (維持) | `bg-gray-50 shadow-md scale-[1.01]` + 左インジケーターバー + 「Selected」バッジ + `aria-selected="true"` |
| MEDIUM | `border-orange-400 border-2` | `border-orange-400 border-2` (維持) | 同上 |
| HIGH | `border-red-400 border-2` | `border-red-400 border-2` (維持) | 同上 |
| BANNED | `border-gray-400 border-2` | `border-gray-400 border-2` (維持) | 同上 |

#### kebab メニュー（タイル右上「...」）

- Ban Agent
- Unban Agent
- View Audit

#### BAN 2段階モーダル

**Step 1: 影響表示**
- 対象 agent
- `/authorize` が DENY になる旨の警告

**Step 2: 理由選択 + 確認**
- 理由選択: `PII overreach` / `Policy violation` / `Suspicious pattern` / `Other`
- 確認ワード「BAN」入力
- 成功後: タイル即更新、ログに BAN イベント追加

#### フィルタチップバー（Control Bar 直下、Recent Activity 見出し直前）

アクティブなフィルタをチップ（pill）形式で表示する。各チップは dismiss（×）ボタン付き。

- コンテナ: `data-testid="filter-chips"`, `flex flex-wrap items-center gap-2 mb-4`
- **1つ以上のフィルタがアクティブな場合のみ表示**（全フィルタ解除時は非表示）

| チップ種別 | 表示条件 | テキスト | dismiss 動作 | data-testid |
|---|---|---|---|---|
| Agent | `selectedAgentId !== null` | `Agent: {display_name}` | `setSelectedAgent(null)` | `filter-chip-agent` |
| Tool | `filterTool !== null` | `Tool: {tool_name}` | `setFilterTool(null)` | `filter-chip-tool` |
| Decision | `decisionFilter !== "ALL"` | `Decision: {ALLOW\|DENY}` | `setDecisionFilter("ALL")` | `filter-chip-decision` |
| Reason | `filterReason !== null` | `Reason: {reason}` | `setFilterReason(null)` | `filter-chip-reason` |

- チップスタイル: `inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-gray-100 text-gray-700 rounded-full`
- dismiss ボタン（×）: `ml-1 text-gray-400 hover:text-gray-600 cursor-pointer`

> 旧「Showing: {decision} | {agent} | {tool}」テキスト行および旧 Active Filters pills は廃止し、このフィルタチップバーに統合する。

#### "Recent Activity" 見出し（テーブル直上）

テーブルの直前に見出しのみを表示する:

- **見出し**: `<h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Activity</h2>`

#### テーブル

- **テーブルカラム**: Time / **Agent** / Tool / Action / Decision
  - 列名変更: `Agent Role` → `Agent`
  - Reason 列は独立カラムから削除し、2行目表示に変更（下記参照）
- **Decision バッジ**:
  - ALLOW = 緑 (`bg-green-100 text-green-800`)
  - DENY = 赤・強調 (`bg-red-200 text-red-900`)
- **DENY 行ハイライト**: `decision === "DENY"` の行全体に `bg-red-50` 背景を適用
- **REASON 2行表示**: 各 judgment を2つの `<tr>` でレンダリング
  - 1行目（データ行）: Time / Agent / Tool / Action / Decision
  - 2行目（reason行）: `colspan` で全幅、`text-xs text-gray-500` で reason テキストを表示
  - DENY の場合、2行目も `bg-red-50` 背景を適用
  - **統一ホバー**: データ行 + reason行を `<tbody className="group hover:bg-gray-100">` でグループ化し、2行を1つのホバー単位として扱う
- **行クリック**: `/judgments/{id}` に遷移
- `/` は `/activity` にリダイレクト
- `/map` は `/activity` に 301 リダイレクト（後方互換）
- `/graph` は `/governance` に 301 リダイレクト（後方互換）

#### Activity Log ページレイアウト順序

```
Snapshot Summary (KPI 4枚 + Last updated)
  ↓
Agent Tiles Row (All Agents タイル + 各エージェントタイル)
  ↓
Control Bar (フィルタ + アクション)
  ↓
Filter Chip Bar (アクティブフィルタのチップ表示、フィルタ未適用時は非表示)
  ↓
Recent Activity (見出し + テーブル)
```

#### Snapshot Summary（ページ先頭、Agent タイル行直前）

フィルタ適用済みデータの概要を4枚のステータスカードで表示する。

| カード | 値の計算方法 | data-testid |
|---|---|---|
| Total | `filteredJudgments.length` | `snapshot-total` |
| Allow | `filteredJudgments.filter(j => j.decision === "ALLOW").length` | `snapshot-allow` |
| Deny | `filteredJudgments.filter(j => j.decision === "DENY").length` | `snapshot-deny` |
| Deny Rate | `deny / total * 100` (%) | `snapshot-deny-rate` |

- レイアウト: 外枠を `flex items-center gap-4` で wrap。左に `flex-1` の grid、右に Last updated
- カードグリッド: `grid grid-cols-2 sm:grid-cols-4 gap-4`
- カード高さ統一: `h-[80px] flex flex-col justify-center`
- Deny Rate の色分け: 30%以上 → `text-orange-600`、50%以上 → `text-red-600`
- Last updated: KPI Row 右端に配置（`whitespace-nowrap`）
- コンテナ: `data-testid="snapshot-summary"`

#### Control Bar（Agent タイル行直下）

フィルタ・ライブモード・リフレッシュ・エクスポートを横並びで配置する。

- 背景: `bg-gray-50`（旧 `bg-white` から変更）
- 左右分離レイアウト: 左に `flex items-center gap-3` でフィルタ群、右に `flex items-center gap-3` でアクション群
- 各フィルタ間に divider: `<div className="w-px h-6 bg-gray-300" />`

```
[All] [Allow] [Deny] | Agent ▼ | Tool ▼ | ☐ High Risk Only  ── spacer ──  Live ● | ⟳ Refresh | Export CSV
└──────── Left (filters) ────────┘                           └──── Right (actions) ────┘
```

| コントロール | 説明 | data-testid |
|---|---|---|
| DecisionFilter | セグメントコントロール（ALL / ALLOW / DENY） | `decision-filter`, `decision-filter-all`, `decision-filter-allow`, `decision-filter-deny` |
| Agent カスタムドロップダウン | 既存 `selectedAgent` と統合。カスタムセレクト（`rounded-md border-gray-200 shadow-sm hover:bg-gray-50`）。開閉状態管理 + クリック外で閉じる。選択中は `bg-blue-50 text-blue-700 font-medium` | `agent-dropdown` |
| Tool カスタムドロップダウン | 既存 `filterTool` と統合。同上のカスタムセレクトスタイル | `tool-dropdown` |
| High Risk Only トグル | `highRiskOnly` state で高リスクエージェントのみ表示 | `high-risk-toggle` |
| Live Mode トグル | ON: 緑、OFF: グレー。3秒間隔で自動 fetch | `live-mode-toggle` |
| Refresh ボタン | fetchData() 呼び出し。ローディング中 `animate-spin` + disabled | `refresh-button` |
| Export CSV ボタン | フィルタ・ソート適用済みデータを CSV ダウンロード | `export-csv` |

- コンテナ: `data-testid="control-bar"`

#### テーブルソート

Time / Agent / Decision のカラムヘッダをクリック可能にする。

| カラム | state | data-testid |
|---|---|---|
| Time | `sortColumn: "time"` | `sort-time` |
| Agent | `sortColumn: "agent"` | `sort-agent` |
| Decision | `sortColumn: "decision"` | `sort-decision` |

- クリックでソート方向を切り替え（asc → desc → null）
- ソートインジケータ: 昇順 `▲`、降順 `▼`
- `sortDirection`: `"asc"` | `"desc"`

#### Live Mode

- ON 時: `setInterval(fetchData, 3000)` で3秒間隔自動 fetch
- OFF 時: `clearInterval` で停止
- `useEffect` の cleanup で `clearInterval`
- トグルボタン: ON = 緑背景、OFF = グレー背景

#### Export CSV

- フィルタ・ソート適用済みの `filteredJudgments` を CSV 出力
- カラム: Time, Agent, Tool, Action, Decision, Reason
- 実装: `Blob` + `URL.createObjectURL` + `a.click()` でダウンロード

#### 実装注意
- ページ全体を `"use client"` に変更（フィルタ状態管理）
- `useEffect` + `useState` パターンで実装

### B. Judgment Detail (`/judgments/[id]`) -- 詳細画面

1件の判断を完全に説明する。4セクション構成。

1. **Overview**: Decision / Agent Role / Agent ID / Tool / Action / Timestamp
2. **Reason**: 判断理由（日本語テキスト）
3. **Policy**: policy_id + tags（バッジ表示）
4. **Context (sanitized)**: サニタイズ済みコンテキスト（JSON形式）

- 1画面完結（スクロール不要、`max-w-3xl`）
- 「Back to Activity Log」リンクを上部に配置
- サイドバーのナビゲーションには含めない（Activity Log からのみ遷移）

### C. Governance Insights (`/governance`) -- グラフ画面

判断の傾向を俯瞰する画面。旧「Judgment Graph」からリネーム。

- **ページタイトル**: 「Governance Insights」（旧「Judgment Graph」からリネーム）

#### SYSTEM STATUS（新規セクション -- ページ最上部）

ページ冒頭に4つのステータスカードを横並びで表示する。

| カード | 値の計算方法 | 表示例 |
|---|---|---|
| Active Agents | `agents.filter(a => a.status === "active").length` | `2` |
| Banned Agents | `agents.filter(a => a.status === "banned").length` | `0` |
| Global Deny Rate | `deny_pct` from DecisionDistribution | `32%` |
| High Risk Agents | `denyRates.filter(r => r.deny_pct >= 50).length` | `1` |

- カードスタイル: `bg-white border border-gray-200 rounded-lg p-4`
- Global Deny Rate >= 50% の場合: `text-red-600 font-bold` で強調
- 4列 `grid grid-cols-4 gap-4`
- **Anomaly Warning Banner**: Global Deny Rate > 50% の場合、SYSTEM STATUS 直下に警告バナーを表示
  - スタイル: `bg-yellow-50 border border-yellow-300 rounded-lg p-3`
  - テキスト: 「Anomaly Detected: Global deny rate exceeds 50%」

#### OVERVIEW（結果の全体像）

1. **Decision Distribution**
   - ドーナツチャート（SVG）
   - **中央に Deny Rate 表示**（旧: 総件数 → 新: `deny_pct%`）
   - ALLOW（緑）/ DENY（赤）

2. **Agent-wise Deny Rate**
   - 横棒グラフ（CSS）
   - `deny_pct` 降順でソート
   - **deny_pct >= 50% のバー**: `bg-red-600`（通常は `bg-red-400`）+ テキスト `text-red-600 font-bold`
   - **Banned Agent**: バー全体を `opacity-40` + agent名に `(Banned)` サフィックス追加

#### GOVERNANCE INSIGHT（なぜ・どこで止めたか）

3. **Block Reason Breakdown**
   - deny reason 内訳の横棒グラフ（CSS）
   - reason ごとの件数・割合を表示
   - **クリック**: reason をクリックすると `/activity?reason={reason}` に遷移（cross-page filter）

4. **Block Layer Breakdown**
   - L1 Judgment / L2 Envoy / L3 Tool の積み上げ棒グラフ（CSS）
   - 各レイヤーでのブロック件数を表示

#### RISK PROFILE（何が危険か）

5. **Tool-wise Risk Profile**
   - ツール別 deny rate 横棒グラフ（CSS）
   - `deny_pct` 降順でソート
   - total / deny_count / deny_pct を表示
   - **クリック**: tool をクリックすると `/activity?tool={tool}` に遷移（cross-page filter）

#### BEHAVIOR（エージェントの振る舞い）

6. **Agent Risk Heatmap**（3カラム HTML レイアウト）

   エージェント別・時間バケット別の Deny Rate をヒートマップで可視化する。
   API エンドポイント: `GET /metrics/behavior_heatmap`

   **レイアウト構造**:
   ```
   <div className="bg-white border border-gray-200 rounded-lg p-6">
     <div className="flex">
       Left (240px)    | Center (flex:1, overflow-x-auto) | Right (220px)
       Agent Labels     | Heatmap Grid (24 cells/row)       | Agent Summary
     </div>
   </div>
   ```
   - **外側コンテナ**: `max-w` 制限なし（他カードと同一の全幅レイアウト）、`p-6` で他セクションとパディング統一
   - **Left Column (240px)**: Agent名（HTML、クリック可能）+ role
   - **Center Column (flex:1)**: 24 個のセル（1時間バケット）を固定幅グリッド（`gridTemplateColumns: repeat(24, ${CELL_SIZE}px)`）で描画。`overflow-x-auto` で横スクロール可能。マウント時に右端（Now）へ自動スクロール
   - **Right Column (220px)**: 各行に Total / Deny / Rate / 5m の4行を縦配置（各項目1行、ラベル `text-gray-400`、値 `font-semibold`、行間 `gap-2`）
   - **Row 高さ**: 各 agent row = 80px（3カラム共通）
   - **親カード**: `p-6`（他カードと統一）
   - **縦スクロール**: `overflow-y-auto max-h-[600px]` でエージェント数制限なし

   **ヒートマップセル**:
   - 各セルは 1 時間バケットを表す（直近 24 時間、計 24 セル）
   - セルの色は deny_rate に基づく 5 段階の離散色:
     - 0%: `bg-green-100`（緑系）
     - 1-29%: `bg-green-300`
     - 30-49%: `bg-yellow-400`
     - 50-79%: `bg-orange-500 text-white`
     - 80-100%: `bg-red-600 text-white`
   - **Low confidence 表示**: total < 10 のセルは `opacity-60` + 右上にドットインジケータ
   - **空セル**: データなし（null）のセルは `bg-gray-50` + "-" テキスト

   **BAN 表示**:
   - Banned agent の行全体に `bg-red-50` 背景 + 左側に `border-l-4 border-l-red-500`
   - Agent 名の横に赤いダイヤ形アイコン（SVG `<path d="M8 1l3 7-3 7-3-7z" />`）
   - Agent 名の右に「BANNED」バッジ（`text-[10px] font-bold bg-red-100 text-red-600 rounded`）

   **カラムラベル（時間軸）**:
   - 5 分割ラベル: `-24h`, `-18h`, `-12h`, `-6h`, `Now`
   - Center column 上部に固定幅グリッドで均等配置（`gridTemplateColumns: repeat(24, ${CELL_SIZE}px)`）
   - `Now` は右端固定、`text-blue-600 font-bold` で強調

   **CSS ホバーツールチップ**:
   - 各セルホバーで deny_rate, allow 数, deny 数, total 数, 時間範囲を表示
   - Tailwind `group` / `group-hover:block` パターンによる CSS-only 実装

   **Warning Bar**:
   - Deny Rate 50% 超のエージェントがいる場合、ヒートマップ上部に警告バナーを表示
   - テキスト: 「High-risk agents detected: {agent names}」

   **Legend（ヒートマップ下部）**:
   - 色スケール凡例: `0-10%`(green) | `10-30%`(lime) | `30-50%`(yellow) | `50-70%`(orange) | `70-100%`(red) | `N/A`(gray)
   - BAN 凡例: 赤ダイヤアイコン + "Banned"

   - **各 Agent 行の Deny Rate 表示**: Left column に `deny_pct%` を表示
   - **各 Agent 行の Risk Level**: deny_pct に基づき `Low` / `Medium` / `High` を表示
     - Low: deny_pct < 30%
     - Medium: 30% <= deny_pct < 50%
     - High: deny_pct >= 50%
   - **Agent Summary（Right column）**: 各 agent 行に以下を4行で縦配置表示
     - Total: 全アクション数（ラベル muted, 値 semibold）
     - Deny: DENY 数
     - Rate: 全体の Deny 率（50%以上は `text-red-600`）
     - 5m: 直近5分のDeny数
   - **クリック操作**:
     - **Agent名クリック**: `router.push('/activity?agent={agent}')` で Activity Log に遷移し、該当 agent でフィルタ

#### 実装制約
- chart library 不使用（CSS/SVG のみ）
- アニメーション・ツールチップなし
- `"use client"` + `useEffect` + `useState` パターンで実装
- Block Reason / Tool-wise Risk Profile のクリックによる cross-page filter のみインタラクティブ

### D. Legacy Log View (`/legacy-logs`) -- 問題提起用画面

デモ冒頭の「Before AGA」フェーズで使用する隠しルート。

- **タイトル**: 「Execution Log」（"Judgment" を意図的に使わない）
- **テーブルカラム**: Time / Tool / Status のみ
- 全行 "success"（Agent Role / Reason / Decision なし）
- 色: 無機質なグレー系
- サイドバーにリンクなし（URL 直接入力でのみアクセス）

## 4. ルーティング

| パス | 画面 | 備考 |
|---|---|---|
| `/` | リダイレクト | → `/activity` |
| `/activity` | Activity Log | メイン画面（旧 `/map`） |
| `/activity?agent=xxx` | Activity Log（フィルタ済み） | agent でフィルタ |
| `/activity?tool=xxx` | Activity Log（フィルタ済み） | tool でフィルタ |
| `/activity?reason=xxx` | Activity Log（フィルタ済み） | reason でフィルタ |
| `/judgments/[id]` | Judgment Detail | Activity Log から行クリックで遷移 |
| `/governance` | Governance Insights | サイドバーからアクセス（旧 `/graph`） |
| `/legacy-logs` | Legacy Log View | 隠しルート（デモ用） |
| `/map` | 301 リダイレクト | → `/activity`（後方互換） |
| `/map?*` | 301 リダイレクト | → `/activity?*`（クエリパラメータ保持） |
| `/graph` | 301 リダイレクト | → `/governance`（後方互換） |

#### Cross-page filter URL パラメータスキーム

Graph（Governance Insights）ページから Activity Log ページへの遷移時に URL query parameters を使用する。

| パラメータ | 用途 | 生成元 |
|---|---|---|
| `agent` | Agent名でフィルタ | Agent-wise Deny Rate クリック |
| `tool` | Tool名でフィルタ | Tool-wise Risk Profile クリック |
| `reason` | Reason テキストでフィルタ | Block Reason Breakdown クリック |

- stateless: ページリロードしてもフィルタが維持される
- shareable: URL を共有するだけでフィルタ済みビューを再現可能
- Activity Log ページ側で `useSearchParams()` で読み取り、テーブルをフィルタ

### デモ遷移フロー

```
/legacy-logs → /activity (Activity Log) → /judgments/{id} → /governance (Governance Insights) → /activity?tool=xxx (filtered Activity Log)
```

## 5. データモデル

### JudgmentEvent（主要型）

```typescript
type JudgmentEvent = {
  id: string;           // 一意ID
  ts: string;           // ISO 8601 タイムスタンプ
  agent_id: string;     // エージェント識別子
  agent_role: string;   // "assistant" | "admin"
  tool: string;         // ツール名
  action: string;       // アクション名
  decision: "ALLOW" | "DENY";
  reason: string;       // 判断理由（日本語）
  policy_id: string;    // ポリシーID
  policy_tags: string[];// タグ配列
  context: Record<string, string>; // サニタイズ済みコンテキスト
};
```

### Agent 型

```typescript
type Agent = {
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
```

### Graph 用の型

```typescript
type BlockReasonEntry = {
  reason: string;
  count: number;
  pct: number;
};

type BlockLayerEntry = {
  layer: string;
  count: number;
  pct: number;
};

type ToolRiskEntry = {
  tool: string;
  total: number;
  deny_count: number;
  deny_pct: number;
};

type AgentTimelineEntry = {
  agent: string;
  entries: {
    ts: string;
    decision: string;
    is_ban?: boolean;
  }[];
};

type HeatmapCell = {
  allow: number;
  deny: number;
  deny_rate: number;
  total: number;
};

type HeatmapAgent = {
  agent_id: string;
  display_name: string;
  role: string;
  status: "active" | "banned";
  summary_deny_rate: number;
  summary_total: number;
  summary_deny: number;
  last_5m_deny: number;
  cells: (HeatmapCell | null)[];
};

type HeatmapResponse = {
  window: string;
  bucket_size: string;
  bucket_starts: string[];
  agents: HeatmapAgent[];
};
```

### 補助型

```typescript
type LegacyLog = { time: string; tool: string; status: string; };
type DecisionDistribution = { allow_pct: number; deny_pct: number; };
type AgentDenyRate = { agent: string; deny_pct: number; };
```

## 6. データ取得方式

### STEP1: モックデータ（完了済み）

外部 API 通信は行わず、`src/lib/mock-data.ts` のハードコードデータを使用。

| 関数 | 用途 |
|---|---|
| `getJudgments()` | Activity Log 用（5件、ALLOW/DENY 混在） |
| `getJudgment(id)` | Judgment Detail 用（id で1件取得） |
| `getLegacyLogs()` | Legacy Log 用（10件、全行 success） |
| `getDecisionDistribution()` | Graph 左カラム用（ALLOW 68% / DENY 32%） |
| `getAgentDenyRate()` | Graph 右カラム用（assistant 35% / admin 12%） |

### STEP2: 実データ連携

`src/lib/api.ts` の各関数を、`NEXT_PUBLIC_API_URL` 環境変数を使って service-a の API を fetch するように変更する。

#### 変更対象の関数と対応 API

| 関数 | API エンドポイント | 方式 |
|---|---|---|
| `getActivity(cursor?, limit?)` | `GET ${NEXT_PUBLIC_API_URL}/activity` | fetch → `{ items, next_cursor, has_more }` |
| `getJudgments()` | `GET ${NEXT_PUBLIC_API_URL}/judgments` | **deprecated** — `getActivity()` を使用 |
| `getJudgment(id)` | `GET ${NEXT_PUBLIC_API_URL}/judgments/${id}` | fetch → JudgmentEvent |
| `getDecisionDistribution()` | `GET ${NEXT_PUBLIC_API_URL}/metrics/decision-distribution` | fetch → DecisionDistribution |
| `getAgentDenyRate()` | `GET ${NEXT_PUBLIC_API_URL}/metrics/agent-deny-rate` | fetch → AgentDenyRate[] |
| `getLegacyLogs()` | (変更なし) | モックデータのまま維持 |
| `getAgents()` | `GET ${NEXT_PUBLIC_API_URL}/agents` | fetch + mock fallback → Agent[] |
| `banAgent(id, reason)` | `POST ${NEXT_PUBLIC_API_URL}/agents/${id}/ban` | fetch (POST) |
| `unbanAgent(id)` | `POST ${NEXT_PUBLIC_API_URL}/agents/${id}/unban` | fetch (POST) |
| `getBlockReasonBreakdown()` | `GET ${NEXT_PUBLIC_API_URL}/metrics/block-reason-breakdown` | fetch + mock fallback → BlockReasonEntry[] |
| `getBlockLayerBreakdown()` | `GET ${NEXT_PUBLIC_API_URL}/metrics/block-layer-breakdown` | fetch + mock fallback → BlockLayerEntry[] |
| `getToolRiskProfile()` | `GET ${NEXT_PUBLIC_API_URL}/metrics/tool-risk-profile` | fetch + mock fallback → ToolRiskEntry[] |
| `getAgentTimeline()` | `GET ${NEXT_PUBLIC_API_URL}/metrics/agent-timeline` | fetch + mock fallback → AgentTimelineEntry[] |
| `getBehaviorHeatmap()` | `GET ${NEXT_PUBLIC_API_URL}/metrics/behavior_heatmap` | fetch + mock fallback → HeatmapResponse |

#### エラーハンドリング方針

```
fetch 成功 → API データを使用
fetch 失敗 → mock-data.ts のデータにフォールバック
```

- **理由**: デモ撮影時に service-a が不調でも UI が壊れないことを保証する
- `NEXT_PUBLIC_API_URL` が未設定の場合もモックデータにフォールバック
- `getLegacyLogs()` は常にモックデータ（Legacy Log は意図的に「判断なし」の世界を表現するため）

#### 実装パターン（api.ts の各関数）

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function getJudgments(): Promise<JudgmentEvent[]> {
  if (!API_URL) return judgmentEvents; // フォールバック
  try {
    const res = await fetch(`${API_URL}/judgments`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return judgmentEvents; // フォールバック
  }
}
```

- `cache: 'no-store'` を指定し、常に最新データを取得する（Next.js の fetch キャッシュを無効化）
- 各画面コンポーネント（Server Component）が async/await で `api.ts` の関数を呼び出す

#### 画面コンポーネントへの影響

- `api.ts` の関数が `async` に変わるため、各 page.tsx の呼び出し元も `async` に対応が必要
- Next.js App Router の Server Component はデフォルトで async/await 対応済みのため、大きな変更は不要
- Client Component（`"use client"`）の場合は `useEffect` + `useState` パターンに変更

#### mock-data.ts の扱い

- **削除しない**: フォールバック用に残す
- api.ts から import して、fetch 失敗時の返り値として使用する

## 7. 技術スタック

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **グラフ描画**: CSS / SVG（外部 chart library 不使用）
- **データ**: モックデータ（STEP1）→ service-a API + モックフォールバック（STEP2）

## 8. ファイル構成

```
judgment-ui/src/
├── app/
│   ├── layout.tsx          # Global Shell（SidebarProvider + Top Bar + Sidebar）
│   ├── TopBar.tsx           # トップバー（ブランドブロック + ハンバーガーメニュー）
│   ├── Sidebar.tsx          # サイドバー（デスクトップ静的 / モバイルオーバーレイ）
│   ├── SidebarContext.tsx   # サイドバー開閉状態の React Context
│   ├── page.tsx             # / → /activity リダイレクト
│   ├── globals.css          # グローバルスタイル
│   ├── activity/
│   │   └── page.tsx         # Activity Log（旧 /map）
│   ├── judgments/
│   │   └── [id]/
│   │       └── page.tsx     # Judgment Detail
│   ├── governance/
│   │   └── page.tsx         # Governance Insights（旧 /graph）
│   ├── map/
│   │   └── page.tsx         # 301 → /activity（後方互換リダイレクト）
│   ├── graph/
│   │   └── page.tsx         # 301 → /governance（後方互換リダイレクト）
│   └── legacy-logs/
│       └── page.tsx         # Legacy Log View
└── lib/
    ├── types.ts             # 型定義（JudgmentEvent 等）
    ├── mock-data.ts         # モックデータ（フォールバック用に残す）
    └── api.ts               # データ取得関数（fetch + mock fallback）
```

## 9. Dockerfile / Cloud Run デプロイ

### Dockerfile 仕様

Next.js の `standalone` output を使用した multi-stage build で構成する。

```dockerfile
# --- Stage 1: Dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Stage 2: Build ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# --- Stage 3: Production ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

### next.config.ts の変更

`output: 'standalone'` を追加する必要がある:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

### Cloud Run 設定

| 項目 | 値 |
|---|---|
| ポート | 3000 |
| メモリ | 512Mi |
| CPU | 1 |
| 最小インスタンス | 0 |
| ビルド引数 | `NEXT_PUBLIC_API_URL=https://service-a.action-gated.tech` |

### デプロイコマンド

```bash
./scripts/deploy.sh prod judgment-ui
```

`deploy.sh` の既存ケース（`judgment-ui|gov-ui`）で対応。`--port 3000` の追加が必要な場合がある。

## 10. 環境変数

| 変数名 | デフォルト値 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | (なし) | service-a の接続先 URL。未設定時はモックデータにフォールバック |

| 環境 | 値 |
|---|---|
| ローカル開発 | `http://localhost:8080` |
| GCP 本番 | `https://service-a.action-gated.tech` |

> [!NOTE]
> `NEXT_PUBLIC_` プレフィックスにより、ビルド時にクライアントサイドにも埋め込まれます。STEP2 では Server Component から fetch するため、サーバーサイドでのみ使用されますが、Next.js の規約に従いプレフィックスを維持します。

> [!NOTE]
> 本コンポーネントは閲覧専用であり、ポリシー自体の編集機能（サービス管理機能）は将来の拡張予定です。
