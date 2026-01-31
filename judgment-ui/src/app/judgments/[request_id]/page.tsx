import Link from 'next/link';
import { JudgmentDetail, TraceStep } from '@/lib/types';

type Props = {
  params: Promise<{ request_id: string }>;
};

import { getJudgment } from "@/lib/api";

export default async function JudgmentDetailPage({ params }: Props) {
  const { request_id } = await params;

  let judgment: JudgmentDetail | null = null;
  let error: string | null = null;

  try {
    judgment = await getJudgment(request_id);
  } catch (e) {
    error = "Failed to fetch judgment details.";
  }

  if (error || !judgment) {
    return (
      <main className="p-8">
        <p className="text-red-600">Judgment not found: {request_id}</p>
        {error && <p className="text-sm text-gray-500 mt-2">{error}</p>}
        <Link href="/dashboard" className="text-blue-600 hover:underline mt-4 inline-block">
          Back to Judgment Map
        </Link>
      </main>
    )
  }

  const isAllow = judgment.decision.allow;

  return (
    <main className="p-8 max-w-4xl">
      {/* ナビゲーション */}
      <Link
        href="/dashboard"
        className="text-blue-600 hover:underline text-sm mb-4 inline-block"
      >
        Back to Judgment Map
      </Link>

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Judgment Detail</h1>
        <Link
          href="/graph"
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
        >
          View Statistics
        </Link>
      </div>

      {/* 1. Overview */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Overview</h2>
        <div className="bg-white border rounded-lg p-4 space-y-2 shadow-sm">
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <span className="text-gray-500 text-sm">Request ID</span>
            <code className="font-mono text-sm bg-gray-100 px-2 py-1 rounded w-fit">
              {judgment.request_id}
            </code>
          </div>
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <span className="text-gray-500 text-sm">Action</span>
            <code className="font-mono text-sm">{judgment.action}</code>
          </div>
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <span className="text-gray-500 text-sm">Result</span>
            <span
              className={`inline-flex px-3 py-1 text-sm font-bold rounded-full w-fit ${isAllow
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
                }`}
            >
              {isAllow ? 'ALLOW' : 'DENY'}
            </span>
          </div>
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <span className="text-gray-500 text-sm">Timestamp</span>
            <span className="text-sm">{new Date(judgment.created_at).toLocaleString('ja-JP')}</span>
          </div>
        </div>
      </section>

      {/* 2. Plan (Agent Proposal) */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Plan (Agent Proposal)</h2>
        <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs uppercase tracking-wider">Context JSON</span>
          </div>
          <pre className="text-sm font-mono overflow-auto">
            {JSON.stringify(judgment.context, null, 2)}
          </pre>
        </div>
      </section>

      {/* 3. Policy Decision (PDP) */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Policy Decision (PDP)</h2>
        <div
          className={`border-l-4 rounded-lg p-4 shadow-sm ${isAllow
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

      {/* 4. Enforcement (PEP) */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Enforcement (PEP)</h2>
        <div className="bg-white border rounded-lg p-4 space-y-3 shadow-sm">
          <EnforcementRow
            label="PDP Consulted"
            value={judgment.pep_enforcement.pdp_called}
            trueText="Yes"
            falseText="No"
          />
          <EnforcementRow
            label="Tool Called"
            value={judgment.pep_enforcement.tool_called}
            trueText="Yes"
            falseText="No"
            highlight={!judgment.pep_enforcement.tool_called && isAllow}
          // If Allowed but not called, that's weird. 
          // If Denied and not called, that's expected (no highlight).
          // Actually, logic: if Denied, tool_called should be false.
          />

          <div className="grid grid-cols-[200px_1fr] items-center gap-4">
            <span className="text-gray-600 text-sm">Side Effects</span>
            <span
              className={`font-bold text-sm ${judgment.pep_enforcement.side_effects === 'none'
                ? 'text-green-700'
                : 'text-yellow-700'
                }`}
            >
              {judgment.pep_enforcement.side_effects === 'none' ? 'NONE' : 'UNKNOWN'}
            </span>
          </div>
        </div>

        {/* DENY 時の強調表示 */}
        {!isAllow && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <div className="text-red-800 font-bold">
              Tool NOT CALLED
            </div>
            <div className="text-red-600 text-xs mt-1">
              Protected by Action-Gating
            </div>
          </div>
        )}
      </section>

      {/* 5. Tool Result (ALLOW時のみ) */}
      {isAllow && judgment.tool_result && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Tool Result</h2>
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 block mb-1">Status Code</span>
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                  {judgment.tool_result.status_code}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block mb-1">Latency</span>
                <span>
                  {judgment.tool_result.latency_ms.toFixed(2)} ms
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 6. Audit Trace */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Audit Trace</h2>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="space-y-4">
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
    <div className="grid grid-cols-[200px_1fr] items-center gap-4">
      <span className="text-gray-600 text-sm">{label}</span>
      <span
        className={`font-semibold text-sm w-fit px-2 py-0.5 rounded ${value
          ? 'text-green-700 bg-green-50'
          : highlight
            ? 'text-red-700 bg-red-100'
            : 'text-gray-500 bg-gray-100'
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
    skipped: 'bg-gray-300',
  };

  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center mt-1">
        <div className={`w-3 h-3 rounded-full ${statusColor[step.status]}`} />
        {/* Line connector could be added here if needed */}
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <div className="font-medium text-sm text-gray-900">{step.step}</div>
          <div className="text-xs text-gray-400">
            {new Date(step.at).toLocaleTimeString('ja-JP')}
          </div>
        </div>
        {step.note && (
          <div className="text-xs text-gray-500 mt-0.5">{step.note}</div>
        )}
      </div>
    </div>
  );
}
