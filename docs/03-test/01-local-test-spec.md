# ローカル環境テスト仕様書

## 概要

ローカル開発環境（docker-compose）での動作確認テスト仕様。

## 前提条件

- Docker Desktop が起動していること
- `.env.local` ファイルが存在すること（なければ `.env.local.example` からコピー）

## 環境起動

```bash
./scripts/deploy.sh local
```

## サービス一覧

| サービス | URL | 役割 |
|---------|-----|------|
| service-a | http://localhost:8080 | Judgment (PEP) |
| service-b | http://localhost:8181 | PDP (OPA) |
| service-c | http://localhost:8082 | Tool Executor |
| envoy-gateway | http://localhost:10000 | JWT検証 + プロキシ |
| firestore-emulator | http://localhost:8080 | JTI Store (ホストで `firebase emulators:start` を実行) |

---

## テストケース

### TC-L01: ヘルスチェック

**目的**: 全サービスが正常に起動していることを確認

#### TC-L01-1: service-a ヘルスチェック

```bash
curl -s http://localhost:8080/health
```

**期待結果**:
```json
{"status":"ok"}
```

#### TC-L01-2: service-b (OPA) ヘルスチェック

```bash
curl -s http://localhost:8181/health
```

**期待結果**:
```json
{}
```

#### TC-L01-3: service-c ヘルスチェック

```bash
curl -s http://localhost:8082/health
```

**期待結果**:
```json
{"status":"ok"}
```

#### TC-L01-4: envoy-gateway ヘルスチェック

```bash
curl -s http://localhost:10000/health
```

**期待結果**:
```json
{"status":"healthy"}
```

---

### TC-L02: 認可フロー（Allow）

**目的**: 営業時間内の問い合わせが許可されることを確認

#### TC-L02-1: /authorize で JWT 取得

```bash
curl -s -X POST "http://localhost:8080/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "local-agent",
    "action": "get_resident_info",
    "context": {
      "purpose": "inquiry",
      "time": "business_hours",
      "data_sensitivity": "required"
    }
  }'
```

**期待結果**:
```json
{
  "request_id": "<UUID>",
  "decision": "allow",
  "reason": "Allowed: inquiry during business hours",
  "execution_handle": "<JWT>",
  "expires_in_seconds": 60
}
```

**検証項目**:
- `decision` が `"allow"` であること
- `execution_handle` が有効な JWT であること
- `expires_in_seconds` が `60` であること

---

### TC-L03: 認可フロー（Deny）

**目的**: 営業時間外のアクセスが拒否されることを確認

#### TC-L03-1: /authorize で拒否

```bash
curl -s -X POST "http://localhost:8080/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "local-agent",
    "action": "get_resident_info",
    "context": {
      "purpose": "inquiry",
      "time": "after_hours",
      "data_sensitivity": "required"
    }
  }'
```

**期待結果**:
```json
{
  "request_id": "<UUID>",
  "decision": "deny",
  "reason": "Denied: access allowed only during business hours",
  "execution_handle": null,
  "expires_in_seconds": null
}
```

**検証項目**:
- `decision` が `"deny"` であること
- `execution_handle` が `null` であること
- `reason` に拒否理由が含まれること

---

### TC-L04: Envoy Gateway JWT 検証

**目的**: Envoy Gateway が JWT を正しく検証することを確認

#### TC-L04-1: JWT なしでアクセス（401 期待）

```bash
curl -s -w "\nHTTP: %{http_code}\n" \
  -X POST http://localhost:10000/tool/execute \
  -H "Content-Type: application/json" \
  -d '{"request_id": "test", "action": "get_resident_info", "context": {}}'
```

**期待結果**:
```
Jwt is missing
HTTP: 401
```

#### TC-L04-2: 有効な JWT でアクセス（200 期待）

```bash
# 事前に TC-L02-1 で取得した JWT を使用
HANDLE="<JWT from TC-L02-1>"

curl -s -w "\nHTTP: %{http_code}\n" \
  -X POST http://localhost:10000/tool/execute \
  -H "Authorization: Bearer $HANDLE" \
  -H "Content-Type: application/json" \
  -d '{"request_id": "test", "action": "get_resident_info", "context": {}}'
```

**期待結果**:
```json
{"status":"done","request_id":"test"}
HTTP: 200
```

---

### TC-L05: 二重実行防止

**目的**: 同じ JWT での二重実行が防止されることを確認

