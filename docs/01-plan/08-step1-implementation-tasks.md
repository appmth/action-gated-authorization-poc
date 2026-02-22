# STEP1 モック開発 -- 実装タスク一覧

## 前提

- 本ドキュメントは `docs/01-plan/06-judgment-dashboard-plan.md` および `docs/01-plan/07-demo-scenario-plan.md` を権威ドキュメントとして参照する
- STEP1 の目的は「デモ撮影に進められる状態」を作ること
- 実データ連携・API通信は行わない（すべてモックデータ）
- デモナレーション（`demo/02-naration.md`）と画面が完全同期することが最終ゴール

---

## 現状分析

### 既存の judgment-ui 実装状態

| ファイル | 現状 | STEP1での扱い |
|---|---|---|
| `src/app/layout.tsx` | ヘッダーのみ（nav bar）。サイドバーなし | Global Shell に全面書き換え |
| `src/app/page.tsx` | `/dashboard` へリダイレクト | `/map` へリダイレクトに変更 |
| `src/app/dashboard/page.tsx` | service-a API 呼び出しテーブル | Judgment Map に全面書き換え |
| `src/app/judgments/[request_id]/page.tsx` | service-a API 呼び出し詳細（pep_enforcement, trace 等の複雑構造） | 計画書仕様の簡潔な Judgment Detail に全面書き換え |
| `src/lib/types.ts` | JudgmentSummary, JudgmentDetail, TraceStep | Judgment Event 仕様に合わせて再定義 |
| `src/lib/api.ts` | service-a への fetch | モックデータ提供に完全切り替え |
| `src/component/CopyButton.tsx` | クリップボードコピーボタン | 不要。削除可 |
| `src/lib/auto-import-sandbox.ts` | 学習用サンドボックス | 不要。削除可 |

### 存在しないもの（新規作成が必要）

- Judgment Graph 画面
- Legacy Log View 画面（`/legacy-logs`）
- Global Shell（Sidebar + Top Bar）
- モックデータファイル

---

## 依存関係

```
タスク 1（モックデータ・型定義）
  ├── タスク 2（Global Shell）--- 独立して着手可能
  ├── タスク 3（Judgment Map）--- タスク 1 に依存
  ├── タスク 4（Judgment Detail）--- タスク 1, 3 に依存
  ├── タスク 5（Judgment Graph）--- タスク 1 に依存
  └── タスク 6（Legacy Log View）--- 独立して着手可能
タスク 7（画面遷移・ルーティング整合）--- タスク 2〜6 すべて完了後
```

推奨着手順: 1 → 2 → 3 → 4 → 5 → 6 → 7
（タスク 2 と 6 はタスク 1 と並行可能）

---

## タスク 1: モックデータ定義と型リファクタ

- **目的**: 全画面が参照するデータの型と値を確定させる。API依存を完全に排除する
- **対象**: `judgment-ui/src/lib/types.ts`, `judgment-ui/src/lib/api.ts`, 新規 `judgment-ui/src/lib/mock-data.ts`
- **やること**:
  - `src/lib/types.ts` を以下の Judgment Event 仕様に書き換える
    ```typescript
    export type JudgmentEvent = {
      id: string;           // 一意ID（例: "j-001"）
      ts: string;           // ISO 8601 タイムスタンプ
      agent_id: string;     // エージェント識別子
      agent_role: string;   // "assistant" | "admin"
      tool: string;         // ツール名（例: "benefit", "resident", "notify"）
      action: string;       // アクション名（例: "update", "read", "send"）
      decision: "ALLOW" | "DENY";
      reason: string;       // 判断理由（日本語、ナレーション同期）
      policy_id: string;    // ポリシーID（例: "P-UPDATE-001"）
      policy_tags: string[]; // タグ配列（例: ["money", "human-required"]）
      context: Record<string, string>; // サニタイズ済みコンテキスト
    };
    ```
  - `src/lib/mock-data.ts` を新規作成し、以下のデータを定義する
    - **Judgment Map 用データ**（最低5件、ALLOW/DENY混在）:
      1. `assistant` / `benefit` / `update` → **DENY** / 理由:「決定権限なし」
      2. `admin` / `benefit` / `update` → **ALLOW** / 理由:「条件付き承認」
      3. `assistant` / `resident` / `read` → **ALLOW** / 理由:「範囲限定」
      4. `assistant` / `notify` / `send` → **ALLOW** / 理由:「監査対象」
      5. `assistant` / `resident` / `read` → **ALLOW** / 理由:「範囲限定（2件目）」
    - **Legacy Log 用データ**（10件程度）:
      - Tool名と "success" だけの無機質なレコード
    - **Graph 用データ**（集計済み定数）:
      - Decision Distribution: ALLOW 68%, DENY 32%
      - Agent-wise Deny Rate: assistant_agent 35%, admin_agent 12%
  - `src/lib/api.ts` を書き換え、fetch を廃止し `mock-data.ts` から直接返す関数に変更する
    - `getJudgments()` → モックデータ配列を返す
    - `getJudgment(id)` → モックデータから1件返す
    - `getLegacyLogs()` → Legacy Log データを返す
    - `getDecisionDistribution()` → 集計データを返す
    - `getAgentDenyRate()` → Agent別統計を返す
  - `src/component/CopyButton.tsx` を削除する
  - `src/lib/auto-import-sandbox.ts` を削除する
