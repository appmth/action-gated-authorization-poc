# Action-Gated Authorization (AGA) - PoC

AI Agent の Action を実行直前で必ず評価・制御する認可構造（Action-Gated Authorization）の最小 PoC です。

## 概要

この PoC では、AI Agent の行動を「アプリケーションの if 文」ではなく、「インフラ層（Envoy）での検証」と「中央集権的な認可サービス（Judgment）」によって構造的に制御します。

### 特徴
- **2段認可**: Phase 1 (認可判定) と Phase 2 (実行要求) の分離。
- **構造的強制力**: Envoy Gateway による JWT 検証と RBAC (scope 判定) の強制。
- **完全性担保**: コンテキストのハッシュ化（ctx_hash）と多重実行防止（jti/Firestore）。
- **Build Once, Run Anywhere**: 環境変数管理の一本化。

## 設計ドキュメント

詳細な設計については、以下のドキュメントを参照してください。
- **[全体設計 (Architecture)](docs/02-design/05-architecture-diagram.md)**
- **[インフラ・ネットワーク (DNS)](docs/02-design/06-infrastructure-network.md)**
- **[シーケンス (Sequence Diagram)](docs/02-design/04-sequence-diagram.md)**
- **[API 仕様 (OpenAPI)](docs/02-design/03-interface-spec.yaml)**
- **[環境変数管理](docs/02-design/01-environment-management.md)**
- **[構造的強制力の詳細](docs/02-design/02-structural-enforcement.md)**

## ディレクトリ構造

```
action-gated-authorization-poc/
├── envoy-gateway/  # Envoy Gateway (JWT Auth & RBAC)
├── service-a/      # Judgment Service (PEP: /authorize, /execute)
├── service-b/      # PDP: OPA (Policy Decision Point)
├── service-c/      # Tool API (Mock: /resident-info)
├── judgment-ui/    # 認可判定の監査画面 (Next.js)
├── gov-ui/         # デモ用行政 UI (Next.js)
├── scripts/        # 共通起動・デプロイスクリプト
└── docs/
    ├── 01-plan/    # 過去の計画・検討資料 (Historical)
    └── 02-design/  # 最新の設計ドキュメント
```

## ローカル開発環境の起動

Docker Compose を使用して、全サービスをワンコマンドで起動するのが最も推奨される方法です。

### 前提: Firestore Emulator の起動

二重実行防止（JTI Store）を動作させるには、**先に** ホストマシンで Firebase Emulator を起動してください。

```bash
# 初回のみ: Firebase CLI のインストール
npm install -g firebase-tools

# Firestore Emulator の起動 (ポート 8080)
firebase emulators:start --only firestore
```

> [!NOTE]
> Apple Silicon (M1/M2/M3) では、Docker 内で Firestore Emulator を動かすより、ホストで直接実行する方が高速で安定します。

### 推奨: Docker Compose での起動

```bash
# 全サービスの起動 (ビルド含む)
./scripts/deploy.sh local

# サービスの停止
./scripts/deploy.sh local down
```

起動後、以下のポートで各サービスにアクセス可能です。
- **Judgment (service-a)**: http://localhost:8080
- **OPA (service-b)**: http://localhost:8181
- **Tool (service-c)**: http://localhost:8082
- **Envoy Gateway**: http://localhost:10000
- **Firestore Emulator**: http://localhost:8080 (ホストで別途起動)
- **Judgment UI**: http://localhost:3000
- **Gov UI**: http://localhost:3001

## 動作確認 (API テスト)

### 1. 認可判定要求 (Phase 1)
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
レスポンスの `execution_handle` (JWT) を取得します。

### 2. 実行要求 (Phase 2)
取得した JWT を使用して実行を依頼します（Judgment が Envoy 経由で Tool を呼び出します）。
```bash
# JWT 部分を取得した値に置き換えてください
curl -sX POST http://localhost:8080/execute \
  -H "Content-Type: application/json" \
  -d '{
    "execution_handle": "YOUR_JWT_HERE",
    "parameters": {}
  }' | jq
```

## デプロイ (Google Cloud)

`scripts/deploy.sh` を使用して、Cloud Run に各コンポーネントをデプロイできます。

```bash
# 特定のサービスをデプロイ
./scripts/deploy.sh prod service-a

# 全バックエンドサービスを一括デプロイ
./scripts/deploy.sh prod all
```

> [!NOTE]
> デプロイ前に `.env.prod` の内容が正しいことを確認してください。

## 開発者向け情報

### 手動起動 (個別サービス)
各ディレクトリで以下のコマンドを使用して個別起動も可能です。
- **Python**: `python -m uvicorn main:app --port XXXX`
- **Next.js**: `npm run dev`

詳細は各ディレクトリ内のソースコード、または `docs/01-plan` 内の過去資料を参照してください。
