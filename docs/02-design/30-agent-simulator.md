# Agent Simulator 設計書

Agent Simulator は、6種類の AI Agent をシミュレーションし、service-a の `/authorize` API に認可リクエストを送信することで、Judgment Dashboard にリアルなデータを供給するサービスです。

## 1. サービス概要

- **言語 / フレームワーク**: Python + FastAPI（service-a と同じ構成）
- **構成**: 単一ファイル `main.py`
- **Cloud Run URL**: `https://agent-simulator.action-gated.tech`
- **環境変数**: `SERVICE_A_BASE_URL`（デフォルト: `http://localhost:8080`、本番: `https://service-a.action-gated.tech`）

## 2. Agent プロファイル定義

6体の Agent を以下の構造で定義する。各 Agent は `actions` 配列を持ち、`weight` に基づいて確率的に Action + Context を選択する。

```python
AGENT_PROFILES = {
    "cs-frontdesk": {
        "agent_id": "cs-frontdesk",
        "agent_role": "cs-frontdesk",
        "display_name": "窓口対応エージェント",
        "actions": [
            {"action": "get_resident_info", "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}, "weight": 80},
            {"action": "get_resident_info", "context": {"purpose": "inquiry", "time": "after_hours", "data_sensitivity": "required"}, "weight": 10},
            {"action": "read_resident_record", "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}, "weight": 10},
        ]
    },
    "cs-night": {
        "agent_id": "cs-night",
        "agent_role": "cs-night",
        "display_name": "夜間対応エージェント",
        "actions": [
            {"action": "get_resident_info", "context": {"purpose": "inquiry", "time": "after_hours", "data_sensitivity": "required"}, "weight": 70},
            {"action": "get_resident_info", "context": {"purpose": "emergency", "time": "after_hours", "data_sensitivity": "required"}, "weight": 30},
        ]
    },
    "benefit-admin": {
        "agent_id": "benefit-admin",
        "agent_role": "benefit-admin",
        "display_name": "給付管理エージェント",
        "actions": [
            {"action": "update_benefit_status", "context": {"purpose": "approval", "time": "business_hours", "data_sensitivity": "required"}, "weight": 60},
            {"action": "read_resident_record", "context": {"purpose": "audit", "time": "business_hours", "data_sensitivity": "required"}, "weight": 30},
            {"action": "update_benefit_status", "context": {"purpose": "approval", "time": "after_hours", "data_sensitivity": "required"}, "weight": 10},
        ]
    },
    "benefit-assistant": {
        "agent_id": "benefit-assistant",
        "agent_role": "benefit-assistant",
        "display_name": "給付窓口エージェント",
        "actions": [
            {"action": "update_benefit_status", "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}, "weight": 70},
            {"action": "get_resident_info", "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}, "weight": 30},
        ]
    },
    "audit-bot": {
        "agent_id": "audit-bot",
        "agent_role": "audit-bot",
        "display_name": "監査エージェント",
        "actions": [
            {"action": "read_resident_record", "context": {"purpose": "audit", "time": "business_hours", "data_sensitivity": "required"}, "weight": 60},
            {"action": "read_resident_record", "context": {"purpose": "audit", "time": "after_hours", "data_sensitivity": "required"}, "weight": 30},
            {"action": "get_resident_info", "context": {"purpose": "audit", "time": "business_hours", "data_sensitivity": "required"}, "weight": 10},
        ]
    },
    "notify-agent": {
        "agent_id": "notify-agent",
        "agent_role": "notify-agent",
        "display_name": "通知エージェント",
        "actions": [
            {"action": "send_official_notice", "context": {"purpose": "notification", "time": "business_hours", "data_sensitivity": "optional"}, "weight": 70},
            {"action": "send_official_notice", "context": {"purpose": "notification", "time": "after_hours", "data_sensitivity": "optional"}, "weight": 20},
            {"action": "send_official_notice", "context": {"purpose": "emergency", "time": "after_hours", "data_sensitivity": "required"}, "weight": 10},
        ]
    },
}
```

### プロファイル設計の意図

| agent_id | 期待 Deny 率 | 設計意図 |
|---|---|---|
| `cs-frontdesk` | ~10% | 正規の窓口業務。ほぼ ALLOW だが、稀に after_hours で DENY |
| `cs-night` | ~80% | 夜間シフト。同じ操作でも時間帯により DENY が多発 |
| `benefit-admin` | ~15% | 権限あり。営業時間内はほぼ ALLOW、after_hours のみ DENY |
| `benefit-assistant` | ~90% | 権限なし。update_benefit_status が purpose 不一致で DENY |
| `audit-bot` | ~30% | 監査目的は ALLOW だが、after_hours や目的不一致で DENY |
| `notify-agent` | ~20% | 通知は ALLOW だが、after_hours で DENY。emergency は例外 ALLOW |

