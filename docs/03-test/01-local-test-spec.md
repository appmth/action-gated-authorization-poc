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
| firestore-emulator | http://localhost:8086 | JTI Store (docker-compose で自動起動) |
| agent-simulator | http://localhost:8090 | Agent Traffic Generator |
| judgment-ui | http://localhost:3000 | 監査ダッシュボード |
| gov-ui | http://localhost:3001 | 行政問い合わせUI |

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

#### TC-L01-5: agent-simulator ヘルスチェック

```bash
curl -s http://localhost:8090/health
```

**期待結果**:
```json
{"status":"ok"}
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
> | `execute:read_resident_record` | `/resident-record` |
> | `execute:update_benefit_status` | `/benefit-status` |
> | `execute:send_official_notice` | `/official-notice` |

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

### TC-L10: 新アクション認可（Allow / Deny）

**目的**: 新しい3アクションの Allow/Deny が正しく機能することを確認

#### TC-L10-1: read_resident_record — Allow（監査目的、営業時間内）

```bash
curl -s -X POST "http://localhost:8080/authorize" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "audit-bot", "agent_role": "audit-bot", "action": "read_resident_record", "context": {"purpose": "audit", "time": "business_hours", "data_sensitivity": "required"}}'
```

**期待結果**:
- `decision` が `"allow"` であること
- `reason` に `"record access for audit/inquiry during business hours"` が含まれること

#### TC-L10-2: read_resident_record — Deny（営業時間外）

```bash
curl -s -X POST "http://localhost:8080/authorize" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "audit-bot", "agent_role": "audit-bot", "action": "read_resident_record", "context": {"purpose": "audit", "time": "after_hours", "data_sensitivity": "required"}}'
```

**期待結果**:
- `decision` が `"deny"` であること
- `reason` に `"full record access requires"` が含まれること

#### TC-L10-3: update_benefit_status — Allow（承認目的、営業時間内）

```bash
curl -s -X POST "http://localhost:8080/authorize" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "benefit-admin", "agent_role": "benefit-admin", "action": "update_benefit_status", "context": {"purpose": "approval", "time": "business_hours", "data_sensitivity": "required"}}'
```

**期待結果**:
- `decision` が `"allow"` であること
- `reason` に `"benefit status update with approval"` が含まれること

#### TC-L10-4: update_benefit_status — Deny（問い合わせ目的）

```bash
curl -s -X POST "http://localhost:8080/authorize" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "benefit-assistant", "agent_role": "benefit-assistant", "action": "update_benefit_status", "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}}'
```

**期待結果**:
- `decision` が `"deny"` であること
- `reason` に `"benefit status update requires approval"` が含まれること

#### TC-L10-5: send_official_notice — Allow（通知目的、営業時間内）

```bash
curl -s -X POST "http://localhost:8080/authorize" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "notify-agent", "agent_role": "notify-agent", "action": "send_official_notice", "context": {"purpose": "notification", "time": "business_hours", "data_sensitivity": "optional"}}'
```

**期待結果**:
- `decision` が `"allow"` であること
- `reason` に `"official notice"` が含まれること

#### TC-L10-6: send_official_notice — Deny（通知目的、営業時間外）

```bash
curl -s -X POST "http://localhost:8080/authorize" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "notify-agent", "agent_role": "notify-agent", "action": "send_official_notice", "context": {"purpose": "notification", "time": "after_hours", "data_sensitivity": "optional"}}'
```

**期待結果**:
- `decision` が `"deny"` であること

#### TC-L10-7: send_official_notice — Allow（緊急時、時間帯問わず）

```bash
curl -s -X POST "http://localhost:8080/authorize" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "notify-agent", "agent_role": "notify-agent", "action": "send_official_notice", "context": {"purpose": "emergency", "time": "after_hours", "data_sensitivity": "required"}}'
```

**期待結果**:
- `decision` が `"allow"` であること

---

### TC-L11: BAN / Unban フロー

**目的**: エージェントの BAN / Unban が正しく機能することを確認

#### TC-L11-1: BAN 実行

```bash
curl -s -X POST "http://localhost:8080/agents/cs-frontdesk/ban" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Suspicious pattern"}'
```

**期待結果**:
```json
{"status": "banned", "agent_id": "cs-frontdesk", "reason": "Suspicious pattern"}
```

#### TC-L11-2: BAN 済みエージェントの認可（DENY 期待）

```bash
curl -s -X POST "http://localhost:8080/authorize" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "cs-frontdesk", "agent_role": "cs-frontdesk", "action": "get_resident_info", "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}}'
```

**期待結果**:
- `decision` が `"deny"` であること
- `reason` に `"agent is banned"` が含まれること

#### TC-L11-3: Unban 実行

```bash
curl -s -X POST "http://localhost:8080/agents/cs-frontdesk/unban"
```

**期待結果**:
```json
{"status": "active", "agent_id": "cs-frontdesk"}
```

#### TC-L11-4: Unban 後の認可（ALLOW 期待）

```bash
curl -s -X POST "http://localhost:8080/authorize" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "cs-frontdesk", "agent_role": "cs-frontdesk", "action": "get_resident_info", "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}}'
```

**期待結果**:
- `decision` が `"allow"` であること

---

### TC-L12: エージェント管理 API

**目的**: エージェント一覧が正しく取得できることを確認

#### TC-L12-1: エージェント一覧取得

```bash
curl -s http://localhost:8080/agents
```

**期待結果**:
- 6個のエージェント（cs-frontdesk, cs-night, benefit-admin, benefit-assistant, audit-bot, notify-agent）を含む配列
- 各エージェントに `id`, `display_name`, `role`, `status`, `allow_24h`, `deny_24h` が含まれること

---

### TC-L13: メトリクス API

**目的**: 各種メトリクスエンドポイントが正しく動作することを確認

#### TC-L13-1: 判断分布メトリクス

```bash
curl -s http://localhost:8080/metrics/decision-distribution
```

**期待結果**:
```json
{
  "allow_pct": <number>,
  "deny_pct": <number>,
  "total_count": <number>
}
```

#### TC-L13-2: エージェント別拒否率

```bash
curl -s http://localhost:8080/metrics/agent-deny-rate
```

**期待結果**:
- エージェントごとの拒否率を含む配列
- 各要素に `agent`, `deny_pct` が含まれること

#### TC-L13-3: ブロック理由内訳

```bash
curl -s http://localhost:8080/metrics/block-reason-breakdown
```

**期待結果**:
- 理由ごとのブロック数を含む配列
- 各要素に `reason`, `count`, `pct` が含まれること

#### TC-L13-4: ブロック層内訳

```bash
curl -s http://localhost:8080/metrics/block-layer-breakdown
```

**期待結果**:
- レイヤーごとのブロック数を含む配列
- 各要素に `layer`, `count`, `pct` が含まれること

#### TC-L13-5: ツールリスクプロファイル

```bash
curl -s http://localhost:8080/metrics/tool-risk-profile
```

**期待結果**:
- ツールごとのリスク情報を含む配列
- 各要素に `tool`, `total`, `deny_count`, `deny_pct` が含まれること

#### TC-L13-6: エージェントタイムライン

```bash
curl -s http://localhost:8080/metrics/agent-timeline
```

**期待結果**:
- エージェントごとのイベントタイムラインを含む配列
- 各エージェントに `agent`, `entries` が含まれること

#### TC-L13-7: エージェント行動ヒートマップ

```bash
curl -s http://localhost:8080/metrics/behavior_heatmap
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

