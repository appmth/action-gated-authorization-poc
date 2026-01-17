import Link from "next/link"
import { getJudgments } from "@/lib/api"
import type { JudgmentSummary } from "@/lib/types"

export default async function DashboardPage() {
    // API から Judgment 一覧を取得
    let judgments: JudgmentSummary[] = [];
    let error: string | null = null;

    try {
        judgments = await getJudgments();
    } catch (e) {
        error = e instanceof Error ? e.message : "Failed to fetch judgments";
    }

  // エラー時の表示
  if (error) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold mb-6">Judgment Dashboard</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            API に接続できません: {error}
          </p>
          <p className="text-sm text-yellow-600 mt-2">
            service-a が起動しているか確認してください（port 8080）
          </p>
        </div>
      </main>
    );
  }

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

}
