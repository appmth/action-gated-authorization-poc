import { getLegacyLogs } from "@/lib/api";

export default function LegacyLogsPage() {
  const logs = getLegacyLogs();

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-2xl font-bold mb-1 text-gray-700">Execution Log</h1>
      <p className="text-sm text-gray-400 mb-6">
        Tool execution history
      </p>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Tool
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log, i) => (
              <tr key={i}>
                <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                  {log.time}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                  {log.tool}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {log.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
