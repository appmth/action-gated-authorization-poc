> [!IMPORTANT]
> このドキュメントはプロジェクト初期の計画書であり、**現在は歴史的資料として保管されています。**
> 最新の設計および仕様については **[docs/02-design/](../02-design/)** を参照してください。

# Judgment 拡張計画：2段認可 + 構造的強制力の実装

## 概要

本計画は、**既存のJudgment最小PoC（5サービス構成）を前提**に、以下の拡張を行うための実装計画である。

- `/authorize` → `/execute` の**2段構成**
- **execution_handle（JWT）** による実行チケット発行・検証
- **Envoy Gateway** による構造的な強制力
- **one-time実行**（二重実行防止）

### 背景：AGAとJudgment

| 用語 | 説明 |
|------|------|
| **AGA（Action-Gated Authorization）** | AI Agentの行動を「実行前に」「業務文脈を含めて」制御するという**設計思想** |
| **Judgment** | AGA思想を実現する**プロダクト**。認可判定エンジンとしてPEP/PDPの役割を担う |

### 現在のPoC構成（実装済み）

| サービス | 役割 | 技術 | GCPサービス | カスタムドメイン |
|---------|------|------|-------------|-----------------|
| service-a | Agent + Judgment（PEP） | FastAPI | Cloud Run | https://service-a.action-gated.tech |
| service-b | PDP（OPA） | OPA + Rego | Cloud Run | https://service-b.action-gated.tech |
| service-c | Tool mock | FastAPI | Cloud Run | https://service-c.action-gated.tech |
| judgment-ui | Judgment監査画面 | Next.js | Cloud Run | https://judgment-ui.action-gated.tech |
| gov-ui | デモ用現場UI | Next.js | Cloud Run | https://gov-ui.action-gated.tech |

**GCP情報**: リージョン `asia-northeast1`（東京）、ドメイン `action-gated.tech`

### 拡張後のゴール

**「/authorize → /execute を通らないとToolに到達できない」** ことを、アプリ内の`if`文ではなく**構造（Envoy + 経路固定）** で示す。

---

## アーキテクチャ図

### 拡張後のシステム構成

```mermaid
graph TB
    subgraph "Client Layer"
        GovUI[gov-ui<br/>現場UI]
        JudgmentUI[judgment-ui<br/>監査画面]
    end

    subgraph "Judgment Layer（service-a）"
        Authorize["/authorize<br/>認可判定 + JWT発行"]
        Execute["/execute<br/>JWT検証 + 実行委譲"]
        JTIStore["JTI Store<br/>（one-time検証）"]
    end

    subgraph "Policy Layer（service-b）"
        PDP["PDP<br/>OPA + Rego"]
    end

    subgraph "Gateway Layer（新規）"
        Envoy["Envoy Gateway<br/>JWT検証 + Proxy"]
    end

    subgraph "Tool Layer（service-c）"
        Tool["Tool API<br/>（ブラックボックス）"]
    end

    subgraph "Observability"
        Logging["Cloud Logging<br/>request_id串刺し"]
    end

    GovUI -->|"1. POST /authorize<br/>action + context"| Authorize
    Authorize -->|"2. Query"| PDP
    PDP -->|"3. allow/deny + reason"| Authorize
    Authorize -->|"4. execution_handle (JWT)"| GovUI

    GovUI -->|"5. POST /execute<br/>+ execution_handle"| Execute
    Execute -->|"6. Check jti"| JTIStore
    Execute -->|"7. Bearer JWT"| Envoy
    Envoy -->|"8. JWT検証OK"| Tool
    Tool -->|"9. Result"| Envoy
    Envoy -->|"10. Result"| Execute
    Execute -->|"11. Result"| GovUI

    JudgmentUI -->|"監査ログ取得"| Authorize

    Authorize -.->|"AUTHZ_DECISION"| Logging
    Execute -.->|"EXEC_RESULT"| Logging
    Envoy -.->|"ENVOY_DENY"| Logging

    style Authorize fill:#ff6b6b
    style Execute fill:#ff6b6b
    style PDP fill:#4ecdc4
    style Envoy fill:#f39c12
    style JTIStore fill:#9b59b6
    style Tool fill:#95a5a6
```

### 責務境界の明確化

