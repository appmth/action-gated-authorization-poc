"use client";

import { useState } from "react";

type AgentResponse = {
  request_id: string;
  action: string;
  allowed: boolean;
  reason: string;
  data?: {
    resident_name: string;
    address: string;
    garbage_day: string;
  };
};

export default function InquiryPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    setIsProcessing(true);
    setResponse(null);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      const res = await fetch(`${apiUrl}/v1/actions/get_resident_info`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          context: {
            purpose: "inquiry",
            time: "business_hours",
            data_sensitivity: "required",
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setResponse({
          request_id: errorData.detail?.request_id || "unknown",
          action: errorData.detail?.action || "get_resident_info",
          allowed: false,
          reason: errorData.detail?.reason || "リクエストが拒否されました",
        });
      } else {
        const data = await res.json();
        setResponse(data);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "通信エラーが発生しました"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          問い合わせ対応
        </h2>
        <p className="text-gray-600">
          住民からの問い合わせに AI Agent が自動で回答します
        </p>
      </div>

      {/* 問い合わせ表示エリア */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 mb-3">
          住民からの問い合わせ
        </h3>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <p className="text-gray-800">
            「○○町のゴミ収集日はいつですか？」
          </p>
        </div>
      </div>

      {/* AI Agent ステータス表示 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 mb-3">
          AI Agent ステータス
        </h3>

        {!isProcessing && !response && !error && (
          <div className="text-gray-500">待機中...</div>
        )}

        {isProcessing && (
          <div className="flex items-center gap-3 text-blue-600">
            <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            <span>AI Agent が回答案を生成しています...</span>
          </div>
        )}

        {response && (
          <div
            className={`px-3 py-1 rounded-full text-sm inline-flex items-center gap-2 ${
              response.allowed
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                response.allowed ? "bg-green-500" : "bg-red-500"
              }`}
            ></span>
            {response.allowed ? "処理完了" : "処理拒否"}
          </div>
        )}

        {error && (
          <div className="text-red-600">
            エラー: {error}
          </div>
        )}

        <button
          onClick={handleProcess}
          disabled={isProcessing}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? "処理中..." : "問い合わせを処理"}
        </button>
      </div>

      {/* AI Agent 回答案表示 */}
      {response && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            AI Agent 回答案
          </h3>

          {response.allowed && response.data ? (
            <div className="bg-green-50 border border-green-100 rounded-lg p-4">
              <p className="text-gray-800">
                ○○町のゴミ収集日は毎週火曜日です。
                <br />
                粗大ゴミは第2・第4水曜日に収集しています。
              </p>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-100 rounded-lg p-4">
              <p className="text-red-700">{response.reason}</p>
            </div>
          )}

          <div className="mt-4 text-xs text-gray-400">
            Request ID: {response.request_id}
          </div>
        </div>
      )}

      {/* 制御不可の明示 */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-amber-800 text-sm">
          ※ AI Agent の内部判断やデータアクセス内容は確認できません
        </p>
      </div>
    </div>
  );
}
