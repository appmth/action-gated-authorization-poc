import Link from "next/link";
import { getJudgments } from "@/lib/api";
import { JudgmentSummary } from "@/lib/types";

export default async function DashboardPage() {
  // Fetch real data
  let judgments: JudgmentSummary[] = [];
  let error: string | null = null;

  try {
    judgments = await getJudgments();
  } catch (e) {
    console.error(e);
    error = "Failed to fetch judgments. Please ensure service-a is running.";
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-2xl font-bold">Judgment Map</h1>
          <p className="text-gray-500 mb-6">判断の履歴。実行結果は扱わない。</p>
        </div>
        {error && <span className="text-red-500 text-sm bg-red-50 px-3 py-1 rounded">{error}</span>}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tool</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Decision</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {judgments.map((item) => (
              <tr
                key={item.request_id}
                className="hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                  {new Date(item.created_at).toLocaleTimeString('ja-JP')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {/* Agent Role is not currently in JudgmentSummary, assuming context has it or we mock it for now until Step 3 */}
                    assistant
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                  {/* Tool name is not explicit in summary, maybe action prefix? */}
                  benefit
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                  {item.action}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link href={`/judgments/${item.request_id}`} className="block w-full h-full">
                    <span className={`inline-flex px-2 text-xs font-semibold leading-5 rounded-full ${item.result === 'ALLOW' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                      {item.result}
                    </span>
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.reason_short}
                </td>
              </tr>
            ))}
            {judgments.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  No judgments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


