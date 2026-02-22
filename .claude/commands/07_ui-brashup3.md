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
4. ローカルのテスト仕様書の更新しテスト実施（/Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/03-test）
※現時点で、GCPへのデプロイは実施しない

目的：
機能修正

仕様書：
# Agent Behavior Timeline 改修仕様書（ClaudeCode実装指示）

## 目的

現在の Agent Behavior Timeline は、
・横軸が何を表しているのか分からない  
・時間範囲が不明  
・現在位置が不明  
・BANとの関係が視覚的に読み取れない  

という問題がある。

本改修の目的は、

「これは時間軸である」
「どの時間帯で異常が起きたか」
「BANがどこで発生したか」
「今どこを見ているのか」

を一目で理解できるようにすることである。

---

# 1. 横軸を明示的な時間軸に変更

## 1.1 タイトル追加

Timeline上部に明確なラベルを追加：

Time (Last 24 Hours)

現在のウィンドウが何であるかを明示する。

---

## 1.2 時間目盛り（Tick）追加

横軸に以下を追加する：

- 最低4本の縦補助線
- 下部に時間ラベル

例：

-24h    -18h    -12h    -6h    Now

または

00:00    06:00    12:00    18:00    Now

※ 実装は現在の時間スケールに合わせて決定

---

## 1.3 現在時刻（Now）ライン追加

右端に：

- 薄い縦線
- "Now" ラベル

これにより時間の方向を明確にする。

---

# 2. イベント点の意味を強調

## 2.1 ALLOWイベント

- 小さめの緑点
- 透明度を少し下げる（例：opacity 0.6）

## 2.2 DENYイベント

- ALLOWより大きくする（例：1.5倍）
- 不透明な赤
- ホバー時に強調

DENYを視覚的に主役にする。

---

# 3. BANラインの追加（最重要）

## 3.1 BANイベントを時間軸上に表示

BAN発生時：

- 太めの赤い縦線
- 上部に "BAN executed" ラベル

## 3.2 BAN後の挙動

BAN後に該当Agentのイベントが発生した場合：

- 自動DENY表示
- その区間を視覚的にわかるようにする（任意で薄赤背景）

---

# 4. 実時間スケールへの変更

現在の点配置が均等間隔の場合：

以下に変更する：

x座標 = (event.timestamp - windowStart) / (windowEnd - windowStart)

実時間に基づいて正確に配置する。

これにより：

単なる散布図 → 実時間タイムライン

に進化させる。

---

# 5. リスク表示の強化

各Agent行に以下を表示：

Agent名
Deny率
Riskレベル

例：

benefit-assistant  73% - HIGH
cs-night  100% - HIGH
cs-frontdesk  18% - LOW

閾値例：

- 0-25% → LOW
- 26-50% → MEDIUM
- 51%以上 → HIGH

HIGHは赤表示。

---

# 6. サマリー表示（右側）

各Agent行の右側に表示：

- Total
- Deny
- Last 5m Deny

例：

Total: 15
Deny: 8
Last 5m Deny: 3

---

# 7. 上部警告表示

Deny率が50%以上のAgentが存在する場合：

Timeline上部に警告表示：

Warning: [agent list] has deny rate above 50%

---

# 8. 操作連動（Mapとの整合）

- 点クリック → Activity Logをその時間帯にスクロール
- Agent名クリック → Activity Logをagentでフィルタ
- BANラインクリック → BANイベント詳細表示

---

# 9. 受け入れ基準（Acceptance Criteria）

以下が満たされれば完了：

1. 横軸が時間であることが一目で分かる
2. 現在時刻が明示されている
3. DENYが視覚的に強調されている
4. BANイベントが明確に表示されている
5. Agentごとのリスクが文字で読める
6. Timelineが「統治ストーリー」を説明できる

---

# 10. 実装優先順位

1. 横軸ラベル + 目盛り追加
2. DENY点の強調
3. BANライン追加
4. 実時間スケール化
5. Map連動

---

以上の仕様に従い、Agent Behavior Timelineを再設計すること。

# Agent Tile 状態表現の修正

## 目的
HIGH RISK 状態と SELECTED 状態が視覚的に衝突しないようにする。

## 現状問題
- HIGH RISK = 赤枠
- SELECTED = 青枠
- SELECTED時に赤枠が消える

## 修正仕様

1. 枠線は「リスク状態専用」にする
   - LOW: グレー
   - MEDIUM: オレンジ
   - HIGH: 赤
   - BANNED: 濃いグレー

2. SELECTED状態では枠線を変更しない

3. SELECTED時の視覚表現：
   - 背景を薄い青に変更（例：bg-blue-50）
   - 軽いbox-shadowを追加
   - 左側に3pxの青バーを追加

4. HIGH & SELECTED の場合：
   - 枠線は赤のまま
   - 背景のみ青に変化
   - ⚠ HIGH バッジを表示

## 受け入れ基準
- HIGH状態は常に赤枠で維持される
- SELECTEDしてもリスク色は消えない
- 状態と操作が同時に認識できる
