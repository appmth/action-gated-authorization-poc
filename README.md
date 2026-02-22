# Action-Gated Authorization (AGA) - PoC

AI Agent の Action を**実行直前**で必ず評価・制御する認可構造（Action-Gated Authorization）の PoC です。

## このPoCで証明すること

1. **Action は同じでも Context によって Allow / Deny が変わる**
2. **PEP は必ず「実行前」に判断を強制する**
3. **判断理由（reason）は必ず人間に説明可能な形で残る**

## アーキテクチャ

```
Agent / Gov-UI
    │
    ▼
┌──────────────────────────────┐
│  service-a (Judgment / PEP)  │  ← /authorize → /execute の2段階
│  - 実行前に必ず PDP に問い合わせ │
│  - Deny なら実行させない        │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  service-b (PDP / OPA)       │  ← Rego ポリシーで判断
│  - Allow / Deny + reason 返却 │
│  - Context (purpose × time)  │
└──────────────────────────────┘
           │
           ▼ (Allow 時のみ)
┌──────────────────────────────┐
│  service-c (Tool API)        │  ← 住民情報 Mock
└──────────────────────────────┘
```

### 主要コンポーネント

| コンポーネント | 役割 | 技術 |
|---|---|---|
| service-a | Judgment Service (PEP) - 認可判定 + 実行制御 | Python / FastAPI |
| service-b | PDP - ポリシー判定エンジン | OPA (Rego) |
| service-c | Tool API - Mock 業務サービス | Python / FastAPI |
| envoy-gateway | JWT 検証 + Proxy | Envoy |
| agent-simulator | AI Agent トラフィック生成（6エージェント） | Python / FastAPI |
| judgment-ui | 認可判断の監査ダッシュボード | Next.js |
| gov-ui | デモ用行政 UI | Next.js |

## ディレクトリ構造

```
action-gated-authorization-poc/
├── service-a/            # Judgment Service (PEP: /authorize, /execute)
├── service-b/            # PDP: OPA (Policy Decision Point)
├── service-c/            # Tool API (Mock: /resident-info)
├── envoy-gateway/        # Envoy Gateway (JWT Auth & Proxy)
├── agent-simulator/      # AI Agent Traffic Generator
├── judgment-ui/          # 監査ダッシュボード (Next.js)
│   └── tests/            # Playwright E2E テスト
├── gov-ui/               # デモ用行政 UI (Next.js)
├── demo/                 # デモ動画・ナレーション・スライド素材
│   ├── ai-naration/      # 生成音声 (mp3)
│   ├── movie/            # 録画素材 (mkv) ※ .gitignore
│   ├── mock/             # デモ用 Mock HTML
│   └── statistic/        # スライド素材・仕様
├── scripts/              # デプロイ・デモ用スクリプト
├── docs/
│   ├── 01-plan/          # 計画・検討資料
│   ├── 02-design/        # 設計ドキュメント
│   └── 03-test/          # テスト仕様書
├── infra/                # インフラ設定 (予約)
├── docker-compose.yml    # ローカル全サービス起動
└── .claude/              # Claude Code 設定・コマンド
```

## 設計ドキュメント

- [全体設計 (Architecture)](docs/02-design/05-architecture-diagram.md)
- [シーケンス図](docs/02-design/04-sequence-diagram.md)
- [API 仕様 (OpenAPI)](docs/02-design/03-interface-spec.yaml)
- [環境変数管理](docs/02-design/01-environment-management.md)
- [構造的強制力の詳細](docs/02-design/02-structural-enforcement.md)
- [Service-A Judgment 設計](docs/02-design/10-service-a-judgment.md)
- [Judgment UI 設計](docs/02-design/20-judgment-ui.md)
- [Gov-UI 設計](docs/02-design/21-gov-ui.md)
- [Agent Simulator 設計](docs/02-design/30-agent-simulator.md)
- [ローカル開発環境](docs/02-design/06-local-development.md)

## ローカル開発環境の起動

### 前提

- Docker がインストールされていること
- Judgment UI / Gov UI の開発には Node.js (v20+) が必要

### Docker Compose での起動（推奨）

```bash
# 全サービスの起動（ビルド含む）
./scripts/deploy.sh local

# サービスの停止
./scripts/deploy.sh local down
```

起動後のアクセス先:

| サービス | URL |
|---|---|
| Judgment (service-a) | http://localhost:8080 |
| OPA (service-b) | http://localhost:8181 |
| Tool (service-c) | http://localhost:8082 |
| Envoy Gateway | http://localhost:10000 |
| Agent Simulator | http://localhost:8090 |
| Firestore Emulator | http://localhost:8086 |
| Judgment UI | http://localhost:3000 (`cd judgment-ui && npm run dev`) |
| Gov UI | http://localhost:3001 (`cd gov-ui && npm run dev`) |

> **Note**: Firestore Emulator は docker-compose に含まれているため、別途起動の必要はありません。

## 動作確認（API テスト）

### 1. 認可判定要求（Phase 1）

```bash
curl -sX POST http://localhost:8080/authorize \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent-001",
    "action": "get_resident_info",
    "context": {
      "purpose": "inquiry",
      "time": "business_hours",
      "data_sensitivity": "high"
    }
  }' | jq
```

レスポンスの `execution_handle`（JWT）を取得します。

### 2. 実行要求（Phase 2）

```bash
curl -sX POST http://localhost:8080/execute \
  -H "Content-Type: application/json" \
  -d '{
    "execution_handle": "YOUR_JWT_HERE",
    "parameters": {}
  }' | jq
```

## デプロイ（Google Cloud）

```bash
# 特定のサービスをデプロイ
./scripts/deploy.sh prod service-a
./scripts/deploy.sh prod judgment-ui
./scripts/deploy.sh prod gov-ui

# 全バックエンドサービスを一括デプロイ
./scripts/deploy.sh prod all
```

> **Note**: デプロイ前に `.env.prod` の内容が正しいことを確認してください。
> UI（judgment-ui / gov-ui）は `all` に含まれません。個別にデプロイしてください。
