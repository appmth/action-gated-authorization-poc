# シーケンス図

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
        
        Envoy->>Envoy: Verify JWT Signature/exp
        Envoy->>Envoy: Check RBAC Policy (scope)
        
        Envoy->>Tool: Forward Request (tool_request.body)
        Tool-->>Envoy: tool_result
        Envoy-->>Judgment: tool_result
        
        Judgment-->>Agent: 200 OK (result)
    else jti is Used
        Judgment-->>Agent: 400 Bad Request (Already used)
    end
```

## 各ステップの補足
1. **認可リクエスト**: Agent は自身の ID、実行したいアクション、利用目的（context）を Judgment に提示します。
2. **ポリシー判定**: OPA は渡されたアクションとコンテキストを事前に定義された Rego ポリシーに照らして判定します。
3. **JWT生成**: `ctx_hash` を含めることで、後の実行時にコンテキストそのものが改ざん（すり替え）されることを防ぎます。
4. **JTIチェック**: Firestore の `jti_store` に登録を試みることで、複数のコンテナ間で同時に同じ JWT が使われたとしても、アトミックに一つに絞り込むことができます。
5. **Envoy RBAC**: `/tool/resident-info` などのセンシティブなパスへの到達は、Envoy が JWT の `scope` クレームを見て物理的に遮断/許可します。
