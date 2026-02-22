- architect - 設計・スコープ定義・タスク分割・Done条件の定義などを担当
- Implementer - architectが定義したタスクの実装を担当
- tester - ローカル動作の検証・デモ準備・デプロイ確認を担当
でチームを組んで、
architect エージェントに以下の作業を依頼してください。

前提ドキュメント：
- /Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/02-design
- /Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/01-plan
  - 01~10まで
- 本文章下部の仕様書

開発ルール：
以下の順番で開発すること
1. 設計書（/Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/02-design）の作成（修正）
2. 実装
3. ローカルへのデプロイ
4. ローカルのテスト仕様書の更新ちテストの実施（/Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/03-test）
※現時点で、GCPへのデプロイは実施しない

目的：
機能修正

依頼詳細：
以下の仕様書に従って、機能修正すること

# Judgment UI 改修仕様書
## 対象：ClaudeCode 実装修正指示
## 目的：Map / Graph / Behavior を統治ストーリーとして再設計する

---

# 1. 全体方針

本UIは「ログ可視化ツール」ではなく  
「AI Agent Governance Platform」として振る舞う必要がある。

審査員に3分で伝えるべきメッセージ：

1. 複数のAI Agentが動いている
2. Agentごとに振る舞いが異なる
3. 危険が可視化される
4. 問題があれば即座にBANできる
5. BAN後の変化が確認できる

そのために以下の構造変更を行う。

---

# 2. Map と Graph の役割定義

## Map → Activity Log（ミクロ視点）
個別イベントの「事件簿」

## Graph → Governance Insights（マクロ視点）
全体の健康状態とリスク構造

---

# 3. Map（Activity Log）改修仕様

## 3.1 名称変更

"Judgment Map" → "Activity Log"

サブタイトル：
"Detailed AI Agent Activity and Decisions"

---

## 3.2 DENY強調表示

### 変更内容

- DENY行は行全体を薄赤背景にする
- DENYバッジは濃い赤
- ALLOWは通常表示

### 目的

「何が止められたか」を即座に認識できるようにする

---

## 3.3 REASON表示改善

現在：
1行テーブル内

変更：
- REASONは2行目に表示
- 1行目：TIME / AGENT / TOOL / ACTION / DECISION
- 2行目：REASON（小さめフォント）

---

## 3.4 フィルタ連動

以下の操作を実装：

- Agentタイルクリック → Mapをagentでフィルタ
- Toolクリック → Mapをtoolでフィルタ
- Graph内バークリック → Map連動

---

# 4. Graph（Governance Insights）改修仕様

---

# 4.1 上部：SYSTEM STATUSセクション追加

Graph最上部に統計カードを追加：

- Active Agents
- Banned Agents
- Global Deny Rate
- High Risk Agents（Deny率50%以上）

横並びカード表示

---

# 4.2 Decision Distribution 改修

- 円中央にDeny率を大きく表示
- 「Last 24h」を明示

---

# 4.3 Agent-wise Deny Rate 改修

- 降順ソート
- Deny率50%以上は赤強調
- Banned Agentはグレー表示

---

# 4.4 Block Reason Breakdown（必須）

表示形式：横棒グラフ

表示項目例：

- Role not permitted
- Purpose mismatch
- Business hour restriction
- Approval required
- Agent banned

クリックでMapフィルタ連動

---

# 4.5 Tool-wise Risk Profile

表示形式：横棒

表示内容：

tool名 + deny数/総数 + deny率

例：
benefit 7/17 (41%)

---

# 5. BEHAVIOR（Agent Behavior Timeline）全面改修

現在の問題：
- 点が並んでいるだけで意味が伝わらない
- 異常が強調されていない
- BANとの関係が見えない

---

## 5.1 目的再定義

BEHAVIORは

「異常検知と統治の証拠表示」

である。

---

## 5.2 表示仕様

### 各Agent行に以下を追加

- Agent名
- Deny率
- Risk Level表示

例：

benefit-assistant ⚠ HIGH RISK (83%)
notify-agent NORMAL (19%)

---

## 5.3 点のスタイル変更

ALLOW：
- 小さい緑点
- 低透明度

DENY：
- 大きめ赤点
- 不透明

---

## 5.4 BANライン追加（最重要）

BANイベント発生時：

- 縦の赤線を描画
- 上部に「BAN executed」ラベル表示

BAN後のイベントは自動DENY表示

---

## 5.5 Agentサマリー追加（右側）

各Agent行の右端に表示：

- Total Actions
- Deny Count
- Last 5 min Deny

---

## 5.6 Anomaly検知メッセージ

Deny率が閾値（例：50%）超えた場合：

画面上部に警告表示：

"⚠ Anomaly detected: benefit-assistant deny rate spiked"

---

# 6. Agent タイル改修

Map画面上部にAgentタイルを配置

各タイルに表示：

- Agent名
- Role
- Deny率
- Status（Active / Banned）
- BANボタン

Deny率50%以上：
- タイル枠を赤にする

Banned：
- グレーアウト

---

# 7. Map と Graph の整合ルール

| Graph要素 | Map連動動作 |
|-----------|--------------|
| Agent Deny Rate | Agentフィルタ |
| Tool Risk | Toolフィルタ |
| Block Reason | Reasonフィルタ |
| Timeline点 | 時間帯スクロール |

---

# 8. 優先実装順

1. DENY強調表示
2. Agentタイル追加
3. Block Reason Breakdown追加
4. BehaviorのDeny率表示
5. BANライン追加

---

# 9. 完成状態のゴール

審査員が見たとき：

1. 複数Agentが存在
2. 危険Agentが可視化される
3. 危険理由が説明できる
4. BANできる
5. BAN後の変化が確認できる

この5点が一目で理解できるUIを完成形とする。
