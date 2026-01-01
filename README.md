# Action-Gated Authorization (AGA) - PoC

## TL;DR
AI Agent の Action を実行直前で必ず評価・制御する
認可構造（Action-Gated Authorization）の最小PoCです。

👉 このPoCでは：
- Agentが Action を生成
- 実行前に必ず PEP で止まり
- PDP が業務文脈を評価し
- Allow / Deny と理由を返します

## Demo (30 seconds)
[demo.mp4]

## Background
- なぜ Agent 時代に認可が壊れるのか
- なぜ業務フローに埋め込めないのか

## Architecture
[architecture.png]

## How it works
1. Agent generates Action
2. Action goes through PEP
3. PDP evaluates context
4. Decision & reason are logged

## Directory Structure

```
action-gated-authorization-poc/
├── README.md                # ★ 最重要（思想＋デモ説明）
│
├── demo/
│   ├── demo.mp4             # 30〜45秒の操作動画（最初に見る）
│   └── demo.gif             # mp4が見れない場合の保険
│
├── diagrams/
│   ├── architecture.png     # Before / After 図
│   ├── sequence.png         # シーケンス図
│   └── responsibility.png  # 責任の所在 Before / After
│
├── policy/
│   ├── policies.yaml        # 認可ポリシー（人が読める）
│   └── policy_explain.md    # ポリシーの意味説明
│
├── agent/
│   ├── agent.py             # 疑似Agent（Actionを出すだけ）
│   └── actions.py           # Action定義（PII / 非PIIなど）
│
├── pep/
│   ├── gateway.py           # ★ PEP（必ず通る）
│   └── middleware.py        # Actionを捕捉する処理
│
├── pdp/
│   ├── decision.py          # ★ PDP（Allow / Deny）
│   └── context.py           # 時間帯・目的・PII判定
│
├── logs/
│   └── sample.log           # 判断理由のログ例
│
├── infra/
│   ├── gcp.md               # GCP構成（Cloud Run等）
│   └── local.md             # ローカル実行方法
│
└── LICENSE
```

## Policy Example
```yaml
- if: time == "night" and action.contains_pii
  deny: true