- **やらないこと**:
  - Firestore への書き込みスクリプト（STEP2 スコープ）
  - データの動的生成・ランダム化（デモ用なので固定値）
  - NEXT_PUBLIC_API_URL 環境変数の維持（モックなので不要）
- **Done 条件**:
  - `src/lib/types.ts` が Judgment Event 仕様のみを定義している
  - `src/lib/mock-data.ts` にナレーション同期データが5件以上定義されている
  - `src/lib/api.ts` が外部 fetch を一切行わず、モックデータを返す
  - `npm run build` がエラーなく通る
  - 不要ファイル（CopyButton.tsx, auto-import-sandbox.ts）が削除されている

---

## タスク 2: Global Shell 実装（Top Bar + Sidebar）

- **目的**: GCP Console / Auth0 Dashboard 同等の「管理基盤としての安心感」を提供する共通レイアウトを実装する
- **対象**: `judgment-ui/src/app/layout.tsx`
- **やること**:
  - `layout.tsx` を全面書き換えし、以下の構成にする

    ```
    ┌──────────────────────────────────────────────────┐
    │ Top Bar                                          │
    │ Judgment  ▸  Project: gov-demo       user ◯     │
    └──────────────────────────────────────────────────┘
    ┌──────────┬───────────────────────────────────────┐
    │ Sidebar  │ Main Content（children）               │
    │          │                                       │
    │ Judgment │                                       │
    │  ▸ Map   │                                       │
    │  ▸ Graph │                                       │
    │          │                                       │
    │ Settings │                                       │
    └──────────┴───────────────────────────────────────┘
    ```

  - **Top Bar 仕様**:
    - プロダクト名: 「Judgment」
    - Project / Environment 表示: 「Project: gov-demo」
    - ユーザーアイコン: ダミー丸アイコン（右端）
    - 背景色: ダーク系（bg-gray-900 程度）
    - 操作可能な要素なし（すべて静的表示）
  - **Sidebar 仕様**:
    - ロゴ領域: 「Judgment」+ サブタイトル「Action-Gated Authorization」（小さく）
    - ロゴクリックで `/map` に遷移
    - ナビゲーション:
      - Judgment（セクションラベル）
        - Map（`/map` にリンク）
        - Graph（`/graph` にリンク）
      - Settings（セクションラベル、リンク先なし、表示のみ）
    - 現在ページのハイライト（アクティブ状態の視覚的区別）
    - 幅: 固定（w-60 程度）
    - 背景: 白またはライトグレー
  - **レスポンシブ対応はしない**（デモはデスクトップ撮影のみ）
- **やらないこと**:
  - 検索バー（計画書で明示的に除外）
  - 通知・アラート・トースト（計画書で明示的に除外）
  - ダークモード切替（計画書で明示的に除外）
  - サイドバーの展開/折り畳みアニメーション（計画書で動的切替なしと明記）
  - モバイル・レスポンシブ対応（デモ撮影はデスクトップのみ）
