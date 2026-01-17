import Link from "next/link"
import { getJudgment, getJudgments } from "@/lib/api"
import type { JudgmentSummary } from "@/lib/types"

export default function DashboardPage() {
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
  
  /**結果バッチコンポーネント */
  function ResultBadge({result}: {result: 'ALLOW' | 'DENY'}){
    const isAllow = result === 'ALLOW';
    return(
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
}