### TC-L14: agent-simulator トリガー

**目的**: agent-simulator が正しく動作することを確認

#### TC-L14-1: 手動トリガー

```bash
curl -s -X POST http://localhost:8090/trigger
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

#### TC-L14-2: ステータス確認

```bash
curl -s http://localhost:8090/status
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

---

### TC-L16: GET /activity 基本クエリ

**目的**: Firestore からアクティビティログが取得できることを確認

#### TC-L16-1: デフォルトクエリ

```bash
# 事前に TC-L02/TC-L03 で判定データを生成しておくこと
curl -s http://localhost:8080/activity
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
- `ts` が ISO 8601 形式であること

#### TC-L16-2: limit パラメータ

```bash
curl -s "http://localhost:8080/activity?limit=2"
```

**期待結果**:
- `items` の長さが最大 2 であること
- データが 3 件以上あれば `has_more` が `true`、`next_cursor` が非 null であること

---

### TC-L17: GET /activity カーソルページネーション

**目的**: カーソルベースのページングが正しく動作することを確認

#### TC-L17-1: 次ページ取得

```bash
# 1ページ目
FIRST=$(curl -s "http://localhost:8080/activity?limit=2")
CURSOR=$(echo "$FIRST" | python3 -c "import sys, json; print(json.load(sys.stdin).get('next_cursor', ''))")

