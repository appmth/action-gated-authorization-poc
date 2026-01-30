# Judgment UI (Audit Dashboard) 設計書

Judgment UI は、システムが行った認可判定（Judgments）を可視化し、監査者（Auditor）が判定理由やメタデータを確認するためのダッシュボードです。

## 1. 役割
- **可視化**: `service-a` に蓄積された認実判定履歴を取得し、一覧および詳細を表示します。
- **監査支援**: なぜそのアクションが許可/拒否されたのか、基になったポリシーやタグ (`pii`, `audit-required` 等) を確認可能にします。

## 2. 画面構成

### A. Dashboard (`/dashboard`)
- **判定一覧**: 直近の判定リクエストをテーブル形式で表示します。
- **ステータス表示**: `ALLOW` / `DENY` をバッジで色分け表示し、一目で判定結果がわかるようにします。

### B. Judgment Detail (`/judgments/[id]`)
- **詳細情報**: リクエストID、対象エージェント、実行アクション、判定理由。
- **コンテキスト**: 判定時に送信されたビジネス文脈 (purpose, time 等) を表示。
- **ポリシーメタデータ**: 判定に適用された `policy_id` や付与された `tags` を表示。

## 3. 技術スタック
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **API 通信**: Server-side Data Fetching (Fetch API)

## 4. 連携インターフェース
`service-a` (Judgment サービス) の以下のエンドポイントからデータを取得します。

- `GET /judgments`: 判定履歴の一覧取得
- `GET /judgments/{id}`: 特定の判定詳細取得

> [!NOTE]
> 本コンポーネントは閲覧専用であり、ポリシー自体の編集機能（サービス管理機能）は将来の拡張予定です。
