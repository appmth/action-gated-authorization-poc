- architect - 設計・スコープ定義・タスク分割・Done条件の定義などを担当
- Implementer - architectが定義したタスクの実装を担当
- tester - ローカル動作の検証・デモ準備・デプロイ確認を担当
でチームを組んで、
architect エージェントに以下の作業を依頼してください。

前提ドキュメント：
- /Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/02-design
- /Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/01-plan
  - 01~10まで
- 本文章下部の仕様書または依頼文

開発ルール：
以下の順番で開発すること
1. 設計書（/Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/02-design）の作成（修正）
2. 実装
3. ローカルへのデプロイ
4. ローカルのテスト仕様書の更新とテスト実施（/Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/03-test）
※現時点で、GCPへのデプロイは実施しない

目的：
機能修正

仕様書：
# Activity Log ダッシュボード機能拡張仕様書（ClaudeCode実装依頼）

## 目的

Activity Log を「閲覧画面」から「運用ダッシュボード」へ進化させる。

審査員が見たときに、

- 今何が起きているか分かる
- 危険なものだけ抽出できる
- 手動で更新できる
- ライブで動いていることが分かる
- 統治できる

という状態を実現する。

本仕様では、視覚的に分かりやすいコンポーネント構成を前提とする。

---

# 1. 全体レイアウト構成

Activity Log 上部に「Control Bar」を新設する。

[ Snapshot Summary ] [ Filters ] [ Live Toggle ] [ Refresh ⟳ ]


その下に Agent タイル群、その下にログテーブルを表示。

---

# 2. Snapshot Summary コンポーネント

## 2.1 表示項目（横並び）

- Total
- Allow
- Deny
- Deny Rate（％）

例：

Total: 120  
Allow: 82  
Deny: 38  
Deny Rate: 31%

## 2.2 デザイン仕様

- 小さなカード型
- Deny Rate は 30%以上でオレンジ、50%以上で赤
- 更新時刻表示：

Last updated: 16:10:32

---

# 3. Decision Filter（All / Allow / Deny）

## 3.1 UI構成

Segmented Control形式：

[ All ] [ Allow ] [ Deny ]

## 3.2 挙動

- All：全表示
- Allow：ALLOWのみ表示
- Deny：DENYのみ表示

## 3.3 デザイン

- 選択中は背景色変更
- Denyタブは赤アクセント
- Allowタブは緑アクセント

---

# 4. Agent / Tool フィルタ

## 4.1 UI

ドロップダウン：

[ Agent ▼ ]  
[ Tool ▼ ]

## 4.2 挙動

選択値に応じてログを再描画。

---

# 5. High Risk Only トグル

## 5.1 UI

チェックボックスまたはトグルスイッチ：

[ Show High Risk Only ]

## 5.2 挙動

Deny率50%以上のAgentのみ表示。

---

# 6. Refresh ボタン

## 6.1 UI構成

右端にボタン：

[ ⟳ Refresh ]

## 6.2 アイコン仕様

- 回転矢印アイコン
- Heroicons の `ArrowPathIcon` 等を使用
- ローディング中は回転アニメーション

例：

- isLoading = true のとき
  - アイコンが回転（CSS animate-spin）
  - ボタンは disabled

## 6.3 挙動

- /judgments を再fetch
- 成功時 Snapshot Summary 更新
- 更新時刻更新

---

# 7. Live Mode トグル

## 7.1 UI

トグルスイッチ：

[ Live Mode ON ]

## 7.2 挙動

ON時：

- 3秒間隔で自動fetch
- 新規ログはフェードイン表示

OFF時：

- 自動更新停止

## 7.3 視覚演出

- ON時は緑表示
- OFF時はグレー表示

---

# 8. ログテーブル拡張

## 8.1 ソート機能

カラムヘッダにクリック可能ソート追加：

- Time
- Agent
- Decision

## 8.2 DENY固定表示オプション（任意）

[ Pin Deny to Top ]

ON時：

DENYを上に表示。

---

# 9. BAN 操作強化（任意拡張）

## 9.1 ログ行にBANボタン追加

DENY行の右端に：

[ BAN Agent ]

押下時：

- 確認モーダル表示
- BAN API 呼び出し

---

# 10. Export CSV

## 10.1 UI

Control Bar右側：

[ Export CSV ]

## 10.2 挙動

現在表示中のフィルタ状態に基づくログをCSV出力。

---

# 11. コンポーネント構成（React想定）

ActivityLogPage
 ├─ SnapshotSummary
 ├─ ControlBar
 │   ├─ DecisionFilter
 │   ├─ AgentFilter
 │   ├─ ToolFilter
 │   ├─ HighRiskToggle
 │   ├─ LiveModeToggle
 │   └─ RefreshButton
 ├─ AgentTileRow
 └─ ActivityTable

---

# 12. 状態管理

state例：

- decisionFilter
- selectedAgent
- selectedTool
- highRiskOnly
- isLiveMode
- isLoading
- lastUpdated

LiveMode ON時：

setIntervalでfetch  
cleanupを必ず実装すること。

---

# 13. アニメーション仕様

- Refresh中アイコン回転
- 新規ログフェードイン
- Live ON時、緑点点滅（任意）

---

# 14. 受け入れ基準

- Allowのみ表示できる
- Denyのみ表示できる
- Refreshで即更新される
- 更新中は矢印が回転する
- Live Modeで自動更新される
- High Riskのみ抽出できる
- Snapshotが常に正しく更新される
- UIが視覚的に直感的である

---

以上の仕様に従い、Activity Logを運用ダッシュボードへ拡張すること。