- **Done 条件**:
  - Top Bar が全ページ共通で表示される
  - Sidebar が全ページ共通で表示される（ただし Judgment Detail は後続タスクで調整可能）
  - ロゴクリックで `/map` に遷移する
  - Map / Graph のサイドバーリンクが正しく機能する
  - 現在ページがサイドバー上でハイライトされる
  - `npm run build` がエラーなく通る

---

## タスク 3: Judgment Map 画面実装

- **目的**: デモの中核画面。AI Agent の判断履歴を一覧で見せ、「同じ行動でも文脈で結果が変わる」ことを一目で伝える
- **対象**: `judgment-ui/src/app/dashboard/page.tsx` → `judgment-ui/src/app/map/page.tsx` にリネーム（または新規作成＋旧ファイル削除）
- **やること**:
  - ルートを `/map` に変更する（`src/app/map/page.tsx`）
  - 旧 `src/app/dashboard/page.tsx` は削除する
  - `src/app/page.tsx` のリダイレクト先を `/map` に変更する
  - 画面タイトル: 「Judgment Map」
  - サブテキスト: 「判断の履歴。実行結果は扱わない」（計画書ワイヤーフレームより）
  - テーブル構成（計画書仕様に厳密に従う）:

    | カラム | 内容 |
    |---|---|
    | Time | タイムスタンプ（HH:MM:SS 形式） |
    | Agent Role | agent_role（"assistant" / "admin"） |
    | Tool | tool名 |
    | Action | action名 |
    | Decision | ALLOW（緑） / DENY（赤）バッジ |
    | Reason | 判断理由（日本語） |

  - ALLOW: 緑バッジ / DENY: 赤バッジ（色は最小限）
  - 行クリックで Judgment Detail（`/judgments/{id}`）に遷移する
  - データは `mock-data.ts` のモックデータを使用する
  - ソート・検索・ページングなし（計画書で明示除外）
- **やらないこと**:
  - ソート機能（計画書で除外）
  - 検索・フィルタ（計画書で除外）
  - ページング（計画書で除外）
  - API呼び出し（STEP1はモック）
- **Done 条件**:
  - `/map` でテーブルが表示される
  - テーブルカラムが計画書の6列（Time / Agent Role / Tool / Action / Decision / Reason）と一致する
  - ALLOW が緑、DENY が赤で表示される
  - ALLOW と DENY が混在するデータが表示されている
  - 行クリックで `/judgments/{id}` に遷移する
  - `/` にアクセスすると `/map` にリダイレクトされる
  - 旧 `/dashboard` ルートが存在しない（削除済み）
  - `npm run build` がエラーなく通る

---

## タスク 4: Judgment Detail 画面実装

- **目的**: 「なぜこの判断になったのか」を1件で完全に説明する。監査・行政文脈でも耐える情報構造
- **対象**: `judgment-ui/src/app/judgments/[request_id]/page.tsx` → `judgment-ui/src/app/judgments/[id]/page.tsx` にリネーム
- **やること**:
  - ルートパラメータを `[request_id]` から `[id]` に変更する（mock-data の id フィールドに合わせる）
  - ページを全面書き換えし、計画書ワイヤーフレームに厳密に従う:

    ```
    ┌──────────────────────────────────────────────────┐
    │ Judgment Detail                                   │
    ├──────────────────────────────────────────────────┤
    │ Decision    : DENY                               │
    │ Agent Role  : assistant                          │
    │ Agent ID    : agent-a                            │
    │ Tool        : update_benefit_status               │
    │ Action      : update                             │
    │ Timestamp   : 2026-02-01 12:03:10                │
    ├──────────────────────────────────────────────────┤
    │ Reason                                           │
    │  給付ステータスの更新は、                        │
    │  人的確認が必要な操作として定義されているため     │
    ├──────────────────────────────────────────────────┤
    │ Policy                                           │
    │  policy_id : P-UPDATE-001                        │
    │  tags      : [money, human-required]              │
    ├──────────────────────────────────────────────────┤
    │ Context（sanitized）                             │
    │ {                                                │
    │   "resident_id": "****a92f",                     │
    │   "target": "benefit_status"                     │
    │ }                                                │
    └──────────────────────────────────────────────────┘
    ```

  - 4つのセクション: Overview / Reason / Policy / Context
  - スクロールさせない（1画面完結）
  - Decision の ALLOW/DENY を色で区別（ALLOW: 緑系, DENY: 赤系）
  - サイドバーは表示するが、Judgment Detail はサイドバーのナビゲーションに項目を持たない（Map からのみ遷移する位置づけ）
  - 「Back to Map」リンクを上部に配置する
  - データは `mock-data.ts` のモックデータを id で引き当てる