| レイヤー | 責務 | JWT操作 |
|---------|------|---------|
| **Judgment /authorize** | 認可判定、JWT発行 | 発行（sign） |
| **Judgment /execute** | JWT検証、one-time検証、実行委譲 | 検証（verify） |
| **Envoy Gateway** | JWT検証、Proxy | 検証（verify） |
| **Tool API** | 業務処理（ブラックボックス） | なし |

### 拡張後のサービス一覧

| サービス | 役割 | 技術 | GCPサービス | カスタムドメイン | 備考 |
|---------|------|------|-------------|-----------------|------|
| service-a | Judgment（/authorize + /execute + JWKS） | FastAPI | Cloud Run | https://service-a.action-gated.tech | 拡張 |
| service-b | PDP（OPA） | OPA + Rego | Cloud Run | https://service-b.action-gated.tech | 既存 |
| envoy-gateway | JWT検証 + Proxy | Envoy | Cloud Run | https://envoy-gateway.action-gated.tech | **新規** |
| service-c | Tool API（モック） | FastAPI | Cloud Run | https://service-c.action-gated.tech | 既存 |
| judgment-ui | Judgment監査画面 | Next.js | Cloud Run | https://judgment-ui.action-gated.tech | 既存 |
| gov-ui | デモ用現場UI | Next.js | Cloud Run | https://gov-ui.action-gated.tech | 既存 |
| jti-store | JTI Store（one-time検証） | - | Firestore | - | **新規** |

**GCP情報**: リージョン `asia-northeast1`（東京）、ドメイン `action-gated.tech`

### 経路の強制

```
[許可された経路]
Agent → Judgment(/authorize) → PDP → JWT発行
Agent → Judgment(/execute) → Envoy → Tool

[禁止された経路（構造的に不可能）]
Agent → Tool（直接）     ← Envoyが止める（JWTなし）
Agent → Envoy → Tool     ← Envoyが止める（JWTなし or 無効）
```

---

## シーケンス図

### mermaid記法メモ

| 記法 | 用途 | 説明 |
|------|------|------|
| `alt`/`else` | 条件分岐 | どちらかのパスを通る（if/else相当） |
| `break` | 中断・終了 | エラー等で処理を打ち切る（early return相当） |

### 基本フロー

```mermaid
sequenceDiagram
    participant Agent
    participant Judgment as Judgment
    participant PDP as PDP（OPA）
    participant JTI as JTI Store
    participant Envoy as Envoy Gateway
    participant Tool as Tool API

    Note over Agent,Tool: Phase 1: 認可判定（/authorize）

    Agent->>Judgment: POST /authorize<br/>{action, context}
    Judgment->>PDP: Query
    PDP-->>Judgment: {allow, reason}

    alt allow = true
        Judgment->>Judgment: JWT発行（exp=60s）
        Judgment-->>Agent: {decision: "allow", execution_handle}
    else allow = false
        Judgment-->>Agent: {decision: "deny", reason}
        Note over Agent: 終了（execution_handleなし）
    end

    Note over Agent,Tool: Phase 2: 実行（/execute）

    Agent->>Judgment: POST /execute<br/>{execution_handle, parameters}

    break JWT署名不正
        Judgment-->>Agent: {status: "blocked", reason: "invalid signature"}
    end

    break JWT期限切れ（60秒超過）
        Judgment-->>Agent: {status: "blocked", reason: "expired"}
    end

    Judgment->>JTI: jti登録（トランザクション）

    break jti既に使用済み
        JTI-->>Judgment: 登録失敗
        Judgment-->>Agent: {status: "blocked", reason: "already used"}
    end

    JTI-->>Judgment: OK
    Judgment->>Envoy: Bearer JWT
    Envoy->>Envoy: JWT検証（sig, exp, aud）
    Envoy->>Tool: リクエスト転送
    Tool-->>Envoy: Result
    Envoy-->>Judgment: Result
    Judgment-->>Agent: {status: "success", result}
```

### 構造的強制力のポイント

Phase 2（/execute）で以下の順に検証し、どこかで失敗すればToolに到達しない：