# 2ページ目
curl -s "http://localhost:8080/activity?limit=2&cursor=$CURSOR"
```

**期待結果**:
- 1ページ目と2ページ目の `items` が重複しないこと
- 2ページ目の `items` が1ページ目より古い（`ts` が小さい）こと

---

### TC-L18: GET /activity フィルタ

**目的**: decision, agent_id, tool フィルタが正しく動作することを確認

#### TC-L18-1: decision フィルタ

```bash
curl -s "http://localhost:8080/activity?decision=DENY"
```

**期待結果**:
- `items` 内の全アイテムの `decision` が `"DENY"` であること

#### TC-L18-2: agent_id フィルタ

```bash
curl -s "http://localhost:8080/activity?agent_id=cs-frontdesk"
```

**期待結果**:
- `items` 内の全アイテムの `agent_id` が `"cs-frontdesk"` であること

#### TC-L18-3: tool フィルタ

```bash
curl -s "http://localhost:8080/activity?tool=resident"
```

**期待結果**:
- `items` 内の全アイテムの `tool` が `"resident"` であること

---

### TC-L19: GET /metrics/overview

**目的**: Firestore ベースのメトリクス概要が取得できることを確認

```bash
curl -s http://localhost:8080/metrics/overview
```

**期待結果**:
```json
{
  "total_events": <number>,
  "allow_count": <number>,
  "deny_count": <number>,
  "deny_rate": <number>,
  "active_agents": <number>,
  "period": "last_24h"
}
```

**検証項目**:
- `total_events` = `allow_count` + `deny_count` であること
- データソースが Firestore `judgment_events`（直近24時間）であること

---

### TC-L20: GET /metrics/agents

**目的**: エージェント別統計が Firestore から集計されることを確認

```bash
curl -s http://localhost:8080/metrics/agents
```

**期待結果**:
```json
[
  { "agent_id": "<agent_id>", "total": <number>, "allow_count": <number>, "deny_count": <number>, "deny_rate": <number> }
]
```

**検証項目**:
- 配列であること
- 各要素に `agent_id`, `total`, `allow_count`, `deny_count`, `deny_rate` が含まれること
- 各要素で `total` = `allow_count` + `deny_count` であること

---

### TC-L21: GET /metrics/reasons

**目的**: DENY 理由別統計が Firestore から集計されることを確認

```bash
curl -s http://localhost:8080/metrics/reasons
```

**期待結果**:
```json
[
  { "reason": "<text>", "count": <number>, "pct": <number> }
]
```

**検証項目**:
- 配列であること
- 各要素に `reason`, `count`, `pct` が含まれること
- DENY が 0 件の場合は空配列 `[]` であること

---

### TC-L22: /authorize → Firestore 書き込み確認

**目的**: /authorize 実行時に judgment_events コレクションにドキュメントが作成されることを確認

```bash
# 認可判定を実行
RESPONSE=$(curl -s -X POST "http://localhost:8080/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "cs-frontdesk",
    "agent_role": "cs-frontdesk",
    "action": "get_resident_info",
    "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}
  }')
REQUEST_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['request_id'])")

# /activity で該当ドキュメントが取得できることを確認
sleep 1
curl -s "http://localhost:8080/activity" | python3 -c "
import sys, json
data = json.load(sys.stdin)
found = any(item['id'] == '$REQUEST_ID' for item in data['items'])
print('FOUND' if found else 'NOT FOUND')
"
```

**期待結果**:
- `FOUND` と出力されること
- `/authorize` で生成された `request_id` が `/activity` のレスポンスに含まれること

---

### TC-L23: /execute → Firestore ドキュメント更新確認

**目的**: /execute 実行後に judgment_events ドキュメントが更新されることを確認

```bash
# Allow で JWT 取得
RESPONSE=$(curl -s -X POST "http://localhost:8080/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "cs-frontdesk",
    "agent_role": "cs-frontdesk",
    "action": "get_resident_info",
    "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}
  }')
REQUEST_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['request_id'])")
HANDLE=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['execution_handle'])")

# 実行
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

# 詳細を取得して確認
sleep 1
curl -s "http://localhost:8080/judgments/$REQUEST_ID"
```

**期待結果**:
- `/judgments/{request_id}` のレスポンスが取得できること（404 でないこと）
- レスポンスに判定データ（`decision`, `reason`, `agent_id`）が含まれること

---

### TC-L24: /activity ページ表示確認

**目的**: 新URLパス `/activity` でページが表示されることを確認

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/activity
```

**期待結果**:
```
200
```

---

### TC-L25: /governance ページ表示確認

