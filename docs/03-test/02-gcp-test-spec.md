# GCP 環境テスト仕様書

## 概要

本番環境（GCP Cloud Run）での動作確認テスト仕様。

## 前提条件

- GCP プロジェクト `aga-poc` へのアクセス権があること
- `gcloud` CLI が認証済みであること
- カスタムドメイン `action-gated.tech` が設定済みであること

## デプロイ

```bash
# 単体デプロイ
./scripts/deploy.sh prod service-a

# 全サービスデプロイ
./scripts/deploy.sh prod all
```

## サービス一覧

| サービス | URL | 役割 |
|---------|-----|------|
| service-a | https://service-a.action-gated.tech | Judgment (PEP) |
| service-b | https://service-b.action-gated.tech | PDP (OPA) |
| service-c | https://service-c.action-gated.tech | Tool Executor |
| envoy-gateway | https://envoy-gateway.action-gated.tech | JWT検証 + プロキシ |

---

## テストケース

### TC-G01: ヘルスチェック

**目的**: 全サービスが正常にデプロイされていることを確認

#### TC-G01-1: service-a ヘルスチェック

```bash
curl -s https://service-a.action-gated.tech/health
```

**期待結果**:
```json
{"status":"ok"}
```

#### TC-G01-2: service-b (OPA) ヘルスチェック

```bash
curl -s https://service-b.action-gated.tech/health
```

**期待結果**:
```json
{}
```

#### TC-G01-3: service-c ヘルスチェック

```bash
curl -s https://service-c.action-gated.tech/health
```

**期待結果**:
```json
{"status":"ok"}
```

#### TC-G01-4: envoy-gateway ヘルスチェック

```bash
curl -s https://envoy-gateway.action-gated.tech/health
```

**期待結果**:
```json
{"status":"healthy"}
```

---

### TC-G02: JWKS エンドポイント

**目的**: JWT 検証用の公開鍵が取得できることを確認

#### TC-G02-1: JWKS 取得

```bash
curl -s https://service-a.action-gated.tech/.well-known/jwks.json
```

**期待結果**:
```json
{
  "keys": [
    {
      "kty": "RSA",
      "alg": "RS256",
      "use": "sig",
      "kid": "judgment-key-1",
      "n": "<base64url-encoded-modulus>",
      "e": "AQAB"
    }
  ]
}
```

**検証項目**:
- `keys` 配列に少なくとも1つの鍵が含まれること
- `alg` が `"RS256"` であること
- `kid` が存在すること

---

### TC-G03: 認可フロー（Allow）

**目的**: 営業時間内の問い合わせが許可されることを確認

#### TC-G03-1: /authorize で JWT 取得

```bash
curl -s -X POST "https://service-a.action-gated.tech/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "test-agent",
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
- `execution_handle` が有効な JWT（RS256 署名）であること
- `expires_in_seconds` が `60` であること
- `reason` に許可理由が含まれること

---

### TC-G04: 認可フロー（Deny）

**目的**: 営業時間外のアクセスが拒否されることを確認

#### TC-G04-1: /authorize で拒否

```bash
curl -s -X POST "https://service-a.action-gated.tech/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "test-agent",
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

### TC-G05: Envoy Gateway JWT 検証

**目的**: Envoy Gateway が JWT を正しく検証することを確認

#### TC-G05-1: JWT なしでアクセス（401 期待）

```bash
curl -s -w "\nHTTP: %{http_code}\n" \
  -X POST https://envoy-gateway.action-gated.tech/tool/execute \
  -H "Content-Type: application/json" \
  -d '{"request_id": "test", "action": "get_resident_info", "context": {}}'
```

**期待結果**:
```
Jwt is missing
HTTP: 401
```

#### TC-G05-2: 有効な JWT でアクセス（200 期待）

```bash
# 事前に TC-G03-1 で取得した JWT を使用
HANDLE="<JWT from TC-G03-1>"

curl -s -w "\nHTTP: %{http_code}\n" \
  -X POST https://envoy-gateway.action-gated.tech/tool/execute \
  -H "Authorization: Bearer $HANDLE" \
  -H "Content-Type: application/json" \
  -d '{"request_id": "test", "action": "get_resident_info", "context": {}}'
```

**期待結果**:
```json
{"status":"done","request_id":"test"}
HTTP: 200
```

#### TC-G05-3: 不正な JWT でアクセス（401 期待）

```bash
curl -s -w "\nHTTP: %{http_code}\n" \
  -X POST https://envoy-gateway.action-gated.tech/tool/execute \
  -H "Authorization: Bearer invalid.jwt.token" \
  -H "Content-Type: application/json" \
  -d '{"request_id": "test", "action": "get_resident_info", "context": {}}'
```

**期待結果**:
```
Jwt is not in the form of Header.Payload.Signature with two dots and 3 sections
HTTP: 401
```

---

### TC-G06: 二重実行防止

**目的**: 同じ JWT での二重実行が防止されることを確認

> **注意**: この機能は service-a の `/execute` エンドポイントで提供される。
> Firestore の JTI Store でトランザクション管理される。

#### TC-G06-1: service-a /execute で1回目実行

```bash
# 新しい JWT を取得
RESPONSE=$(curl -s -X POST "https://service-a.action-gated.tech/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "test-agent",
    "action": "get_resident_info",
    "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}
  }')

REQUEST_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['request_id'])")
HANDLE=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['execution_handle'])")

# 1回目実行
curl -s -X POST https://service-a.action-gated.tech/execute \
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

#### TC-G06-2: 同じ JWT で2回目実行（blocked 期待）

```bash
# 同じ HANDLE で再実行
curl -s -X POST https://service-a.action-gated.tech/execute \
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

