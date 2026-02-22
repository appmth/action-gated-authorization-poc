# STEP2 機能開発 -- 実装タスク一覧

## 前提

- STEP1 モック開発は完了済み（judgment-ui の4画面 + Global Shell がモックデータで動作）
- 本ドキュメントは STEP2「実データ連携」および「デモシナリオの完全動作」を対象とする
- 権威ドキュメント: `docs/01-plan/06-judgment-dashboard-plan.md`, `docs/01-plan/07-demo-scenario-plan.md`
- CLAUDE.md のルール（AGAの3証明、PEP/PDP設計原則）に従う

## 現状分析（ギャップ）

### service-a の現状と不足

| 項目 | 現状 | 必要な状態 |
|---|---|---|
| `GET /judgments` | 存在する。`request_id`, `action`, `result`, `reason_short`, `created_at` を返す | judgment-ui の `JudgmentEvent` 型に合致するスキーマで返す必要がある |
| `GET /judgments/{request_id}` | 存在する。内部 judgment_store の生データを返す | `JudgmentEvent` 型に合致するスキーマで返す |
| `GET /metrics/decision-distribution` | 存在しない | 新規実装が必要 |
| `GET /metrics/agent-deny-rate` | 存在しない | 新規実装が必要 |
| 判定ストア | `deque(maxlen=100)` インメモリのみ | PoC ではインメモリで十分。永続化は不要 |
| Judgment データモデル | `agent_id` はリクエストに含まれるが `agent_role` は含まれない。`tool` は独立フィールドとして保存されていない | `agent_role` を `/authorize` リクエストに追加するか、固定マッピングで解決 |

### judgment-ui の現状と不足

| 項目 | 現状 | 必要な状態 |
|---|---|---|
| データ取得 | `mock-data.ts` から固定値を返す | service-a の API から fetch する |
| 環境変数 | `NEXT_PUBLIC_API_URL` は不使用（モック） | service-a の URL を設定して使用 |
| Dockerfile | 存在しない | Cloud Run デプロイ用に必要 |

### gov-ui の現状

- 既に service-a の `/authorize` → `/execute` の2段階フローが動作する
- Dockerfile は存在しない（Cloud Run デプロイ用に必要）

### デモシナリオ関連

- `07-demo-scenario-plan.md` のシナリオインジェクター（`scripts/inject-demo-scenario.py`）は未実装
- デモで judgment-ui に実データが表示される状態にする必要がある

---

## フェーズ1: 設計書の修正

### タスク 1: service-a 設計書の更新（集計API追加）

- **フェーズ**: 1
- **目的**: service-a に追加する集計API（`/judgments` の応答スキーマ変更、`/metrics/*` の新規追加）を設計書に反映する
- **対象**: `docs/02-design/10-service-a-judgment.md`, `docs/02-design/03-interface-spec.yaml`
- **やること**:
  - `10-service-a-judgment.md` に「3. 集計API（Judgment UI 用）」セクションを追加
    - `GET /judgments` -- 応答スキーマを `JudgmentEvent` 互換に変更する仕様を記載
    - `GET /judgments/{request_id}` -- 同上
    - `GET /metrics/decision-distribution` -- `{ allow_pct: number, deny_pct: number }` を返す仕様
    - `GET /metrics/agent-deny-rate` -- `[{ agent: string, deny_pct: number }]` を返す仕様
  - `AuthorizeRequest` スキーマに `agent_role: string`（optional, default="assistant"）を追加する仕様を記載
  - `03-interface-spec.yaml` に上記4エンドポイントの OpenAPI 定義を追加
  - CORS 設定に変更がないことを確認・記載
- **やらないこと**:
  - Firestore への永続化設計（PoC はインメモリで十分）
  - ページング・フィルタ・ソートの設計（計画書で明示除外）
  - `/judgments` 以外の新規エンドポイントの追加
- **Done 条件**:
  - `10-service-a-judgment.md` に集計APIセクションが存在する
  - `03-interface-spec.yaml` に4つの新規エンドポイント定義が追加されている
  - `AuthorizeRequest` に `agent_role` フィールドが追加されている

---

### タスク 2: judgment-ui 設計書の更新（実データ連携）

