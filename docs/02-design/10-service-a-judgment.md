# Service A: Judgment (PEP) 設計書

Judgment サービスは、認可判定（Phase 1）と実行仲介（Phase 2）のライフサイクルを管理する中心的なコンポーネントです。

## 1. 認可判定 (Phase 1: /authorize)

### リクエストスキーマ

| フィールド | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `agent_id` | string | Yes | - | エージェント識別子 |
| `agent_role` | string | No | `"assistant"` | エージェントのロール（例: `"assistant"`, `"admin"`）。Judgment UI の表示に使用。PDP の判定には使用しない |
| `action` | string | Yes | - | 実行するアクション名 |
| `context` | object | Yes | - | 業務文脈（`purpose`, `time`, `data_sensitivity`） |
| `request_id` | string | No | UUID 自動生成 | リクエスト追跡用ID |

### ロジック
1.  **リクエスト受付**: Agent からのアクション、コンテキスト、エージェントロールを受け取ります。
2.  **PDP 問い合わせ**: `service-b` (OPA) に対して、アクションとコンテキストを送信し、認可判断（allow/deny）とメタデータ（policy_id, tags）を取得します。
    - `agent_role` は PDP には送信しません（判定に使用しない、表示専用）。
3.  **JWT (execution_handle) 生成**:
    - `allow` の場合、以下のクレームを含む RS256 署名済み JWT を発行します。
    - `scope`: `execute:{action}`
    - `ctx_hash`: 認可時のコンテキストの SHA256 ハッシュ値。
    - `jti`: ユニークなチケットID。
    - `req_id`: リクエストの追跡用ID。
4.  **判定データ保存**: 判定結果を Firestore `judgment_events` コレクションに非同期で保存します（ドキュメントID = `request_id`）。Firestore 書き込みに失敗した場合でも API レスポンスには影響しません。
5.  **監査ログ**: 判定結果とメタデータを JSON 形式で stdout に出力します。

## 2. 実行仲介 (Phase 2: /execute)

### ロジック
1.  **チケット検証**:
    - 受取った `execution_handle` の署名と有効期限を検証します。
2.  **二重実行チェック (Firestore)**:
    - JWT の `jti` を Firestore の `jti_store` コレクションに書き込みを試みます。
    - 書き込みに失敗（既に存在）した場合は、多重実行としてリクエストをブロックします（400 Bad Request）。
3.  **パス検証**:
    - `tool_request.path` と JWT の `scope` の整合性を検証します。
    - 例: `scope: execute:get_resident_info` の場合、`/resident-info` のみ許可。
    - 不一致の場合は 403 Forbidden を返却します。
4.  **ツール呼び出し (Envoy 経由)**:
    - `execution_handle` を `Authorization: Bearer` ヘッダーに付与し、Envoy Gateway 経由で `tool_request` で指定されたパスに転送します。
    - `tool_request.body` がリクエストボディとして送信されます。
5.  **結果返却**: ツールの実行結果を Agent に返却し、実行結果ログ（レイテンシ、成否）を出力します。
6.  **判定ドキュメント更新 (Firestore)**: `/authorize` で作成された `judgment_events` ドキュメントを更新します。
    - `execution_status`: `"success"` / `"failed"` / `"blocked"`
    - `jti`: JWT の `jti` クレーム値
    - 更新は非同期で行い、失敗してもレスポンスに影響しません。

### scope と path のマッピング

| scope | 許可される path |
|-------|----------------|
| `execute:get_resident_info` | `/resident-info` |

## 3. 集計API（Judgment UI 用）

Judgment UI がデータを取得するための読み取り専用エンドポイントです。データソースは Firestore `judgment_events` コレクションです。

### 3.1 GET /activity（メインクエリ）

判定履歴をカーソルベースのページングで取得します。Activity Log 画面で使用します。

- **クエリパラメータ**:

| パラメータ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `limit` | integer | 20 | 取得件数（最大 100） |
| `cursor` | string | (なし) | ページングカーソル（base64エンコード） |
| `direction` | string | `"next"` | ページング方向（`"next"` / `"prev"`） |
| `decision` | string | (なし) | フィルタ: `"ALLOW"` / `"DENY"` |
| `agent_id` | string | (なし) | フィルタ: エージェントID |
| `tool` | string | (なし) | フィルタ: ツール名 |

