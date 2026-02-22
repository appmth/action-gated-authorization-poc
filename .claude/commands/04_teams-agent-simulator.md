- architect - 設計・スコープ定義・タスク分割・Done条件の定義などを担当
- Implementer - architectが定義したタスクの実装を担当
- tester - ローカル動作の検証・デモ準備・デプロイ確認を担当
でチームを組んで、
architect エージェントに以下の作業を依頼してください。

前提ドキュメント：
- /Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/02-design
- /Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/01-plan
  - 01~09まで
- 本文章下部の仕様書

目的：
機能開発をしてほしい。

依頼内容：
1. 実装に入る前に必要な「設計タスク」をすべて洗い出す
2. 各タスクについて、以下を必ず含める
   - 目的
   - 対象コンポーネント / ディレクトリ
   - やること
   - 明示的に「やらないこと」
   - Done 条件
3. タスクは implementer がそのまま着手できる粒度にする
4. プランの作成（/Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/01-plan）→設計書（/Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/02-design）の作成（修正）→実装→ローカルでのテスト→GCPへのデプロイ→GCP上でのテストという順番でやること

# 仕様書：Agent Simulator（Cloud Run）実装（ClaudeCode 用）

## 目的
- 「多数のAI Agentが稼働している」ように見えるイベントを自動生成し、Judgment UI（Map/Graph）に継続的に流し込む
- agent ごとに Deny 率の特色を作り、BAN対象になり得る agent の挙動も再現する
- 1分に1回のトリガー（Cloud Scheduler）で、ランダムな agent がランダムな action を試行する

---

## スコープ
### 実装対象
- Cloud Run サービス：agent-simulator
- Cloud Scheduler からの HTTP POST を受けて、以下を実行する処理
  - agent をランダム選択
  - tool/action をランダム選択（agent ごとの分布に従う）
  - service-a の /authorize を呼ぶ
  - allow の場合に /execute を呼ぶ（PoC段階では呼び出し可否を設定で切替可能）
  - すべての結果を構造化ログとして出力

### 非スコープ（今回やらない）
- LLM / プロンプト運用（人格は確率分布で表現する）
- Pub/Sub / Dataflow 等のストリーム基盤
- BigQuery 集計（Graph は既存 store から描画する前提）
- 自動BAN（BANはUIから手動、ただしBAN候補の挙動は再現する）
- 永続DB（agent定義・BAN状態の永続化は任意。まずは設定ファイル/環境変数で固定）

---

## 全体アーキテクチャ
- Cloud Scheduler（1分）→ agent-simulator（Cloud Run）
- agent-simulator → service-a（Judgment）の API を呼ぶ
  - POST /authorize（必須）
  - POST /execute（任意：設定で有効化）

---

## 前提・依存
- service-a が以下を受け付けること
  - /authorize で agent_id / agent_role / tool / action を受け取れる
  - deny 時に reason が返る（またはログに残る）
  - （任意）BAN済 agent は常に deny（agent banned）になる
- agent-simulator は service-a のURLに到達できる（VPCは不要、外部公開でも可）

---

## Cloud Scheduler → agent-simulator の入力仕様
- HTTP Method: POST
- Content-Type: application/json
- Body（最小）
  - mode: "scheduled"（固定）
  - source: "cloud-scheduler"（固定）
  - dry_run: boolean（任意。true の場合は service-a を呼ばずログだけ出す）

---

## agent-simulator の設定仕様

### 環境変数
- SERVICE_A_BASE_URL（必須）
  - 例：https://judgment-service-a.example.com
- EXECUTE_ENABLED（任意、デフォルト false）
  - true の場合、authorize が allow のとき execute も呼ぶ
- TIME_WINDOW_LABEL（任意、デフォルト "last24h"）
  - ログやメタ情報に付与（UI表示に不要なら省略可）
- AGENT_PROFILE_SOURCE（任意、デフォルト "inline"）
  - "inline"：ソース内の定義を使用
  - "gcs"：GCS上のJSON/YAMLから読み込み（将来）
- RANDOM_SEED（任意）
  - デバッグ用に乱数固定したい場合のみ

---

## Agent Profile（人格）仕様

### Agent の属性
- agent_id（必須、ユニーク）
- agent_role（必須：例 assistant / admin / external など）
- persona（任意：UI表示用の短い説明）
- action_weights（必須）
  - tool ごとの行動比率（確率分布）
- risk_bias（任意：conservative / normal / aggressive）
  - action_weights の調整に使う（実装簡易なら固定でOK）
- ban_prone（任意：true/false）
  - BAN候補として動かす agent に付与（実装上は action_weights が強ければ十分）

### 推奨：デモ用 Agent セット（例）
- 低Deny（模範）
  - assistant_frontdesk_1（assistant）
  - assistant_frontdesk_2（assistant）
- 中間（業務）
  - admin_backoffice_1（admin）
  - admin_backoffice_2（admin）
- 高Deny（BAN候補）
  - rogue_agent_test（assistant または external）
  - external_partner_bot（external）

---

## Tool / Action 仕様（デモ用）

### Tool 一覧（固定）
- read_resident_record（resident）
- update_benefit_status（benefit）
- send_official_notice（notify）

### Action 名（固定）
- resident: read
- benefit: update
- notify: send

### コンテキスト（最低限）
- tool に応じたダミーの context を付与して、UIのReason説明をそれっぽくする
- PIIは実値を入れない（マスキング or ダミーID）
  - resident_id: "RES-xxxx"
  - district: "D-xx"
  - benefit_case_id: "BEN-xxxx"
  - notice_channel: "email" / "sms" など

