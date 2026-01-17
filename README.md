# Action-Gated Authorization (AGA) - PoC

AI Agent の Action を実行直前で必ず評価・制御する認可構造の最小PoCです。

## TL;DR
AI Agent の Action を実行直前で必ず評価・制御する
認可構造（Action-Gated Authorization）の最小PoCです。

👉 このPoCでは：
- Agentが Action を生成
- 実行前に必ず PEP で止まり
- PDP が業務文脈を評価し
- Allow / Deny と理由を返します

## Folder Structure

```
action-gated-authorization-poc/
├── service-a/      # Agent + PEP（FastAPI）
├── service-b/      # PDP（OPA）
├── service-c/      # Tool mock / sandbox
├── judgment-ui/    # Judgment UI（Next.js App Router）
│   ├── src/
│   │   ├── app/    # App Router routes
│   │   ├── components/
│   │   └── lib/
│   ├── public/
│   └── package.json
├── infra/          # Infrastructure setup
├── logs/           # Execution logs
├── demo/           # Demo scenarios and examples
├── diagrams/       # Architecture diagrams
└── docs/           # Documentation
    └── 01-plan/    # Implementation plans & guides
```

## Demo (30 seconds)
[demo.mp4]

## Background
- なぜ Agent 時代に認可が壊れるのか
- なぜ業務フローに埋め込めないのか

## Architecture
[architecture.png]

## How it works
1. Agent generates Action
2. Action goes through PEP
3. PDP evaluates context
4. Decision & reason are logged

## Local Development

### Judgment UI (Next.js)

```bash
cd judgment-ui

# 初回のみ: Next.js プロジェクトを初期化
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# 環境変数を設定
cp .env.local.example .env.local

# 開発サーバー起動
npm run dev
```

- http://localhost:3000 でアクセス
- 詳細は `docs/01-plan/03-nextjs-catchup-guide.md` を参照

### uvicorn を使う場合 (service-a)

```bash
cd service-a

# venv作成・有効化
python3 -m venv .venv
source .venv/bin/activate

# 依存関係インストール
pip install -r requirements.txt

# 起動
uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

サーバーが起動したら、別ターミナルで動作確認:

```bash
# Allow パターン
curl -X POST http://localhost:8080/v1/actions/get_resident_info \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "purpose": "inquiry",
      "time": "business_hours",
      "data_sensitivity": "required"
    }
  }'

# Deny パターン
curl -X POST http://localhost:8080/v1/actions/get_resident_info \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "purpose": "marketing",
      "time": "business_hours",
      "data_sensitivity": "required"
    }
  }'
```

### Docker を使う場合 (OPA/PDP)

```bash
# ビルド
docker build -t aga-pdp:local .

# 実行
docker run --rm -p 8181:8181 --name aga-pdp aga-pdp:local
```

## Deploy to Cloud Run

各サービスをCloud Runにデプロイするには、サービスのディレクトリに移動して以下のコマンドを実行します。

```bash
# 1. service-b (OPA/PDP) を先にデプロイ
cd service-b
gcloud run deploy service-b \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 5 \
  --port 8080

# 2. service-a をデプロイ（PDP_URL に service-b のURLを設定）
cd service-a
gcloud run deploy service-a \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 5 \
  --set-env-vars PDP_URL=https://service-b-XXXXXX.asia-northeast1.run.app
```

> **Note**: `PDP_URL` にはベースURLのみを指定。パス (`/v1/data/authorization/decision`) はコード側で付与されます。

**オプション説明：**
- `--source .` : 現在のディレクトリからビルド
- `--allow-unauthenticated` : 認証なしでアクセス可能（PoC用）
- `--region asia-northeast1` : 東京リージョン
- `--min-instances 0` : 最小インスタンス数（コスト最適化）
- `--max-instances 5` : 最大インスタンス数
- `--port 8080` : OPAがリッスンするポート
- `--set-env-vars` : 環境変数を設定

## 動作確認

### service-b (OPA/PDP) のテスト

```bash
# Allow ケース: inquiry + business_hours + data_sensitivity=required
curl -s -X POST "https://service-b-374053446416.asia-northeast1.run.app/v1/data/authorization/decision" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "action": "get_resident_info",
      "context": {
        "purpose": "inquiry",
        "time": "business_hours",
        "data_sensitivity": "required"
      }
    }
  }' | jq
# => {"result":{"allow":true,"reason":"Allowed: inquiry during business hours"}}

# Deny ケース: purpose が inquiry 以外
curl -s -X POST "https://service-b-374053446416.asia-northeast1.run.app/v1/data/authorization/decision" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "action": "get_resident_info",
      "context": {
        "purpose": "marketing",
        "time": "business_hours",
        "data_sensitivity": "required"
      }
    }
  }' | jq
# => {"result":{"allow":false,"reason":"Denied: purpose must be 'inquiry'"}}

# Deny ケース: 業務時間外
curl -s -X POST "https://service-b-374053446416.asia-northeast1.run.app/v1/data/authorization/decision" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "action": "get_resident_info",
      "context": {
        "purpose": "inquiry",
        "time": "after_hours",
        "data_sensitivity": "required"
      }
    }
  }' | jq
# => {"result":{"allow":false,"reason":"Denied: access allowed only during business hours"}}
```

### service-a のテスト

```bash
# Allow ケース
curl -s -X POST "https://service-a-374053446416.asia-northeast1.run.app/v1/actions/get_resident_info" \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "purpose": "inquiry",
      "time": "business_hours",
      "data_sensitivity": "required"
    }
  }' | jq
# => {"request_id":"...","action":"get_resident_info","allowed":true,"reason":"Allowed: inquiry during business hours","data":{...}}

# Deny ケース
curl -s -X POST "https://service-a-374053446416.asia-northeast1.run.app/v1/actions/get_resident_info" \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "purpose": "marketing",
      "time": "business_hours",
      "data_sensitivity": "required"
    }
  }' | jq
# => {"detail":{"request_id":"...","action":"get_resident_info","allowed":false,"reason":"Denied: purpose must be 'inquiry'"}}
```

## Policy Example
```yaml
- if: time == "night" and action.contains_pii
  deny: true
```

## Claude Code Tips

### セッション管理

```bash
# 直前のセッションを続ける（最も最近のセッションを自動選択）
claude --continue

# 過去のセッションを選んで再開（対話的に選択）
claude --resume
```

- `--continue`: 直前の会話をそのまま続行。作業を中断して再開したいときに便利
- `--resume`: 過去のセッション一覧から選んで再開。複数のプロジェクトを行き来するときに便利

### セッション中のコマンド

```
/stats
```

現在のセッションの統計情報を表示:
- トークン使用量（入力/出力）
- コスト概算
- セッション時間