| 順序 | 検証項目 | 失敗時の理由 | 検証場所 |
|------|---------|-------------|---------|
| 1 | JWT署名 | invalid signature | Judgment |
| 2 | JWT期限（exp） | expired | Judgment |
| 3 | jti未使用 | already used | Judgment + Firestore |
| 4 | JWT検証（二重） | 401 Unauthorized | Envoy |

---

## 1. 完成条件（Definition of Done）

### 機能DoD

- [ ] Agent は `POST /authorize` → `POST /execute` の2段でしか実行できない
- [ ] `/authorize` は **allow/deny + reason** を返し、allowのときのみ **execution_handle（JWT）** を発行
- [ ] `/execute` は execution_handle を検証（署名/exp/jti/scope/one-time）し、OKのときのみ実行
- [ ] Tool呼び出しは **必ず Envoy 経由**（Judgment → Tool 直叩き経路が存在しない）
- [ ] Envoy でも JWT を検証し、NG なら Tool へ到達しない
- [ ] `request_id` で authorize → execute → proxy → tool が **Cloud Logging で串刺し**できる
- [ ] 2ケースデモ（Allow / Deny）がUIまたはcurlで再現できる

### デモDoD（審査員に刺さる見せ方）

- [ ] 「/authorizeで"理由付き"で止める」→「/executeを叩いても通らない」までを数十秒で見せられる
- [ ] 「JWTを改ざん/期限切れ/二重実行」など、**構造的強制力の証明**が1つ以上入っている
- [ ] 記事に載せる図（PDP/Judgment/Envoyの責務境界）とシーケンスが揃っている

---

## 2. 進め方

### Phase 0：基盤方針の確定

**成果物**

- [ ] execution_handle（JWT）のクレーム定義（確定版）
- [ ] OPA input schema（authorizeで渡すinput）確定
- [ ] Envoyの責務（何を検証し、何をしないか）確定

**決め切る事項**

| 項目 | 方針 |
|------|------|
| execution_handle | 「外部APIの認証トークン」ではなく **Judgment内輪の実行チケット** |
| Tool（外部API） | ブラックボックス（JWT検証しない） |
| JWT検証 | **Judgment**（署名/exp/jti） + **Envoy**（署名/exp/aud）の役割分担 |
| JTI Store | **Firestore**（TTL自動削除、トランザクションで排他制御） |
| JWKS | **Judgment**に `/.well-known/jwks.json` を設置、Envoyが参照 |

---

## 3. 実装計画

### 3.1 Judgment：/authorize（発行）側の拡張

**目的**

PDP（OPA）から allow/deny + reason を得て、allowなら **execution_handle（JWT）を発行**する。

**タスク**

- [ ] `/authorize` の入出力を確定（7章「インターフェース」参照）
- [ ] OPAへ投げる `input` を **固定スキーマ**にする
  - 例：`{action, agent_id, context, request_id, now, ...}`
- [ ] OPAレスポンス（allow/deny/reason）を Judgment 側で正規化
- [ ] allow時に execution_handle を生成（署名付きJWT、**exp=60秒**）
  - [ ] `iss/aud/sub/jti/exp/iat/scope/req_id` は必須
  - [ ] `ctx_hash` を入れるならここで生成（PoCではoptional）
- [ ] JWKSエンドポイント `/.well-known/jwks.json` を実装（Envoyが参照）
- [ ] Cloud Logging に `AUTHZ_DECISION` を出す（req_id, allow, reason, scope, jti, exp）
- [ ] レスポンスに `execution_handle` を返す（allow時のみ）

---

### 3.2 Judgment：/execute（検証＋実行）側の拡張

**目的**

Agentが提示した execution_handle を検証し、OKなら Envoy 経由でToolを実行する。
**one-time**（二重実行防止）を入れて「使い捨てチケット」感を出す。

**検証タスク**（検証順序は「構造的強制力のポイント」参照）

- [ ] `/execute` の入出力を確定（7章「インターフェース」参照）
- [ ] JWT検証（Judgment内）
  - [ ] 署名検証（HS256 or RS256）
  - [ ] `exp`（60秒超過でblocked）
- [ ] one-time実行（**Firestore**）
  - [ ] `jti` をFirestoreに登録（トランザクションで排他制御）
  - [ ] 既に存在する場合は `already used` でblocked
  - [ ] TTL用フィールド `ttl_at`（used_at + 10分）で自動削除

