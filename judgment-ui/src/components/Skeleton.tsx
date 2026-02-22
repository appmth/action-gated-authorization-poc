"use client";

export function SkeletonKPICards() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white border border-gray-200 rounded-lg p-4 h-[80px] flex flex-col justify-center"
        >
          <div className="h-3 w-16 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-6 w-12 bg-gray-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonAgentTiles() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="border border-gray-200 rounded-lg p-4 min-w-[270px] bg-white"
        >
          <div className="flex flex-col gap-2">
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="flex gap-2">
              <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
              <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-5 w-14 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTableRows({ rows = 5 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tbody key={i}>
          <tr className="border-t border-gray-200">
            <td className="px-4 py-3">
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
            </td>
            <td className="px-4 py-3">
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
            </td>
            <td className="px-4 py-3">
              <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
            </td>
            <td className="px-4 py-3">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            </td>
            <td className="px-4 py-3">
              <div className="h-5 w-14 bg-gray-200 rounded-full animate-pulse" />
            </td>
          </tr>
          <tr>
            <td colSpan={5} className="px-4 pb-3 pt-0">
              <div className="h-3 w-48 bg-gray-200 rounded animate-pulse" />
            </td>
          </tr>
        </tbody>
      ))}
    </>
  );
}

export function SkeletonMetricCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="h-4 w-40 bg-gray-200 rounded animate-pulse mb-6" />
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <div className="flex justify-between mb-1">
              <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-10 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="h-4 w-full bg-gray-200 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonSystemStatus() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white border border-gray-200 rounded-lg p-4"
        >
          <div className="h-3 w-20 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-7 w-10 bg-gray-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonHeatmap() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="h-4 w-40 bg-gray-200 rounded animate-pulse mb-4" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-2 items-center">
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse flex-shrink-0" />
            <div className="flex gap-1 flex-1">
              {Array.from({ length: 12 }).map((_, j) => (
                <div
                  key={j}
                  className="h-6 w-6 bg-gray-200 rounded-sm animate-pulse"
                />
              ))}
            </div>
            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