- **やらないこと**:
  - pep_enforcement セクション（現在の実装にあるが計画書にない。削除する）
  - trace / audit trace セクション（現在の実装にあるが計画書にない。削除する）
  - tool_result セクション（現在の実装にあるが計画書にない。削除する）
  - CopyButton の使用（削除済み）
  - スクロールが必要な長い情報（計画書で「1画面完結」と明記）
- **Done 条件**:
  - `/judgments/{id}` で計画書ワイヤーフレーム通りの4セクションが表示される
  - Decision / Agent Role / Agent ID / Tool / Action / Timestamp が表示される
  - Reason が日本語で表示される
  - Policy（policy_id, tags）が表示される
  - Context が JSON 形式で表示される
  - 「Back to Map」リンクが機能する
  - 1画面に収まる（スクロール不要）
  - `npm run build` がエラーなく通る

---

## タスク 5: Judgment Graph 画面実装

- **目的**: 運用した結果の傾向を示し、AI Agent が増えた未来を自然に想起させる
- **対象**: 新規 `judgment-ui/src/app/graph/page.tsx`
- **やること**:
  - `/graph` ルートを新規作成する
  - 画面タイトル: 「Judgment Graph」
  - サブテキスト: 「Last 24h」
  - 2カラム構成（計画書ワイヤーフレームに従う）:

    **左カラム: Decision Distribution**
    - 円グラフ（CSS/SVGで実装。chart library は追加しない）
    - ALLOW: 68% / DENY: 32%
    - 色: ALLOW=緑系 / DENY=赤系

    **右カラム: Agent-wise Deny Rate**
    - 横棒グラフ（CSS/SVGで実装）
    - assistant_agent: 35%（バー表示）
    - admin_agent: 12%（バー表示）
    - パーセンテージのみ表示。回数は出さない

  - すべて静的値（mock-data.ts の定数を使用）
  - アニメーションなし
  - ツールチップなし
  - 操作不可（見るだけ）
- **やらないこと**:
  - chart library（recharts, chart.js 等）の追加（CSS/SVGで十分。依存を増やさない）
  - アニメーション・トランジション（計画書で除外）
  - ツールチップ（計画書で除外）
  - 数値の動的計算（固定ダミー値）
  - レスポンシブ対応
- **Done 条件**:
  - `/graph` で2カラムレイアウトが表示される
  - 左に Decision Distribution の円グラフ（ALLOW 68% / DENY 32%）が表示される
  - 右に Agent-wise Deny Rate の横棒グラフが表示される
  - グラフはCSSまたはSVGのみで描画され、外部chart libraryを使用していない
  - アニメーション・ツールチップが存在しない
  - `npm run build` がエラーなく通る

---

## タスク 6: Legacy Log View 画面実装

- **目的**: デモ冒頭の「問題提起フェーズ」（0:00-1:00）で使用する。判断レイヤがない世界の不全を可視化する
- **対象**: 新規 `judgment-ui/src/app/legacy-logs/page.tsx`
- **やること**:
  - `/legacy-logs` ルートを新規作成する（サイドバーには表示しない隠しルート）
  - 画面仕様:
    - タイトル: 「Execution Log」（あえて "Judgment" という語を使わない）
    - 無機質なテーブル:

      | Time | Tool | Status |
      |---|---|---|
      | 12:03:10 | update_benefit_status | success |
      | 12:03:15 | update_benefit_status | success |
      | 12:03:20 | read_resident_record | success |
      | ... | ... | ... |

    - 「誰が」「なぜ」という情報が欠落していることを視覚的に強調する
    - Agent Role なし、Reason なし、Decision なし
    - 全行が "success" のみ（判断レイヤがないので止められない）
    - 色: 単色（グレー系。緑も赤もない）
    - 10件程度のデータ
  - サイドバーのナビゲーションには追加しない（隠しルート）
  - ナレーション「この画面は、実行が成功したログです」に対応する
