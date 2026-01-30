# Tool 実行基盤の拡張 — API キー管理 + /execute リクエスト拡張

## 概要

本計画では、Tool 実行基盤に対して以下の 2 つの拡張を行う。

### Part A: API キー管理
service-c (Tool Executor) に API キー検証を追加し、AI Agent が API キーを知らなくてもツールを実行できる構造を実現する。Envoy Gateway がリクエスト転送時に API キーヘッダを注入する。

### Part B: /execute エンドポイント拡張
`/execute` エンドポイントで Tool API リクエスト情報（method, path, body）を受け取る方式に変更し、Agent が具体的なパラメータを渡せるようにする。

---

## アーキテクチャ

```
Agent → service-a (/authorize) → JWT取得
Agent → Envoy Gateway (/tool/*) + JWT
         ↓ Envoy が X-Tool-Api-Key ヘッダを注入
       service-c → API キー検証 → 実行
```

- Agent は API キーを一切知らない
- Envoy が `/tool/*` ルートへの転送時にヘッダを自動付与
- service-c は `X-Tool-Api-Key` ヘッダを検証

---

## 防御レイヤー構成

| レイヤー | 場所 | 検証内容 |
|---------|------|----------|
| L1 | service-a `/execute` | JWT 署名・有効期限・JTI |
| L2 | Envoy Gateway | JWT 署名・有効期限・RBAC (scope) |
| **L3 (新規)** | **service-c** | **API キー検証** |

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|----------|
| `service-c/main.py` | API キー検証ミドルウェア追加 |
| `envoy-gateway/envoy.yaml.template` | `/tool/*` ルートに `request_headers_to_add` 追加 |
| `envoy-gateway/envoy-local.yaml` | 同上（envsubst パターンに変更） |
| `envoy-gateway/Dockerfile.local` | envsubst でテンプレート展開する起動方式に変更 |
| `docker-compose.yml` | envoy-gateway と service-c に `TOOL_API_KEY` 環境変数追加 |

---

## 実装詳細

### 1. service-c/main.py — API キー検証

**目的**

service-c へのリクエストが正規の経路（Envoy Gateway 経由）からのみ来ることを検証する。

**タスク**

- [ ] API キー検証ミドルウェアを追加
- [ ] `/health` エンドポイントはスキップ（ヘルスチェック用）
- [ ] 環境変数 `TOOL_API_KEY` 未設定時は検証スキップ（開発用）

**実装例**

```python
import os
from fastapi import Request, HTTPException

TOOL_API_KEY = os.getenv("TOOL_API_KEY", "")

@app.middleware("http")
async def verify_api_key(request: Request, call_next):
    if request.url.path == "/health":
        return await call_next(request)
    if not TOOL_API_KEY:
        return await call_next(request)  # キー未設定時はスキップ（開発用）
    api_key = request.headers.get("X-Tool-Api-Key", "")
    if api_key != TOOL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return await call_next(request)
```

---

### 2. envoy.yaml.template — ヘッダ注入

**目的**

Envoy Gateway が Tool 宛のリクエスト転送時に API キーヘッダを自動付与する。

**タスク**

- [ ] 各 `/tool/*` ルートに `request_headers_to_add` を追加
- [ ] `OVERWRITE_IF_EXISTS_OR_ADD` で Agent からの偽装を防止

**実装例**

```yaml
- match:
    prefix: "/tool/resident-info"
  route:
    cluster: service_c
    prefix_rewrite: "/resident-info"
    host_rewrite_literal: ${SERVICE_C_HOST}
  request_headers_to_add:
    - header:
        key: "X-Tool-Api-Key"
        value: "${TOOL_API_KEY}"
      append_action: OVERWRITE_IF_EXISTS_OR_ADD
```

同様に `/tool/execute` と `/tool` ルートにも追加。

---

### 3. envoy-local.yaml — envsubst テンプレート化

**目的**

ローカル環境でも環境変数から API キーを注入できるようにテンプレート化する。

**タスク**

- [ ] ハードコード値を `${TOOL_API_KEY}` 変数に変更
- [ ] 各 `/tool/*` ルートに `request_headers_to_add` を追加

**実装例**