- **フェーズ**: 1
- **目的**: judgment-ui の STEP2（実データ連携）に必要な変更を設計書に反映する
- **対象**: `docs/02-design/20-judgment-ui.md`
- **やること**:
  - 「6. データ取得方式」の STEP2 セクションを具体化
    - `api.ts` の各関数が service-a の API を fetch するように変更する仕様
    - `NEXT_PUBLIC_API_URL` 環境変数を使用する仕様
    - エラーハンドリング方針: API 失敗時はモックデータにフォールバック（デモ安全性のため）
  - Dockerfile の仕様（Next.js standalone output + Cloud Run 対応）を記載
- **やらないこと**:
  - 画面設計の変更（STEP1 で確定済み）
  - SSR/ISR の導入（クライアントサイド fetch で十分）
- **Done 条件**:
  - `20-judgment-ui.md` の STEP2 セクションに具体的な実装仕様が記載されている
  - Dockerfile の仕様が記載されている

---

### タスク 3: gov-ui 設計書にデモシナリオ連携を追記

- **フェーズ**: 1
- **目的**: gov-ui からの操作が judgment-ui に反映されるデモフローを明確にする
- **対象**: `docs/02-design/21-gov-ui.md`
- **やること**:
  - 「デモシナリオとの連携」セクションを追加
    - gov-ui で `/authorize` を叩くと、service-a の `judgment_store` に記録される
    - judgment-ui で `/judgments` を叩くと、上記記録が表示される
    - デモフロー: gov-ui で操作 → judgment-ui で確認 の流れを明記
  - Context の2パターン（Allow/Deny）をデモ用に明記
    - Allow: `{ purpose: "inquiry", time: "business_hours", data_sensitivity: "required" }`
    - Deny: `{ purpose: "audit", time: "after_hours", data_sensitivity: "required" }` 等
  - Dockerfile の仕様を記載
- **やらないこと**:
  - gov-ui の画面変更（既存実装で十分）
  - Context 切り替え UI の追加（デモではコード変更 or curl で対応）
- **Done 条件**:
  - `21-gov-ui.md` にデモシナリオ連携セクションが存在する
  - Allow/Deny の2パターンの Context が明記されている
  - Dockerfile の仕様が記載されている

---

## フェーズ2: 実装

### タスク 4: service-a に `agent_role` フィールドを追加

- **フェーズ**: 2
- **目的**: judgment-ui の Judgment Map で `Agent Role` 列を表示するために、`/authorize` リクエストに `agent_role` を受け取り、judgment_store に保存する
- **対象**: `service-a/main.py`
- **やること**:
  - `AuthorizeRequest` モデルに `agent_role: str = "assistant"` フィールドを追加
  - `store_judgment()` の保存データに `agent_role` を含める
  - `store_judgment()` の保存データに `tool` フィールドを独立して追加（現在は `action` のみ）
    - PoC では `action` から機械的に導出: `get_resident_info` → tool=`resident`, action=`read` と固定マッピング
  - `/authorize` のログ出力に `agent_role` を追加
- **やらないこと**:
  - `agent_role` のバリデーション（PoC では自由文字列で十分）
  - 既存の `AuthorizeResponse` スキーマの変更
  - PDP (Rego) への agent_role 連携（現在の Rego は action + context のみで判定）
- **Done 条件**:
  - `AuthorizeRequest` に `agent_role` フィールドが存在する
  - `/authorize` 呼び出し後、`judgment_store` のデータに `agent_role` と `tool` が含まれている
  - 既存の `/authorize`, `/execute` が壊れていないこと

---

### タスク 5: service-a の `/judgments` API を JudgmentEvent 互換に変更

- **フェーズ**: 2
- **目的**: judgment-ui が期待する `JudgmentEvent` 型に一致する応答を返すようにする
- **対象**: `service-a/main.py`
- **依存**: タスク 4
- **やること**:
  - `GET /judgments` の応答スキーマを以下に変更:
    ```json
    [
      {
        "id": "request_id をそのまま使用",
        "ts": "created_at の値",
        "agent_id": "agent_id",
        "agent_role": "agent_role",
        "tool": "tool",
        "action": "action",
        "decision": "ALLOW" or "DENY",
        "reason": "decision.reason",
        "policy_id": "decision.policy_id",
        "policy_tags": "decision.tags",
        "context": "context（サニタイズ済み）"
      }
    ]
    ```
  - `GET /judgments/{request_id}` の応答スキーマも同一フォーマットに変更
  - `store_judgment()` 関数を修正し、上記フォーマットで保存する（変換ロジックを保存時に寄せる）
- **やらないこと**:
  - 応答のページング・ソート（計画書で除外）
  - Firestore への永続化
  - `pep_enforcement`, `trace`, `tool_result` の応答への含有（judgment-ui では不使用）