## 3. API エンドポイント

### GET /health

ヘルスチェック用。Cloud Run のスタートアッププローブに使用。

**応答**:

```json
{"status": "ok"}
```

### POST /trigger

シミュレーションのトリガー。Cloud Scheduler が毎60秒で呼び出す。

**リクエストボディ**: なし（空 or 任意）

**応答**:

```json
{
  "triggered_agents": ["cs-frontdesk", "audit-bot"],
  "results": [
    {
      "agent_id": "cs-frontdesk",
      "action": "get_resident_info",
      "decision": "ALLOW",
      "reason": "Allowed: inquiry during business hours"
    },
    {
      "agent_id": "audit-bot",
      "action": "read_resident_record",
      "decision": "DENY",
      "reason": "Denied: audit access not permitted after hours"
    }
  ],
  "timestamp": "2026-02-10T10:30:00Z"
}
```

**エラー時**: service-a が不達でも常に **200** を返す（Cloud Scheduler がリトライしないようにするため）。

### GET /status

最後のトリガー情報を返す。デバッグ・監視用。

**応答**:

```json
{
  "last_trigger": "2026-02-10T10:30:00Z",
  "total_triggers": 42,
  "total_requests": 87
}
```

## 4. トリガーロジック

`POST /trigger` の処理フロー:

```
1. Agent を 1-3 体ランダムに選択
   - count = random.randint(1, 3)
   - selected = random.sample(list(AGENT_PROFILES.values()), count)

2. 各 Agent について:
   a. actions 配列から weight に基づいて 1 つ選択
      - random.choices(agent["actions"], weights=[a["weight"] for a in agent["actions"]])[0]
   b. service-a の /authorize に POST リクエスト送信:
      {
        "agent_id": agent["agent_id"],
        "agent_role": agent["agent_role"],
        "action": selected_action["action"],
        "context": selected_action["context"]
      }
   c. レスポンスの decision / reason を記録
   d. 構造化ログを stdout に出力

3. 結果を集約してレスポンスを返す（常に 200）
```

### service-a 呼び出し

```python
import httpx

async def call_authorize(agent_profile: dict, action_entry: dict) -> dict:
    url = f"{SERVICE_A_BASE_URL}/authorize"
    payload = {
        "agent_id": agent_profile["agent_id"],
        "agent_role": agent_profile["agent_role"],
        "action": action_entry["action"],
        "context": action_entry["context"],
    }
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.post(url, json=payload)
        return resp.json()
```

## 5. ファイル構成

```
agent-simulator/
├── main.py                # FastAPI アプリケーション + Agent プロファイル + トリガーロジック
├── requirements.txt       # fastapi, uvicorn, httpx
├── Dockerfile             # python:3.12-slim、service-a と同じパターン
└── docker-entrypoint.sh   # コンテナ起動スクリプト
```

## 6. 構造化ログ

全てのログは JSON 形式で stdout に出力する（Cloud Logging との統合のため）。

### リクエスト単位ログ（各 /authorize 呼び出しごと）

```json
{"phase": "TRIGGER", "agent_id": "cs-frontdesk", "action": "get_resident_info", "result_decision": "ALLOW", "result_reason": "Allowed: inquiry during business hours", "latency_ms": 45.2}
```

### エラーログ

```json
{"phase": "TRIGGER_ERROR", "agent_id": "cs-frontdesk", "action": "get_resident_info", "error": "Connection refused", "latency_ms": 5000.0}
```

## 7. エラーハンドリング

| 状況 | 対応 |
|---|---|
| service-a が応答しない | エラーログを出力し、該当 Agent の結果を `error` として記録。他の Agent の処理は継続。**POST /trigger は 200 を返す** |
| service-a が 4xx を返す | レスポンスをそのままログに記録 |
| service-a が 5xx を返す | エラーログを出力。リトライはしない |
| Agent 選択で例外 | 500 Internal Server Error を返す（通常発生しない） |