**実行タスク**

- [ ] Judgment → Envoy への転送を実装（HTTP）
  - [ ] `Authorization: Bearer <execution_handle>`
  - [ ] 実行対象（tool endpoint/path）をJudgment側で決める（Agentに直接URLを渡さない）
- [ ] 結果を Agent に返却
- [ ] Cloud Logging に `EXECUTION_RESULT`（req_id, jti, status, latency, tool）を出す

---

### 3.3 PDP（OPA）：ポリシー拡張

**目的**

allow/deny + reason を返し、説明可能性を担保する。

**タスク**

- [ ] input schema を Rego 側でも固定（ドキュメント化）
- [ ] ルールを3〜5個に絞る（PoCの芯だけ）
  - [ ] business_hours 以外は deny（purpose=inquiry の場合）
  - [ ] data_sensitivity が high の場合は deny（inquiry目的）
  - [ ] actionごとに必要最小限のcontextを満たさないと deny
- [ ] 返却形式を決める（例）
  ```json
  {"allow": true/false, "reason": "...", "policy_id": "...", "tags": [...]}
  ```
- [ ] Cloud Logging（OPA側）にも req_id を出す（できれば）

---

### 3.4 Envoy Gateway：JWT検証 + Proxy

**目的**

Toolへの入口を Envoy に固定し、**JWTがないと到達不能**にする。
「アプリのif文ではなく構造で止める」を成立させる。

**環境タスク**

- [ ] Envoy を Cloud Run で起動
- [ ] Envoy の upstream を Tool API（モック）へ向ける
- [ ] ルーティング：`/tool/*` を tool にプロキシ

**JWT検証タスク**

- [ ] JWKSエンドポイントを参照（Judgmentの `/.well-known/jwks.json`）
- [ ] Envoy で JWT検証を有効化（署名/exp/aud）
- [ ] `aud` を `envoy-gateway` に固定（Judgmentで発行するaudと合わせる）
- [ ] `scope` を見て許可するパスを絞る（可能なら）
  - 例：`scope` に `execute:get_resident_info` がないと `/tool/resident-info` に到達不可

**ログタスク**

- [ ] Envoy access log に `req_id` 相当を出す（headerで渡す or JWT claim）
- [ ] Cloud Logging で「Envoyで止めた」が見えるようにする

---

### 3.5 Tool API（モック）：最小実装

**目的**

「叩ける/叩けない」を見せるだけ。ビジネスロジックは不要。

**タスク**

- [ ] `GET/POST /tool/resident-info` を実装（ダミー応答でOK）
- [ ] Envoyのみから到達できるようにする（できる範囲で）
- [ ] Tool側で `Authorization` は検証しない（ブラックボックス前提）

---

### 3.6 JTI Store（Firestore）：one-time実行

**目的**

同じ `execution_handle` での二重実行を防止する。

**タスク**

- [ ] Firestoreプロジェクト設定（既存プロジェクトを使用）
- [ ] コレクション `jti_store` を作成
- [ ] TTLポリシー設定（`ttl_at` フィールド基準で自動削除）
  ```bash
  gcloud firestore fields ttls update ttl_at \
    --collection-group=jti_store \
    --enable-ttl
  ```
- [ ] Python SDK（google-cloud-firestore）をservice-aに追加
- [ ] トランザクションによる排他制御を実装（8章「Firestore操作例」参照）

**スキーマ**

```json
{
  "jti": "uuid",
  "used_at": "2026-01-27T01:23:45Z",
  "expired_at": "2026-01-27T01:24:45Z",
  "ttl_at": "2026-01-27T01:33:45Z"
}
```

| フィールド | 説明 |
|-----------|------|
| `jti` | JWTのjtiクレーム（一意識別子）、ドキュメントIDとしても使用 |
| `used_at` | 使用された日時 |
| `expired_at` | JWTの有効期限（used_at + 60秒） |
| `ttl_at` | Firestore TTL用（used_at + 10分） |

---

## 4. デモ設計

### デモシナリオ（最小2本）

#### 1. Allowフロー

```
Context A: purpose=inquiry, time=business_hours, data_sensitivity=required
```

1. `/authorize` → allow + reason + execution_handle
2. `/execute` → Envoy経由で tool 成功
3. ログで reason / req_id 串刺し

