"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useJudgmentDetail } from "@/lib/hooks";

export default function JudgmentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: judgment, isLoading } = useJudgmentDetail(id);

  if (!isLoading && !judgment) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <p className="text-red-600">Judgment not found: {id}</p>
        <Link
          href="/activity"
          className="text-blue-600 hover:underline mt-4 inline-block"
        >
          Back to Activity Log
        </Link>
      </div>
    );
  }

  const isDeny = judgment?.decision === "DENY";

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl">
      <Link
        href="/activity"
        className="text-blue-600 hover:underline text-sm mb-4 inline-block"
      >
        &larr; Back to Activity Log
      </Link>

      <h1 className="text-2xl font-bold mb-6">Judgment Detail</h1>

      {/* Overview */}
      <section className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : judgment ? (
          <dl className="space-y-3">
            <Row label="Decision">
              <span
                className={`inline-flex px-3 py-1 text-sm font-bold rounded-full ${
                  isDeny
                    ? "bg-red-100 text-red-800"
                    : "bg-green-100 text-green-800"
                }`}
              >
                {judgment.decision}
              </span>
            </Row>
            <Row label="Agent Role">{judgment.agent_role}</Row>
            <Row label="Agent ID">
              <code className="font-mono text-sm bg-gray-100 px-2 py-0.5 rounded">
                {judgment.agent_id}
              </code>
            </Row>
            <Row label="Tool">
              <code className="font-mono text-sm">{judgment.tool}</code>
            </Row>
            <Row label="Action">
              <code className="font-mono text-sm">{judgment.action}</code>
            </Row>
            <Row label="Timestamp">{formatTimestamp(judgment.ts)}</Row>
          </dl>
        ) : null}
      </section>

      {/* Reason */}
      <section className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Reason
        </h2>
        {isLoading ? (
          <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
        ) : judgment ? (
          <p className="text-gray-800 leading-relaxed">{judgment.reason}</p>
        ) : null}
      </section>

      {/* Policy */}
      <section className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Policy
        </h2>
        {isLoading ? (
          <div className="space-y-2">
            <div className="flex gap-4">
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="flex gap-4">
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
              <div className="flex gap-1.5">
                <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
                <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ) : judgment ? (
          <dl className="space-y-2">
            <Row label="policy_id">
              <code className="font-mono text-sm">{judgment.policy_id}</code>
            </Row>
            <Row label="tags">
              <div className="flex gap-1.5 flex-wrap">
                {judgment.policy_tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Row>
          </dl>
        ) : null}
      </section>

      {/* Context */}
      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Context (sanitized)
        </h2>
        {isLoading ? (
          <div className="bg-gray-50 border border-gray-200 rounded p-4">
            <div className="space-y-2">
              <div className="h-3 w-48 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-40 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-44 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        ) : judgment ? (
          <pre className="bg-gray-50 border border-gray-200 rounded p-4 text-sm font-mono text-gray-800 overflow-x-auto">
            {JSON.stringify(judgment.context, null, 2)}
          </pre>
        ) : null}
      </section>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
      <dt className="text-gray-500 text-sm sm:w-28 sm:shrink-0">{label}</dt>
      <dd className="text-gray-800">{children}</dd>
    </div>
  );
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
