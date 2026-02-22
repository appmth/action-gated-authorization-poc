# 設計ドキュメント一覧

`action-gated-authorization-poc` の設計ドキュメントのインデックスです。

---

## 機能一覧

### コア認可機能（バックエンド）

| # | 機能名 | 概要 | 関連コンポーネント |
| :--- | :--- | :--- | :--- |
| C-1 | **認可判定（Authorize）** | AI Agent のアクション実行前に PDP（OPA）へ問い合わせ、Allow / Deny を判定。同じ Action でも Context（purpose × time）により結果が変わる | service-a `/authorize` |
| C-2 | **実行仲介（Execute）** | Allow 時に発行される JWT（execution_handle）を検証し、Envoy Gateway 経由でツールを実行。JTI による二重実行防止を含む | service-a `/execute` |
| C-3 | **ポリシー判定エンジン** | Rego 言語で記述されたポリシーに基づき、4 アクション × 5 目的 × 2 時間帯の組み合わせを判定。判断理由（reason）を必ず返却 | service-b (OPA) |
| C-4 | **構造的強制力** | Envoy Gateway による JWT 署名検証 + scope ベース RBAC + API キー自動注入。アプリロジックに依存しないインフラ層での認可制御 | envoy-gateway |
| C-5 | **Tool API（L3 防御）** | API キー検証ミドルウェアによる多層防御。Envoy を経由しない直接アクセスを遮断 | service-c |
| C-6 | **Agent BAN / UNBAN** | Agent を動的に BAN / UNBAN。BAN 中は PDP を経由せず即座に DENY。BAN イベントも判定履歴に記録 | service-a `/agents/{id}/ban`, `/agents/{id}/unban` |
| C-7 | **判定データ永続化** | 全判定結果を Firestore `judgment_events` に非同期保存。TTL（72h）による自動削除。カーソルベースページング対応 | service-a, Firestore |

### Judgment UI（監査ダッシュボード）

| # | 機能名 | 概要 | 画面 / パス |
| :--- | :--- | :--- | :--- |
| J-1 | **Activity Log** | AI Agent の判断プロセスを時系列テーブルで一覧表示。判定結果だけでなく「どの文脈で、どのポリシーが参照され、どの理由で Allow / Deny されたか」を記録・閲覧できる。説明可能性（Explainability）を構造として担保 | `/activity` |
| J-2 | **Judgment Detail** | 1 件の判断を完全に説明する詳細画面。Decision / Agent / Tool / Action / Reason / Policy / Context を1画面で確認可能 | `/judgments/[id]` |
| J-3 | **Governance Insights** | 蓄積された判断データを俯瞰し、ガバナンス状態を可視化するダッシュボード。過度なポリシー、見逃し傾向、チケット再利用パターンなどをデータから把握し、継続的なポリシー最適化を支援 | `/governance` |
| J-3a | ├ Decision Distribution | Allow / Deny の比率をドーナツチャート（SVG）で表示。中央に Deny Rate を強調表示 | `/governance` |
| J-3b | ├ Agent-wise Deny Rate | Agent 別の Deny 率を横棒グラフで可視化。高リスク Agent（50%超）を赤色で強調 | `/governance` |
| J-3c | ├ Block Reason Breakdown | DENY 理由の内訳を横棒グラフで表示。理由クリックで Activity Log へフィルタ遷移 | `/governance` |
| J-3d | ├ Block Layer Breakdown | ブロック層（L1 Judgment / L2 Envoy / L3 Tool）別の内訳を表示 | `/governance` |
| J-3e | ├ Tool-wise Risk Profile | ツール別 Deny 率を表示。ツールクリックで Activity Log へフィルタ遷移 | `/governance` |
| J-3f | └ Agent Risk Heatmap | Agent 別 × 時間バケット（24h）の Deny Rate をヒートマップで可視化。BAN 状態・Low confidence 表示・CSS ツールチップ付き | `/governance` |
| J-4 | **Agent タイル** | Agent 一覧をカード形式で表示。リスクレベル（LOW / MEDIUM / HIGH）を枠線色で表現。BAN 2段階モーダル（影響表示 → 理由選択 + 確認ワード入力）を提供 | `/activity` |
| J-5 | **フィルタ / ソート** | Decision / Agent / Tool / Reason によるフィルタリング。URL パラメータと同期し、リロード・URL 共有でフィルタ維持。テーブルカラムソート対応 | `/activity` |
| J-6 | **Live Mode** | 3 秒間隔の自動データ更新。トグルで ON / OFF 切替 | `/activity` |
| J-7 | **Export CSV** | フィルタ・ソート適用済みデータを CSV ダウンロード | `/activity` |
| J-8 | **Legacy Log View** | 「Before AGA」の世界を表現する隠しルート。Tool / Status のみの無機質なログ（Agent / Reason / Decision なし）。デモ冒頭で AGA 導入前の課題を提示 | `/legacy-logs` |
| J-9 | **Cross-page Filter** | Governance Insights の各グラフ要素をクリックすると Activity Log にフィルタ付きで遷移。URL パラメータベースで stateless | `/governance` → `/activity` |