```yaml
- match:
    prefix: "/tool/resident-info"
  route:
    cluster: service_c
    prefix_rewrite: "/resident-info"
  request_headers_to_add:
    - header:
        key: "X-Tool-Api-Key"
        value: "${TOOL_API_KEY}"
      append_action: OVERWRITE_IF_EXISTS_OR_ADD
```

---

### 4. Dockerfile.local — envsubst 起動

**目的**

コンテナ起動時に envsubst で環境変数を展開する。

**タスク**

- [ ] envsubst でテンプレートを展開する起動方式に変更

**実装例**

```dockerfile
FROM envoyproxy/envoy:v1.28-latest
COPY envoy-local.yaml /etc/envoy/envoy.yaml.template
EXPOSE 8080
CMD ["/bin/sh", "-c", "envsubst < /etc/envoy/envoy.yaml.template > /etc/envoy/envoy.yaml && envoy -c /etc/envoy/envoy.yaml --log-level info"]
```

---

### 5. docker-compose.yml

**目的**

envoy-gateway と service-c に同一の `TOOL_API_KEY` を設定する。

**タスク**

- [ ] envoy-gateway に `TOOL_API_KEY` 環境変数追加
- [ ] service-c に `TOOL_API_KEY` 環境変数追加

**実装例**

```yaml
envoy-gateway:
  environment:
    - TOOL_API_KEY=${TOOL_API_KEY:-local-dev-api-key-12345}

service-c:
  environment:
    - TOOL_API_KEY=${TOOL_API_KEY:-local-dev-api-key-12345}
```

---

### 6. GCP — Secret Manager

**目的**

本番環境では Secret Manager から API キーを取得する。

**タスク**

- [ ] シークレット `tool-api-key` を作成
- [ ] Cloud Run デプロイ時に `--set-secrets` で注入

**実装例**

```bash
# シークレット作成
echo -n "$(openssl rand -hex 32)" | \
  gcloud secrets create tool-api-key --data-file=-

# Cloud Run デプロイ時に注入
gcloud run deploy service-c \
  --set-secrets=TOOL_API_KEY=tool-api-key:latest

gcloud run deploy envoy-gateway \
  --set-secrets=TOOL_API_KEY=tool-api-key:latest
```

---

## 検証方法

### 1. service-c に直接アクセス（APIキーなし → 401）

```bash
# ローカル起動
./scripts/deploy.sh local

# APIキーなしでアクセス → 401
curl -s -w "\nHTTP: %{http_code}\n" \
  -X POST http://localhost:8082/execute \
  -H "Content-Type: application/json" \
  -d '{"request_id":"test","action":"get_resident_info","context":{}}'
```

**期待結果**: HTTP 401

---

### 2. Envoy Gateway 経由（JWT + APIキー自動注入 → 200）

```bash
# JWT取得
RESPONSE=$(curl -s -X POST "http://localhost:8080/authorize" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"test","action":"get_resident_info","context":{"purpose":"inquiry","time":"business_hours","data_sensitivity":"required"}}')
HANDLE=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['execution_handle'])")

# Envoy Gateway 経由でアクセス → 200
curl -s -w "\nHTTP: %{http_code}\n" \
  -X POST http://localhost:10000/tool/execute \
  -H "Authorization: Bearer $HANDLE" \
  -H "Content-Type: application/json" \
  -d '{"request_id":"test","action":"get_resident_info","context":{}}'
```

**期待結果**: HTTP 200

---

## Part A 完成条件（Definition of Done）

- [ ] service-c へのリクエストは `X-Tool-Api-Key` ヘッダ必須（`/health` 除く）
- [ ] Envoy Gateway が `/tool/*` ルートで API キーを自動注入
- [ ] Agent は API キーを知らなくてもツールを実行できる
- [ ] ローカル環境と GCP 環境の両方で動作確認済み

---

# Part B: /execute エンドポイント拡張

## 現状の課題

現在の `/execute` 実装（service-a/main.py）では：

1. JWT の `scope` からアクション名を取得
2. `dummy_context` をハードコードで生成
3. Tool API へのリクエストペイロードは Judgment 側で固定的に生成

**問題点：** Agent は Tool に渡すパラメータ（例: `resident_id: "R-0001"`）を指定できない

---

## 拡張後の `/execute` リクエスト形式

