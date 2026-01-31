# Service C: Tool API (Mock) 設計書

実際に業務処理を行うバックエンドサービスを模擬しています。

## 1. エンドポイント

### POST `/resident-info`
住民情報を検索するツールエンドポイント。
- **入力**: `request_id`, `action`, `context`。
- **出力**: 氏名、住所、住民番号などのモックデータ。
- **ログ**: `tool_executed` イベントを記録。

### POST `/execute` (Legacy)
以前の汎用実行エンドポイント。現在は `/resident-info` 等の特定パスへの移行が推奨されます。

## 2. API キー検証（L3 防御レイヤー）

全リクエスト（`/health` を除く）に対して `X-Tool-Api-Key` ヘッダの検証を行うミドルウェアを実装しています。

- **ヘッダ**: `X-Tool-Api-Key`
- **キー供給元**: GCP Secret Manager（`tool-api-key`）→ Cloud Run 環境変数 `TOOL_API_KEY`
- **ローカル**: docker-compose の環境変数（デフォルト: `local-dev-key-12345`）
- **不一致時**: `401 Unauthorized` を返却
- **キー未設定時**: 検証をスキップ（開発用フォールバック）

これにより、Envoy Gateway を経由しない直接アクセスはすべて遮断されます。

## 3. 実装のポイント
- **FastAPI**: 軽量な API 実装。
- **構造化ログ**: クラウドロギングでの分析を容易にするため、全てのレスポンスに `request_id` や `phase` を含めて stdout に出力。

## 4. インフラ上の位置付け
このサービスは **Envoy Gateway** の背後に配置されます。Envoy が `X-Tool-Api-Key` ヘッダを注入し、service-c がそれを検証する多層防御（Defense-in-Depth）の設計です。Agent は API キーを一切知りません。