- **Done 条件**:
  - `GET /judgments` が `JudgmentEvent[]` 互換の JSON を返す
  - `GET /judgments/{request_id}` が `JudgmentEvent` 互換の JSON を返す
  - `decision` フィールドが `"ALLOW"` / `"DENY"` 文字列である
  - 既存の gov-ui フロー（`/authorize` + `/execute`）が壊れていないこと

---

### タスク 6: service-a に `/metrics/*` エンドポイントを追加

- **フェーズ**: 2
- **目的**: judgment-ui の Graph 画面に表示するデータを提供する
- **対象**: `service-a/main.py`
- **依存**: タスク 5
- **やること**:
  - `GET /metrics/decision-distribution` を新規実装
    - `judgment_store` 内の全レコードから ALLOW/DENY の件数を集計
    - `{ "allow_pct": 68, "deny_pct": 32 }` 形式で返す（パーセンテージ）
    - レコードが0件の場合は `{ "allow_pct": 0, "deny_pct": 0 }` を返す
  - `GET /metrics/agent-deny-rate` を新規実装
    - `judgment_store` 内の全レコードから agent_role 別の deny 率を集計
    - `[{ "agent": "assistant", "deny_pct": 35 }, ...]` 形式で返す
    - レコードが0件の場合は `[]` を返す
- **やらないこと**:
  - 期間指定フィルタ（「Last 24h」は UI 側の表示文言のみ）
  - キャッシュ・パフォーマンス最適化（インメモリ100件なので不要）
- **Done 条件**:
  - `GET /metrics/decision-distribution` がパーセンテージを返す
  - `GET /metrics/agent-deny-rate` が agent 別の deny 率を返す
  - レコード0件でもエラーにならない

---

### タスク 7: judgment-ui のデータ取得を実API連携に切り替え

- **フェーズ**: 2
- **目的**: モックデータから service-a の実データに切り替える
- **対象**: `judgment-ui/src/lib/api.ts`
- **依存**: タスク 5, タスク 6
- **やること**:
  - `api.ts` の各関数を `NEXT_PUBLIC_API_URL` 環境変数を使った fetch に変更:
    - `getJudgments()` → `GET ${API_URL}/judgments` を fetch
    - `getJudgment(id)` → `GET ${API_URL}/judgments/${id}` を fetch
    - `getDecisionDistribution()` → `GET ${API_URL}/metrics/decision-distribution` を fetch
    - `getAgentDenyRate()` → `GET ${API_URL}/metrics/agent-deny-rate` を fetch
  - エラーハンドリング: fetch 失敗時はモックデータにフォールバック（デモの安全性を確保）
  - `getLegacyLogs()` はモックデータのまま維持（Legacy Log は意図的にモック）
  - judgment-ui の各画面コンポーネントで `api.ts` の関数呼び出しを Server Component の async/await 対応に調整（必要に応じて）
- **やらないこと**:
  - `mock-data.ts` の削除（フォールバック用に残す）
  - SWR / React Query 等のデータフェッチライブラリの導入
  - リアルタイム更新（ポーリング・WebSocket）
  - `LegacyLog` の実データ化（デモ用モックとして固定）
- **Done 条件**:
  - `NEXT_PUBLIC_API_URL` を設定した状態で、service-a の実データが judgment-ui に表示される
  - `NEXT_PUBLIC_API_URL` 未設定 or service-a 不通時に、モックデータにフォールバックする
  - `npm run build` がエラーなく通る
  - Legacy Log View はモックデータのまま表示される

---

### タスク 8: デモシナリオデータ投入スクリプトの作成

- **フェーズ**: 2
- **目的**: デモ撮影時に judgment-ui に意図的なデータを表示するため、service-a の `/authorize` を呼び出してデータを生成する
- **対象**: 新規 `scripts/inject-demo-scenario.sh`
- **やること**:
  - service-a の `/authorize` を curl で呼び出すシェルスクリプトを作成
  - 以下の3シナリオ + 追加2件（計5件）を順番に投入:
    1. `agent_role=assistant`, `action=get_resident_info`, context: `purpose=audit, time=after_hours` → **DENY**
    2. `agent_role=admin`, `action=get_resident_info`, context: `purpose=inquiry, time=business_hours` → **ALLOW**
    3. `agent_role=assistant`, `action=get_resident_info`, context: `purpose=inquiry, time=business_hours` → **ALLOW**
    4. `agent_role=assistant`, `action=get_resident_info`, context: `purpose=inquiry, time=business_hours` → **ALLOW**
    5. `agent_role=assistant`, `action=get_resident_info`, context: `purpose=emergency, time=after_hours` → **DENY**
  - スクリプトは `SERVICE_A_URL` 環境変数（デフォルト `http://localhost:8080`）を使用
  - 各呼び出し後に1秒待機（タイムスタンプを分散させるため）
