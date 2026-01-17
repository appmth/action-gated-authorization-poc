# Next.js キャッチアップ & Judgment UI 実装ガイド

このガイドでは、Next.js（App Router）を学びながら Judgment UI を実装していきます。

---

## 運用ルール（重要）

### プロジェクト構造

```
action-gated-authorization-poc/
├── service-a/                 # Agent + PEP（FastAPI）
├── service-b/                 # PDP（OPA）
├── service-c/                 # Tool mock / sandbox
├── judgment-ui/               # ★Next.js（App Router）← ここで開発
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/           # BFF route handlers（/api/...）
│   │   │   ├── dashboard/
│   │   │   └── judgments/
│   │   ├── components/
│   │   └── lib/
│   ├── public/
│   ├── package.json           # ★UIの依存はここで管理
│   └── .env.local
├── docs/                      # 設計・手順
├── diagrams/
├── infra/
├── logs/
├── demo/
├── README.md
└── CLAUDE.md
```

### 依存管理のルール

1. **Node依存は `judgment-ui/node_modules` に閉じる**
   - `npm install` は必ず `judgment-ui/` ディレクトリで実行
   - ルートの `node_modules` は使わない

2. **ルートの `package.json` は使わない**
   - PoCでは余計な複雑性になる
   - UI関連のスクリプトは `judgment-ui/package.json` に記載

3. **既存の service-a/b/c は変更しない**
   - UIは独立したプロジェクトとして動作
   - API経由でのみ通信

---

## 前提知識の確認

### Next.js App Router とは？

Next.js 13以降で導入された新しいルーティングシステム。従来の `pages/` ディレクトリから `app/` ディレクトリに移行。

**主な特徴：**
- **Server Components**: デフォルトでサーバーサイドレンダリング
- **ファイルベースルーティング**: `app/dashboard/page.tsx` → `/dashboard`
- **レイアウト共有**: `layout.tsx` で共通UIを定義
- **Server Actions**: サーバーサイドの処理を直接呼び出し可能

---

## Phase 0: プロジェクト初期化（Next.js 基礎）

### Step 0-1: Next.js プロジェクト作成

```bash
# judgment-ui ディレクトリに移動
cd /Users/fumiyaishiguchi/git/action-gated-authorization-poc/judgment-ui

# 既存ディレクトリ内に Next.js プロジェクトを初期化
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

**選択肢の意味：**
- `.`: 現在のディレクトリに作成（新しいフォルダを作らない）
- `--typescript`: TypeScript を使用（型安全性）
- `--tailwind`: Tailwind CSS（ユーティリティファーストCSS）
- `--eslint`: コード品質チェック
- `--app`: App Router を使用
- `--src-dir`: `src/` ディレクトリ構成
- `--import-alias`: `@/` でインポート可能に

### Step 0-2: ディレクトリ構成を理解する

```
judgment-ui/
├── src/
│   ├── app/                    # App Router のルートディレクトリ
│   │   ├── layout.tsx          # 全ページ共通レイアウト
│   │   ├── page.tsx            # / ルートページ
│   │   ├── globals.css         # グローバルCSS
│   │   ├── api/                # BFF route handlers
│   │   ├── dashboard/          # /dashboard ルート
│   │   │   └── page.tsx
│   │   └── judgments/          # /judgments ルート
│   │       └── [request_id]/   # 動的ルート /judgments/{request_id}
│   │           └── page.tsx
│   ├── components/             # 再利用可能なコンポーネント
│   └── lib/                    # ユーティリティ、API クライアント
├── public/                     # 静的ファイル
├── package.json
├── .env.local                  # 環境変数（gitignore）
└── next.config.js
```

### Step 0-3: 環境変数を設定

```bash
# .env.local.example をコピー
cp .env.local.example .env.local
```

`.env.local` の内容：
```env
# Service-A (Agent + PEP) の URL
NEXT_PUBLIC_API_URL=http://localhost:8080
```

**学習ポイント：**
- `NEXT_PUBLIC_` プレフィックス: クライアントサイドでも使える環境変数
- プレフィックスなし: サーバーサイドのみ（API キーなど秘密情報向け）

### Step 0-4: ルーティングを作成

**`src/app/page.tsx`（ルートページ → ダッシュボードにリダイレクト）**

```tsx
// src/app/page.tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}
```

**学習ポイント：**
- `redirect()`: サーバーサイドリダイレクト（Next.js 組み込み）
- App Router では `useRouter` よりサーバーサイドの `redirect` を優先

**`src/app/dashboard/page.tsx`（ダッシュボード）**

```tsx
// src/app/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Judgment Dashboard</h1>
      <p className="text-gray-600">一覧がここに表示されます（Phase 1 で実装）</p>
    </main>
  );
}
```

**`src/app/judgments/[request_id]/page.tsx`（詳細ページ）**

```tsx
// src/app/judgments/[request_id]/page.tsx