### Gov-UI（行政問い合わせ UI）

| # | 機能名 | 概要 | 画面 / パス |
| :--- | :--- | :--- | :--- |
| G-1 | **2段階認可フロー体験** | Authorize → Execute の2フェーズを UI 上で体験。ステップインジケータで進行状態を可視化。Deny 時はツール未実行で理由を表示 | `/inquiry` |
| G-2 | **住民データ閲覧** | Agent がアクセス可能なデータ範囲を表示。Judgment なしの場合のリスクを視覚的に提示 | `/residents` |

### 運用・テスト支援

| # | 機能名 | 概要 | 関連コンポーネント |
| :--- | :--- | :--- | :--- |
| O-1 | **Agent Simulator** | 6種の AI Agent（窓口対応 / 夜間対応 / 給付管理 / 給付窓口 / 監査 / 通知）をシミュレーション。重み付きランダムで Action + Context を選択し、service-a に認可リクエストを送信。Cloud Scheduler による定期実行 | agent-simulator |
| O-2 | **Docker Compose 開発環境** | 全サービス（service-a / b / c / envoy / agent-simulator / firestore-emulator）をワンコマンドで起動 | docker-compose.yml |
| O-3 | **Cloud Run デプロイ** | `scripts/deploy.sh` による GCP 環境への統一デプロイ。UI は standalone ビルド + multi-stage Docker | scripts/deploy.sh |
| O-4 | **Playwright E2E テスト** | Judgment UI の主要画面・操作フローを自動テスト | judgment-ui/tests/ |

---

## ドキュメント一覧

| ファイル名 | タイトル | 概要 |
| :--- | :--- | :--- |
| **[01-environment-management.md](01-environment-management.md)** | 環境変数管理設計 | Build Once, Run Anywhere を実現するための環境変数注入方式（Native / Template）の定義 |
| **[02-structural-enforcement.md](02-structural-enforcement.md)** | 構造的強制力の詳細 | Envoy Gateway + JWT + Sidecar パターンによる、アプリロジックに依存しない認可制御の仕組み |
| **[03-interface-spec.yaml](03-interface-spec.yaml)** | API 仕様 (OpenAPI v1.2.0) | Judgment (Service-A), PDP (Service-B), Tool (Service-C) のAPI定義。GET /activity, メトリクス API 含む |
| **[04-sequence-diagram.md](04-sequence-diagram.md)** | シーケンス図 | 認可判定 (Authorzation Phase) から 実行 (Execution Phase) までの詳細な処理フロー |
| **[05-architecture-diagram.md](05-architecture-diagram.md)** | 全体アーキテクチャ | システム全体の構成要素、通信経路、依存関係の鳥瞰図 |
| **[06-local-development.md](06-local-development.md)** | ローカル開発ガイド | Docker Compose を用いた開発環境の構築・起動手順とデバッグ方法 |
| **[07-gcp-infrastructure.md](07-gcp-infrastructure.md)** | インフラ構成 (GCP) | Cloud Run, Firestore, Secret Manager などの GCP リソース構成とデプロイ概略 |
| **[10-service-a-judgment.md](10-service-a-judgment.md)** | Service-A 詳細設計 | Judgment Service の責務、内部ロジック、データモデル（Firestore judgment_events, カーソルベースページング） |
| **[11-service-b-pdp.md](11-service-b-pdp.md)** | Service-B 詳細設計 | PDP (OPA) のポリシー構造と判定ロジック |
| **[12-envoy-gateway.md](12-envoy-gateway.md)** | Envoy Gateway 詳細設計 | Envoy の設定、JWT検証、およびルーティングルール |
| **[13-service-c-tool.md](13-service-c-tool.md)** | Service-C 詳細設計 | Tool API のモック実装と保護機能 |
| **[20-judgment-ui.md](20-judgment-ui.md)** | Judgment UI 詳細設計 | 認可判断を可視化・監査する管理画面（Global Shell + Activity / Detail / Governance / Legacy Log の4画面構成） |
| **[21-gov-ui.md](21-gov-ui.md)** | Gov-UI (行政 UI) 設計 | デモ用行政問い合わせ UI。2段階認可フロー（Authorize → Execute）を体験するフロントエンド |
| **[22-speed-improvement.md](22-speed-improvement.md)** | Judgment UI 速度改善設計 | TanStack Query v5 によるキャッシュ・Skeleton UI・prefetch を用いた Activity Log / Governance Insights の体感速度最大化 |
| **[23-ui-consistency-fix.md](23-ui-consistency-fix.md)** | UI Consistency Fix | Heatmap layout, Activity Log icons/badges, filter URL sync, visual hierarchy improvements for demo readiness |
| **[30-agent-simulator.md](30-agent-simulator.md)** | Agent Simulator 設計 | 6種 AI Agent のシミュレーションにより、Judgment Dashboard にリアルなデータを供給するトラフィック生成サービス |