- **リトライなし**: Simulator はベストエフォートでデータを生成する。欠損は許容する
- **部分成功**: 3 体中 1 体が失敗しても、残り 2 体の結果は正常に返す
- **タイムアウト**: 各 `/authorize` 呼び出しは **5秒** でタイムアウト
- **常に 200**: Cloud Scheduler がリトライしないよう、`/trigger` は常に 200 を返す

## 8. 環境変数

| 変数名 | デフォルト値 | 用途 |
|---|---|---|
| `SERVICE_A_BASE_URL` | `http://localhost:8080` | service-a の接続先 URL |
| `PORT` | `8080` | FastAPI のリッスンポート |

| 環境 | `SERVICE_A_BASE_URL` の値 |
|---|---|
| ローカル開発 | `http://localhost:8080`（docker-compose 内: `http://service-a:8080`） |
| GCP 本番 | `https://service-a.action-gated.tech` |

## 9. Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["./docker-entrypoint.sh"]
```

### docker-entrypoint.sh

```bash
#!/bin/bash
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8080}"
```

### requirements.txt

```
fastapi==0.115.0
uvicorn==0.30.0
httpx==0.27.0
```

## 10. デプロイコマンド

```bash
# ビルド & デプロイ
gcloud run deploy agent-simulator \
  --source=agent-simulator/ \
  --region=asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars="SERVICE_A_BASE_URL=https://service-a.action-gated.tech" \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=1

# Cloud Scheduler 設定
gcloud scheduler jobs create http agent-simulator-trigger \
  --location=asia-northeast1 \
  --schedule="* * * * *" \
  --uri="https://agent-simulator.action-gated.tech/trigger" \
  --http-method=POST \
  --attempt-deadline=30s
```

### deploy.sh への統合

既存の `scripts/deploy.sh` に `agent-simulator` ケースを追加する。

```bash
agent-simulator)
  gcloud run deploy agent-simulator \
    --source=agent-simulator/ \
    --region=asia-northeast1 \
    --allow-unauthenticated \
    --set-env-vars="SERVICE_A_BASE_URL=https://service-a.action-gated.tech" \
    --memory=256Mi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=1
  ;;
```

## 11. service-a 側の変更要件

Agent Simulator の導入に伴い、service-a に以下の変更が必要。

### action → tool / action マッピングの拡張

```python
ACTION_MAP = {
    "get_resident_info":    {"tool": "resident", "action": "read"},
    "read_resident_record": {"tool": "resident", "action": "read_full"},
    "update_benefit_status": {"tool": "benefit", "action": "update"},
    "send_official_notice":  {"tool": "notify",  "action": "send"},
}
```

### Agent 登録の拡張

```python
agents = {
    "assistant": { ... },      # 既存
    "admin": { ... },          # 既存
    "cs-frontdesk": {
        "id": "cs-frontdesk",
        "name": "cs-frontdesk",
        "display_name": "窓口対応エージェント",
        "role": "Frontdesk",
        "status": "active",
        "last_seen": None,
        "banned_reason": None,
        "banned_at": None,
    },
    "cs-night": {
        "id": "cs-night",
        "name": "cs-night",
        "display_name": "夜間対応エージェント",
        "role": "Frontdesk",
        "status": "active",
        "last_seen": None,
        "banned_reason": None,
        "banned_at": None,
    },
    "benefit-admin": {
        "id": "benefit-admin",
        "name": "benefit-admin",
        "display_name": "給付管理エージェント",
        "role": "Backoffice",
        "status": "active",
        "last_seen": None,
        "banned_reason": None,
        "banned_at": None,
    },
    "benefit-assistant": {
        "id": "benefit-assistant",
        "name": "benefit-assistant",
        "display_name": "給付窓口エージェント",
        "role": "Frontdesk",
        "status": "active",
        "last_seen": None,
        "banned_reason": None,
        "banned_at": None,
    },
    "audit-bot": {
        "id": "audit-bot",
        "name": "audit-bot",
        "display_name": "監査エージェント",
        "role": "Auditor",
        "status": "active",
        "last_seen": None,
        "banned_reason": None,
        "banned_at": None,
    },
    "notify-agent": {
        "id": "notify-agent",
        "name": "notify-agent",
        "display_name": "通知エージェント",
        "role": "Notifier",
        "status": "active",
        "last_seen": None,
        "banned_reason": None,
        "banned_at": None,
    },
}
```

### OPA ポリシーの拡張

新規 3 アクション（`read_resident_record`, `update_benefit_status`, `send_official_notice`）に対応する Rego ルールが必要。詳細は別途 OPA ポリシー設計で定義する。