- **やらないこと**:
  - Python スクリプト（`inject-demo-scenario.py`）の作成（シェルスクリプトで十分。Python 依存を増やさない）
  - Firestore 直接書き込み（service-a の API 経由で投入する方が正しい）
  - 実行シミュレーター（`scenario_runner.py`）の作成（curl スクリプトで十分）
- **Done 条件**:
  - `bash scripts/inject-demo-scenario.sh` を実行すると、service-a に5件の judgment が記録される
  - judgment-ui の `/map` に ALLOW/DENY 混在の5件が表示される
  - スクリプトにエラーハンドリング（service-a への接続確認）が含まれている

---

### タスク 9: judgment-ui の Dockerfile 作成

- **フェーズ**: 2
- **目的**: judgment-ui を Cloud Run にデプロイするための Dockerfile を用意する
- **対象**: 新規 `judgment-ui/Dockerfile`
- **やること**:
  - Next.js standalone output を使用した multi-stage build の Dockerfile を作成
  - `next.config.ts` に `output: 'standalone'` を追加（未設定の場合）
  - ビルド時に `NEXT_PUBLIC_API_URL` を ARG として受け取れるようにする
  - ポートは 3000（Cloud Run の `--port 3000` に合わせる）
- **やらないこと**:
  - docker-compose.yml への追加（judgment-ui はローカルでは `npm run dev` で動かす）
  - CI/CD パイプラインの構築
- **Done 条件**:
  - `docker build -t judgment-ui --build-arg NEXT_PUBLIC_API_URL=http://localhost:8080 judgment-ui/` が成功する
  - コンテナが起動し、ブラウザからアクセスできる

---

### タスク 10: gov-ui の Dockerfile 作成

- **フェーズ**: 2
- **目的**: gov-ui を Cloud Run にデプロイするための Dockerfile を用意する
- **対象**: 新規 `gov-ui/Dockerfile`
- **やること**:
  - タスク 9 と同じ構成（Next.js standalone）の Dockerfile を作成
  - `NEXT_PUBLIC_API_URL` を ARG として受け取れるようにする
  - ポートは 3000
- **やらないこと**:
  - docker-compose.yml への追加
  - gov-ui の機能変更
- **Done 条件**:
  - `docker build -t gov-ui --build-arg NEXT_PUBLIC_API_URL=http://localhost:8080 gov-ui/` が成功する
  - コンテナが起動し、ブラウザからアクセスできる

---

### タスク 11: deploy.sh の judgment-ui / gov-ui デプロイ対応を確認・修正

- **フェーズ**: 2
- **目的**: `scripts/deploy.sh` が judgment-ui と gov-ui を正しくデプロイできることを確認する
- **対象**: `scripts/deploy.sh`, `.env.prod`
- **依存**: タスク 9, タスク 10
- **やること**:
  - `deploy.sh` の `judgment-ui|gov-ui` ケースが Dockerfile ベースのデプロイに対応していることを確認
  - Cloud Run の `--source` オプションが Dockerfile を自動検出することを確認
  - `NEXT_PUBLIC_API_URL` が `.env.prod` に正しく設定されていることを確認（現在 `https://service-a.action-gated.tech` -- OK）
  - 必要に応じて `--port 3000` の追加
- **やらないこと**:
  - CI/CD パイプラインの構築
  - 自動デプロイの設定
- **Done 条件**:
  - `./scripts/deploy.sh prod judgment-ui` のコマンドが正しいパラメータで実行される
  - `./scripts/deploy.sh prod gov-ui` のコマンドが正しいパラメータで実行される

---

## フェーズ3: ローカルテスト

### タスク 12: ローカル環境での統合テスト

