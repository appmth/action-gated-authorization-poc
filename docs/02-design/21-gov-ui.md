# Gov-UI (行政問い合わせシステム) 設計書

Gov-UI は、AI Agent が行政サービスの問い合わせに対応するデモ用フロントエンドです。2段階認可フロー（Authorize → Execute）を UI 上で体験・可視化できます。

## 1. 役割

- **デモ体験**: 住民問い合わせに対して AI Agent が認可を経てツールを実行する流れを、審査員やステークホルダーが画面上で確認できます。
- **AGA 構造の可視化**: 「認可判定（Authorize）」と「ツール実行（Execute）」の2段階が分離されていることを、ステップインジケータで明示します。
- **制御不可の明示**: Agent 内部の判断やデータアクセスの詳細は Gov-UI からは見えない点を注記し、Judgment UI（監査ダッシュボード）との役割分担を示します。

## 2. 画面構成

### A. 問い合わせ対応 (`/inquiry`)

2段階認可フローを実行する画面です。

#### 処理フロー

1. 「問い合わせを処理」ボタンをクリック
2. **Step 1 (Authorize)**: `POST /authorize` で PDP にポリシー判定を問い合わせ
   - 許可（Allow）の場合 → Step 2 に進行
   - 拒否（Deny）の場合 → 理由を表示して終了
3. **Step 2 (Execute)**: `POST /execute` で Envoy Gateway 経由のツール実行
   - 成功（Success）→ 回答案を表示
   - ブロック / 失敗 → 理由を表示

#### UI 要素

| 要素 | 説明 |
| :--- | :--- |
| 問い合わせ表示エリア | 住民からの質問（固定テキスト） |
| ステップインジケータ | Step 1 / Step 2 の進行状態を番号バッジで表示 |
| AI Agent 回答案 | 成功時はモック回答、拒否/ブロック時は理由を表示 |
| Request ID | トレーサビリティ用の一意識別子 |

### B. 住民データ閲覧 (`/residents`)

静的な住民データ表示画面です。API 連携はありません。
AI Agent が問い合わせ対応時にアクセス可能なデータ範囲を示し、Judgment（認可制御）がない場合のリスクを視覚的に伝えます。

## 3. 連携インターフェース

`service-a` (Judgment サービス) の以下のエンドポイントを呼び出します。

### POST `/authorize` (Phase 1)

```json
// リクエスト
{
  "agent_id": "gov-ui-agent",
  "agent_role": "assistant",
  "action": "get_resident_info",
  "context": {
    "purpose": "inquiry",
    "time": "business_hours",
    "data_sensitivity": "required"
  }
}

// レスポンス (Allow)
{
  "request_id": "uuid",
  "decision": "allow",
  "reason": "...",
  "execution_handle": "JWT...",
  "expires_in_seconds": 60
}

// レスポンス (Deny)
{
  "request_id": "uuid",
  "decision": "deny",
  "reason": "...",
  "execution_handle": null,
  "expires_in_seconds": null
}
```

> [!NOTE]
> `agent_role` フィールドが追加されました（STEP2）。Judgment UI の表示に使用されます。PDP の判定には影響しません。

### POST `/execute` (Phase 2)

```json
// リクエスト
{
  "request_id": "uuid",
  "execution_handle": "JWT...",
  "tool_request": {
    "method": "POST",
    "path": "/resident-info",
    "body": {}
  }
}

// レスポンス (Success)
{
  "request_id": "uuid",
  "status": "success",
  "result": { ... },
  "reason": null
}

// レスポンス (Blocked/Failed)
{
  "request_id": "uuid",
  "status": "blocked",
  "result": null,
  "reason": "expired"
}
```

## 4. 技術スタック

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **API 通信**: Client-side Fetch API (`"use client"`)

## 5. 環境変数

| 変数名 | デフォルト値 | 用途 |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | service-a の接続先 URL |

| 環境 | 値 |
|---|---|
| ローカル開発 | `http://localhost:8080` |
| GCP 本番 | `https://service-a.action-gated.tech` |

## 6. AGA 証明項目との対応

| 証明項目 | Gov-UI での体験 |
| :--- | :--- |
| Context で Allow/Deny が変わる | 同じ Action でも Context（purpose, time 等）によって Step 1 の結果が変化 |
| PEP は実行前に判断を強制する | Step 1 で Deny の場合、Step 2 に進行しない（ツール未実行） |
| 判断理由が説明可能な形で残る | Step 1 の reason が画面に表示される |

## 7. デモシナリオとの連携

### データフロー

Gov-UI からの操作は、service-a を経由して Judgment UI に反映されます。

```
[Gov-UI]                    [service-a]              [Judgment UI]
    │                           │                        │
    │ POST /authorize           │                        │
    │ (agent_role, context)     │                        │
    │ ────────────────────────> │                        │
    │                           │ judgment_store に保存   │
    │ <──────────── allow/deny  │                        │
    │                           │                        │
    │                           │  GET /judgments         │
    │                           │ <───────────────────── │
    │                           │ ──────────────────────>│
    │                           │  判定履歴を表示         │
```

**デモの流れ**:
1. Gov-UI の `/inquiry` で「問い合わせを処理」をクリック
2. service-a が判定結果を `judgment_store` に保存
3. Judgment UI の `/map` をリロードすると、新しい判定レコードが表示される

### Context の2パターン（Allow / Deny）

デモでは以下の2パターンの Context で Allow / Deny が変わることを示します。

#### Allow パターン

```json
{
  "agent_id": "gov-ui-agent",
  "agent_role": "assistant",
  "action": "get_resident_info",
  "context": {
    "purpose": "inquiry",
    "time": "business_hours",
    "data_sensitivity": "required"
  }
}
```

- **結果**: Allow
- **理由**: 「Allowed: inquiry during business hours」
- **Rego 条件**: `action == "get_resident_info"` AND `purpose == "inquiry"` AND `time == "business_hours"`

#### Deny パターン

```json
{
  "agent_id": "gov-ui-agent",
  "agent_role": "assistant",
  "action": "get_resident_info",
  "context": {
    "purpose": "audit",
    "time": "after_hours",
    "data_sensitivity": "required"
  }
}
```

- **結果**: Deny
- **理由**: 「Denied: purpose must be 'inquiry'」
- **Rego 条件**: `purpose != "inquiry"` のため deny

### Gov-UI のコード変更（STEP2）

現在の `/inquiry` 画面は Allow パターンの Context がハードコードされています。デモで Deny パターンを見せる方法:

1. **コード変更**: `inquiry/page.tsx` の context を一時的に書き換える
2. **curl で直接呼び出し**: `scripts/inject-demo-scenario.sh` で Deny パターンを投入

PoC では方法2（curl スクリプト）を推奨します。Gov-UI の画面変更は行いません。

## 8. Dockerfile / Cloud Run デプロイ

### Dockerfile 仕様

judgment-ui と同一構成（Next.js standalone output の multi-stage build）。

```dockerfile
# --- Stage 1: Dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Stage 2: Build ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# --- Stage 3: Production ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

### next.config.ts の変更

`output: 'standalone'` を追加する必要がある:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

### Cloud Run 設定

| 項目 | 値 |
|---|---|
| ポート | 3000 |
| メモリ | 512Mi |
| CPU | 1 |
| 最小インスタンス | 0 |
| ビルド引数 | `NEXT_PUBLIC_API_URL=https://service-a.action-gated.tech` |

### デプロイコマンド

```bash
./scripts/deploy.sh prod gov-ui
```