#### 2. Denyフロー

```
Context B: purpose=inquiry, time=night, data_sensitivity=high
```

1. `/authorize` → deny + reason
2. execution_handle なし
3. `/execute` しても通らない（400/401等）

### 構造的強制力を示す追加ワンショット

以下のいずれか1つで十分：

- [ ] **期限切れ**：exp短命にして、少し待ってから /execute → Envoyで401
- [ ] **改ざん**：JWTの1文字変えて /execute → Judgment or EnvoyでNG
- [ ] **二重実行**：同じexecution_handleで2回 /execute → 2回目deny（one-time）

---

## 5. デプロイ計画

### サービス一覧（拡張後）

| サービス | 役割 | 技術 | GCPサービス | カスタムドメイン | 備考 |
|---------|------|------|-------------|-----------------|------|
| service-a | Judgment（/authorize + /execute + JWKS） | FastAPI | Cloud Run | https://service-a.action-gated.tech | 拡張 |
| service-b | PDP（OPA） | OPA + Rego | Cloud Run | https://service-b.action-gated.tech | 既存 |
| envoy-gateway | JWT検証 + Proxy | Envoy | Cloud Run | https://envoy-gateway.action-gated.tech | **新規** |
| service-c | Tool API（モック） | FastAPI | Cloud Run | https://service-c.action-gated.tech | 既存 |
| judgment-ui | Judgment監査画面 | Next.js | Cloud Run | https://judgment-ui.action-gated.tech | 既存 |
| gov-ui | デモ用現場UI | Next.js | Cloud Run | https://gov-ui.action-gated.tech | 既存 |
| jti-store | JTI Store（one-time検証） | - | Firestore | - | **新規** |

**GCP情報**: リージョン `asia-northeast1`（東京）、ドメイン `action-gated.tech`

### ルーティング（固定する）

- Agent → Judgment のみ到達可能
- Judgment → Envoy → Tool の経路を固定
- **Judgment が Tool を直叩きできないようにする**（構造で強制）

---

## 6. 監査ログ設計

**共通キー：request_id**

| イベント | 内容 |
|---------|------|
| `AUTHZ_REQUEST` | action, context, agent_id, request_id |
| `AUTHZ_DECISION` | allow, reason, policy_id, request_id, jti, exp, scope |
| `EXEC_REQUEST` | request_id, jti, scope |
| `EXEC_RESULT` | request_id, status, latency, tool |
| `ENVOY_DENY` | request_id, reason（exp/invalid_aud/invalid_sig 等） |

---

## 7. インターフェース定義

### 7.1 POST /authorize（Judgment）

**Request**

```json
{
  "agent_id": "agent-1",
  "action": "get_resident_info",
  "context": {
    "purpose": "inquiry",
    "time": "business_hours",
    "data_sensitivity": "required"
  },
  "request_id": "uuid-..."
}
```

**Response（allow）**

```json
{
  "request_id": "uuid-...",
  "decision": "allow",
  "reason": "問い合わせ対応のため、営業時間内で必要最小限のPIIアクセス",
  "execution_handle": "<signed-jwt>",
  "expires_in_seconds": 60
}
```

**Response（deny）**

```json
{
  "request_id": "uuid-...",
  "decision": "deny",
  "reason": "問い合わせ目的では深夜の高感度PIIアクセスは正当化できない"
}
```

### 7.2 POST /execute（Judgment）

**Request**

```json
{
  "request_id": "uuid-...",
  "execution_handle": "<signed-jwt>",
  "parameters": {
    "resident_id": "R-0001"
  }
}
```

**Response（success）**

```json
{
  "request_id": "uuid-...",
  "status": "success",
  "result": {
    "resident_id": "R-0001",
    "name": "Taro Yamada",
    "address": "Tokyo",
    "note": "dummy"
  }
}
```

**Response（fail: invalid/expired/used）**

```json
{
  "request_id": "uuid-...",
  "status": "blocked",
  "reason": "execution_handle is expired or invalid"
}
```

---

## 8. execution_handle（JWT）仕様

### Header

```
alg: RS256（推奨）or HS256（PoCで簡略化可）
kid: 鍵ローテ用（余裕があれば）
```

### Claims（必須）