```json
{
  "request_id": "uuid-...",
  "execution_handle": "<signed-jwt>",
  "tool_request": {
    "method": "POST",
    "path": "/resident-info",
    "body": {
      "resident_id": "R-0001"
    }
  }
}
```

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `request_id` | ○ | リクエスト追跡用 ID |
| `execution_handle` | ○ | 認可チケット (JWT) |
| `tool_request` | ○ | Tool API リクエスト情報 |
| `tool_request.method` | △ | HTTP メソッド（デフォルト: POST） |
| `tool_request.path` | ○ | Tool API パス（例: `/resident-info`） |
| `tool_request.body` | △ | リクエストボディ |

---

## セキュリティ考慮

### 1. scope による path 制限

JWT の `scope` クレームと `tool_request.path` の整合性を検証する。

```python
SCOPE_TO_PATHS = {
    "execute:get_resident_info": ["/resident-info"],
}

def validate_path_for_scope(scope: str, path: str) -> bool:
    allowed_paths = SCOPE_TO_PATHS.get(scope, [])
    return any(path.startswith(p) for p in allowed_paths)
```

**Agent が許可されていないパスを指定した場合は 403 Forbidden**

---

## 変更ファイル一覧（Part B）

| ファイル | 変更内容 |
|---------|----------|
| `docs/02-design/03-interface-spec.yaml` | `ExecuteRequest` スキーマに `tool_request` 追加 |
| `service-a/main.py` | `/execute` で `tool_request` を受け取り、検証・転送 |

---

## 実装詳細

### 7. service-a/main.py — /execute 拡張

**目的**

Agent から Tool API リクエスト情報を受け取り、scope との整合性を検証してから転送する。

**タスク**

- [ ] `ToolRequest` モデル追加（method, path, body）
- [ ] `ExecuteRequest` に `tool_request` フィールド追加
- [ ] `SCOPE_TO_PATHS` マッピング定義
- [ ] パス検証ロジック実装
- [ ] `call_tool_via_envoy` の引数変更

**実装例**

```python
class ToolRequest(BaseModel):
    method: str = "POST"
    path: str
    body: dict = Field(default_factory=dict)

class ExecuteRequest(BaseModel):
    request_id: str
    execution_handle: str
    tool_request: ToolRequest

SCOPE_TO_PATHS = {
    "execute:get_resident_info": ["/resident-info"],
}

def validate_path_for_scope(scope: str, path: str) -> bool:
    allowed_paths = SCOPE_TO_PATHS.get(scope, [])
    if not allowed_paths:
        return False
    return any(path.startswith(p) for p in allowed_paths)
```

---

### 8. docs/02-design/03-interface-spec.yaml — スキーマ更新

**目的**

OpenAPI 仕様に `tool_request` フィールドを追加。

**タスク**

- [ ] `ToolRequest` スキーマ定義
- [ ] `ExecuteRequest` に `tool_request` 追加

---

## 検証方法（Part B）

### 1. tool_request による実行

```bash
# JWT取得
RESPONSE=$(curl -s -X POST "http://localhost:8080/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent-001",
    "action": "get_resident_info",
    "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}
  }')
HANDLE=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['execution_handle'])")

# /execute で tool_request を送信
curl -s -X POST "http://localhost:8080/execute" \
  -H "Content-Type: application/json" \
  -d "{
    \"request_id\": \"test-001\",
    \"execution_handle\": \"$HANDLE\",
    \"tool_request\": {
      \"method\": \"POST\",
      \"path\": \"/resident-info\",
      \"body\": {\"resident_id\": \"R-0001\"}
    }
  }"
```

**期待結果**: status: success

### 2. 不正パス検証

```bash
# 許可されていないパスを指定
curl -s -X POST "http://localhost:8080/execute" \
  -H "Content-Type: application/json" \
  -d "{
    \"request_id\": \"test-002\",
    \"execution_handle\": \"$HANDLE\",
    \"tool_request\": {\"path\": \"/admin/delete-all\"}
  }"
```

**期待結果**: status: blocked, reason: "path not allowed for scope"

---

## Part B 完成条件（Definition of Done）

- [ ] `ExecuteRequest` に `tool_request` フィールドを追加
- [ ] JWT の `scope` と `tool_request.path` の整合性検証
- [ ] 不正なパス指定時に 403 を返す
- [ ] `call_tool_via_envoy` が `tool_request` を使用して Tool を呼び出す
- [ ] curl による動作確認（正常系・異常系）
