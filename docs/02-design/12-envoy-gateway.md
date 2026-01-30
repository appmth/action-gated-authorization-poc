# Envoy Gateway 設計書

インフラ層での構造的強制力を提供し、不正なアクセスや権限外のツール実行を遮断します。

## 1. 主要フィルタ構成

### A. JWT Authentication (`envoy.filters.http.jwt_authn`)
- **役割**: 公開鍵（JWKS）を用いた署名検証と有効期限のチェック。
- **設定**:
  - `issuer`: `judgment`
  - `remote_jwks`: `service-a` の `/.well-known/jwks.json` から取得。
- **挙動**: 検証に失敗したリクエストは 401 で即座に終了。検証成功時は JWT のペイロードをメタデータとして後続のフィルタに渡す。

### B. RBAC (`envoy.filters.http.rbac`)
- **役割**: JWT ペイロードの `scope` クレームに基づいたパス制限。
- **ポリシー例**:
  - `resident-info-policy`:
    - パス: `/tool/resident-info`
    - 条件: `scope` が `execute:get_resident_info` と完全一致すること。
- **挙動**: 条件を満たさない場合は 403 Forbidden。

## 2. ルーティング設計
- **/health**: 認証なしでアクセス可能。
- **/tool/resident-info**: `service-c` の `/resident-info` に転送（Prefix Rewrite）。
- **/tool/execute**: 旧エンドポイントへの互換層。

## 3. 環境差異の吸収 (envsubst)
- `envoy.yaml.template` 内の `${SERVICE_C_HOST}` や `${UPSTREAM_TLS_...}` を起動時に置換。
- ローカルは HTTP、本番は UpstreamTlsContext を設定することで、イメージを一本化。
