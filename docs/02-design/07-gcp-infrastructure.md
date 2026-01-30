# GCP インフラ・ネットワーク設計

GCP（Cloud Run）上でのサービス配置、ドメイン・DNS 構成、および通信設計を定義します。

## 1. ドメイン・DNS 構成

すべてのサービスは `action-gated.tech` ドメイン配下のサブドメインとして公開されます。Cloud Run のカスタムドメイン機能を利用し、Google マネージドの証明書（HTTPS）を適用しています。

| サービス名 | 公開 URL (Custom Domain) | 役割 |
| :--- | :--- | :--- |
| **envoy-gateway** | `https://envoy-gateway.action-gated.tech` | エントリポイント (JWT 認可 + Proxy) |
| **service-a** | `https://service-a.action-gated.tech` | Judgment (PEP) |
| **service-b** | `https://service-b.action-gated.tech` | PDP (OPA) |
| **service-c** | `https://service-c.action-gated.tech` | Tool API (Mock) |
| **judgment-ui** | `https://judgment-ui.action-gated.tech` | 監査ダッシュボード |
| **gov-ui** | `https://gov-ui.action-gated.tech` | デモ用行政システム |

## 2. サービス間通信

### 通信経路

```
[Client / Agent]
    │ HTTPS
    ▼
envoy-gateway (JWT検証 + RBAC + Proxy)
    │ HTTPS (host_rewrite_literal)
    ▼
service-c (Tool)

[service-a] ──HTTPS──▶ [service-b (OPA)]   ... PDP 問い合わせ
[service-a] ──HTTPS──▶ [envoy-gateway]      ... Tool 実行（構造的強制力）
[service-a] ──SDK──▶   [Firestore]          ... JTI Store（二重実行防止）
[envoy-gateway] ──HTTPS──▶ [service-a JWKS] ... JWT 公開鍵取得
```

### 名前解決
- パブリック DNS（`*.action-gated.tech`）を使用
- 環境変数にフルドメイン URL を設定（例: `PDP_URL=https://service-b.action-gated.tech`）
- Envoy Gateway は `service-a` の `/.well-known/jwks.json` エンドポイントから公開鍵を取得

### TLS 設定
- **外部アクセス**: Google マネージド証明書による HTTPS (TLS 1.2+)
- **サービス間通信**: Cloud Run エンドポイント間は HTTPS
- **Envoy → Upstream**: `transport_socket` で TLS を明示設定、`sni` にホスト名を指定

## 3. Cloud Run 構成

### デプロイ設定

| サービス | リージョン | メモリ | CPU | 最小インスタンス |
| :--- | :--- | :--- | :--- | :--- |
| service-a | asia-northeast1 | 512Mi | 1 | 0 |
| service-b | asia-northeast1 | 256Mi | 1 | 0 |
| service-c | asia-northeast1 | 256Mi | 1 | 0 |
| envoy-gateway | asia-northeast1 | 256Mi | 1 | 0 |

### 環境変数（service-a）

| 変数名 | 値 | 用途 |
| :--- | :--- | :--- |
| `PDP_URL` | `https://service-b.action-gated.tech` | OPA への接続先 |
| `TOOL_URL` | `https://service-c.action-gated.tech` | Tool 直接呼び出し |
| `ENVOY_URL` | `https://envoy-gateway.action-gated.tech` | Envoy 経由の Tool 呼び出し |
| `GOOGLE_CLOUD_PROJECT` | `aga-poc` | Firestore プロジェクト |

### 環境変数（envoy-gateway）

| 変数名 | 値 | 用途 |
| :--- | :--- | :--- |
| `SERVICE_A_HOST` | `service-a.action-gated.tech` | JWKS 取得先 |
| `SERVICE_C_HOST` | `service-c.action-gated.tech` | Tool Proxy 先 |
| `JWKS_URI` | `https://service-a.action-gated.tech/.well-known/jwks.json` | JWT 公開鍵エンドポイント |

## 4. データストア

### Firestore（JTI Store）

- **目的**: JWT の `jti` を記録し、二重実行を防止
- **コレクション**: `jti_store`
- **TTL**: `ttl_at` フィールドで 10 分後に自動削除
- **トランザクション**: Firestore トランザクションで原子的に登録

## 5. デプロイ手順

```bash
# 単一サービスデプロイ
./scripts/deploy.sh prod service-a

# 全サービスデプロイ
./scripts/deploy.sh prod all
```

デプロイスクリプトは `.env.prod` から環境変数を読み込み、`gcloud run deploy --set-env-vars` で Cloud Run に反映します。
