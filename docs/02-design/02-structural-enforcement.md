# 構造的強制力の設計

本システムは、AI Agent の行動を「アプリケーションの `if` 文のみに頼らず、インフラ構成（ゲートウェイ）として強制する」ことを特徴としています。

## 強制力の3要素

### 1. Envoy Gateway による経路固定
Tool API（`service-c`）へのアクセスを Envoy Gateway 経由に限定します。

- **JWT 検証**: 有効な署名と期限（exp）を持つ JWT が付与されていないリクエストは、Envoy が即座に 401 Unauthorized で遮断します。
- **RBAC (Role Based Access Control)**: JWT 内の `scope` クレームに基づき、パスへの到達可否を制御します。
    - 例: `scope: "execute:get_resident_info"` を持つリクエストのみが `/tool/resident-info` に転送されます。

### 2. Judgment によるチケット発行
実行権限の判定は Judgment サービス（`service-a`）が中央集権的に行います。

- **2段認可**: 実行前に必ず `/authorize` を呼び出し、PDP（OPA）による認可を得る必要があります。
- **execution_handle (JWT)**: 認可が降りた場合のみ、特定の目的（scope）とリクエストID（req_id）を埋め込んだ短命なサイン付き JWT を発行します。
- **ハッシュによる完全性担保**: コンテキストの改ざんを防ぐため、認可時のパラメータをハッシュ化した `ctx_hash` を JWT に含めます。

### 3. One-time 実行の担保 (JTI Store)
同一の認可チケット（JWT）による多重実行を防止します。

- **jti (JWT ID)**: 各 JWT に付与される一意識別子です。
- **Firestore 連携**: 実行要求（`/execute`）の際、Firestore 上の `jti_store` コレクションに ID を登録します。
- **アトミック性**: トランザクションを使用して ID の登録を試み、既に登録されている（使用済み）場合は即座に実行を拒否します。
- **TTL (Time To Live)**: 使用済み ID は一定時間（10分程度）経過後に Firestore の TTL 機能で自動削除され、ストレージを圧迫しません。

> [!NOTE]
> ローカル開発環境では `firestore-emulator` (Docker) を使用して Firestore をエミュレートできます。`docker-compose.yml` に定義されており、ポート 8086 でアクセス可能です。

## 検証レイヤー

| 深度 | 検証場所 | 検証項目 | 失敗時の挙動 |
| :--- | :--- | :--- | :--- |
| **L1** | **Judgment (`/execute`)** | JWT 署名、有効期限、**jti (二重実行)** | 400 Bad Request / 403 Forbidden |
| **L2** | **Envoy Gateway** | JWT 署名、有効期限、**scope (パス制限)** | 401 Unauthorized / 403 Forbidden |
| **L3** | **Tool API** | (ブラックボックス) | - |

> [!IMPORTANT]
> この多重検証により、たとえ Judgment がバイパスされたとしても、Envoy 側で JWT の不備や権限不足を検知し、Tool への不正アクセスを防ぐことができます。