> **注意**: この機能は service-a の `/execute` エンドポイントで提供される。
> Envoy Gateway は JWT の署名・有効期限・audience のみを検証し、JTI の一意性チェックは行わない。

#### TC-L05-1: service-a /execute で1回目実行

```bash
# 新しい JWT を取得
RESPONSE=$(curl -s -X POST "http://localhost:8080/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "local-agent",
    "action": "get_resident_info",
    "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}
  }')

REQUEST_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['request_id'])")
HANDLE=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['execution_handle'])")

# 1回目実行
curl -s -X POST http://localhost:8080/execute \
  -H "Content-Type: application/json" \
  -d "{
    \"request_id\": \"$REQUEST_ID\",
    \"execution_handle\": \"$HANDLE\",
    \"tool_request\": {
      \"method\": \"POST\",
      \"path\": \"/resident-info\",
      \"body\": {\"request_id\": \"test\", \"action\": \"get_resident_info\", \"context\": {}}
    }
  }"
```

**期待結果**:
```json
{
  "request_id": "<UUID>",
  "status": "success",
  "result": {"status": "done", "request_id": "<UUID>", "data": {...}},
  "reason": null
}
```

#### TC-L05-2: 同じ JWT で2回目実行（blocked 期待）

```bash
# 同じ HANDLE で再実行
curl -s -X POST http://localhost:8080/execute \
  -H "Content-Type: application/json" \
  -d "{
    \"request_id\": \"$REQUEST_ID\",
    \"execution_handle\": \"$HANDLE\",
    \"tool_request\": {
      \"method\": \"POST\",
      \"path\": \"/resident-info\",
      \"body\": {\"request_id\": \"test\", \"action\": \"get_resident_info\", \"context\": {}}
    }
  }"
```

**期待結果**:
```json
{
  "request_id": "<UUID>",
  "status": "blocked",
  "result": null,
  "reason": "already used"
}
```

---

### TC-L06: Firestore Emulator 動作確認

**目的**: Firestore Emulator が正常に動作しており、JTI Store として機能することを確認

> **前提**: `FIRESTORE_EMULATOR_HOST=firestore-emulator:8080` が service-a に設定されていること。

#### TC-L06-1: Firestore Emulator ヘルスチェック

```bash
curl -s http://localhost:8086/
```

**期待結果**:
```
Ok
```
（または類似のレスポンス。エミュレータが起動していることを確認）

#### TC-L06-2: JTI 登録確認（TC-L05 の結果確認）

TC-L05 で `/execute` を実行した後、以下を確認：

1. **1回目の実行**: `status: "success"` が返却される。
2. **2回目の実行**: `status: "blocked"`, `reason: "already used"` が返却される。

これにより、Firestore Emulator 上で JTI が正しく登録・検証されていることが確認できる。

---

### TC-L07: JWT 有効期限

**目的**: JWT の有効期限（60秒）が正しく機能することを確認

#### TC-L07-1: 期限切れ JWT で service-a /execute（blocked 期待）

```bash
RESPONSE=$(curl -s -X POST "http://localhost:8080/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "local-agent",
    "action": "get_resident_info",
    "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}
  }')
REQUEST_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['request_id'])")
HANDLE=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['execution_handle'])")

# 75秒待機（60秒の有効期限 + 余裕）
sleep 75

# 期限切れ JWT で実行
curl -s -X POST http://localhost:8080/execute \
  -H "Content-Type: application/json" \
  -d "{
    \"request_id\": \"$REQUEST_ID\",
    \"execution_handle\": \"$HANDLE\",
    \"tool_request\": {
      \"method\": \"POST\",
      \"path\": \"/resident-info\",
      \"body\": {\"request_id\": \"test\", \"action\": \"get_resident_info\", \"context\": {}}
    }
  }"
```

**期待結果**:
```json
{
  "request_id": "<UUID>",
  "status": "blocked",
  "result": null,
  "reason": "expired"
}
```

**検証項目**:
- `status` が `"blocked"` であること
- `reason` が `"expired"` であること

> **備考**: Envoy の JWT フィルタはデフォルトで `exp` チェック時に 60 秒の clock skew を許容する。
> `clock_skew_seconds: 1` を設定することで、ほぼ即時に期限切れを検出する。
> さらに service-a の `/execute` エンドポイントが PyJWT で期限を二重チェックするため、構造として期限切れ JWT の実行は防止される。