- **やらないこと**:
  - サイドバーへのリンク追加（隠しルートなのでナビに表示しない）
  - 複雑なスタイリング（意図的に無機質にする）
  - 失敗ログ（すべて success。止められない世界を表現する）
- **Done 条件**:
  - `/legacy-logs` で無機質なテーブルが表示される
  - テーブルカラムが Time / Tool / Status のみ
  - 全行の Status が "success"
  - Agent Role / Reason / Decision カラムが存在しない
  - サイドバーに `/legacy-logs` へのリンクが存在しない
  - 10件程度のデータが表示される
  - `npm run build` がエラーなく通る

---

## タスク 7: 画面遷移・ルーティング整合と最終確認

- **目的**: デモ撮影時にナレーション通りの画面遷移が確実にできることを保証する
- **対象**: 全ルート、全ページ、テスト
- **やること**:
  - 以下のデモ遷移フローが動作することを確認する:
    1. `/legacy-logs` を表示（問題提起フェーズ 0:00-1:00）
    2. ブラウザで `/map` に直接遷移（解決フェーズ 1:00-2:15）
    3. Judgment Map で DENY 行をクリック → `/judgments/{id}` に遷移（保証フェーズ 2:15-3:00）
    4. ブラウザバックまたはサイドバーで `/graph` に遷移（保証フェーズ 2:15-3:00）
    5. サイドバーまたはロゴクリックで `/map` に戻る（締め）
  - 旧ルートの削除確認:
    - `/dashboard` が存在しないこと（404になること）
  - 既存テストの更新:
    - `tests/dashboard.spec.ts` → `/map` 用に書き換え or 新規作成
    - `tests/judgment-detail.spec.ts` → 新しい Detail 画面に合わせて更新
    - `tests/example.spec.ts` → 削除（Playwright 公式サイトへのテストで不要）
  - 新規テスト（最低限）:
    - `/` → `/map` へのリダイレクト
    - Judgment Map のテーブル表示
    - Judgment Map の行クリック → Detail 遷移
    - Judgment Detail の4セクション表示
    - Judgment Graph の2カラム表示
    - Legacy Log View の表示
  - `npm run build` が成功すること
  - ローカル dev サーバーで全画面遷移が手動確認できること
- **やらないこと**:
  - E2E テストの網羅的追加（最低限のスモークテストのみ）
  - パフォーマンステスト
  - クロスブラウザテスト（chromium のみ）
- **Done 条件**:
  - 上記デモ遷移フロー 1〜5 がすべて動作する
  - 旧 `/dashboard` ルートが 404 を返す
  - 全テストがパスする（`cd judgment-ui && npx playwright test --project=chromium`）
  - `npm run build` がエラーなく通る
  - デモ撮影可能な状態になっている

---

## 明示的にやらないこと一覧

| 項目 | 理由 |
|---|---|
| service-a への API 通信 | STEP1 はモック開発。STEP2 で実データ連携 |
| Firestore へのデータ投入スクリプト | STEP2 スコープ（`scripts/inject-demo-scenario.py`） |
| 実行シミュレーター（Mock Agent & PEP） | STEP2 スコープ |
| chart library の追加（recharts等） | CSS/SVG で十分。依存を増やさない |
| レスポンシブ対応 | デモ撮影はデスクトップのみ |
| ダークモード | 計画書で明示的に除外 |
| 検索・フィルタ・ソート | 計画書で明示的に除外 |
| ページング | 計画書で明示的に除外 |
| CSV / Export | 計画書で明示的に除外 |
| 通知・アラート・トースト | 計画書で明示的に除外 |
| Settings ページの実装 | サイドバーにラベルのみ表示。ページは作らない |
| IAM / 認証 | CLAUDE.md で明示的にスコープ外 |
| Cloud Run へのデプロイ | STEP1 はローカル開発のみ |
| NEXT_PUBLIC_API_URL の維持 | モックのため不要 |
| i18n / 多言語対応 | デモは日本語固定 |