- **フェーズ**: 3
- **目的**: ローカル環境でデモシナリオが完全に動作することを確認する
- **対象**: 全サービス
- **依存**: タスク 4〜8
- **やること**:
  - `docker-compose up` で全バックエンドサービスを起動
  - `cd judgment-ui && npm run dev` で judgment-ui を起動（`NEXT_PUBLIC_API_URL=http://localhost:8080`）
  - 以下のテストを手動実行:
    1. `bash scripts/inject-demo-scenario.sh` でデモデータを投入
    2. `http://localhost:3000/map` で ALLOW/DENY 混在のデータが表示されることを確認
    3. 行クリックで `/judgments/{id}` に遷移し、詳細が表示されることを確認
    4. `/graph` で Decision Distribution と Agent Deny Rate が表示されることを確認
    5. `/legacy-logs` がモックデータのまま表示されることを確認
  - gov-ui のテスト:
    1. `cd gov-ui && npm run dev` で起動（別ポート 3001）
    2. `/inquiry` で「問い合わせを処理」→ Allow ケースが動作することを確認
    3. judgment-ui の `/map` に新しいレコードが反映されることを確認
  - 上記結果をテストレポートとして記録
- **やらないこと**:
  - Playwright による自動 E2E テスト（STEP2 では手動確認で十分）
  - パフォーマンステスト
  - クロスブラウザテスト
- **Done 条件**:
  - 上記テスト項目がすべて PASS
  - デモシナリオ（Legacy Log → Map → Detail → Graph → Map）の画面遷移がスムーズに動作
  - gov-ui → judgment-ui のデータ連携が確認できた

---

## フェーズ4: GCP デプロイ

### タスク 13: バックエンドサービスの再デプロイ（service-a 更新）

- **フェーズ**: 4
- **目的**: service-a の集計API変更を GCP に反映する
- **対象**: service-a
- **依存**: タスク 12
- **やること**:
  - `./scripts/deploy.sh prod service-a` を実行
  - デプロイ完了後、`https://service-a.action-gated.tech/health` で正常稼働を確認
  - `https://service-a.action-gated.tech/judgments` が空配列を返すことを確認
- **やらないこと**:
  - service-b, service-c, envoy-gateway の再デプロイ（変更なし）
  - Cloud Run の設定変更（メモリ、CPU など）
- **Done 条件**:
  - service-a が GCP 上で正常稼働している
  - `/health`, `/judgments`, `/metrics/decision-distribution`, `/metrics/agent-deny-rate` が正常応答する

---

### タスク 14: judgment-ui の GCP デプロイ

- **フェーズ**: 4
- **目的**: judgment-ui を Cloud Run にデプロイし、実データ連携を GCP 上で動作させる
- **対象**: judgment-ui
- **依存**: タスク 9, タスク 13
- **やること**:
  - `./scripts/deploy.sh prod judgment-ui` を実行
  - デプロイ完了後、`https://judgment-ui.action-gated.tech` にアクセスして表示を確認
  - CORS が正常に動作していることを確認（service-a → judgment-ui）
- **やらないこと**:
  - カスタムドメインの新規設定（既に `judgment-ui.action-gated.tech` が設定済みの前提）
  - SSL 証明書の手動管理（Google マネージド証明書を使用）
- **Done 条件**:
  - `https://judgment-ui.action-gated.tech` でページが表示される
  - `/map`, `/graph`, `/legacy-logs`, `/judgments/{id}` がすべて正常表示される

---

### タスク 15: gov-ui の GCP デプロイ

- **フェーズ**: 4
- **目的**: gov-ui を Cloud Run にデプロイする
- **対象**: gov-ui
- **依存**: タスク 10, タスク 13
- **やること**:
  - `./scripts/deploy.sh prod gov-ui` を実行
  - デプロイ完了後、`https://gov-ui.action-gated.tech` にアクセスして表示を確認
  - `/inquiry` で「問い合わせを処理」が動作することを確認
- **やらないこと**:
  - カスタムドメインの新規設定
- **Done 条件**:
  - `https://gov-ui.action-gated.tech` でページが表示される
  - `/inquiry` の2段階認可フローが正常動作する

---

## フェーズ5: GCP上でのテスト

### タスク 16: GCP 環境でのデモシナリオ通しテスト

- **フェーズ**: 5
- **目的**: GCP 上でデモシナリオが完全に動作することを最終確認する
- **対象**: 全サービス（GCP）
- **依存**: タスク 13, タスク 14, タスク 15
- **やること**:
  - `SERVICE_A_URL=https://service-a.action-gated.tech bash scripts/inject-demo-scenario.sh` でデモデータを投入
  - 以下のデモフローを通しで実行:
    1. `https://judgment-ui.action-gated.tech/legacy-logs` -- Legacy Log が表示される（モックデータ）
    2. `https://judgment-ui.action-gated.tech/map` -- ALLOW/DENY 混在のデータが表示される（実データ）
    3. DENY 行をクリック → Detail 画面で判断理由が表示される
    4. Graph 画面で Decision Distribution / Agent Deny Rate が表示される
    5. `https://gov-ui.action-gated.tech/inquiry` で「問い合わせを処理」→ Allow
    6. judgment-ui の Map に新しいレコードが追加される
  - 以下の AGA 3証明を確認:
    1. **Context で Allow/Deny が変わる**: 同じ action でも purpose/time が異なると結果が変わる
    2. **PEP は実行前に判断を強制する**: Deny 時にツールが実行されない（gov-ui の Step 2 に進まない）
    3. **判断理由が説明可能な形で残る**: Detail 画面の Reason が日本語で表示される
  - テスト結果を記録
