# AGA PoC – Claude Code Project Rules

## このリポジトリの目的

このリポジトリは **Action-Gated Authorization（AGA）** の PoC を構築するためのもの。
目的は「実装を作ること」ではなく、**構造の価値を最短で証明すること**。

---

## このPoCで証明したいこと（絶対軸）

1. **Action は同じでも Context によって Allow / Deny が変わる**
2. **PEP は必ず「実行前」に判断を強制する**
3. **判断理由（reason）は必ず人間に説明可能な形で残る**

この3点を満たさない実装・提案は、このPoCでは価値とみなさない。

---

## 設計原則（必ず守ること）

### PEP（Policy Enforcement Point）
- Tool / API の **実行直前に必ず存在する**
- PDP の判断を **必ず** 経由する
- Deny の場合、**実行させてはいけない**
- 「ログだけ残す」「後から説明する」は不可

### PDP（Policy Decision Point）
- 判断は **ポリシー（Rego）に基づく**
- Allow / Deny に加えて **理由（reason）を返す**
- 判断は業務文脈（Context）を含めて行う

### Context
- PoCでは **UIから明示的に与える**
- Agentが勝手に生成しない
- Contextの正しさではなく「Contextで結果が変わる構造」を示す

---

## やらないこと（明示的スコープ外）

- IAM / 認証の完成度を競わない
- LLM の賢さ・推論能力を競わない
- Envoy / Sidecar による強制はPoCでは行わない

---

## 技術前提（固定）

- 実行基盤：Cloud Run
- PDP：OPA（Rego）
- PEP：アプリ内 PEP
- Action：4つ（get_resident_info, read_resident_record, update_benefit_status, send_official_notice）
- Context：purpose（inquiry / audit / approval / notification / emergency）× time（business_hours / after_hours）の組み合わせ

---

## Playwright Testing Rules
- **Execution Directory**: Always run playwright commands from the `judgment-ui` directory.
- **Headless Mode Required**: Use `npx playwright test` (headless) only. Never use `--ui`, `--headed`, or `codegen` as they will fail in this WSL environment due to XServer absence.
- **Project Filter**: Use `--project=chromium` to speed up tests unless cross-browser testing is specifically requested.
- **Environment**: Ensure the local development server is running at `http://localhost:3000` before executing tests. If not, suggest starting it with `npm run dev`.
- **Test File Location**: All new tests must be created in `judgment-ui/tests/`.
- **Debugging**: If a test fails, do not attempt to open a browser. Instead:
    1. Read the terminal error output.
    2. Check the `playwright-report/` or `test-results/` directory if available.
    3. Use `console.log` inside tests to debug state if needed.
- **Command Snippets**:
    - Run all tests: `cd judgment-ui && npx playwright test`
    - Run specific test: `cd judgment-ui && npx playwright test tests/example.spec.ts`
    - Show report (text based): `cd judgment-ui && npx playwright show-report`

---

## 判断に迷ったときの優先順位

1. AGAの3つの証明に寄与するか？
2. 「実行前に止められる」構造になっているか？
3. 審査員が3分で理解できるか？

この順で判断すること。
