# Judgment Dashboard (Judgment UI) 設計書

Judgment UI は、AI Agent の「判断」を可視化し、説明責任と構造的強制力の価値を直感的に伝えるための管理画面です。

## 1. 目的と役割
- **判断の可視化**: 「実行結果」ではなく「判断（Allow/Deny）」に焦点を当て、AIがどのようなポリシーに基づき意思決定したかを提示します。
- **説明責任 (Accountability)**: 特定のアクションがなぜ拒否されたのか、どの記述に基づいて許可されたのかを即座に説明可能な状態にします。
- **運用監視 (Observability)**: システム全体の判断傾向（許可率、エージェントごとの拒否率など）を可視化し、運用上の異常やポリシーの過不足を発見します。

## 2. 画面構成
本アプリケーションは、共通の**Global Shell**と、3つのメインビューで構成されます。

### A. Global Shell (共通レイアウト)
全ての画面で共通して表示されるナビゲーションフレームです。
- **Sidebar**: `Map`, `Graph` への遷移ナビゲーション。
- **Top Bar**: プロダクト名、現在のプロジェクト名 (`gov-demo`)、ユーザープロフィールを表示。

### B. Judgment Map (`/dashboard`)
判断の「時系列フロー」を可視化するメイン画面です。
- **リスト表示**: 時間、エージェントロール、対象ツール、アクション、判定結果 (`ALLOW`/`DENY`)、理由を表示します。
- **インタラクション**: 各行をクリックすることで `Judgment Detail` へ遷移します。
- **役割**: 個々の判断を俯瞰し、異常なパターンの有無を直感的に把握します。

### C. Judgment Detail (`/judgments/[id]`)
単一の判断に関する完全な説明責任を果たす詳細画面です。
- **Overview**: リクエストID、日時、判定結果。
- **Context**: エージェントが提示した文脈情報（JSON）。
- **Policy Decision (PDP)**: 判定理由、適用ポリシーID/バージョン。
- **Enforcement (PEP)**: 実際に強制されたアクション（PDP問い合わせ有無、ツール実行有無、副作用の有無）。
- **Trace**: リクエスト受信から完了までのステップごとのタイムスタンプとステータス。

### D. Judgment Graph (`/graph`)
運用状況と傾向を示す統計画面です。
- **Decision Distribution**: 全判定における許可/拒否の割合（円グラフ）。
- **Agent-wise Deny Rate**: エージェントロールごとの拒否率（バーチャート）。
- **役割**: 単発の判断ではなく、システム全体の傾向やポリシーの厳格さを評価します。

## 3. 技術スタック
- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (v4)
- **State Management**: Server Components (RSC) によるデータフェッチ主体。

## 4. データ連携 (API Interface)
`service-a` (Judgment Service) が提供する以下のAPIを利用します。

### Core APIs
- `GET /judgments?limit={n}`
    - 最新の判定一覧を取得。
- `GET /judgments/{request_id}`
    - 判定の詳細情報を取得。

### Metrics APIs (Step 2以降)
- `GET /metrics/decision-distribution`
    - 許可/拒否の分布統計を取得。
- `GET /metrics/agent-deny-rate`
    - エージェント別の拒否率統計を取得。

## 5. 実装フェーズ
### Step 1: Mock Development (完了)
- 目的: UI/UXの確定とデモシナリオの固定。
- 実装: フロントエンド側でダミーデータを保持し、API通信を行わずに画面遷移と表示ロジックを検証。

### Step 2: Real Data Integration (次フェーズ)
- 目的: 実稼働する `service-a` との連携。
- 実装: `service-a` に上記APIを実装し、UI側のデータソースを Mock から Fetch API に切り替える。
