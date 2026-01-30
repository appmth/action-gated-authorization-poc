# 環境変数管理設計

本プロジェクトでは、Docker のベストプラクティス（Build Once, Run Anywhere）に基づき、環境変数を活用してローカル開発環境と本番環境（GCP）の差分を吸収します。

## 管理戦略

### 1. 管理ファイルの分離
環境ごとの値は以下のファイルで管理し、`docker-compose` およびデプロイスクリプトで使い分けます。

- **`.env.local`**: ローカル開発用
    - コンテナ間通信に Docker Bridge ネットワーク内のホスト名（例: `http://service-b:8080`）を使用。
    - TLS（HTTPS）を無効化。
- **`.env.prod`**: 本番（GCP/Cloud Run）用
    - フルサービスドメイン（例: `https://service-b.action-gated.tech`）を使用。
    - 上流サービスへの HTTPS 通信を有効化。

### 2. コンテナ起動時の設定注入

コンテナの性質に応じて、2つの注入方式を使い分けています。

#### A. テンプレート方式 (Middleware)
設定ファイルが主体となるミドルウェアでは、起動時に環境変数を反映させた設定ファイルを生成します。
- **対象**: `envoy-gateway`, `service-b` (OPA)
- **仕組み**:
    1. `config.yaml.template` などのテンプレートファイルを用意。
    2. Docker 起動時の `CMD` で `envsubst` を実行し、実際の設定ファイルを `/tmp` 等に書き出す。
    3. 生成されたファイルをミドルウェアが読み込んで起動。
- **利点**: ローカルと本番で設定ファイルの構造を完全に同期させつつ、エンドポイントやログレベルのみを動的に変更できる。

#### B. ネイティブ方式 (Application)
アプリケーションコードが主体となるサービスでは、プログラム内で環境変数を直接参照します。
- **対象**: `service-a`, `service-c` (Python/FastAPI)
- **仕組み**: Python の `os.getenv()` を使用して実行時に値を読み込む。
- **利点**: 中間ファイルを作成せず、言語標準の機能で動的に動作を制御できる。

## 主要な環境変数

| 変数名 | 用途 | 例 (Local) | 例 (Production) |
| :--- | :--- | :--- | :--- |
| `PDP_URL` | service-a から OPA への接続先 | `http://service-b:8080` | `https://service-b...` |
| `ENVOY_URL` | service-a から Envoy への接続先 | `http://envoy-gateway:8080` | `https://envoy...` |
| `UPSTREAM_TLS_...` | Envoy の上流通信 TLS 設定 | (空文字) | `transport_socket: ...` |
| `OPA_LOG_FORMAT` | OPA のログ形式 | `text` | `json` |
| `FIRESTORE_EMULATOR_HOST` | Firestore エミュレータへの接続先 | `firestore-emulator:8080` | (未設定 = 本番 Firestore) |