**目的**: 新URLパス `/governance` でページが表示されることを確認

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/governance
```

**期待結果**:
```
200
```

---

### TC-L26: /map → /activity 301 リダイレクト

**目的**: 旧パス `/map` が `/activity` に 301 リダイレクトされることを確認

```bash
curl -s -o /dev/null -w "%{http_code}" -L http://localhost:3000/map
```

**期待結果**:
```
200
```

**追加検証**:
```bash
curl -s -o /dev/null -w "%{http_code}\n%{redirect_url}" http://localhost:3000/map
```

- HTTP ステータスが `301` または `308` であること
- リダイレクト先に `/activity` が含まれること

---

### TC-L27: /graph → /governance 301 リダイレクト

**目的**: 旧パス `/graph` が `/governance` に 301 リダイレクトされることを確認

```bash
curl -s -o /dev/null -w "%{http_code}" -L http://localhost:3000/graph
```

**期待結果**:
```
200
```

**追加検証**:
```bash
curl -s -o /dev/null -w "%{http_code}\n%{redirect_url}" http://localhost:3000/graph
```

- HTTP ステータスが `301` または `308` であること
- リダイレクト先に `/governance` が含まれること

---

### TC-L15: Judgment UI ページ確認

**目的**: Judgment UI の各ページが正しく表示され、UI brushup の変更が反映されていることを確認

> **Playwright テスト**: 以下の手動テストに加え、Playwright による自動テストが利用可能。
> ```bash
> cd judgment-ui && npx playwright test --project=chromium
> ```

#### TC-L15-1: /activity ページ（Activity Log）

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/activity
```

**期待結果**:
```
200
```

**目視確認項目**:
- ページ見出しが「Activity Log」と表示されること
- サイドバーに「Activity Log」ラベルが表示されること
- テーブルのカラムヘッダーが Time / Agent / Tool / Action / Decision の5列であること（Reason カラムは廃止）
- 各行の下に Reason テキストが2行目として表示されること

#### TC-L15-2: /governance ページ（Governance Insights）

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/governance
```

**期待結果**:
```
200
```

**目視確認項目**:
- ページ見出しが「Governance Insights」と表示されること
- サイドバーに「Governance Insights」ラベルが表示されること

#### TC-L15-3: /legacy-logs ページ

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/legacy-logs
```

**期待結果**:
```
200
```