- **やらないこと**:
  - 負荷テスト
  - セキュリティテスト
  - デモ動画の撮影（これはテスト後の別タスク）
- **Done 条件**:
  - 上記デモフロー 1〜6 がすべて正常動作する
  - AGA 3証明がすべて確認できる
  - テスト結果が記録されている

---

## 依存関係図

```
フェーズ1（設計）
  タスク 1 ──┐
  タスク 2 ──┤──（並行可能）
  タスク 3 ──┘

フェーズ2（実装）
  タスク 4 ──→ タスク 5 ──→ タスク 6 ──→ タスク 7
  タスク 8 ──────────────────────────────（タスク 4, 5 完了後）
  タスク 9 ──┐
  タスク 10 ─┤──（並行可能、他タスクと独立）
  タスク 11 ─┘──（タスク 9, 10 完了後）

フェーズ3（ローカルテスト）
  タスク 12 ──（タスク 4〜8 すべて完了後）

フェーズ4（GCP デプロイ）
  タスク 13 ──→ タスク 14
              ──→ タスク 15
              （タスク 12 完了後）

フェーズ5（GCP テスト）
  タスク 16 ──（タスク 13〜15 すべて完了後）
```

---

## 明示的にやらないこと一覧

| 項目 | 理由 |
|---|---|
| Firestore への Judgment 永続化 | PoC ではインメモリ（deque maxlen=100）で十分。サービス再起動でデータは消える前提 |
| ページング・フィルタ・ソート | 計画書（06-judgment-dashboard-plan.md）で明示的に除外 |
| リアルタイム更新（WebSocket / ポーリング） | デモは手動リロードで十分 |
| Rego ポリシーへの agent_role 連携 | 現在の Rego は action + context で判定。agent_role は判定には使わず表示のみ |
| chart library の導入 | STEP1 で CSS/SVG で実装済み |
| Playwright E2E テストの更新 | STEP2 では手動統合テストで十分 |
| CI/CD パイプラインの構築 | PoC では手動デプロイ |
| cloudbuild.yaml の作成 | 手動デプロイ（`deploy.sh`）で十分 |
| Cloud Logging / Trace との連携 | 計画書で「GCP に委譲」と明記。UI からは参照しない |
| レスポンシブ対応 | デモはデスクトップのみ |
| i18n / 多言語対応 | デモは日本語固定 |
| LLM (Vertex AI) の Plan-and-Act フローのデモ連携 | デモシナリオに含まれない。既存エンドポイントとして残すが UI 連携はしない |
| Context 切り替え UI の追加 | デモでは curl / シナリオスクリプトで対応 |
| Settings ページの実装 | サイドバーにラベルのみ。ページは作らない |
| judgment-ui の多エージェント / 多アクション対応 | PoC は `get_resident_info` の1アクションのみ。ただし judgment-ui の表示は汎用的 |

---

## 備考

### PoC でのデータフロー（最終）

```
[gov-ui] → POST /authorize → [service-a] → POST /v1/data/authorization/decision → [service-b (OPA)]
                                    ↓
                              judgment_store に保存
                                    ↓
[judgment-ui] → GET /judgments → [service-a] → judgment_store から読み出し
[judgment-ui] → GET /metrics/* → [service-a] → judgment_store から集計
```

### service-a 内部の判定データモデル（STEP2 後）

judgment_store に保存する各レコードは以下の形式:
```python
{
    "id": request_id,
    "ts": created_at (ISO 8601),
    "agent_id": agent_id,
    "agent_role": agent_role,        # 新規追加
    "tool": tool,                     # action から導出
    "action": action_mapped,          # action から導出
    "decision": "ALLOW" or "DENY",
    "reason": decision.reason,
    "policy_id": decision.policy_id,
    "policy_tags": decision.tags,
    "context": context (sanitized),
}
```
