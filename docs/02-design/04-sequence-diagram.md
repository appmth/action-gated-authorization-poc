# シーケンス図

## デプロイ時: API キーのプロビジョニング

GCP Secret Manager から API キーが各サービスに注入される流れを示します。

```mermaid
sequenceDiagram
    autonumber
    participant Ops as Operator
    participant SM as GCP Secret Manager
    participant CR as Cloud Run
    participant Envoy as Envoy Gateway
    participant Tool as Tool API (service-c)

    Note over Ops, Tool: デプロイ時（1回のみ）
    Ops->>SM: gcloud secrets create tool-api-key
    SM-->>Ops: Secret 作成完了

    Note over Ops, Tool: サービスデプロイ時
    Ops->>CR: gcloud run deploy envoy-gateway<br/>--set-secrets=TOOL_API_KEY=tool-api-key:latest
    CR->>SM: Secret 取得
    SM-->>CR: TOOL_API_KEY 値
    CR->>Envoy: 環境変数 TOOL_API_KEY を注入して起動

    Ops->>CR: gcloud run deploy service-c<br/>--set-secrets=TOOL_API_KEY=tool-api-key:latest
    CR->>SM: Secret 取得
    SM-->>CR: TOOL_API_KEY 値
    CR->>Tool: 環境変数 TOOL_API_KEY を注入して起動

    Note over Envoy, Tool: 両サービスが同一の API キーを保持<br/>Agent はキーを一切知らない
```

---

## ランタイム: 2段認可と Tool 実行

2段認可と構造的強制力を伴う Tool 実行の全体フローを定義します。

```mermaid
sequenceDiagram
    autonumber
    participant Agent as Agent (Client)
    participant Judgment as Judgment (service-a)
    participant PDP as PDP (service-b/OPA)
    participant Firestore as Firestore (JTI Store)
    participant Envoy as Envoy Gateway
    participant Tool as Tool API (service-c)

    Note over Agent, Tool: Phase 1: Authorization
    Agent->>Judgment: POST /authorize (action, context)
    Judgment->>PDP: Query Policy Decision
    PDP-->>Judgment: decision (Allow + policy_id/tags)

    alt is Allowed
        Judgment->>Judgment: Generate JWT (execution_handle)<br/>with jti, scope, ctx_hash
        Judgment-->>Agent: 200 OK (execution_handle)
    else is Denied
        Judgment-->>Agent: 200 OK (Decision: Deny)
    end

    Note over Agent, Tool: Phase 2: Execution
    Agent->>Judgment: POST /execute (execution_handle, tool_request)

    Judgment->>Judgment: Verify JWT Signature/exp
    Judgment->>Judgment: Validate path against scope

    alt path not allowed
        Judgment-->>Agent: 403 Forbidden (path not allowed for scope)
    end

    Judgment->>Firestore: Check & Register jti (Atomic)

    alt jti is New
        Judgment->>Envoy: Proxy to tool_request.path (Bearer JWT)

        Note over Envoy: L2: JWT + RBAC 検証
        Envoy->>Envoy: Verify JWT Signature/exp
        Envoy->>Envoy: Check RBAC Policy (scope)

        Note over Envoy, Tool: L3: API キー注入
        Envoy->>Envoy: Inject X-Tool-Api-Key header<br/>(from env TOOL_API_KEY)
        Envoy->>Tool: Forward Request + X-Tool-Api-Key
        Tool->>Tool: Verify API Key (middleware)

        alt API Key invalid
            Tool-->>Envoy: 401 Unauthorized
            Envoy-->>Judgment: 401
            Judgment-->>Agent: Tool error
        else API Key valid
            Tool->>Tool: Execute action
            Tool-->>Envoy: tool_result
            Envoy-->>Judgment: tool_result
            Judgment-->>Agent: 200 OK (result)
        end
    else jti is Used
        Judgment-->>Agent: 400 Bad Request (Already used)
    end
```

---

## 防御レイヤー構成

```mermaid
flowchart LR
    Agent([Agent]) --> SA[service-a<br/>L1: JWT検証 + JTI]
    SA --> Envoy[Envoy Gateway<br/>L2: JWT + RBAC]
    Envoy -->|X-Tool-Api-Key 注入| SC[service-c<br/>L3: API キー検証]

    SM[(Secret Manager)] -.->|TOOL_API_KEY| Envoy
    SM -.->|TOOL_API_KEY| SC

    style SM fill:#4285F4,color:#fff
    style SA fill:#34A853,color:#fff
    style Envoy fill:#FBBC04,color:#333
    style SC fill:#EA4335,color:#fff
```

| レイヤー | 場所 | 検証内容 | 失敗時 |
|---------|------|----------|--------|
| L1 | service-a `/execute` | JWT 署名・有効期限・JTI・scope/path | blocked |
| L2 | Envoy Gateway | JWT 署名・有効期限・RBAC (scope) | 401/403 |
| L3 | service-c | API キー (`X-Tool-Api-Key`) | 401 |

---

## 各ステップの補足
1. **認可リクエスト**: Agent は自身の ID、実行したいアクション、利用目的（context）を Judgment に提示します。
2. **ポリシー判定**: OPA は渡されたアクションとコンテキストを事前に定義された Rego ポリシーに照らして判定します。
3. **JWT生成**: `ctx_hash` を含めることで、後の実行時にコンテキストそのものが改ざん（すり替え）されることを防ぎます。
4. **JTIチェック**: Firestore の `jti_store` に登録を試みることで、複数のコンテナ間で同時に同じ JWT が使われたとしても、アトミックに一つに絞り込むことができます。
5. **Envoy RBAC**: `/tool/resident-info` などのセンシティブなパスへの到達は、Envoy が JWT の `scope` クレームを見て物理的に遮断/許可します。
6. **API キー注入**: Envoy が `request_headers_to_add` で `X-Tool-Api-Key` を付与します。Agent はこのキーを一切知りません。キーは GCP Secret Manager（ローカルでは環境変数）から取得されます。
7. **API キー検証**: service-c のミドルウェアが全リクエスト（`/health` 除く）で `X-Tool-Api-Key` ヘッダを検証します。直接アクセスはすべて 401 で遮断されます。