- **応答**:

```json
{
  "items": [
    {
      "id": "request_id",
      "ts": "2026-02-01T12:03:10Z",
      "agent_id": "agent-a",
      "agent_role": "assistant",
      "tool": "resident",
      "action": "read",
      "decision": "ALLOW",
      "reason": "Allowed: inquiry during business hours",
      "policy_id": "P-001",
      "policy_tags": ["pii", "audit-required"],
      "context": { "purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required" }
    }
  ],
  "next_cursor": "eyJjcmVhdGVkX2F0IjoiMjAyNi...",
  "prev_cursor": "eyJjcmVhdGVkX2F0IjoiMjAyNi...",
  "has_more": true
}
```

- **ソート順**: `created_at` 降順（新しい順）
- **カーソル形式**: `base64(json({"created_at": "<ISO8601>", "request_id": "<id>"}))`
- **`direction: "next"`**: `start_after(cursor)` で次ページを取得
- **`direction: "prev"`**: `end_before(cursor)` で前ページを取得
- **0 件の場合**: `{ "items": [], "next_cursor": null, "prev_cursor": null, "has_more": false }`

#### 複合インデックス（Firestore）

| インデックス | フィールド | 用途 |
|---|---|---|
| デフォルト | `created_at` DESC | 基本ソート |
| agent_id フィルタ | `agent_id` ASC, `created_at` DESC | agent_id でフィルタ |
| decision フィルタ | `decision` ASC, `created_at` DESC | decision でフィルタ |
| tool フィルタ | `tool` ASC, `created_at` DESC | tool でフィルタ |

### 3.2 GET /judgments/{request_id}

特定の判定詳細を取得します。Firestore `judgment_events` コレクションから `request_id` をドキュメントIDとして取得します。

- **パスパラメータ**: `request_id`（string）
- **応答**: `JudgmentEvent` 互換の JSON オブジェクト
- **404**: 該当する判定が見つからない場合

### 3.3 GET /judgments（後方互換・非推奨）

> [!WARNING]
> このエンドポイントは後方互換性のために残されています。新規開発では GET /activity を使用してください。

インメモリストアに保存された判定履歴を新しい順に取得します。Firestore 移行完了後に削除予定。

- **クエリパラメータ**: `limit`（integer, デフォルト 20, 最大 100）
- **応答**: `JudgmentEvent[]` 互換の JSON 配列（新しい順）

### 3.4 GET /metrics/overview（新規）

直近24時間の判定分布を Firestore から集計して返します。Governance Insights 画面の SYSTEM STATUS / Decision Distribution で使用します。

