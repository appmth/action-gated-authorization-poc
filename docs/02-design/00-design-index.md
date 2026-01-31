# 設計ドキュメント一覧

`action-gated-authorization-poc` の設計ドキュメントのインデックスです。

| ファイル名 | タイトル | 概要 |
| :--- | :--- | :--- |
| **[01-environment-management.md](01-environment-management.md)** | 環境変数管理設計 | Build Once, Run Anywhere を実現するための環境変数注入方式（Native / Template）の定義 |
| **[02-structural-enforcement.md](02-structural-enforcement.md)** | 構造的強制力の詳細 | Envoy Gateway + JWT + Sidecar パターンによる、アプリロジックに依存しない認可制御の仕組み |
| **[03-interface-spec.yaml](03-interface-spec.yaml)** | API 仕様 (OpenAPI) | Judgment (Service-A), PDP (Service-B), Tool (Service-C) のAPI定義 |
| **[04-sequence-diagram.md](04-sequence-diagram.md)** | シーケンス図 | 認可判定 (Authorzation Phase) から 実行 (Execution Phase) までの詳細な処理フロー |
| **[05-architecture-diagram.md](05-architecture-diagram.md)** | 全体アーキテクチャ | システム全体の構成要素、通信経路、依存関係の鳥瞰図 |
| **[06-local-development.md](06-local-development.md)** | ローカル開発ガイド | Docker Compose を用いた開発環境の構築・起動手順とデバッグ方法 |
| **[07-gcp-infrastructure.md](07-gcp-infrastructure.md)** | インフラ構成 (GCP) | Cloud Run, Firestore, Secret Manager などの GCP リソース構成とデプロイ概略 |
| **[10-service-a-judgment.md](10-service-a-judgment.md)** | Service-A 詳細設計 | Judgment Service の責務、内部ロジック、データモデル |
| **[11-service-b-pdp.md](11-service-b-pdp.md)** | Service-B 詳細設計 | PDP (OPA) のポリシー構造と判定ロジック |
| **[12-envoy-gateway.md](12-envoy-gateway.md)** | Envoy Gateway 詳細設計 | Envoy の設定、JWT検証、およびルーティングルール |
| **[13-service-c-tool.md](13-service-c-tool.md)** | Service-C 詳細設計 | Tool API のモック実装と保護機能 |
| **[20-judgment-ui.md](20-judgment-ui.md)** | Judgment UI 詳細設計 | 認可プロセスを可視化・監査するための管理画面の設計 |
