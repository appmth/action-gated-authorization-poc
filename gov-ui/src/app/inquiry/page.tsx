"use client";

import { useState } from "react";

type AuthorizeResponse = {
  request_id: string;
  decision: "allow" | "deny";
  reason: string;
  execution_handle: string | null;
  expires_in_seconds: number | null;
};

type ExecuteResponse = {
  request_id: string;
  status: "success" | "blocked" | "failed";
  result: Record<string, unknown> | null;
  reason: string | null;
};

type ProcessStep = "idle" | "authorizing" | "authorized" | "executing" | "done";

export default function InquiryPage() {
  const [step, setStep] = useState<ProcessStep>("idle");
  const [authResponse, setAuthResponse] = useState<AuthorizeResponse | null>(null);
  const [execResponse, setExecResponse] = useState<ExecuteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    setStep("authorizing");
    setAuthResponse(null);
    setExecResponse(null);
    setError(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

    try {
      // Step 1: /authorize
      const authRes = await fetch(`${apiUrl}/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "gov-ui-agent",
          action: "get_resident_info",
          context: {
            purpose: "inquiry",
            time: "business_hours",
            data_sensitivity: "required",
          },
        }),
      });

      const authData: AuthorizeResponse = await authRes.json();
      setAuthResponse(authData);

      if (authData.decision === "deny" || !authData.execution_handle) {
        setStep("done");
        return;
      }

      setStep("executing");

      // Step 2: /execute
      const execRes = await fetch(`${apiUrl}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: authData.request_id,
          execution_handle: authData.execution_handle,
          tool_request: {
            method: "POST",
            path: "/resident-info",
            body: {
              request_id: authData.request_id,
              action: "get_resident_info",
              context: {},
            },
          },
        }),
      });

      const execData: ExecuteResponse = await execRes.json();
      setExecResponse(execData);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "通信エラーが発生しました");
      setStep("done");
    }
  };

  const isProcessing = step === "authorizing" || step === "executing";

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

      {/* 2段階認可ステップ表示 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 mb-4">
          AI Agent 処理ステップ
        </h3>

        <div className="space-y-4">
          {/* Step 1: 認可判定 */}
          <div className="flex items-start gap-3">
            <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === "idle"
                ? "bg-gray-200 text-gray-500"
                : step === "authorizing"
                  ? "bg-blue-500 text-white"
                  : authResponse?.decision === "allow"
                    ? "bg-green-500 text-white"
                    : "bg-red-500 text-white"
            }`}>
              1
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-700">認可判定 (Authorize)</div>
              {step === "authorizing" && (
                <div className="flex items-center gap-2 mt-1 text-blue-600 text-sm">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  PDP にポリシー判定を問い合わせ中...
                </div>
              )}
              {authResponse && (
                <div className="mt-1">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    authResponse.decision === "allow"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      authResponse.decision === "allow" ? "bg-green-500" : "bg-red-500"
                    }`}></span>
                    {authResponse.decision === "allow" ? "許可" : "拒否"}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">{authResponse.reason}</p>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: ツール実行 */}
          <div className="flex items-start gap-3">
            <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === "idle" || step === "authorizing" || (step === "done" && authResponse?.decision === "deny")
                ? "bg-gray-200 text-gray-500"
                : step === "executing"
                  ? "bg-blue-500 text-white"
                  : execResponse?.status === "success"
                    ? "bg-green-500 text-white"
                    : "bg-red-500 text-white"
            }`}>
              2
            </div>
            <div className="flex-1">
              <div className={`text-sm font-medium ${
                step === "idle" || step === "authorizing" || (step === "done" && authResponse?.decision === "deny")
                  ? "text-gray-400"
                  : "text-gray-700"
              }`}>
                ツール実行 (Execute)
              </div>
              {step === "executing" && (
                <div className="flex items-center gap-2 mt-1 text-blue-600 text-sm">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  Envoy Gateway 経由でツールを実行中...
                </div>
              )}
              {execResponse && (
                <div className="mt-1">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    execResponse.status === "success"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      execResponse.status === "success" ? "bg-green-500" : "bg-red-500"
                    }`}></span>
                    {execResponse.status === "success" ? "実行完了" : execResponse.status === "blocked" ? "ブロック" : "失敗"}
                  </span>
                  {execResponse.reason && (
                    <p className="text-xs text-gray-500 mt-1">{execResponse.reason}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleProcess}
          disabled={isProcessing}
          className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? "処理中..." : "問い合わせを処理"}
        </button>
      </div>

      {/* 結果表示 */}
      {step === "done" && authResponse && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            AI Agent 回答案
          </h3>

          {authResponse.decision === "allow" && execResponse?.status === "success" && execResponse.result ? (
            <div className="bg-green-50 border border-green-100 rounded-lg p-4">
              <p className="text-gray-800">
                ○○町のゴミ収集日は毎週火曜日です。
                <br />
                粗大ゴミは第2・第4水曜日に収集しています。
              </p>
            </div>
          ) : authResponse.decision === "deny" ? (
            <div className="bg-red-50 border border-red-100 rounded-lg p-4">
              <p className="text-red-700">認可拒否: {authResponse.reason}</p>
            </div>
          ) : execResponse?.status === "blocked" || execResponse?.status === "failed" ? (
            <div className="bg-red-50 border border-red-100 rounded-lg p-4">
              <p className="text-red-700">実行{execResponse.status === "blocked" ? "ブロック" : "失敗"}: {execResponse.reason}</p>
            </div>
          ) : null}

          <div className="mt-4 text-xs text-gray-400">
            Request ID: {authResponse.request_id}
          </div>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="bg-white rounded-lg border border-red-200 p-6 shadow-sm">
          <div className="text-red-600">エラー: {error}</div>
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
