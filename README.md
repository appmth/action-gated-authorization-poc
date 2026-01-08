# Action-Gated Authorization (AGA) - PoC

AI Agent の Action を実行直前で必ず評価・制御する認可構造の最小PoCです。

## TL;DR
AI Agent の Action を実行直前で必ず評価・制御する
認可構造（Action-Gated Authorization）の最小PoCです。

👉 このPoCでは：
- Agentが Action を生成
- 実行前に必ず PEP で止まり
- PDP が業務文脈を評価し
- Allow / Deny と理由を返します

## Folder Structure

```
action-gated-authorization-poc/
├── agent/          # AI Agent implementation
├── pep/            # Policy Enforcement Point
├── pdp/            # Policy Decision Point
├── policy/         # Policy definitions
├── infra/          # Infrastructure setup
├── logs/           # Execution logs
├── demo/           # Demo scenarios and examples
├── diagrams/       # Architecture diagrams
├── docs/           # Documentation
│   ├── 01-plan/
│   ├── 02-slides/
│   ├── 03-images/
│   └── 99-gpt-memo/
└── slides/         # Presentation materials
```

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

## Policy Example
```yaml
- if: time == "night" and action.contains_pii
  deny: true