### TC-G07: JWT 有効期限

**目的**: JWT の有効期限（60秒）が正しく機能することを確認

#### TC-G07-1: 期限切れ JWT で service-a /execute（blocked 期待）

```bash
RESPONSE=$(curl -s -X POST "https://service-a.action-gated.tech/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "test-agent",
    "action": "get_resident_info",
    "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}
  }')
REQUEST_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['request_id'])")
HANDLE=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['execution_handle'])")

# 75秒待機（60秒の有効期限 + 余裕）
sleep 75

# 期限切れ JWT で実行
curl -s -X POST https://service-a.action-gated.tech/execute \
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
- `reason` が `"expired"` または `"invalid token: Signature verification failed"` であること

> **備考**: Cloud Run の `min-instances=0` 設定では、75秒の待機中にインスタンスがリサイクルされる可能性がある。
> その場合、新しいインスタンスで RSA キーペアが再生成されるため、`reason` が `"expired"` ではなく
> `"invalid token: Signature verification failed"` となる。いずれの場合も JWT は `blocked` として拒否される。
> Envoy の `clock_skew_seconds: 1` により、Envoy 層でも期限切れ JWT はほぼ即時に検出される。

---

### TC-G08: パス検証（scope と path の整合性）

**目的**: JWT の scope と tool_request.path の整合性が検証されることを確認

#### TC-G08-1: 許可されたパスで実行（success 期待）

```bash
RESPONSE=$(curl -s -X POST "https://service-a.action-gated.tech/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "test-agent",
    "action": "get_resident_info",
    "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}
  }')
REQUEST_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['request_id'])")
HANDLE=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['execution_handle'])")

# 許可されたパス（/resident-info）で実行
curl -s -X POST https://service-a.action-gated.tech/execute \
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

#### TC-G08-2: 許可されていないパスで実行（blocked 期待）

```bash
# 新しい JWT を取得
RESPONSE=$(curl -s -X POST "https://service-a.action-gated.tech/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "test-agent",
    "action": "get_resident_info",
    "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}
  }')
REQUEST_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['request_id'])")
HANDLE=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['execution_handle'])")

# 許可されていないパス（/admin/delete-all）で実行
curl -s -X POST https://service-a.action-gated.tech/execute \
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

### TC-G09: API キー強制力（Tool 直接アクセス）

**目的**: Tool (service-c) に直接アクセスした場合、API キーがないと拒否されることを確認

#### TC-G09-1: API キーなしで直接アクセス（401 期待）

```bash
curl -s -w "\nHTTP: %{http_code}\n" \
  -X POST https://service-c.action-gated.tech/resident-info \
  -H "Content-Type: application/json" \
  -d '{"request_id": "test", "action": "get_resident_info", "context": {}}'
```

**期待結果**:
```json
{"detail":"Invalid or missing API key"}
HTTP: 401
```

#### TC-G09-2: 不正な API キーで直接アクセス（401 期待）

```bash
curl -s -w "\nHTTP: %{http_code}\n" \
  -X POST https://service-c.action-gated.tech/resident-info \
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
- Envoy を通さない直接アクセスが確実に遮断されること
- API キーは GCP Secret Manager から注入され、Agent には一切公開されないこと

---

## E2E シナリオテスト

### TC-G-E2E-1: Allow → Execute → 二重実行防止

```bash
#!/bin/bash
# 完全な E2E テストスクリプト

echo "=== Step 1: JWT 取得（Allow）==="
RESPONSE=$(curl -s -X POST "https://service-a.action-gated.tech/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "e2e-agent",
    "action": "get_resident_info",
    "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}
  }')
echo "$RESPONSE"
REQUEST_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['request_id'])")
HANDLE=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['execution_handle'])")

echo -e "\n=== Step 2: service-a /execute で1回目実行 ==="
curl -s -X POST https://service-a.action-gated.tech/execute \
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

echo -e "\n\n=== Step 3: 同じ JWT で2回目実行（blocked 期待）==="
curl -s -X POST https://service-a.action-gated.tech/execute \
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

---

## AGA 証明項目との対応

| AGA 証明項目 | テストケース | 検証内容 |
|-------------|-------------|----------|
| Context によって Allow/Deny が変わる | TC-G03, TC-G04 | `business_hours` → Allow, `after_hours` → Deny |
| 実行前に判断を強制 | TC-G05 | JWT なしでは 401、構造的に実行不可 |
| 理由が説明可能 | TC-G03, TC-G04 | `reason` フィールドに人間可読な説明 |
| 二重実行防止 | TC-G06 | 同じ JWT での2回目実行は blocked |
| JWT 有効期限 | TC-G07 | 60秒後に blocked (expired or signature mismatch) |
| scope/path 整合性検証 | TC-G08 | 許可されていないパスは blocked |
| Tool 直接アクセスの保護 | TC-G09 | API キーなしでは Tool 実行不可 |

---

## トラブルシューティング

### 401 エラーが発生する場合

1. JWT の有効期限（60秒）が切れていないか確認
2. JWKS エンドポイントが正常に動作しているか確認
3. JWT の `aud` が `"envoy-gateway"` であることを確認

### 502/503 エラーが発生する場合

1. Cloud Run のインスタンスがコールドスタートの可能性
2. 数秒待って再試行
3. `gcloud run services describe <service-name> --region asia-northeast1` でステータス確認
