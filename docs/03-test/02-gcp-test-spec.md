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
./scripts/deploy.sh prod service-b
./scripts/deploy.sh prod service-c
./scripts/deploy.sh prod envoy-gateway
./scripts/deploy.sh prod agent-simulator
./scripts/deploy.sh prod judgment-ui
./scripts/deploy.sh prod gov-ui

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
| agent-simulator | https://agent-simulator.action-gated.tech | Agent Traffic Generator |
| judgment-ui | https://judgment-ui.action-gated.tech | 監査ダッシュボード |
| gov-ui | https://gov-ui.action-gated.tech | 行政問い合わせUI |

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

#### TC-G01-5: agent-simulator ヘルスチェック

```bash
curl -s https://agent-simulator.action-gated.tech/health
```

**期待結果**:
```json
{"status":"ok"}
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
> | `execute:read_resident_record` | `/resident-record` |
> | `execute:update_benefit_status` | `/benefit-status` |
> | `execute:send_official_notice` | `/official-notice` |

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

### TC-G10: 新アクション認可（Allow / Deny）

**目的**: 新しい3アクションの Allow/Deny が正しく機能することを確認

#### TC-G10-1: read_resident_record — Allow（監査目的、営業時間内）

```bash
curl -s -X POST "https://service-a.action-gated.tech/authorize" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "audit-bot", "agent_role": "audit-bot", "action": "read_resident_record", "context": {"purpose": "audit", "time": "business_hours", "data_sensitivity": "required"}}'
```

**期待結果**:
- `decision` が `"allow"` であること
- `reason` に `"record access for audit/inquiry during business hours"` が含まれること

#### TC-G10-2: read_resident_record — Deny（営業時間外）

```bash
curl -s -X POST "https://service-a.action-gated.tech/authorize" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "audit-bot", "agent_role": "audit-bot", "action": "read_resident_record", "context": {"purpose": "audit", "time": "after_hours", "data_sensitivity": "required"}}'
```

**期待結果**:
- `decision` が `"deny"` であること
- `reason` に `"full record access requires"` が含まれること

#### TC-G10-3: update_benefit_status — Allow（承認目的、営業時間内）

```bash
curl -s -X POST "https://service-a.action-gated.tech/authorize" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "benefit-admin", "agent_role": "benefit-admin", "action": "update_benefit_status", "context": {"purpose": "approval", "time": "business_hours", "data_sensitivity": "required"}}'
```

**期待結果**:
- `decision` が `"allow"` であること
- `reason` に `"benefit status update with approval"` が含まれること

#### TC-G10-4: update_benefit_status — Deny（問い合わせ目的）

```bash
curl -s -X POST "https://service-a.action-gated.tech/authorize" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "benefit-assistant", "agent_role": "benefit-assistant", "action": "update_benefit_status", "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}}'
```

**期待結果**:
- `decision` が `"deny"` であること
- `reason` に `"benefit status update requires approval"` が含まれること

#### TC-G10-5: send_official_notice — Allow（通知目的、営業時間内）

```bash
curl -s -X POST "https://service-a.action-gated.tech/authorize" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "notify-agent", "agent_role": "notify-agent", "action": "send_official_notice", "context": {"purpose": "notification", "time": "business_hours", "data_sensitivity": "optional"}}'
```

**期待結果**:
- `decision` が `"allow"` であること
- `reason` に `"official notice"` が含まれること

#### TC-G10-6: send_official_notice — Deny（通知目的、営業時間外）

```bash
curl -s -X POST "https://service-a.action-gated.tech/authorize" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "notify-agent", "agent_role": "notify-agent", "action": "send_official_notice", "context": {"purpose": "notification", "time": "after_hours", "data_sensitivity": "optional"}}'
```

**期待結果**:
- `decision` が `"deny"` であること

#### TC-G10-7: send_official_notice — Allow（緊急時、時間帯問わず）

```bash
curl -s -X POST "https://service-a.action-gated.tech/authorize" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "notify-agent", "agent_role": "notify-agent", "action": "send_official_notice", "context": {"purpose": "emergency", "time": "after_hours", "data_sensitivity": "required"}}'
```

**期待結果**:
- `decision` が `"allow"` であること

---

### TC-G11: BAN / Unban フロー

**目的**: エージェントの BAN / Unban が正しく機能することを確認

#### TC-G11-1: BAN 実行

```bash
curl -s -X POST "https://service-a.action-gated.tech/agents/cs-frontdesk/ban" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Suspicious pattern"}'
```

**期待結果**:
```json
{"status": "banned", "agent_id": "cs-frontdesk", "reason": "Suspicious pattern"}
```

#### TC-G11-2: BAN 済みエージェントの認可（DENY 期待）

```bash
curl -s -X POST "https://service-a.action-gated.tech/authorize" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "cs-frontdesk", "agent_role": "cs-frontdesk", "action": "get_resident_info", "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}}'
```

**期待結果**:
- `decision` が `"deny"` であること
- `reason` に `"agent is banned"` が含まれること

#### TC-G11-3: Unban 実行

```bash
curl -s -X POST "https://service-a.action-gated.tech/agents/cs-frontdesk/unban"
```

**期待結果**:
```json
{"status": "active", "agent_id": "cs-frontdesk"}
```

#### TC-G11-4: Unban 後の認可（ALLOW 期待）

```bash
curl -s -X POST "https://service-a.action-gated.tech/authorize" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "cs-frontdesk", "agent_role": "cs-frontdesk", "action": "get_resident_info", "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}}'
```

**期待結果**:
- `decision` が `"allow"` であること

---

### TC-G12: エージェント管理 API

**目的**: エージェント一覧が正しく取得できることを確認

#### TC-G12-1: エージェント一覧取得

```bash
curl -s https://service-a.action-gated.tech/agents
```

**期待結果**:
- 6個のエージェント（cs-frontdesk, cs-night, benefit-admin, benefit-assistant, audit-bot, notify-agent）を含む配列
- 各エージェントに `id`, `display_name`, `role`, `status`, `allow_24h`, `deny_24h` が含まれること

---

### TC-G13: メトリクス API

**目的**: 各種メトリクスエンドポイントが正しく動作することを確認

#### TC-G13-1: 判断分布メトリクス

```bash
curl -s https://service-a.action-gated.tech/metrics/decision-distribution
```

**期待結果**:
```json
{
  "allow_pct": <number>,
  "deny_pct": <number>,
  "total_count": <number>
}
```

#### TC-G13-2: エージェント別拒否率

```bash
curl -s https://service-a.action-gated.tech/metrics/agent-deny-rate
```

**期待結果**:
- エージェントごとの拒否率を含む配列
- 各要素に `agent`, `deny_pct` が含まれること

#### TC-G13-3: ブロック理由内訳

```bash
curl -s https://service-a.action-gated.tech/metrics/block-reason-breakdown
```

**期待結果**:
- 理由ごとのブロック数を含む配列
- 各要素に `reason`, `count`, `pct` が含まれること

#### TC-G13-4: ブロック層内訳

```bash
curl -s https://service-a.action-gated.tech/metrics/block-layer-breakdown
```

**期待結果**:
- レイヤーごとのブロック数を含む配列
- 各要素に `layer`, `count`, `pct` が含まれること

#### TC-G13-5: ツールリスクプロファイル

```bash
curl -s https://service-a.action-gated.tech/metrics/tool-risk-profile
```

**期待結果**:
- ツールごとのリスク情報を含む配列
- 各要素に `tool`, `total`, `deny_count`, `deny_pct` が含まれること

#### TC-G13-6: エージェントタイムライン

```bash
curl -s https://service-a.action-gated.tech/metrics/agent-timeline
```

**期待結果**:
- エージェントごとのイベントタイムラインを含む配列
- 各エージェントに `agent`, `entries` が含まれること

#### TC-G13-7: エージェント行動ヒートマップ

```bash
curl -s https://service-a.action-gated.tech/metrics/behavior_heatmap
```

**期待結果**:
```json
{
  "window": "24h",
  "bucket_size": "1h",
  "bucket_starts": ["<ISO 8601>", ...],
  "agents": [
    {
      "agent_id": "<string>",
      "display_name": "<string>",
      "role": "<string>",
      "status": "active",
      "summary_deny_rate": <number>,
      "summary_total": <number>,
      "summary_deny": <number>,
      "last_5m_deny": <number>,
      "cells": [<HeatmapCell | null>, ...]
    }
  ]
}
```

**検証項目**:
- `agents` が配列であること
- 各エージェントの `cells` 配列の長さが 24 であること（24 時間バケット）
- 各セルが `null` または `{ allow, deny, deny_rate, total }` オブジェクトであること
- `bucket_starts` 配列の長さが 24 であること
- `agents` が `summary_deny_rate` 降順でソートされていること

---

### TC-G14: agent-simulator トリガー

**目的**: agent-simulator が正しく動作することを確認

#### TC-G14-1: 手動トリガー

```bash
curl -s -X POST https://agent-simulator.action-gated.tech/trigger
```

**期待結果**:
```json
{
  "triggered_count": <1-3>,
  "results": [...]
}
```

**検証項目**:
- `triggered_count` が 1〜3 の範囲であること
- `results` 配列に各エージェントのリクエスト結果が含まれること

#### TC-G14-2: ステータス確認

```bash
curl -s https://agent-simulator.action-gated.tech/status
```

**期待結果**:
```json
{
  "last_trigger": "...",
  "total_requests": <number>,
  "errors_last_24h": <number>
}
```

**検証項目**:
- `last_trigger` にタイムスタンプが含まれること
- `total_requests` が 0 以上の数値であること

#### TC-G14-3: Cloud Scheduler 自動トリガー確認

```bash
# 現在の total_requests を記録
BEFORE=$(curl -s https://agent-simulator.action-gated.tech/status | python3 -c "import sys, json; print(json.load(sys.stdin)['total_requests'])")

# 2分待機（Cloud Scheduler は1分間隔で実行）
sleep 120

# 再度確認
AFTER=$(curl -s https://agent-simulator.action-gated.tech/status | python3 -c "import sys, json; print(json.load(sys.stdin)['total_requests'])")

echo "Before: $BEFORE, After: $AFTER"
```

**期待結果**:
- `AFTER` が `BEFORE` より大きいこと（自動トリガーが動作している証拠）

---

### TC-G16: GET /activity 基本クエリ

**目的**: GCP Firestore からアクティビティログが取得できることを確認

#### TC-G16-1: デフォルトクエリ

```bash
curl -s https://service-a.action-gated.tech/activity
```

**期待結果**:
```json
{
  "items": [...],
  "next_cursor": null,
  "has_more": false
}
```

**検証項目**:
- `items` が配列であること
- 各アイテムに `id`, `ts`, `agent_id`, `decision`, `reason` が含まれること

#### TC-G16-2: limit パラメータ

```bash
curl -s "https://service-a.action-gated.tech/activity?limit=2"
```

**期待結果**:
- `items` の長さが最大 2 であること

---

### TC-G17: GET /activity カーソルページネーション

**目的**: カーソルベースのページングが GCP 環境で動作することを確認

#### TC-G17-1: 次ページ取得

```bash
FIRST=$(curl -s "https://service-a.action-gated.tech/activity?limit=2")
CURSOR=$(echo "$FIRST" | python3 -c "import sys, json; print(json.load(sys.stdin).get('next_cursor', ''))")

curl -s "https://service-a.action-gated.tech/activity?limit=2&cursor=$CURSOR"
```

**期待結果**:
- 1ページ目と2ページ目の `items` が重複しないこと

---

### TC-G18: GET /activity フィルタ

**目的**: decision, agent_id, tool フィルタが GCP 環境で動作することを確認

#### TC-G18-1: decision フィルタ

```bash
curl -s "https://service-a.action-gated.tech/activity?decision=DENY"
```

**期待結果**:
- `items` 内の全アイテムの `decision` が `"DENY"` であること

#### TC-G18-2: agent_id フィルタ

```bash
curl -s "https://service-a.action-gated.tech/activity?agent_id=cs-frontdesk"
```

**期待結果**:
- `items` 内の全アイテムの `agent_id` が `"cs-frontdesk"` であること

---

### TC-G19: GET /metrics/overview

**目的**: GCP Firestore ベースのメトリクス概要が取得できることを確認

```bash
curl -s https://service-a.action-gated.tech/metrics/overview
```

**期待結果**:
```json
{
  "total_events": 0,
  "allow_count": 0,
  "deny_count": 0,
  "deny_rate": 0.0,
  "active_agents": 0,
  "period": "last_24h"
}
```

**検証項目**:
- `total_events` = `allow_count` + `deny_count` であること

---

### TC-G20: GET /metrics/agents

**目的**: エージェント別統計が GCP Firestore から集計されることを確認

```bash
curl -s https://service-a.action-gated.tech/metrics/agents
```

**期待結果**:
- 配列であること
- 各要素に `agent_id`, `total`, `allow_count`, `deny_count`, `deny_rate` が含まれること

---

### TC-G21: GET /metrics/reasons

**目的**: DENY 理由別統計が GCP Firestore から集計されることを確認

```bash
curl -s https://service-a.action-gated.tech/metrics/reasons
```

**期待結果**:
- 配列であること
- 各要素に `reason`, `count`, `pct` が含まれること

---

### TC-G22: /authorize → Firestore 書き込み確認

**目的**: GCP 環境で /authorize 実行時に Firestore にドキュメントが作成されることを確認

```bash
RESPONSE=$(curl -s -X POST "https://service-a.action-gated.tech/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "cs-frontdesk",
    "agent_role": "cs-frontdesk",
    "action": "get_resident_info",
    "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}
  }')
REQUEST_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['request_id'])")

sleep 2
curl -s "https://service-a.action-gated.tech/activity" | python3 -c "
import sys, json
data = json.load(sys.stdin)
found = any(item['id'] == '$REQUEST_ID' for item in data['items'])
print('FOUND' if found else 'NOT FOUND')
"
```

**期待結果**:
- `FOUND` と出力されること

---

### TC-G23: /execute → Firestore ドキュメント更新確認

**目的**: GCP 環境で /execute 実行後に Firestore ドキュメントが更新されることを確認

```bash
RESPONSE=$(curl -s -X POST "https://service-a.action-gated.tech/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "cs-frontdesk",
    "agent_role": "cs-frontdesk",
    "action": "get_resident_info",
    "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}
  }')
REQUEST_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['request_id'])")
HANDLE=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['execution_handle'])")

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