// Next.js の動的ルートでは params を props として受け取る
type Props = {
  params: Promise<{ request_id: string }>;
};

export default async function JudgmentDetailPage({ params }: Props) {
  const { request_id } = await params;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Judgment Detail</h1>
      <p className="text-gray-600">Request ID: {request_id}</p>
      <p className="text-gray-600">詳細がここに表示されます（Phase 2 で実装）</p>
    </main>
  );
}
```

**学習ポイント：**
- `[request_id]`: 動的ルートセグメント
- `params.request_id`: URL パラメータへのアクセス
- Next.js 15 では `params` は Promise なので `await` が必要

### Step 0-5: 共通レイアウトを作成

**`src/app/layout.tsx`**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AGA Judgment UI',
  description: 'Action-Gated Authorization - Judgment Viewer',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        {/* ヘッダー */}
        <header className="bg-gray-900 text-white p-4">
          <nav className="container mx-auto flex items-center gap-6">
            <Link href="/dashboard" className="text-xl font-bold">
              AGA Judgment
            </Link>
            <Link href="/dashboard" className="hover:underline">
              Dashboard
            </Link>
          </nav>
        </header>

        {/* メインコンテンツ */}
        <div className="container mx-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
```

**学習ポイント：**
- `layout.tsx`: 子ルートすべてに適用される共通レイアウト
- `Link`: Next.js のクライアントサイドナビゲーション（プリフェッチあり）
- `metadata`: SEO 用のメタデータ（サーバーコンポーネント専用）

### Step 0-6: 動作確認

```bash
# judgment-ui ディレクトリで実行
cd /Users/fumiyaishiguchi/git/action-gated-authorization-poc/judgment-ui
npm run dev
```

- http://localhost:3000 → /dashboard にリダイレクト
- http://localhost:3000/dashboard → ダッシュボード表示
- http://localhost:3000/judgments/test-123 → 詳細ページ表示

---

## Phase 1: Dashboard 一覧画面

### Step 1-1: 型定義を作成

**`src/lib/types.ts`**

```tsx
// src/lib/types.ts

/** Judgment の一覧表示用 */
export type JudgmentSummary = {
  request_id: string;
  action: string;
  result: 'ALLOW' | 'DENY';
  reason_short: string;
  created_at: string;
};

/** Judgment の詳細 */
export type JudgmentDetail = {
  request_id: string;
  created_at: string;
  action: string;
  context: {
    purpose: string;
    time: string;
    data_sensitivity: string;
  };
  plan_raw?: string;
  decision: {
    allow: boolean;
    reason: string;
  };
  reason_short: string;
  policy_version?: string;
  rule_id?: string;
  pep_enforcement: {
    pdp_called: boolean;
    tool_called: boolean;
    side_effects: 'none' | 'unknown';
  };
  tool_result?: {
    status_code: number;
    latency_ms: number;
    data?: unknown;
  };
  trace: TraceStep[];
};

export type TraceStep = {
  step: string;
  at: string;
  status: 'completed' | 'blocked' | 'skipped';
  note?: string;
};
```

### Step 1-2: API クライアントを作成

**`src/lib/api.ts`**

```tsx
// src/lib/api.ts
import { JudgmentSummary, JudgmentDetail } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

/**
 * Judgment 一覧を取得
 *
 * 学習ポイント: Server Component から直接 fetch できる
 * - クライアントに API キーを露出させない
 * - キャッシュ戦略を細かく制御可能
 */
export async function getJudgments(): Promise<JudgmentSummary[]> {
  const res = await fetch(`${API_URL}/judgments`, {
    // Next.js の拡張 fetch オプション
    cache: 'no-store',  // 毎回最新を取得（リアルタイム性優先）
    // 'force-cache': キャッシュを使う（パフォーマンス優先）
    // next: { revalidate: 60 }: 60秒ごとに再検証
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch judgments: ${res.status}`);
  }

  return res.json();
}

