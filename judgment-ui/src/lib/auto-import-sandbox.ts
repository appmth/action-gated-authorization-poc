// src/lib/auto-import-sandbox.ts
// ✅ Auto Import 動作確認用（どこからも import しない想定）
// - ビルドや実行には影響しない
// - 型/関数の補完・自動importの練習にだけ使う

export type SandboxJudgment = {
  request_id: string;
  result: "ALLOW" | "DENY";
  reason_short: string;
};

export function formatSandboxLabel(j: SandboxJudgment): string {
  return `${j.result}: ${j.reason_short} (${j.request_id.slice(0, 8)}...)`;
}