sleep 2
curl -s "https://service-a.action-gated.tech/judgments/$REQUEST_ID"
```

**期待結果**:
- `/judgments/{request_id}` のレスポンスが取得できること（404 でないこと）

---

### TC-G24: /activity ページ表示確認

**目的**: GCP 環境で新URLパス `/activity` が表示されることを確認

```bash
curl -s -o /dev/null -w "%{http_code}" https://judgment-ui.action-gated.tech/activity
```

**期待結果**:
```
200
```

---

### TC-G25: /governance ページ表示確認

**目的**: GCP 環境で新URLパス `/governance` が表示されることを確認

```bash
curl -s -o /dev/null -w "%{http_code}" https://judgment-ui.action-gated.tech/governance
```

**期待結果**:
```
200
```

---

### TC-G26: /map → /activity 301 リダイレクト

**目的**: GCP 環境で旧パス `/map` が `/activity` にリダイレクトされることを確認

```bash
curl -s -o /dev/null -w "%{http_code}\n%{redirect_url}" https://judgment-ui.action-gated.tech/map
```

**期待結果**:
- HTTP ステータスが `301` または `308` であること
- リダイレクト先に `/activity` が含まれること

---

### TC-G27: /graph → /governance 301 リダイレクト

**目的**: GCP 環境で旧パス `/graph` が `/governance` にリダイレクトされることを確認

```bash
curl -s -o /dev/null -w "%{http_code}\n%{redirect_url}" https://judgment-ui.action-gated.tech/graph
```

**期待結果**:
- HTTP ステータスが `301` または `308` であること
- リダイレクト先に `/governance` が含まれること

---

### TC-G15: UI ページ確認

**目的**: 各 UI の全ページが正しく表示されることを確認

#### TC-G15-1: judgment-ui /activity ページ

```bash
curl -s -o /dev/null -w "%{http_code}" https://judgment-ui.action-gated.tech/activity
```

**期待結果**:
```
200
```

#### TC-G15-2: judgment-ui /governance ページ

```bash
curl -s -o /dev/null -w "%{http_code}" https://judgment-ui.action-gated.tech/governance
```

**期待結果**:
```
200
```

#### TC-G15-3: judgment-ui /legacy-logs ページ

```bash
curl -s -o /dev/null -w "%{http_code}" https://judgment-ui.action-gated.tech/legacy-logs
```

**期待結果**:
```
200
```

#### TC-G15-4: judgment-ui /activity API連携確認

**目的**: GCP 上の judgment-ui が service-a のリアルデータを表示していることを確認

```bash
# HTML 内に Agent Simulator で生成されたエージェント名が含まれること
curl -s https://judgment-ui.action-gated.tech/activity | grep -o "窓口対応エージェント" | head -1
```

**期待結果**:
- `窓口対応エージェント` が HTML 内に含まれること（モックデータではなく service-a のリアルデータ）

**検証項目**:
- `NEXT_PUBLIC_API_URL` が正しく設定され、service-a からデータ取得できていること
- Agent Simulator のトラフィックによる判断データが表示されること

#### TC-G15-5: judgment-ui Snapshot Summary 確認

**目的**: Activity Log の KPI カード（Snapshot Summary）が表示されること

**手動確認**:
1. https://judgment-ui.action-gated.tech/activity にアクセス
2. ページ上部に以下の4枚の KPI カードが表示されること
   - Total（全判断数）
   - Allow（許可数）
   - Deny（拒否数）
   - Deny Rate（拒否率 %）
3. Last updated 時刻が表示されること

#### TC-G15-6: judgment-ui Agent Tiles 確認

**目的**: Agent タイル行とカスタムドロップダウンが正しく表示されること

**手動確認**:
1. https://judgment-ui.action-gated.tech/activity にアクセス
2. ページ見出しが「AI Agent Activity Log」と表示されること
3. ヘッダー右側に「Last updated: HH:MM:SS」が表示されること
4. "Agents" セクション見出しが表示されること
5. タイル行左端に「All Agents」タイル（マルチロボットSVGアイコン付き）が常時表示されていること
6. エージェント未選択時は「All Agents」タイルがアクティブ状態（`bg-blue-50 border-blue-200`）+ 「Showing All」サブテキスト表示
7. 6個の Agent タイルが表示され、各タイルに以下が含まれること:
   - Agent 名（日本語 display_name）
   - Role ラベル
   - Deny Rate (%)
   - ALLOW / DENY バッジ（24h カウント）
   - ステータスピル（Active / Banned）
8. Agent / Tool ドロップダウンがカスタムセレクト（`rounded-md border-gray-200 shadow-sm`）で表示されること
9. タイルクリックでテーブルがフィルタされること
10. エージェント選択時に「All Agents」タイルが非アクティブ状態（グレー文字、白背景）で表示されること
11. 「All Agents」タイルクリックでフィルタが解除され、アクティブ状態に戻ること
12. 選択中のタイルに「Selected」バッジが左上（青色、text-blue-700 bg-blue-100）に表示されること
13. **フィルタチップバーにアクティブフィルタがチップ形式で表示されること**

#### TC-G15-7: judgment-ui Control Bar 確認

**目的**: Control Bar のフィルタ・アクション機能が動作すること

**手動確認**:
1. https://judgment-ui.action-gated.tech/activity にアクセス
2. Agent タイル行の下に Control Bar が表示されること
3. 以下のコントロールが存在すること:
   - Decision Filter（All / Allow / Deny セグメント）
   - Agent ドロップダウン
   - Tool ドロップダウン
   - High Risk Only トグル
   - Live Mode トグル
   - Refresh ボタン
   - Export CSV ボタン
4. Decision Filter で "Deny" を選択 → テーブルに DENY 行のみ表示されること
5. Refresh ボタンクリック → データが再取得されること

#### TC-G15-8: judgment-ui Governance Insights 確認

**目的**: Governance Insights ページのグラフが正しく表示されること

**手動確認**:
1. https://judgment-ui.action-gated.tech/governance にアクセス
2. SYSTEM STATUS: 4枚のステータスカード（Active Agents / Banned Agents / Global Deny Rate / High Risk Agents）
3. OVERVIEW: Decision Distribution ドーナツチャート + Agent-wise Deny Rate 横棒グラフ
4. GOVERNANCE INSIGHT: Block Reason Breakdown + Block Layer Breakdown
5. RISK PROFILE: Tool-wise Risk Profile
6. BEHAVIOR: Agent Risk Heatmap（3カラムレイアウト: Agent名 | ヒートマップグリッド | サマリ統計）
   - ヒートマップの横幅が他セクション（Tool-wise Risk Profile等）と揃っていること
   - 横軸ラベル（-24h, -18h, -12h, -6h, Now）が固定幅グリッドで均等表示、Now が右端に青太字で固定
   - 各セルの色が deny_rate に基づく 5 段階色で表示されること
   - セルホバーで CSS ツールチップが表示されること
   - 右カラムに Total / Deny / Rate / 5m の4行サマリーが各項目1行で表示されること（ラベル muted、値 semibold）
   - Banned agent の行に赤ダイヤアイコン + 「BANNED」バッジが表示されること
   - 下部に色スケール凡例（0-10%, 10-30%, 30-50%, 50-70%, 70-100%, N/A）+ Banned（赤ダイヤアイコン）が表示されること
   - 過去24時間以内にログが存在する全 agent が表示されること（表示制限なし）

#### TC-G15-9: judgment-ui BAN フロー UI 確認

**目的**: Judgment UI から BAN / Unban 操作が正しく動作すること

**手動確認**:
1. https://judgment-ui.action-gated.tech/activity にアクセス
2. 任意のエージェントタイルの「...」（kebab メニュー）をクリック
3. 「Ban Agent」を選択 → 2段階モーダルが表示されること
4. Step 1: 影響表示 → 「次へ」
5. Step 2: 理由選択 + 「BAN」入力 → 「BAN 実行」
6. タイルが Banned 表示（グレーアウト）に変わること
7. 「...」→ 「Unban Agent」で復旧できること

#### TC-G15-10: gov-ui /inquiry ページ

```bash
curl -s -o /dev/null -w "%{http_code}" https://gov-ui.action-gated.tech/inquiry
```

**期待結果**:
```
200
```

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

### TC-G-E2E-2: agent-simulator → service-a → Judgment UI E2E

**目的**: agent-simulator からの自動トラフィックが全システムで正しく処理されることを確認

```bash
#!/bin/bash
# 完全な E2E テストスクリプト

