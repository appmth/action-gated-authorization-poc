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

本番環境では `https://service-a.action-gated.tech` を設定します。

## 6. AGA 証明項目との対応

| 証明項目 | Gov-UI での体験 |
| :--- | :--- |
| Context で Allow/Deny が変わる | 同じ Action でも Context（purpose, time 等）によって Step 1 の結果が変化 |
| PEP は実行前に判断を強制する | Step 1 で Deny の場合、Step 2 に進行しない（ツール未実行） |
| 判断理由が説明可能な形で残る | Step 1 の reason が画面に表示される |
