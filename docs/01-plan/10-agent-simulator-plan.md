# Agent Simulator 実装計画書

## 目的

Judgment Dashboard にリアルなデータを継続的に供給するための **Agent Simulator** を構築する。
6種類のリスクプロファイルを持つ AI Agent をシミュレーションし、Cloud Scheduler により毎分トリガーすることで、
Dashboard 上に ALLOW / DENY が自然に混在するデータを生成する。

**狙い**:
- デモ時に Dashboard が「動いている」状態を即座に作れる
- Agent ごとに Deny 率が異なることで、AGAの文脈依存性を視覚的に証明できる
- 手動で curl を叩く必要がなくなる

---

## Agent プロファイル（6体）

| agent_id | agent_role | 説明 | 期待 Deny 率 |
|---|---|---|---|
| `cs-frontdesk` | Frontdesk | 窓口対応。営業時間内の問い合わせ中心 | ~10% |
| `cs-night` | Frontdesk | 夜間シフト。同じ操作でも after_hours | ~80% |
| `benefit-admin` | Backoffice | 給付管理者。給付ステータス更新権限あり | ~15% |
| `benefit-assistant` | Frontdesk | 給付更新を試みるが権限なし | ~90% |
| `audit-bot` | Auditor | 監査用に記録を読み取る | ~30% |
| `notify-agent` | Notifier | 公式通知を送信する | ~20% |

### 設計意図

- **同じ Action でも Agent / Context で結果が変わる** ことを示すため、`cs-frontdesk` と `cs-night` は同じ操作を異なる時間帯で実行する
- **権限のない Agent が操作を試みて拒否される** ことを示すため、`benefit-assistant` は `update_benefit_status` を実行しようとする
- Agent 数は 6 に固定し、Dashboard の Agent タイルが程よく埋まるようにする

---

## Action 定義（4種類）

| Action 名 | tool | action | 状態 |
|---|---|---|---|
| `get_resident_info` | resident | read | 既存 |
| `read_resident_record` | resident | read_full | 新規 |
| `update_benefit_status` | benefit | update | 新規 |
| `send_official_notice` | notify | send | 新規 |

### tool / action マッピングの拡張

既存の service-a は `get_resident_info` -> `resident / read` の 1 パターンのみ。
新規 3 アクションの追加に伴い、service-a の変換テーブルと OPA ポリシーの拡張が必要。

---

## トリガー機構

```
Cloud Scheduler (毎60秒)
    ↓ POST /trigger
Agent Simulator
    ↓ 1-3 体の Agent をランダム選択
    ↓ 各 Agent のプロファイルに基づき Action + Context を決定
    ↓ POST /authorize を service-a に送信
service-a
    ↓ OPA に問い合わせ
    ↓ Judgment を保存
Dashboard に反映
```

- 各トリガーで 1-3 体の Agent を選択（ランダム）
- 各 Agent は自身のプロファイルの重み付けに従って Action + Context を選択
- service-a の `/authorize` API を呼び出し、結果は service-a 側で保存される
- Simulator 自身はデータを永続化しない

---

## アーキテクチャ

```
┌─────────────────┐     POST /trigger      ┌──────────────────┐
│ Cloud Scheduler  │ ──────────────────────→ │ Agent Simulator  │
│ (毎60秒)         │                         │ (Cloud Run)      │
└─────────────────┘                         └──────┬───────────┘
                                                   │
                                          POST /authorize (1-3回)
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │  service-a   │
                                            │  (Judgment)   │
                                            └──────┬───────┘
                                                   │
                                              OPA 問い合わせ
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │  service-b   │
                                            │  (OPA/PDP)   │
                                            └──────────────┘
```

- **Python + FastAPI**: service-a と同じ構成
- **Cloud Run**: https://agent-simulator.action-gated.tech
- **単一ファイル構成**: `main.py` のみ

---

## データフロー

1. Cloud Scheduler が Agent Simulator の `/trigger` を POST で呼び出す
2. Simulator が 1-3 体の Agent を選択し、各 Agent のプロファイルに基づいてリクエストを構成
3. Simulator が service-a の `/authorize` API を呼び出す
4. service-a が OPA (service-b) に問い合わせ、判定結果を `judgment_store` に保存
5. Judgment UI が service-a の集計 API からデータを取得して表示

---

## スコープ外（明示的にやらないこと）

- LLM / AI 推論は使わない（プロファイルベースの確率的選択のみ）
- Pub/Sub / BigQuery は使わない
- 自動 BAN 機能は持たない
- Simulator 自身にデータベースは持たない
- `/execute` フェーズは呼び出さない（`/authorize` のみ）
- Agent プロファイルの動的変更 API は作らない

---

## 実装ステップ

### STEP 1: service-a / OPA の拡張
- 新規 3 アクションの tool/action マッピングを service-a に追加
- OPA ポリシーに新規ルールを追加
- 6 Agent の登録情報を service-a に追加

### STEP 2: Agent Simulator 実装
- `main.py` / `requirements.txt` / `Dockerfile` を作成
- 6 Agent のプロファイルとトリガーロジックを実装
- ローカルで service-a と結合テスト

### STEP 3: デプロイ・結合
- Cloud Run へデプロイ
- Cloud Scheduler の設定
- Dashboard でデータが流れていることを確認

---

## 完成条件（Definition of Done）

- [ ] Agent Simulator が `/trigger` で 1-3 体の Agent のリクエストを service-a に送信できる
- [ ] 6 種類の Agent プロファイルが定義され、それぞれ異なる Deny 率で判定される
- [ ] Dashboard (Judgment Map) に ALLOW / DENY が混在するデータが表示される
- [ ] Cloud Scheduler により毎分自動でデータが生成される
- [ ] Simulator 自身に永続化層がない（ステートレス）