| Claim | 説明 |
|-------|------|
| `iss` | "judgment" |
| `aud` | "envoy-gateway" |
| `sub` | "agent-1" |
| `jti` | "uuid" |
| `exp` | UNIX time（**60秒**） |
| `iat` | UNIX time |
| `scope` | "execute:get_resident_info" |
| `req_id` | "uuid-..." |

### Claims（任意）

| Claim | 説明 |
|-------|------|
| `ctx_hash` | contextのハッシュ（Context改ざん論点を潰すなら） |

### JTI Store スキーマ（Firestore）

**Firestore TTL: ttl_atを基準に自動削除**

```json
{
  "jti": "uuid",
  "used_at": "2026-01-27T01:23:45Z",
  "expired_at": "2026-01-27T01:24:45Z",
  "ttl_at": "2026-01-27T01:33:45Z"
}
```

| フィールド | 説明 |
|-----------|------|
| `jti` | JWTのjtiクレーム（一意識別子） |
| `used_at` | 使用された日時（ISO 8601） |
| `expired_at` | JWTの有効期限（used_at + 60秒） |
| `ttl_at` | Firestore TTL用（used_at + 10分）|

### Firestore 操作例（Python）

**セットアップ**

```bash
pip install google-cloud-firestore
```

**初期化**

```python
from google.cloud import firestore
from datetime import datetime, timedelta, timezone

db = firestore.Client()
jti_collection = db.collection("jti_store")
```

**jti登録（使用済みとしてマーク）**

```python
def register_jti(jti: str, jwt_exp: datetime) -> bool:
    """jtiを登録。既に存在する場合はFalseを返す"""
    doc_ref = jti_collection.document(jti)

    # トランザクションで排他制御
    @firestore.transactional
    def create_if_not_exists(transaction):
        doc = doc_ref.get(transaction=transaction)
        if doc.exists:
            return False  # 既に使用済み

        now = datetime.now(timezone.utc)
        transaction.set(doc_ref, {
            "jti": jti,
            "used_at": now,
            "expired_at": jwt_exp,
            "ttl_at": now + timedelta(minutes=10)
        })
        return True

    transaction = db.transaction()
    return create_if_not_exists(transaction)
```

**jti確認（未使用かどうか）**

```python
def is_jti_unused(jti: str) -> bool:
    """jtiが未使用ならTrue"""
    doc = jti_collection.document(jti).get()
    return not doc.exists
```

**使用例（/execute内）**

```python
# JWT検証後
jti = decoded_jwt["jti"]
jwt_exp = datetime.fromtimestamp(decoded_jwt["exp"], tz=timezone.utc)

if not register_jti(jti, jwt_exp):
    return {"status": "blocked", "reason": "execution_handle already used"}

# Tool実行へ進む
```

**Firestore TTL設定（コンソールまたはgcloud）**

```bash
# TTLポリシーを設定（ttl_atフィールドを基準に自動削除）
gcloud firestore fields ttls update ttl_at \
  --collection-group=jti_store \
  --enable-ttl
```

---

## 9. スプリント例（実作業の順番）

### Day 1：/authorize + JWKS 完成

- OPA query → allow/deny + reason → logging
- execution_handle（JWT）発行（exp=60秒）
- JWKSエンドポイント `/.well-known/jwks.json` 実装

### Day 2：/execute + Firestore 完成

- JWT検証（署名/exp）
- Firestore JTI Store 設定（TTLポリシー含む）
- トランザクションによるone-time実行

### Day 3：Envoy Gateway 立ち上げ

- Cloud Run でEnvoy起動
- JWKSエンドポイント参照設定
- JWT検証（sig/exp/aud）+ Proxy経路

### Day 4：デモ固め

- Allow/Denyの2ケース
- 構造的強制力デモ（期限切れ / 二重実行 / 改ざん）

### Day 5：監査ログ整形 & 図/記事素材

- req_id串刺しが一目で分かるログ
- アーキ図・シーケンス図を揃える

---

## 10. スコープ外（やらないこと）

- ReBAC/FGA連携
- Tool側でのJWT検証（ブラックボックス前提）
- 高度な鍵管理/ローテ（PoCは最小）
- Agentの賢さ追求（PoCの勝ち筋は「構造」）
