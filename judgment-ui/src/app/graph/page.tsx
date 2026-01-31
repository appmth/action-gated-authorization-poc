import Link from "next/link";
import { getDecisionDistribution, getAgentDenyRate } from "@/lib/api";

type DecisionDist = {
    allow_count: number;
    deny_count: number;
    allow_percentage: number;
    deny_percentage: number;
};
type AgentRate = {
    agent_role: string;
    deny_rate: number;
    total_requests: number;
};

export default async function GraphPage() {
    let dist: DecisionDist | null = null;
    let rates: AgentRate[] = [];

    try {
        dist = await getDecisionDistribution();
        rates = await getAgentDenyRate();
    } catch (e) {
        console.error("Failed to fetch metrics", e);
    }

    // Fallback if empty or failed
    if (!dist) dist = { allow_count: 0, deny_count: 0, allow_percentage: 0, deny_percentage: 0 };

    return (
        <div>
            <h1 className="text-2xl font-bold mb-2">Judgment Graph</h1>
            <p className="text-gray-500 mb-6">Last 24 hours statistics.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Decision Distribution */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <h2 className="text-lg font-semibold mb-6 text-gray-800">Decision Distribution</h2>

                    {dist.allow_count + dist.deny_count === 0 ? (
                        <div className="text-center text-gray-400 py-10">No data available</div>
                    ) : (
                        <div className="flex items-center justify-center gap-8">
                            {/* Simple CSS Pie Chart using Conic Gradient */}
                            <div
                                className="w-48 h-48 rounded-full shadow-inner"
                                style={{
                                    background: `conic-gradient(#dcfce7 0% ${dist.allow_percentage}%, #fee2e2 ${dist.allow_percentage}% 100%)`
                                }}
                            ></div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 bg-green-100 rounded"></div>
                                    <div>
                                        <div className="text-sm font-medium text-gray-900">ALLOW</div>
                                        <div className="text-xs text-gray-500">{dist.allow_percentage}%</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 bg-red-100 rounded"></div>
                                    <div>
                                        <div className="text-sm font-medium text-gray-900">DENY</div>
                                        <div className="text-xs text-gray-500">{dist.deny_percentage}%</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <p className="text-center text-xs text-gray-400 mt-6">Based on {dist.allow_count + dist.deny_count} judgments</p>
                </div>

                {/* Agent-wise Deny Rate */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <h2 className="text-lg font-semibold mb-6 text-gray-800">Agent-wise Deny Rate</h2>

                    <div className="space-y-6">
                        {rates.map(r => (
                            <AgentBar
                                key={r.agent_role}
                                label={r.agent_role}
                                percentage={r.deny_rate}
                                color={r.deny_rate > 30 ? "bg-red-500" : "bg-orange-400"}
                            />
                        ))}
                        {rates.length === 0 && <div className="text-center text-gray-400">No agent data</div>}
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-6">Higher rate indicates more blocked actions</p>
                </div>

            </div>

            <div className="mt-8 text-center">
                <Link href="/dashboard" className="text-blue-600 hover:underline text-sm">
                    Back to Judgment Map
                </Link>
            </div>
        </div>
    );
}

function AgentBar({ label, percentage, color }: { label: string; percentage: number; color: string }) {
    return (
        <div>
            <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{label}</span>
                <span className="text-sm font-medium text-gray-700">{percentage}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                    className={`${color} h-2.5 rounded-full`}
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    )
}