#### TC-L15-4: gov-ui /inquiry ページ

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/inquiry
```

**期待結果**:
```
200
```

#### TC-L15-5: Activity Log — DENY 行ハイライト

**手順**: ブラウザで http://localhost:3000/activity を開く

**期待結果**:
- DENY 判定の行が赤背景（`bg-red-50`）でハイライトされていること
- ALLOW 判定の行は白背景のままであること

#### TC-L15-6: Activity Log — Agent タイルと Deny Rate 表示

**手順**: ブラウザで http://localhost:3000/activity を開く

**期待結果**:
- ページ見出しが「AI Agent Activity Log」と表示されること
- ヘッダー右側に「Last updated: HH:MM:SS」が `text-xs text-gray-400` で表示されること
- テーブル上部に Agent タイルが横並びで表示されること
- タイル行左端に「All Agents」タイル（マルチロボットSVGアイコン付き）が常時表示されていること
- エージェント未選択時は「All Agents」タイルがアクティブ状態（`bg-blue-50 border-blue-200`）+ 「Showing All」サブテキスト表示
- Agent カスタムドロップダウン（`rounded-md border-gray-200 shadow-sm`）に「All Agents」オプションが存在すること
- Tool カスタムドロップダウンも同スタイルで表示されること
- 各 Agent タイルに「Deny Rate: XX%」が表示されること
- Deny Rate 50% 以上の Agent タイルは赤枠（`border-red-400`）で強調されること
- Banned Agent のタイルは半透明（`opacity-60`）表示であること
- タイルクリックでテーブルがフィルタリングされること
- エージェント選択時に「All Agents」タイルが非アクティブ状態（グレー文字、白背景）で表示されること
- 「All Agents」タイルクリックでフィルタが解除され、アクティブ状態に戻ること
- 選択中のタイルに「Selected」バッジが左上（青色、text-blue-700 bg-blue-100）に表示されること

#### TC-L15-7: Governance Insights — SYSTEM STATUS セクション

**手順**: ブラウザで http://localhost:3000/governance を開く

**期待結果**:
- ページ上部に「SYSTEM STATUS」セクションが表示されること
- 4枚のカード（Active Agents / Banned Agents / Global Deny Rate / High Risk Agents）が横並びで表示されること
- Banned Agents が 1 以上の場合、数値が赤色で表示されること
- Global Deny Rate が 50% 以上の場合、数値が赤色で表示されること

#### TC-L15-8: Governance Insights — Decision Distribution ドーナツチャート

**手順**: ブラウザで http://localhost:3000/governance を開く

**期待結果**:
- ドーナツチャートの中央に Deny Rate（XX%）が赤字で表示されること
- 凡例に「ALLOW: XX%」「DENY: XX%」が表示されること

#### TC-L15-9: クロスページフィルタリング（Graph -> Map）

**手順**:
1. ブラウザで http://localhost:3000/governance を開く
2. Agent-wise Deny Rate のバーをクリックする

**期待結果**:
- /activity?agent=<agent_name> に遷移すること
- Activity Log テーブルが該当 Agent でフィルタリングされていること

#### TC-L15-10: Agent Risk Heatmap — ヒートマップ表示・インタラクション

**手順**: ブラウザで http://localhost:3000/governance を開く

**期待結果**:
- Agent Risk Heatmap セクションが「BEHAVIOR」見出し下に表示されること
- カードタイトルが「Agent Risk Heatmap」であること
- サブタイトルに「Deny rate by agent and time bucket (Last 24h)」が表示されること
- 3カラムレイアウト（Agent名 | ヒートマップグリッド | サマリー）で表示されること
- カラムラベル（-24h, -18h, -12h, -6h, Now）が表示されること
- 各セルの色が deny_rate に基づく 5 段階色で表示されること（緑系→黄→橙→赤）
- セルホバーで CSS ツールチップが表示されること（deny_rate, allow, deny, total, 時間範囲）
- Low confidence セル（total < 10）が半透明 + ドットインジケータ付きで表示されること
- データなしセルが灰色背景 + "-" テキストで表示されること
- Banned agent の行が赤背景 + 「BANNED」バッジ付きで表示されること
- 各エージェント名の下に Deny Rate と Risk Level（HIGH/MEDIUM/LOW）が表示されること
- 各エージェント行の右側に Total / Deny / Deny Rate のサマリーが表示されること
- Deny Rate 50% 超のエージェントがいる場合、上部に Warning バナーが表示されること
- 下部に 5 段階色スケールの凡例が表示されること
- エージェント名クリックで `/activity?agent={agent}` に遷移すること
- マウント時にヒートマップが右端（Now）へ自動スクロールされること

#### TC-L15-16: Agent Tile — リスク枠と選択状態の分離

**手順**: ブラウザで http://localhost:3000/activity を開く

**期待結果**:
- Agent タイルの枠線がリスク状態に基づいて表示されること
  - LOW（0-29%）: グレー枠（`border-gray-200`）
  - MEDIUM（30-49%）: オレンジ枠（`border-orange-400`）
  - HIGH（50%以上）: 赤枠（`border-red-400`）
  - BANNED: 濃いグレー枠（`border-gray-400`）+ 半透明
- タイル選択時に枠線色が変わらないこと（リスク枠が維持されること）
- 選択状態は背景色（`bg-gray-50`）+ シャドウ + scale-[1.01] + 左側青バー（`bg-blue-500`）+ `aria-selected="true"` で表現されること
- 選択中のタイルに「Selected」バッジ（左上、青色 bg-blue-100 text-blue-700、左インジケーターバーの右）が表示されること
- HIGH RISK + SELECTED の場合：赤枠 + グレー背景 + 左側青バー + scale-[1.01] が同時に表示されること

#### TC-L15-11: Favicon 表示確認

**手順**: ブラウザで http://localhost:3000/activity を開く

**期待結果**:
- ブラウザタブに SVG ファビコン（judgment-ui-favicon.svg）が設定されていること
- HTML の `<link rel="icon">` タグに `judgment-ui-favicon` を含む href が存在すること

#### TC-L15-12: TopBar ブランドブロック確認

**手順**: ブラウザで http://localhost:3000/activity を開く

**期待結果**:
- ヘッダー左上にロゴ画像 + 「Judgment」+ 「AI Governance Platform」が表示されること
- ヘッダー右上に「Project: Government AI Oversight」が表示されること

#### TC-L15-13: Sidebar ブランド削除・セクション見出し確認

**手順**: ブラウザで http://localhost:3000/activity を開く

**期待結果**:
- サイドバーに旧ブランドブロック（「Action-Gated Authorization」）が表示されないこと
- サイドバーに「OVERVIEW」セクション見出しが表示されること

#### TC-L15-14: Activity Log — サブタイトル・AIアイコン・警告絵文字なし

**手順**: ブラウザで http://localhost:3000/activity を開く

**期待結果**:
- ページ見出し「Activity Log」の下にサブタイトルが表示されること
- エージェントタイルに AI ロボットアイコン（SVG, `text-blue-500`）が表示されること
- エージェントタイルに ⚠️ 警告絵文字が表示されないこと

#### TC-L15-15: テーブルホバー統一確認

**手順**: ブラウザで http://localhost:3000/activity を開き、テーブル行にマウスオーバーする

**期待結果**:
- Data 行と Reason 行が `<tbody class="group">` でグループ化されていること
- 1つのジャッジメントにつき Data 行 + Reason 行の 2 行が 1 セットでホバーされること


#### TC-L15-17: Activity Log — SnapshotSummary 表示確認

**手順**: Playwright テスト `dashboard.spec.ts` > `Activity Log Dashboard: Snapshot Summary`

**期待結果**:
- `data-testid="snapshot-summary"` が表示されること
- `data-testid="snapshot-total"` に数値が表示されること
- `data-testid="snapshot-deny-rate"` に "%" を含むテキストが表示されること
- Last updated 時刻が表示されること

#### TC-L15-18: Activity Log — Decision Filter 動作確認

**手順**: Playwright テスト `dashboard.spec.ts` > `Activity Log Dashboard: Decision Filter`

**期待結果**:
- `data-testid="decision-filter"` が表示されること
- "Allow" ボタンクリック → DENY 行が非表示
- "Deny" ボタンクリック → ALLOW 行が非表示
- "All" ボタンクリック → 全行が表示に戻ること

#### TC-L15-19: Activity Log — Agent/Tool カスタムドロップダウン確認

**手順**: Playwright テスト `dashboard.spec.ts` > `Activity Log Dashboard: Agent/Tool Dropdowns`

**期待結果**:
- `data-testid="agent-dropdown"` がカスタムドロップダウンとして表示されること（`rounded-md border-gray-200 shadow-sm`）
- `data-testid="tool-dropdown"` が同スタイルのカスタムドロップダウンとして表示されること
- ドロップダウンクリックで選択肢リスト（`bg-white border border-gray-200 rounded-md shadow-lg`）が開くこと
- 選択中の項目が `bg-blue-50 text-blue-700 font-medium` でハイライトされること
- ドロップダウン外クリックで選択肢リストが閉じること
- 開閉に応じてシェブロンアイコンが回転すること

#### TC-L15-20: Activity Log — High Risk Only トグル確認

**手順**: Playwright テスト `dashboard.spec.ts` > `Activity Log Dashboard: High Risk Only`

**期待結果**:
- `data-testid="high-risk-toggle"` が表示されること

#### TC-L15-21: Activity Log — Refresh ボタン動作確認

**手順**: Playwright テスト `dashboard.spec.ts` > `Activity Log Dashboard: Refresh Button`

**期待結果**:
- `data-testid="refresh-button"` が表示されること
- クリック後もページが正常に動作すること（Activity Log 見出し + snapshot-summary が表示されること）

#### TC-L15-22: Activity Log — Live Mode トグル確認

**手順**: Playwright テスト `dashboard.spec.ts` > `Activity Log Dashboard: Live Mode`

**期待結果**:
- `data-testid="live-mode-toggle"` が表示されること

#### TC-L15-23: Activity Log — テーブルソート確認

**手順**: Playwright テスト `dashboard.spec.ts` > `Activity Log Dashboard: Table Sort`

**期待結果**:
- `data-testid="sort-time"` が表示されること
- `data-testid="sort-decision"` クリックで昇順インジケータ（▲）が表示されること
- 再クリックで降順インジケータ（▼）に変わること

#### TC-L15-24: Activity Log — Export CSV 確認

**手順**: Playwright テスト `dashboard.spec.ts` > `Activity Log Dashboard: Export CSV`

**期待結果**:
- `data-testid="export-csv"` が表示されること


#### TC-L15-25: Activity Log — レイアウト視線導線確認

**手順**: Playwright テスト `dashboard.spec.ts` > `Activity Log: Section Headings`

**期待結果**:
- 「Agents」セクション見出しが Agent タイル行の上に表示されること
- 「Recent Activity」セクション見出しがテーブルの上に表示されること
- フィルタ状態テキスト（"Showing: ..."）が Recent Activity 見出しの下に表示されること
- 画面の視線導線が KPI Row → Control Bar → Agents → Recent Activity の順であること

#### TC-L15-26: Governance Insights — Heatmap 3カラム構造確認

**手順**: ブラウザで http://localhost:3000/governance を開く

**期待結果**:
- Agent Risk Heatmap が3カラム構成（Agent名 | ヒートマップグリッド | サマリー）で表示されること
- ヒートマップの横幅が他セクション（Tool-wise Risk Profile等）と揃っていること（`max-w` 制限なし、`p-6` パディング統一）
- 左カラムにAgent名と role が表示されること
- 中央カラムにヒートマップセルが固定幅グリッド（`repeat(24, CELL_SIZE)px`）で均等表示されること
- カラムラベル（-24h, -18h, -12h, -6h, Now）が均等配置され、Now が `text-blue-600 font-bold` で右端固定表示されること
- 右カラムに Total / Deny / Rate / 5m の4行サマリーが表示されること（各項目1行、ラベル muted、値 semibold、行間 gap-2）
- Banned agent の行に赤ダイヤアイコン + 「BANNED」バッジが表示されること
- 凡例に色スケール（0-10%, 10-30%, 30-50%, 50-70%, 70-100%）+ N/A + Banned（赤ダイヤアイコン）が表示されること
- 過去24時間以内にログが存在する全 agent が表示されること（表示制限なし、縦スクロール対応）
- Agent名がクリック可能で `/activity?agent={agent}` に遷移すること

#### TC-L15-27: Activity Log — フィルタチップ表示確認

**手順**: Playwright テスト `dashboard.spec.ts` > `Filter Chips`

**期待結果**:
- エージェント選択時に `data-testid="filter-chip-agent"` チップが表示されること
- チップに Agent の display_name が含まれること
- チップの × ボタンクリックでフィルタが解除されること
- Decision Filter で ALLOW/DENY 選択時に `data-testid="filter-chip-decision"` チップが表示されること
- Tool ドロップダウンでツール選択時に `data-testid="filter-chip-tool"` チップが表示されること
- フィルタ未適用時はフィルタチップバー（`data-testid="filter-chips"`）が非表示であること
- 旧「Showing: ...」テキスト行が表示されないこと

#### TC-L15-28: Activity Log — タイルとドロップダウンの同期確認

**手順**: Playwright テスト `dashboard.spec.ts` > `Tile-Dropdown Sync`

**期待結果**:
- タイルクリックでドロップダウンの値が対応するエージェントに更新されること
- ドロップダウンでエージェント選択時に対応するタイルがハイライトされること（bg-gray-50 + 左インジケーターバー + Selected バッジ）
- 「All Agents」ボタンクリックでタイル選択とドロップダウンの両方がクリアされること
- フィルタチップの Agent × ボタンクリックでタイル選択とドロップダウンの両方がクリアされること

---

### TC-L28: Activity Log — Skeleton-first レンダリング

**手順**: Playwright テスト `dashboard.spec.ts` > `Activity Log Dashboard: Snapshot Summary`

**期待結果**:
- `/activity` アクセス時、データロード前に skeleton UI（`animate-pulse bg-gray-200`）が表示されること
- KPI カード、Agent タイル、テーブル行がそれぞれ skeleton で表示されること
- データロード完了後に skeleton が実データに置き換わること

**技術詳細**:
- TanStack Query (`useActivityQuery`, `useAgentsQuery`) の `isLoading` でスケルトン表示を制御
- `SkeletonKPICards`, `SkeletonAgentTiles`, `SkeletonTableRows` コンポーネントを使用

---

### TC-L29: Activity Log — バックナビゲーションキャッシュ

**手順**:
1. http://localhost:3000/activity にアクセスし、データ表示を待つ
2. 任意のテーブル行をクリックして Detail ページに遷移
3. 「Back to Activity Log」リンクで Activity に戻る

**期待結果**:
- Activity ページがキャッシュから即座に表示されること（skeleton なし、再フェッチなし）
- `staleTime: 30s` 以内であればキャッシュデータが再利用されること

---

### TC-L30: Governance Insights — 段階読み込み

**手順**: ブラウザで http://localhost:3000/governance を開く

**期待結果**:
- ページフレーム（見出し、セクションヘッダー）が即座に表示されること
- 各セクションが独立して skeleton → 実データに遷移すること:
  - SYSTEM STATUS: `SkeletonSystemStatus` → 4 枚のステータスカード
  - OVERVIEW: `SkeletonMetricCard` × 2 → Decision Distribution + Agent-wise Deny Rate
  - GOVERNANCE INSIGHT: `SkeletonMetricCard` × 2 → Block Reason + Block Layer
  - RISK PROFILE: `SkeletonMetricCard` → Tool Risk Profile
  - BEHAVIOR: `SkeletonHeatmap` → Agent Risk Heatmap
- 全セクションが同時にブロックされないこと（最遅 API に依存しない）

---

### TC-L31: Governance Insights — キャッシュ再訪問

**手順**:
1. http://localhost:3000/governance にアクセスし、全セクション表示を待つ
2. サイドバーから Activity Log に遷移
3. サイドバーから Governance Insights に戻る

**期待結果**:
- 2回目の訪問時はキャッシュから即座に全セクションが表示されること（skeleton なし）
- `staleTime: 60s` 以内であればキャッシュデータが再利用されること

---

### TC-L32: Judgment Detail — Prefetch / Skeleton

**手順**:
1. http://localhost:3000/activity にアクセス
2. テーブル行にマウスオーバー（prefetch トリガー）
3. その行をクリックして Detail ページに遷移

**期待結果**:
- ホバー済みの行をクリック → キャッシュから即座に Detail が表示されること
- 直接 URL アクセス（未キャッシュ）→ skeleton が表示された後にデータが表示されること

**技術詳細**:
- `queryClient.prefetchQuery` でホバー時に `/judgments/{id}` を事前取得
- `useJudgmentDetail(id)` フックで `staleTime: 60s` のキャッシュ

---

### TC-L33: Activity Log — 行クリック遷移の確実化

**手順**:
1. http://localhost:3000/activity にアクセス
2. テーブル行の任意の箇所（セル間の隙間含む）をクリック

**期待結果**:
- 1回のクリックで確実に Judgment Detail ページに遷移すること
- 行のどこをクリックしても（テキスト上、セル間隙間、padding 部分）遷移すること

**技術詳細**:
- `<tbody>` に `onClick` ハンドラを設定し、`router.push()` で遷移
- 各 `<td>` 内の個別 `<Link>` は削除（`<tbody>` の onClick に統一）

---

### TC-L34: Judgment Detail — initialData による即時表示

**手順**:
1. http://localhost:3000/activity にアクセス（Activity List がキャッシュされる）
2. テーブル行をクリックして Detail ページに遷移
3. 遷移直後の表示を確認

**期待結果**:
- Activity List のキャッシュデータを `initialData` として使用し、API応答を待たず即時表示されること
- Skeleton が一瞬も表示されない（cache hit の場合）
- Context セクションに context データが表示されること（purpose, time 等）

**技術詳細**:
- `useJudgmentDetail` フックが `initialData` で activity キャッシュから該当アイテムを検索
- バックグラウンドで最新データを fetch し差し替え

---

### TC-L35: Firestore — context / policy_id / policy_tags の保存

**手順**:
1. Agent Simulator または Gov-UI から `/authorize` リクエストを送信
2. `GET /activity?limit=1` で最新イベントを取得
3. レスポンスの `context`, `policy_id`, `policy_tags` フィールドを確認

**期待結果**:
- `context` に `purpose`, `time` などのフィールドが含まれること（空 `{}` でないこと）
- `policy_id` が null でないこと（PDP が返す場合）
- `policy_tags` が空配列でないこと（PDP が返す場合）

---

## AGA 証明項目との対応

| AGA 証明項目 | テストケース | 結果 |
|-------------|-------------|------|
| Context によって Allow/Deny が変わる | TC-L02, TC-L03, TC-L10 | `business_hours` → Allow, `after_hours` → Deny（全4アクション） |
| 実行前に判断を強制 | TC-L04 | JWT なしでは実行不可 |
| 理由が説明可能 | TC-L02, TC-L03 | `reason` フィールドに説明あり |
| 二重実行防止 | TC-L05 | 同じ JWT での2回目実行は blocked |
| JWT 有効期限 | TC-L07 | 60秒後に expired |
| scope/path 整合性検証 | TC-L08 | 許可されていないパスは blocked |
| Tool 直接アクセスの保護 | TC-L09 | API キーなしでは Tool 実行不可 |
| BAN による即時無効化 | TC-L11 | BAN されたエージェントは即座に deny |
| 複数 Agent の管理 | TC-L12 | 6個のエージェントを一覧取得可能 |
| メトリクスによる可視化 | TC-L13 | 6種類のメトリクスで判断状況を可視化 |
| UI による判断状況の可視化 | TC-L15 | Activity Log / Governance Insights で判断履歴・統計・リスクを視覚的に確認可能 |
| Firestore による判定データ永続化 | TC-L16〜TC-L23 | 判定データが Firestore に保存・取得・ページング可能 |
| URL リネーム + 後方互換リダイレクト | TC-L24〜TC-L27 | 新パスで 200、旧パスで 301 リダイレクト |
