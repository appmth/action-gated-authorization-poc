# ローカル開発環境設計

Docker Compose を使用したローカル開発環境の構成と起動方法を定義します。

## 1. 構成概要

```
localhost
├── :8080   service-a       (Judgment / PEP)
├── :8181   service-b       (PDP / OPA)
├── :8082   service-c       (Tool / Mock)
├── :10000  envoy-gateway   (JWT検証 + RBAC + Proxy)
└── :8086   firebase emulator (Firestore / JTI Store)
```

全サービスは Docker Bridge ネットワーク（`aga-network`）で接続され、コンテナ名で相互通信します。

## 2. GCP 環境との差分

| 項目 | ローカル | GCP |
| :--- | :--- | :--- |
| 通信プロトコル | HTTP | HTTPS (TLS) |
| 名前解決 | Docker DNS (`service-a:8080`) | パブリック DNS (`*.action-gated.tech`) |
| Envoy 設定 | `envoy-local.yaml`（TLS なし） | `envoy.yaml.template`（TLS あり） |
| Firestore | Firebase Emulator（ホスト実行） | GCP Firestore |
| Envoy → Upstream | `STRICT_DNS` / HTTP | `LOGICAL_DNS` / HTTPS + SNI |

## 3. サービス定義

### service-a（Judgment / PEP）

| 項目 | 値 |
| :--- | :--- |
| ポート | 8080:8080 |
| Dockerfile | `service-a/Dockerfile` |
| ヘルスチェック | `curl http://localhost:8080/health` |

主要環境変数:

| 変数名 | 値 | 用途 |
| :--- | :--- | :--- |
| `PDP_URL` | `http://service-b:8080` | OPA への接続先 |
| `TOOL_URL` | `http://service-c:8080` | Tool 直接呼び出し |
| `ENVOY_URL` | `http://envoy-gateway:8080` | Envoy 経由の Tool 呼び出し |
| `FIRESTORE_EMULATOR_HOST` | `firestore-emulator:8080` | Firestore エミュレータ接続 |
| `GOOGLE_CLOUD_PROJECT` | `aga-poc` | Firestore プロジェクト ID |

### service-b（PDP / OPA）

| 項目 | 値 |
| :--- | :--- |
| ポート | 8181:8080 |
| Dockerfile | `service-b/Dockerfile` |
| OPA イメージ | `openpolicyagent/opa:latest-static`（ARM 対応） |
| ヘルスチェック | `wget http://localhost:8080/health` |

### service-c（Tool / Mock）

| 項目 | 値 |
| :--- | :--- |
| ポート | 8082:8080 |
| Dockerfile | `service-c/Dockerfile` |
| ヘルスチェック | `curl http://localhost:8080/health` |

### envoy-gateway（JWT 検証 + RBAC + Proxy）

| 項目 | 値 |
| :--- | :--- |
| ポート | 10000:8080 |
| Dockerfile | `envoy-gateway/Dockerfile.local` |
| 設定ファイル | `envoy-gateway/envoy-local.yaml` |

GCP 版との主な差分:
- **TLS 無効**: `transport_socket` 設定を除去
- **DNS 方式**: `STRICT_DNS`（Docker 内部 DNS 向け）
- **ホスト名固定**: 環境変数展開なし（`service-a`, `service-c` で直接指定）
- **JWKS URI**: `http://service-a:8080/.well-known/jwks.json`

### Firestore Emulator

| 項目 | 値 |
| :--- | :--- |
| 実行方式 | docker-compose 内の `firestore-emulator` サービス（`mtlynch/firestore-emulator`） |
| ポート | 8086（ホスト側）→ 8080（コンテナ内部） |
| コンテナからの接続 | `firestore-emulator:8080` |
| プロジェクト ID | `aga-poc` |

docker-compose で自動起動されるため、ホスト側での `firebase emulators:start` は不要です。Firestore クライアントライブラリは `FIRESTORE_EMULATOR_HOST` 環境変数が設定されている場合、自動的にエミュレータに接続します。service-a のコード内で `AnonymousCredentials` を使用し、GCP 認証をバイパスします。

## 4. ネットワーク構成

```
                    aga-network (Docker Bridge)
┌──────────────────────────────────────────────────────┐
│                                                      │
│  service-a:8080 ──HTTP──▶ service-b:8080 (PDP)      │
│       │                                              │
│       │──HTTP──▶ envoy-gateway:8080 (JWT+Proxy)      │
│       │                  │                           │
│       │                  │──HTTP──▶ service-c:8080   │
│       │                                              │
│       │──HTTP──▶ firestore-emulator:8080               │
│                  (Firestore Emulator)                │
└──────────────────────────────────────────────────────┘
```

## 5. 起動・停止

```bash
# 起動（ビルド含む）
./scripts/deploy.sh local

# 停止
./scripts/deploy.sh local down

# または直接 docker-compose
docker-compose --env-file .env.local up -d --build
docker-compose down
```

### 前提条件
- Docker Desktop が起動していること
- `.env.local` ファイルが存在すること（なければ `.env.local.example` からコピー）

## 6. ヘルスチェック

```bash
curl http://localhost:8080/health     # service-a
curl http://localhost:8181/health     # service-b (OPA)
curl http://localhost:8082/health     # service-c
curl http://localhost:10000/health    # envoy-gateway
```

## 7. 関連ファイル

| ファイル | 用途 |
| :--- | :--- |
| `docker-compose.yml` | サービス定義 |
| `.env.local.example` | ローカル環境変数テンプレート |
| `envoy-gateway/envoy-local.yaml` | Envoy ローカル設定（TLS なし） |
| `envoy-gateway/Dockerfile.local` | Envoy ローカル用 Dockerfile |