echo "=== Step 1: 初期メトリクス取得 ==="
INITIAL_COUNT=$(curl -s https://service-a.action-gated.tech/agents | python3 -c "import sys, json; agents = json.load(sys.stdin); print(sum(a['allow_24h'] + a['deny_24h'] for a in agents))")
echo "Initial total judgments: $INITIAL_COUNT"

echo -e "\n=== Step 2: agent-simulator トリガー ==="
curl -s -X POST https://agent-simulator.action-gated.tech/trigger

echo -e "\n\n=== Step 3: 判断数の増加確認 ==="
sleep 2
NEW_COUNT=$(curl -s https://service-a.action-gated.tech/agents | python3 -c "import sys, json; agents = json.load(sys.stdin); print(sum(a['allow_24h'] + a['deny_24h'] for a in agents))")
echo "New total judgments: $NEW_COUNT"

if [ "$NEW_COUNT" -gt "$INITIAL_COUNT" ]; then
  echo "✓ Judgments increased from $INITIAL_COUNT to $NEW_COUNT"
else
  echo "✗ No new judgments recorded"
fi

echo -e "\n=== Step 4: メトリクス API 確認 ==="
curl -s https://service-a.action-gated.tech/metrics/decision-distribution | python3 -m json.tool

echo -e "\n=== Step 5: Judgment UI 確認 ==="
curl -s -o /dev/null -w "Activity page: %{http_code}\n" https://judgment-ui.action-gated.tech/activity
curl -s -o /dev/null -w "Governance page: %{http_code}\n" https://judgment-ui.action-gated.tech/governance
```

**期待結果**:
- 判断数が増加すること
- メトリクス API が正しいデータを返すこと
- Judgment UI が 200 を返すこと

---

## AGA 証明項目との対応

| AGA 証明項目 | テストケース | 検証内容 |
|-------------|-------------|----------|
| Context によって Allow/Deny が変わる | TC-G03, TC-G04, TC-G10 | `business_hours` → Allow, `after_hours` → Deny（全4アクション） |
| 実行前に判断を強制 | TC-G05 | JWT なしでは 401、構造的に実行不可 |
| 理由が説明可能 | TC-G03, TC-G04 | `reason` フィールドに人間可読な説明 |
| 二重実行防止 | TC-G06 | 同じ JWT での2回目実行は blocked |
| JWT 有効期限 | TC-G07 | 60秒後に blocked (expired or signature mismatch) |
| scope/path 整合性検証 | TC-G08 | 許可されていないパスは blocked |
| Tool 直接アクセスの保護 | TC-G09 | API キーなしでは Tool 実行不可 |
| BAN による即時無効化 | TC-G11 | BAN されたエージェントは即座に deny |
| 複数 Agent の管理 | TC-G12 | 6個のエージェントを一覧取得可能 |
| メトリクスによる可視化 | TC-G13 | 6種類のメトリクスで判断状況を可視化 |
| UI による判断履歴の監査 | TC-G15-4〜9 | Activity Log / Governance Insights / BAN フローが GCP 上で正しく動作 |
| Firestore による判定データ永続化 | TC-G16〜TC-G23 | 判定データが Firestore に保存・取得・ページング可能 |
| URL リネーム + 後方互換リダイレクト | TC-G24〜TC-G27 | 新パスで 200、旧パスで 301 リダイレクト |

---

### TC-G28: Judgment UI 速度改善 — Skeleton-first 表示

**目的**: TanStack Query 導入による skeleton-first レンダリングが GCP 環境で動作することを確認

#### TC-G28-1: Activity Log skeleton 表示確認

**手動確認**:
1. https://judgment-ui.action-gated.tech/activity にアクセス
2. ページフレーム（ヘッダー、KPI カード skeleton、Agent タイル skeleton、テーブル skeleton）が即座に表示されること
3. データが数秒以内に skeleton を置き換えて表示されること

#### TC-G28-2: Governance Insights 段階読み込み確認

**手動確認**:
1. https://judgment-ui.action-gated.tech/governance にアクセス
2. 各セクション（SYSTEM STATUS、OVERVIEW、GOVERNANCE INSIGHT、RISK PROFILE、BEHAVIOR）が独立して skeleton → 実データに遷移すること
3. 全セクションが同時にブロックされず、段階的に表示されること

#### TC-G28-3: Judgment Detail skeleton / instant 確認

**手動確認**:
1. Activity Log で行をホバー（prefetch トリガー）
2. ホバーした行をクリック → Detail ページがキャッシュから即座に表示されること
3. 直接 URL で未キャッシュの Detail にアクセス → skeleton が表示された後にデータが表示されること

---

### TC-G29: Judgment UI 速度改善 — キャッシュ動作

**目的**: ページ遷移時のキャッシュ再利用が GCP 環境で動作することを確認

#### TC-G29-1: Activity → Detail → Activity のキャッシュ確認

**手動確認**:
1. https://judgment-ui.action-gated.tech/activity にアクセスし、データ表示を待つ
2. 任意の行をクリックして Detail ページに遷移
3. 「Back to Activity Log」リンクで Activity に戻る
4. Activity ページがキャッシュから即座に表示されること（skeleton なし、再ロードなし）

#### TC-G29-2: Activity ↔ Governance の往復キャッシュ確認

**手動確認**:
1. https://judgment-ui.action-gated.tech/activity にアクセスし、データ表示を待つ
2. サイドバーから Governance Insights に遷移
3. Governance のデータ表示を待つ
4. サイドバーから Activity Log に戻る → キャッシュから即座に表示
5. 再度 Governance に遷移 → キャッシュから即座に表示

---

### TC-G30: Judgment UI 速度改善 — fetch タイムアウト

**目的**: API が応答しない場合でも UI がハングせずモックデータにフォールバックすることを確認

**検証方法**: fetchWithTimeout (3秒) が設定されているため、API サーバーが無応答の場合でも 3 秒以内にモックデータにフォールバックする。GCP 環境では service-a が正常に動作しているため、この動作は間接的に確認済み（ローカルテストで検証済み）。

---

### TC-G31: Activity Log — 行クリック遷移

**手順**:
1. https://judgment.action-gated.tech/activity にアクセス
2. テーブル行の任意の箇所をクリック

**期待結果**:
- 1回のクリックで Judgment Detail ページに遷移すること
- 行のどこをクリックしても遷移が発動すること

**検証コマンド**: ブラウザで目視確認

---

### TC-G32: Judgment Detail — 即時表示 + Context データ

**手順**:
1. Activity Log ページでテーブル行をクリック
2. Detail ページの表示速度と Context セクションを確認

**期待結果**:
- Activity List キャッシュから即時表示されること（Skeleton が表示されない）
- Context セクションに `purpose`, `time` 等のフィールドが表示されること
- `policy_id`, `policy_tags` が表示されること

---

### TC-G33: Firestore — context / policy_id / policy_tags の保存確認

**手順**:
```bash
curl -s "https://service-a.action-gated.tech/activity?limit=3" | python3 -m json.tool
```

**期待結果**:
- 新規イベントの `context` フィールドに `purpose`, `time` 等が含まれること
- `policy_id` が null でないこと
- `policy_tags` が空配列でないこと

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

### service-a のデータ一貫性

判定データは Firestore `judgment_events` コレクションに永続化されるため、複数インスタンス間でのデータ不整合は発生しない。
ただし、Agent の BAN/Unban 状態はインメモリで管理されているため、複数インスタンスが起動すると BAN 状態が分散される可能性がある。

> **注意**: `scripts/deploy.sh` では `--max-instances 5` が設定されている。PoC での Agent 状態の一貫性を保証するには `--max-instances 1` に変更すること。

### Cloud Scheduler が動作しない場合

1. Cloud Scheduler ジョブが有効になっているか確認:
   ```bash
   gcloud scheduler jobs describe agent-simulator-trigger --location=asia-northeast1
   ```
2. 最新の実行ログを確認:
   ```bash
   gcloud scheduler jobs describe agent-simulator-trigger --location=asia-northeast1 | grep lastAttemptTime
   ```
3. 手動で実行してテスト:
   ```bash
   gcloud scheduler jobs run agent-simulator-trigger --location=asia-northeast1
   ```
