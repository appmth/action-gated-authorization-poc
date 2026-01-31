# Service A: Judgment (PEP) 設計書

Judgment サービスは、認可判定（Phase 1）と実行仲介（Phase 2）のライフサイクルを管理する中心的なコンポーネントです。

## 1. 認可判定 (Phase 1: /authorize)

### ロジック
1.  **リクエスト受付**: Agent からのアクションとコンテキストを受け取ります。
2.  **PDP 問い合わせ**: `service-b` (OPA) に対して、アクションとコンテキストを送信し、認可判断（allow/deny）とメタデータ（policy_id, tags）を取得します。
3.  **JWT (execution_handle) 生成**:
    - `allow` の場合、以下のクレームを含む RS256 署名済み JWT を発行します。
    - `scope`: `execute:{action}`
    - `ctx_hash`: 認可時のコンテキストの SHA256 ハッシュ値。
    - `jti`: ユニークなチケットID。
    - `req_id`: リクエストの追跡用ID。
4.  **監査ログ**: 判定結果とメタデータを JSON 形式で stdout に出力します。

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

### scope と path のマッピング

| scope | 許可される path |
|-------|----------------|
| `execute:get_resident_info` | `/resident-info` |

## 3. 監査・管理API (Audit & Management APIs)
Judgment UI および外部監査システム向けのデータ提供APIです。

### Endpoints
#### 1. List Judgments
- **GET** `/judgments`
- **Query Params**:
  - `limit`: 取得件数 (default: 20)
- **Response**: `[ { request_id, action, result, reason_short, created_at }, ... ]`

#### 2. Get Judgment Detail
- **GET** `/judgments/{request_id}`
- **Response**:
    ```json
    {
      "request_id": "...",
      "created_at": "...",
      "action": "...",
      "context": { ... },
      "decision": { "allow": true, "reason": "..." },
      "pep_enforcement": { ... },
      "tool_result": { ... },
      "trace": [ ... ]
    }
    ```

#### 3. Metrics (Step 2 Future)
- **GET** `/metrics/decision-distribution`
    - 直近（または指定期間）の ALLOW / DENY カウントと割合を返却。
- **GET** `/metrics/agent-deny-rate`
    - エージェントロールごとの拒否率、総リクエスト数を返却。

## 4. 内部コンポーネント
- **FastAPI**: API フレームワーク。
- **python-jose**: JWT の署名・検証。
- **google-cloud-firestore**: JTI の一意識別子管理。

> [!NOTE]
> ローカル開発時は `FIRESTORE_EMULATOR_HOST` 環境変数を設定することで、`firestore-emulator` コンテナ（ポート 8086）に接続して動作確認が可能です。