---

### TC-L08: パス検証（scope と path の整合性）

**目的**: JWT の scope と tool_request.path の整合性が検証されることを確認

#### TC-L08-1: 許可されたパスで実行（success 期待）

```bash
RESPONSE=$(curl -s -X POST "http://localhost:8080/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "local-agent",
    "action": "get_resident_info",
    "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}
  }')
REQUEST_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['request_id'])")
HANDLE=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['execution_handle'])")

# 許可されたパス（/resident-info）で実行
curl -s -X POST http://localhost:8080/execute \
  -H "Content-Type: application/json" \
  -d "{
    \"request_id\": \"$REQUEST_ID\",
    \"execution_handle\": \"$HANDLE\",
    \"tool_request\": {
      \"method\": \"POST\",
      \"path\": \"/resident-info\",
      \"body\": {\"request_id\": \"test\", \"action\": \"get_resident_info\", \"context\": {}}
    }
  }"
```

**期待結果**:
```json
{
  "request_id": "<UUID>",
  "status": "success",
  "result": {...},
  "reason": null
}
```

#### TC-L08-2: 許可されていないパスで実行（blocked 期待）

```bash
# 新しい JWT を取得
RESPONSE=$(curl -s -X POST "http://localhost:8080/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "local-agent",
    "action": "get_resident_info",
    "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}
  }')
REQUEST_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['request_id'])")
HANDLE=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['execution_handle'])")

# 許可されていないパス（/admin/delete-all）で実行
curl -s -X POST http://localhost:8080/execute \
  -H "Content-Type: application/json" \
  -d "{
    \"request_id\": \"$REQUEST_ID\",
    \"execution_handle\": \"$HANDLE\",
    \"tool_request\": {
      \"method\": \"POST\",
      \"path\": \"/admin/delete-all\",
      \"body\": {}
    }
  }"
```

**期待結果**:
```json
{
  "request_id": "<UUID>",
  "status": "blocked",
  "result": null,
  "reason": "path not allowed for scope"
}
```

**検証項目**:
- `status` が `"blocked"` であること
- `reason` に `"path not allowed for scope"` が含まれること
- JWT は消費されない（次の正しいパスでの実行は可能）

> **注意**: パス検証は JWT の scope と tool_request.path の紐付けに基づく。
> 現在のマッピング:
> | scope | 許可される path |
> |-------|----------------|
> | `execute:get_resident_info` | `/resident-info` |

---

### TC-L09: API キー強制力（Tool 直接アクセス）

**目的**: Tool (service-c) に直接アクセスした場合、API キーがないと拒否されることを確認

#### TC-L09-1: API キーなしで直接アクセス（401 期待）

```bash
curl -s -w "\nHTTP: %{http_code}\n" \
  -X POST http://localhost:8082/resident-info \
  -H "Content-Type: application/json" \
  -d '{"request_id": "test", "action": "get_resident_info", "context": {}}'
```

**期待結果**:
```json
{"detail":"Invalid or missing API key"}
HTTP: 401
```

#### TC-L09-2: 不正な API キーで直接アクセス（401 期待）

```bash
curl -s -w "\nHTTP: %{http_code}\n" \
  -X POST http://localhost:8082/resident-info \
  -H "X-Tool-Api-Key: wrong-key" \
  -H "Content-Type: application/json" \
  -d '{"request_id": "test", "action": "get_resident_info", "context": {}}'
```

**期待結果**:
```json
{"detail":"Invalid or missing API key"}
HTTP: 401
```

**検証項目**:
- Envoy を通さないアクセスが確実に遮断されること

---

## AGA 証明項目との対応

| AGA 証明項目 | テストケース | 結果 |
|-------------|-------------|------|
| Context によって Allow/Deny が変わる | TC-L02, TC-L03 | `business_hours` → Allow, `after_hours` → Deny |
| 実行前に判断を強制 | TC-L04 | JWT なしでは実行不可 |
| 理由が説明可能 | TC-L02, TC-L03 | `reason` フィールドに説明あり |
| 二重実行防止 | TC-L05 | 同じ JWT での2回目実行は blocked |
| JWT 有効期限 | TC-L07 | 60秒後に expired |
| scope/path 整合性検証 | TC-L08 | 許可されていないパスは blocked |
| Tool 直接アクセスの保護 | TC-L09 | API キーなしでは Tool 実行不可 |