---

## service-a 呼び出し仕様

### 1) POST /authorize（必須）
- URL: {SERVICE_A_BASE_URL}/authorize
- Body（最小）
  - request_id（必須）：agent-simulator が生成する UUID
  - agent_id（必須）
  - agent_role（必須）
  - tool（必須：resident/benefit/notify 等、service-a 仕様に合わせる）
  - action（必須：read/update/send）
  - context（任意：上記のダミー文脈）
- 期待レスポンス（抽象）
  - decision: "ALLOW" | "DENY"
  - reason: string（DENYなら必須が望ましい）
  - execution_handle / token（ALLOW時に必要なら）

### 2) POST /execute（任意：EXECUTE_ENABLED=true のとき）
- URL: {SERVICE_A_BASE_URL}/execute
- Body（最小）
  - request_id（authorize と同じ）
  - execution_handle（authorize が返したもの）
  - tool_request（service-a 仕様に合わせる）
- 期待レスポンス（抽象）
  - result_status: "success" | "blocked" | "error"
  - blocked_layer / blocked_reason（あればGraphが強くなる）

---

## ランダム実行アルゴリズム（1回のPOSTでやること）

1. request_id を生成（UUID）
2. agent を1体選択
   - 一様ランダム、または agent_weight（任意）で偏らせる
3. tool/action を選択
   - 選択した agent の action_weights から tool をサンプリング
   - tool に対応する action は固定（resident→read 等）
4. context を生成（tool別テンプレート）
5. /authorize を呼ぶ
6. decision が ALLOW かつ EXECUTE_ENABLED=true なら /execute を呼ぶ
7. すべての結果を構造化ログとして出力
8. HTTP 200 を返す（失敗時も 200 返却可：スケジューラ再試行ループを避ける。代わりに error フィールドをログに残す）

---

## “特色”の作り方（Deny率コントロール）
- Deny率は「policyに引っかかる行動をどれだけ選ぶか」で作る
- 例：BAN候補（rogue）は update_benefit_status の比率を高くする
  - assistant_role で benefit:update を多発 → role not permitted で deny が増える
- 例：模範（assistant_frontdesk）は resident:read を中心に、notify:send は少なめ
- admin は benefit:update を一定割合で許可（条件付き）にして allow も混ざる

---

## エラーハンドリング方針
- service-a 呼び出し失敗（4xx/5xx/timeout）
  - その回は「通信失敗」としてログに記録して終了
  - Scheduler には 200 を返す（デモ中のリトライ嵐を防ぐ）
- authorize が DENY
  - execute は呼ばない
  - reason を必ずログに残す
- execute が失敗
  - result_status=error としてログに残す
  - blocked_layer/reason が取れれば残す（取れなければ空）

---

## 観測性（ログ仕様：最重要）
- すべて JSON 形式の構造化ログで出力する
- 1回のスケジュール実行で、最低1行は必ず出る

### ログ項目（推奨）
- ts
- request_id
- agent_id
- agent_role
- tool
- action
- authorize:
  - decision
  - reason
  - latency_ms
  - http_status
- execute（呼んだ場合のみ）:
  - result_status
  - blocked_layer
  - blocked_reason
  - latency_ms
  - http_status
- simulator:
  - mode（scheduled/manual）
  - source
  - version（デプロイ識別用：コミットSHA等があれば）
  - dry_run

---

## セキュリティ方針（PoC最小）
- agent-simulator は Scheduler からのみ呼ぶのが理想（OIDC推奨）
- 今回は設定が完了している前提なので、少なくとも以下を満たす
  - 外部から叩ける場合でも、Body の内容で危険な動作は起きない（実際のPIIや金銭処理はしない）
  - service-a への呼び出しはデモ用の環境に限定

---

## デプロイ/運用フロー（ClaudeCodeで実装後にやること）
1. Cloud Run の agent-simulator(すでに、GCP に空のクラウドランを立てており、カスタムドメインhttps://agent-simulator.action-gated.tech　を設定済み)にデプロイ
2. 環境変数 SERVICE_A_BASE_URL を設定
3. EXECUTE_ENABLED を false で開始（まずは authorize のみでMap/Graphが回ることを確認）
4. 問題なければ EXECUTE_ENABLED=true にして execute も流す
5. UI（Map/Graph）で以下が観測できること
   - agent が増えている（agent_id が複数出る）
   - agent-wise deny rate に差が出る
   - tool-wise risk（または reason breakdown）に偏りが出る
   - rogue が deny を積み上げ、BAN対象に見える

---

## 受け入れ基準（Acceptance Criteria）
- 1分に1回、Judgment Map に新しい行が追加される
- 6体以上の agent_id が UI 上で観測できる
- agent-wise deny rate が、少なくとも「低Deny（10%前後）」「高Deny（50%以上）」の2群に分かれる
- 高Deny agent に対して BAN を実行した場合、以降の authorize が deny（agent banned）になり、Graph/Mapで差分が確認できる（service-a 側が対応済みの場合）

---

## 実装メモ（ClaudeCodeに指示する観点）
- “動くこと”を最優先し、抽象化・汎用化は後回し
- agent定義はまずソース内固定で良い（YAML化は次段）
- request_id と agent_id を必ず service-a に渡し、UI上で追えるようにする
- ログは構造化JSONで統一して、デモ中のトラブルシュートを容易にする