/**
 * Judgment 詳細を取得
 */
export async function getJudgment(requestId: string): Promise<JudgmentDetail> {
  const res = await fetch(`${API_URL}/judgments/${requestId}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch judgment: ${res.status}`);
  }

  return res.json();
}
```

**学習ポイント：**
- Server Component では `fetch` が拡張されている
- `cache: 'no-store'` でリアルタイム性を確保
- エラーは throw することで Next.js の error boundary に任せる

### Step 1-3: ダッシュボードを実装

**`src/app/dashboard/page.tsx`**

```tsx
// src/app/dashboard/page.tsx
import Link from 'next/link';
import { getJudgments } from '@/lib/api';
import { JudgmentSummary } from '@/lib/types';

// Server Component（デフォルト）
// - async/await が使える
// - クライアントに JavaScript を送らない（軽量）
export default async function DashboardPage() {
  // PoC 初期段階: モックデータを使用
  // 後で getJudgments() に切り替え
  const judgments: JudgmentSummary[] = getMockJudgments();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Judgment Dashboard</h1>

      {/* フィルター（将来実装） */}
      <div className="mb-4 flex gap-4">
        <span className="text-sm text-gray-500">
          Showing {judgments.length} judgments
        </span>
      </div>

      {/* 一覧テーブル */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                Request ID
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                Action
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                Result
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                Reason
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                Time
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {judgments.map((judgment) => (
              <tr key={judgment.request_id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/judgments/${judgment.request_id}`}
                    className="text-blue-600 hover:underline font-mono text-sm"
                  >
                    {judgment.request_id.slice(0, 8)}...
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-sm">
                  {judgment.action}
                </td>
                <td className="px-4 py-3">
                  <ResultBadge result={judgment.result} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                  {judgment.reason_short}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {formatTime(judgment.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

/** 結果バッジコンポーネント */
function ResultBadge({ result }: { result: 'ALLOW' | 'DENY' }) {
  const isAllow = result === 'ALLOW';
  return (
    <span
      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
        isAllow
          ? 'bg-green-100 text-green-800'
          : 'bg-red-100 text-red-800'
      }`}
    >
      {result}
    </span>
  );
}

/** 時刻フォーマット */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** モックデータ（Phase 3 で API に切り替え） */
function getMockJudgments(): JudgmentSummary[] {
  return [
    {
      request_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      action: 'get_resident_info',
      result: 'DENY',
      reason_short: 'After-hours access requires emergency purpose',
      created_at: new Date().toISOString(),
    },
    {
      request_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      action: 'get_resident_info',
      result: 'ALLOW',
      reason_short: 'Emergency access granted',
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      request_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      action: 'get_resident_info',
      result: 'DENY',
      reason_short: 'Inquiry purpose not permitted after hours',
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
  ];
}
```

**学習ポイント：**
- `async function DashboardPage()`: Server Component はそのまま async/await が使える
- コンポーネント内で関数を定義可能（小さいコンポーネントは同じファイルに）
- Tailwind CSS: `className` にユーティリティクラスを並べるだけ

---

## Phase 2: Judgment Detail 詳細画面

### Step 2-1: 詳細ページを実装

**`src/app/judgments/[request_id]/page.tsx`**

```tsx
// src/app/judgments/[request_id]/page.tsx
import Link from 'next/link';
import { JudgmentDetail, TraceStep } from '@/lib/types';

type Props = {
  params: Promise<{ request_id: string }>;
};

export default async function JudgmentDetailPage({ params }: Props) {
  const { request_id } = await params;

  // PoC 初期段階: モックデータを使用
  const judgment = getMockJudgment(request_id);

  if (!judgment) {
    return (
      <main className="p-8">
        <p className="text-red-600">Judgment not found: {request_id}</p>
        <Link href="/dashboard" className="text-blue-600 hover:underline">
          Back to Dashboard
        </Link>
      </main>
    );
  }

  const isAllow = judgment.decision.allow;

  return (
    <main className="p-8 max-w-4xl">
      {/* ナビゲーション */}
      <Link
        href="/dashboard"
        className="text-blue-600 hover:underline text-sm mb-4 inline-block"
      >
        Back to Dashboard
      </Link>

      {/* 1. Overview */}
      <section className="mb-8">
        <h1 className="text-2xl font-bold mb-4">Judgment Detail</h1>
        <div className="bg-white border rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-4">
            <span className="text-gray-500 w-28">Request ID:</span>
            <code className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
              {judgment.request_id}
            </code>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-500 w-28">Action:</span>
            <code className="font-mono">{judgment.action}</code>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-500 w-28">Result:</span>
            <span
              className={`inline-flex px-3 py-1 text-sm font-bold rounded-full ${
                isAllow
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {isAllow ? 'ALLOW' : 'DENY'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-500 w-28">Timestamp:</span>
            <span>{new Date(judgment.created_at).toLocaleString('ja-JP')}</span>
          </div>
        </div>
      </section>

      {/* 2. Plan (Agent Proposal) */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Plan (Agent Proposal)</h2>
        <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs">Context JSON</span>
          </div>
          <pre className="text-sm font-mono">
            {JSON.stringify(judgment.context, null, 2)}
          </pre>
        </div>
      </section>

      {/* 3. Policy Decision (PDP) */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Policy Decision (PDP)</h2>
        <div
          className={`border-l-4 rounded-lg p-4 ${
            isAllow
              ? 'border-green-500 bg-green-50'
              : 'border-red-500 bg-red-50'
          }`}
        >
          <div className="font-bold text-lg mb-2">
            {isAllow ? 'ALLOWED' : 'DENIED'}
          </div>
          <div className="text-gray-700 mb-4">{judgment.decision.reason}</div>
          {judgment.policy_version && (
            <div className="text-sm text-gray-500">
              Policy Version: {judgment.policy_version}
            </div>
          )}
        </div>
      </section>

      {/* 4. Enforcement (PEP) - 最重要 */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Enforcement (PEP)</h2>
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <EnforcementRow
            label="PDP Consulted Before Execution"
            value={judgment.pep_enforcement.pdp_called}
            trueText="Yes - PDP was consulted"
            falseText="No - PDP was NOT consulted"
          />
          <EnforcementRow
            label="Tool Called"
            value={judgment.pep_enforcement.tool_called}
            trueText="Yes - Tool was executed"
            falseText="No - Tool was NOT called"
            highlight={!judgment.pep_enforcement.tool_called}
          />
          <div className="flex items-center gap-4">
            <span className="text-gray-600 w-48">Side Effects:</span>
            <span
              className={`font-bold ${
                judgment.pep_enforcement.side_effects === 'none'
                  ? 'text-green-700'
                  : 'text-yellow-700'
              }`}
            >
              {judgment.pep_enforcement.side_effects === 'none'
                ? 'NONE'
                : 'UNKNOWN'}
            </span>
          </div>
        </div>

        {/* DENY 時の強調表示 */}
        {!isAllow && (
          <div className="mt-4 bg-red-100 border border-red-300 rounded-lg p-4 text-center">
            <div className="text-red-800 font-bold text-lg">
              Tool NOT CALLED
            </div>
            <div className="text-red-700 text-sm">
              Side effects: NONE
            </div>
          </div>
        )}
      </section>

      {/* 5. Tool Result (ALLOW時のみ) */}
      {isAllow && judgment.tool_result && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Tool Result</h2>
          <div className="bg-white border rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Status Code:</span>
                <span className="ml-2 font-mono">
                  {judgment.tool_result.status_code}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Latency:</span>
                <span className="ml-2">
                  {judgment.tool_result.latency_ms.toFixed(2)} ms
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 6. Audit Trace */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Audit Trace</h2>
        <div className="bg-white border rounded-lg p-4">
          <div className="space-y-3">
            {judgment.trace.map((step, index) => (
              <TraceStepRow key={index} step={step} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

/** Enforcement の行コンポーネント */
function EnforcementRow({
  label,
  value,
  trueText,
  falseText,
  highlight = false,
}: {
  label: string;
  value: boolean;
  trueText: string;
  falseText: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-gray-600 w-48">{label}:</span>
      <span
        className={`font-semibold ${
          value
            ? 'text-green-700'
            : highlight
            ? 'text-red-700 bg-red-100 px-2 py-1 rounded'
            : 'text-red-700'
        }`}
      >
        {value ? trueText : falseText}
      </span>
    </div>
  );
}

/** Trace 行コンポーネント */
function TraceStepRow({ step }: { step: TraceStep }) {
  const statusColor = {
    completed: 'bg-green-500',
    blocked: 'bg-red-500',
    skipped: 'bg-gray-400',
  };

  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-3 h-3 rounded-full mt-1.5 ${statusColor[step.status]}`}
      />
      <div className="flex-1">
        <div className="font-medium">{step.step}</div>
        <div className="text-sm text-gray-500">
          {new Date(step.at).toLocaleTimeString('ja-JP')}
          {step.note && <span className="ml-2">- {step.note}</span>}
        </div>
      </div>
    </div>
  );
}

/** モックデータ */
function getMockJudgment(requestId: string): JudgmentDetail | null {
  const now = new Date();

  // DENY のモック
  if (requestId.startsWith('a') || requestId === 'deny-demo') {
    return {
      request_id: requestId,
      created_at: now.toISOString(),
      action: 'get_resident_info',
      context: {
        purpose: 'inquiry',
        time: 'after_hours',
        data_sensitivity: 'required',
      },
      decision: {
        allow: false,
        reason:
          'After-hours access with inquiry purpose is not permitted. Emergency or audit purpose is required for after-hours data access.',
      },
      reason_short: 'After-hours access requires emergency purpose',
      policy_version: '1.0.0',
      rule_id: 'after_hours_check',
      pep_enforcement: {
        pdp_called: true,
        tool_called: false,
        side_effects: 'none',
      },
      trace: [
        { step: 'Request Received', at: now.toISOString(), status: 'completed' },
        {
          step: 'PDP Consulted',
          at: new Date(now.getTime() + 50).toISOString(),
          status: 'completed',
          note: 'Policy evaluated',
        },
        {
          step: 'Decision: DENY',
          at: new Date(now.getTime() + 55).toISOString(),
          status: 'blocked',
          note: 'After-hours + inquiry',
        },
        {
          step: 'Tool Execution',
          at: new Date(now.getTime() + 56).toISOString(),
          status: 'skipped',
          note: 'Not called due to DENY',
        },
      ],
    };
  }

  // ALLOW のモック
  return {
    request_id: requestId,
    created_at: now.toISOString(),
    action: 'get_resident_info',
    context: {
      purpose: 'emergency',
      time: 'after_hours',
      data_sensitivity: 'required',
    },
    decision: {
      allow: true,
      reason: 'Emergency access is permitted regardless of time.',
    },
    reason_short: 'Emergency access granted',
    policy_version: '1.0.0',
    rule_id: 'emergency_override',
    pep_enforcement: {
      pdp_called: true,
      tool_called: true,
      side_effects: 'none',
    },
    tool_result: {
      status_code: 200,
      latency_ms: 45.23,
      data: { resident_info: 'dummy data' },
    },
    trace: [
      { step: 'Request Received', at: now.toISOString(), status: 'completed' },
      {
        step: 'PDP Consulted',
        at: new Date(now.getTime() + 50).toISOString(),
        status: 'completed',
        note: 'Policy evaluated',
      },
      {
        step: 'Decision: ALLOW',
        at: new Date(now.getTime() + 55).toISOString(),
        status: 'completed',
        note: 'Emergency override',
      },
      {
        step: 'Tool Execution',
        at: new Date(now.getTime() + 100).toISOString(),
        status: 'completed',
        note: 'Tool called successfully',
      },
    ],
  };
}
```

### Step 2-2: Client Component（コピーボタン）

インタラクティブな機能には Client Component が必要。

**`src/components/CopyButton.tsx`**

```tsx
// src/components/CopyButton.tsx
'use client';  // ← これが Client Component の宣言

import { useState } from 'react';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}
```

**学習ポイント：**
- `'use client'`: このファイルを Client Component として宣言
- Client Component でのみ `useState`, `useEffect`, イベントハンドラが使える
- Server Component から Client Component を import して使える（逆は不可）

---

## Phase 3: service-a に Judgment API を追加

### Step 3-1: インメモリストアの追加

**`service-a/main.py` に追加**

```python
# service-a/main.py に追加する部分

from datetime import datetime
from collections import deque

# インメモリストア（最新100件を保持）
judgment_store: deque[dict] = deque(maxlen=100)


def store_judgment(
    request_id: str,
    action: str,
    context: dict,
    decision: dict,
    pep_enforcement: dict,
    tool_result: dict | None = None,
    trace: list[dict] | None = None,
):
    """Judgment をインメモリに保存"""
    judgment = {
        "request_id": request_id,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "action": action,
        "context": context,
        "decision": decision,
        "reason_short": decision.get("reason", "")[:80],
        "policy_version": "1.0.0",  # PoC では固定
        "pep_enforcement": pep_enforcement,
        "tool_result": tool_result,
        "trace": trace or [],
    }
    judgment_store.appendleft(judgment)
    return judgment


# 一覧取得 API
@app.get("/judgments")
def list_judgments(limit: int = 20):
    """Judgment 一覧を取得"""
    items = list(judgment_store)[:limit]
    return [
        {
            "request_id": j["request_id"],
            "action": j["action"],
            "result": "ALLOW" if j["decision"]["allow"] else "DENY",
            "reason_short": j["reason_short"],
            "created_at": j["created_at"],
        }
        for j in items
    ]


# 詳細取得 API
@app.get("/judgments/{request_id}")
def get_judgment(request_id: str):
    """Judgment 詳細を取得"""
    for j in judgment_store:
        if j["request_id"] == request_id:
            return j
    raise HTTPException(status_code=404, detail="Judgment not found")
```

### Step 3-2: 既存エンドポイントで store_judgment を呼び出す

`get_resident_info` と `plan_and_act` の最後で `store_judgment()` を呼び出すように修正。

```python
# get_resident_info の最後（return の前）に追加
trace = [
    {"step": "Request Received", "at": start_time_iso, "status": "completed"},
    {"step": "PDP Consulted", "at": pdp_time_iso, "status": "completed"},
    {"step": f"Decision: {'ALLOW' if decision.allow else 'DENY'}",
     "at": decision_time_iso, "status": "completed" if decision.allow else "blocked"},
]
if decision.allow:
    trace.append({
        "step": "Tool Execution",
        "at": tool_time_iso,
        "status": "completed" if tool_result.ok else "blocked"
    })
else:
    trace.append({
        "step": "Tool Execution",
        "at": decision_time_iso,
        "status": "skipped",
        "note": "Not called due to DENY"
    })

store_judgment(
    request_id=request_id,
    action=action,
    context=context,
    decision={"allow": decision.allow, "reason": decision.reason},
    pep_enforcement={
        "pdp_called": True,
        "tool_called": decision.allow,
        "side_effects": "none" if not decision.allow else "unknown",
    },
    tool_result={
        "status_code": tool_result.status_code,
        "latency_ms": tool_result.latency_ms,
    } if decision.allow and tool_result else None,
    trace=trace,
)
```

---

## Phase 4: 接続と動作確認

### Step 4-1: CORS 設定（service-a）

```python
# service-a/main.py に追加
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Step 4-2: API からデータ取得に切り替え

**`src/app/dashboard/page.tsx`**

```tsx
// モックを使う行を削除し、以下に変更
import { getJudgments } from '@/lib/api';

export default async function DashboardPage() {
  const judgments = await getJudgments();
  // ... 残りは同じ
}
```

### Step 4-3: デモ用 URL

- DENY デモ: `/judgments/deny-demo`
- ALLOW デモ: `/judgments/allow-demo`

---

## 次のステップ（Nice-to-have）

1. **Policy Viewer**: Rego ファイルを読み取り専用で表示
2. **フィルタ機能**: result (ALLOW/DENY) でフィルタ
3. **自動更新**: WebSocket または Polling で一覧を更新
4. **Firestore 移行**: インメモリ → Firestore で永続化

---

## チートシート

### Next.js App Router の基本ファイル

| ファイル | 役割 |
|---------|------|
| `page.tsx` | ルートのメインコンテンツ |
| `layout.tsx` | 共通レイアウト（ネスト可） |
| `loading.tsx` | ローディング UI |
| `error.tsx` | エラー UI |
| `not-found.tsx` | 404 ページ |

### Server vs Client Component

| | Server Component | Client Component |
|---|---|---|
| 宣言 | デフォルト | `'use client'` |
| async/await | ○ | × |
| useState/useEffect | × | ○ |
| イベントハンドラ | × | ○ |
| fetch | 拡張版が使える | 通常の fetch |

### Tailwind CSS よく使うクラス

```
// レイアウト
p-4, px-4, py-2     // padding
m-4, mx-auto        // margin
flex, grid          // display
gap-4               // gap
w-full, max-w-4xl   // width

// テキスト
text-sm, text-xl    // サイズ
font-bold           // 太さ
text-gray-600       // 色

// 背景・ボーダー
bg-white, bg-gray-100
border, rounded-lg
```

### 開発コマンド

```bash
# judgment-ui ディレクトリで実行
cd judgment-ui

# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 本番モード起動
npm start

# リント
npm run lint
```