- **応答**:
```json
{
  "total_count": 50,
  "allow_count": 34,
  "deny_count": 16,
  "allow_pct": 68,
  "deny_pct": 32
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| `total_count` | integer | 直近24hの判定総数 |
| `allow_count` | integer | ALLOW 件数 |
| `deny_count` | integer | DENY 件数 |
| `allow_pct` | integer | ALLOW の割合（%） |
| `deny_pct` | integer | DENY の割合（%） |

- レコード 0 件の場合: 全フィールド 0
- 計算方法: `allow_pct = round(allow_count / total_count * 100)`, `deny_pct = 100 - allow_pct`
- **データソース**: Firestore `judgment_events` where `created_at >= now - 24h`

### 3.5 GET /metrics/agents（新規）

直近24時間のエージェント別統計を Firestore から集計して返します。Governance Insights 画面の Agent-wise Deny Rate で使用します。

- **応答**:
```json
[
  { "agent": "cs-frontdesk", "total": 20, "allow": 15, "deny": 5, "deny_pct": 25 },
  { "agent": "cs-night", "total": 10, "allow": 2, "deny": 8, "deny_pct": 80 }
]
```

| フィールド | 型 | 説明 |
|---|---|---|
| `agent` | string | Agent ID（`agent_role` に対応） |
| `total` | integer | 直近24hの判定総数 |
| `allow` | integer | ALLOW 件数 |
| `deny` | integer | DENY 件数 |
| `deny_pct` | integer | DENY 率（%） |

- レコード 0 件の場合: `[]`
- **データソース**: Firestore `judgment_events` where `created_at >= now - 24h`, grouped by `agent_id`

### 3.6 GET /metrics/reasons（新規）

直近24時間の DENY 理由別内訳を Firestore から集計して返します。Governance Insights 画面の Block Reason Breakdown で使用します。

- **応答**:
```json
[
  { "reason": "Denied: agent is banned (Suspicious pattern)", "count": 5, "pct": 50 },
  { "reason": "Denied: access allowed only during business hours", "count": 3, "pct": 30 }
]
```

| フィールド | 型 | 説明 |
|---|---|---|
| `reason` | string | DENY の理由（先頭80文字まで） |
| `count` | integer | 該当件数 |
| `pct` | integer | 全 DENY に対する割合（%、四捨五入） |

- DENY レコードが 0 件の場合: `[]`
- count 降順でソート
- **データソース**: Firestore `judgment_events` where `created_at >= now - 24h` AND `decision == "DENY"`

### 3.7 既存メトリクスエンドポイント（後方互換）

以下のエンドポイントはインメモリ `judgment_store` からデータを取得する旧実装です。Firestore 移行完了後、3.4-3.6 の新エンドポイントに置き換え予定。

- GET /metrics/decision-distribution
- GET /metrics/agent-deny-rate
- GET /metrics/block-reason-breakdown
- GET /metrics/block-layer-breakdown
- GET /metrics/tool-risk-profile
- GET /metrics/agent-timeline

### 設計判断

- **Firestore がプライマリストア**: 判定データの永続化先は Firestore `judgment_events` コレクション
- **TTL による自動削除**: `ttl_at` フィールドにより3日後に自動削除
- **非同期書き込み**: Firestore 書き込みは非同期で行い、失敗しても API レスポンスには影響しない
- **カーソルベースページング**: GET /activity で大量データにも対応
- **Agent はインメモリ維持**: Agent 管理は引き続きインメモリ dict で行う（Firestore 移行なし）

## 4. 判定データモデル（Firestore `judgment_events` コレクション）

`/authorize` の判定結果は、以下のフォーマットで Firestore `judgment_events` コレクションに保存されます。ドキュメントID = `request_id`。

| フィールド | 型 | 説明 | 設定タイミング |
|---|---|---|---|
| `request_id` | string | リクエストID（= ドキュメントID） | /authorize |
| `created_at` | timestamp | 判定時刻（Firestore serverTimestamp） | /authorize |
| `ttl_at` | timestamp | 自動削除時刻（created_at + 72時間） | /authorize |
| `agent_id` | string | エージェント識別子 | /authorize |
| `agent_role` | string | エージェントロール | /authorize |
| `tool` | string | ツール名（action から導出） | /authorize |
| `action` | string | アクション名（action から導出） | /authorize |
| `decision` | string | 判定結果（"ALLOW" / "DENY"） | /authorize |
| `reason` | string | 判定理由 | /authorize |
| `blocked_layer` | string | ブロック層（デフォルト: "L1 Judgment"） | /authorize |
| `policy_id` | string | ポリシーID | /authorize |
| `policy_tags` | array[string] | ポリシータグ | /authorize |
| `context` | map | サニタイズ済みコンテキスト | /authorize |
| `execution_status` | string / null | 実行結果（"success" / "failed" / "blocked" / null） | /execute |
| `jti` | string / null | JWT の jti クレーム値 | /execute |

### TTL 設定

- `ttl_at` = `created_at` + 72時間（3日間）
- Firestore の TTL ポリシーを `ttl_at` フィールドに設定することで、3日経過後にドキュメントが自動削除される
- GCP Console または `gcloud firestore fields ttls update` で設定

### UI 互換フォーマット

GET /activity および GET /judgments/{request_id} のレスポンスでは、Firestore ドキュメントを以下の `JudgmentEvent` 互換形式に変換して返す:

```python
{
    "id": doc["request_id"],
    "ts": doc["created_at"].isoformat() + "Z",
    "agent_id": doc["agent_id"],
    "agent_role": doc["agent_role"],
    "tool": doc["tool"],
    "action": doc["action"],
    "decision": doc["decision"],
    "reason": doc["reason"],
    "policy_id": doc["policy_id"],
    "policy_tags": doc["policy_tags"],
    "context": doc["context"],
}
```

### action → tool / action_mapped の変換テーブル

| action (入力) | tool (導出) | action_mapped (導出) |
|---|---|---|
| `get_resident_info` | `resident` | `read` |

PoC では上記1パターンのみ。未知の action はそのまま `tool=action`, `action_mapped=action` として保存します。

## 5. 内部コンポーネント
- **FastAPI**: API フレームワーク。
- **python-jose**: JWT の署名・検証。
- **google-cloud-firestore**: JTI の一意識別子管理（`jti_store` コレクション）+ 判定データの永続化（`judgment_events` コレクション）。

> [!NOTE]
> ローカル開発時は `FIRESTORE_EMULATOR_HOST` 環境変数を設定することで、`firestore-emulator` コンテナ（ポート 8086）に接続して動作確認が可能です。

## 6. Agent 管理 API（BAN 機能）

### Agent データモデル

Agent はインメモリで管理されます。初期状態:

```python
agents = {
    "assistant": {
        "id": "assistant",
        "name": "assistant",
        "display_name": "アシスタント",
        "role": "Frontdesk",
        "status": "active",
        "last_seen": None,
        "banned_reason": None,
        "banned_at": None,
    },
    "admin": {
        "id": "admin",
        "name": "admin",
        "display_name": "管理者",
        "role": "Backoffice",
        "status": "active",
        "last_seen": None,
        "banned_reason": None,
        "banned_at": None,
    },
}
```

### API エンドポイント

#### GET /agents

Agent の一覧を取得します。各 Agent に対し、直近24時間の Allow/Deny 件数を Firestore `judgment_events` から集計して返します。

**応答**:

```json
[
  {
    "id": "assistant",
    "name": "assistant",
    "display_name": "アシスタント",
    "role": "Frontdesk",
    "status": "active",
    "last_seen": "2026-02-10T10:30:00Z",
    "allow_24h": 15,
    "deny_24h": 3
  },
  {
    "id": "admin",
    "name": "admin",
    "display_name": "管理者",
    "role": "Backoffice",
    "status": "banned",
    "last_seen": "2026-02-10T09:00:00Z",
    "allow_24h": 5,
    "deny_24h": 1
  }
]
```

- `allow_24h` / `deny_24h` は Firestore `judgment_events` コレクションで `agent_id == agent_id` かつ `created_at >= 24時間前` のレコードから集計
- `last_seen` は判定が記録される度に更新されます

#### POST /agents/{agent_id}/ban

Agent を BAN します。

**リクエストボディ**:

```json
{
  "reason": "不正アクセスの疑い"
}
```

- `reason` は必須（string）

**動作**:
1. `agent_id` が存在しない場合: 404 Not Found
2. 既に `status == "banned"` の場合: 409 Conflict
3. 正常時:
   - `status` を `"banned"` に変更
   - `banned_reason` に `reason` を記録
   - `banned_at` に現在時刻（ISO 8601）を記録
   - Firestore `judgment_events` に BAN イベントを記録:
     - `decision = "DENY"`
     - `reason = "Agent banned: {reason}"`
     - `tool = "system"`
     - `action = "ban"`
     - `agent_id = agent_id`
     - `agent_role = agent_id`
     - `context = {}`

**応答**: 200 OK

#### POST /agents/{agent_id}/unban

Agent の BAN を解除します。

**動作**:
1. `agent_id` が存在しない場合: 404 Not Found
2. 既に `status == "active"` の場合: 409 Conflict
3. 正常時:
   - `status` を `"active"` に変更
   - `banned_reason` を `None` に設定
   - `banned_at` を `None` に設定

**応答**: 200 OK

### /authorize でのBANチェック

`/authorize` エンドポイントの冒頭で、以下のチェックを実施します。

1. リクエストの `agent_role` が `agents` dict に存在するか確認
2. 存在し、かつ `status == "banned"` の場合:
   - **PDP を呼び出さず**、即座に DENY 判定
   - `reason = "Denied: agent is banned ({banned_reason})"`
3. `agent_role` が `agents` dict に存在しない場合: チェックをスキップ（後方互換性のため）

BAN チェックで DENY となった場合も、通常の DENY と同様に Firestore `judgment_events` に保存されます。

### last_seen の更新

`store_judgment()` 関数内で、判定が記録される度に該当 agent の `last_seen` を現在時刻（ISO 8601）に更新します。

## 7. 追加メトリクス API（/graph リニューアル用）

Judgment UI の Governance Insights 画面に表示する詳細メトリクスを提供します。全て読み取り専用エンドポイントで、データソースは Firestore `judgment_events` コレクションです（直近24時間のデータを集計）。

### GET /metrics/block-reason-breakdown

DENY 判定の理由（reason）別の内訳を取得します。

**応答**:

```json
[
  { "reason": "Denied: agent is banned (不正アクセスの疑い)", "count": 5, "pct": 50 },
  { "reason": "Denied: action not allowed outside business hours", "count": 3, "pct": 30 },
  { "reason": "Denied: data sensitivity too high for assistant role", "count": 2, "pct": 20 }
]
```

| フィールド | 型 | 説明 |
|---|---|---|
| `reason` | string | DENY の理由（先頭80文字まで） |
| `count` | integer | 該当件数 |
| `pct` | integer | 全 DENY に対する割合（%、四捨五入） |

- DENY レコードが 0 件の場合: `[]`
- reason は先頭80文字でトリミングされます
- count 降順でソート

### GET /metrics/block-layer-breakdown

DENY 判定がどの層（Layer）で発生したかの内訳を取得します。

**応答**:

```json
[
  { "layer": "L1 Judgment", "count": 8, "pct": 100 },
  { "layer": "L2 Envoy", "count": 0, "pct": 0 },
  { "layer": "L3 Tool", "count": 0, "pct": 0 }
]
```

| フィールド | 型 | 説明 |
|---|---|---|
| `layer` | string | 判定レイヤー名 |
| `count` | integer | 該当件数 |
| `pct` | integer | 全 DENY に対する割合（%、四捨五入） |

- PoC では全ての DENY は L1（Judgment）で発生するため、L2/L3 は常に 0
- DENY レコードが 0 件の場合: `[]`
- レイヤーの順序は固定（L1, L2, L3）

### GET /metrics/tool-risk-profile

ツール別の DENY 率（リスクプロファイル）を取得します。

**応答**:

```json
[
  { "tool": "resident", "total": 10, "deny_count": 3, "deny_pct": 30 },
  { "tool": "system", "total": 5, "deny_count": 5, "deny_pct": 100 }
]
```

| フィールド | 型 | 説明 |
|---|---|---|
| `tool` | string | ツール名 |
| `total` | integer | 該当ツールの全判定数 |
| `deny_count` | integer | DENY 件数 |
| `deny_pct` | integer | DENY 率（%、四捨五入） |

- レコードが 0 件の場合: `[]`
- `deny_pct` 降順でソート
- 計算方法: `deny_pct = round(deny_count / total * 100)`

### GET /metrics/agent-timeline

Agent ごとの時系列データを取得します。BAN/UNBAN イベントも含まれます。

**応答**:

```json
[
  {
    "agent": "assistant",
    "entries": [
      { "ts": "2026-02-10T10:30:00Z", "decision": "ALLOW", "is_ban": false },
      { "ts": "2026-02-10T10:31:00Z", "decision": "DENY", "is_ban": false },
      { "ts": "2026-02-10T10:35:00Z", "decision": "DENY", "is_ban": true }
    ]
  },
  {
    "agent": "admin",
    "entries": [
      { "ts": "2026-02-10T09:00:00Z", "decision": "ALLOW", "is_ban": false }
    ]
  }
]
```

| フィールド | 型 | 説明 |
|---|---|---|
| `agent` | string | Agent ID（`agent_role` に対応） |
| `entries` | array | 時系列エントリの配列 |
| `entries[].ts` | string | タイムスタンプ（ISO 8601） |
| `entries[].decision` | string | 判定結果（"ALLOW" / "DENY"） |
| `entries[].is_ban` | boolean | BAN イベント（`action == "ban"`）の場合 `true` |

- レコードが 0 件の場合: `[]`
- 各 agent の entries は `ts` 昇順（古い順）
- BAN イベントの判定は `action == "ban"` かつ `tool == "system"` で識別
