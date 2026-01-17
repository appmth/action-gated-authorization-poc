import Link from 'next/link';
import { getJudgment } from '@/lib/api';
import { JudgmentDetail, TraceStep } from '@/lib/types';

type Props = {
    params: Promise<{ request_id: string }>;
};

export default async function JudgmentDetailPage({ params }: Props) {
  const { request_id } = await params;

  // API から Judgment 詳細を取得
  let judgment: JudgmentDetail | null = null;
  let error: string | null = null;

  try {
    judgment = await getJudgment(request_id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to fetch judgment";
  }

  if (error || !judgment) {
    return (
      <main className="p-8">
        <p className="text-red-600">Judgment not found: {request_id}</p>
        {error && (
          <p className="text-sm text-gray-500 mt-2">{error}</p>
        )}
        <Link href="/dashboard" className="text-blue-600 hover:underline mt-4 inline-block">
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

