- architect - 設計・スコープ定義・タスク分割・Done条件の定義などを担当
- Implementer - architectが定義したタスクの実装を担当
- tester - ローカル動作の検証・デモ準備・デプロイ確認を担当
でチームを組んで、
architect エージェントに以下の作業を依頼してください。

前提ドキュメント：
- /Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/02-design
- /Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/01-plan
  - 01~09まで

目的：
実際に機能開発をしてほしい。

依頼内容：
1. 実装に入る前に必要な「設計タスク」をすべて洗い出す
2. 各タスクについて、以下を必ず含める
   - 目的
   - 対象コンポーネント / ディレクトリ
   - やること
   - 明示的に「やらないこと」
   - Done 条件
3. タスクは implementer がそのまま着手できる粒度にする
4. プランの作成（/Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/01-plan）→設計書（/Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/02-design）の作成（修正）→実装→ローカルでのテスト→GCPへのデプロイ→GCP上でのテストという順番でやること
5. Judgment UI の作業
   1. 共通画面
      1. Judgmentのロゴをダッシュボード上の右上に配置してほしい
         1. ロゴのパス：/Users/fumiyaishiguchi/git/action-gated-authorization-poc/judgment-ui/public/judgment-logo.png
      2. '/Users/fumiyaishiguchi/git/action-gated-authorization-poc/tmp/スクリーンショット 2026-02-10 6.39.29.png'を参考にして、ユーザーの情報が出る様にしてほしい。以下で固定で表示としたい。
         1. ユーザーアイコンはそのままでOK
         2. ユーザー名：admin user
         3. メールアドレス：admin@example.com
   2. /map 画面
      1. Judgment Mapとログが並んでいるボードの間に管理対象のAI Agent一覧が出る様にしてほしい
      2. いまの「Judgment Map」見出し直下、ログボード（テーブル）の直前に、
         1. 1行で Agent 横長タイル を並べる
         2. クリックすると下のログが その agent だけに絞り込まれる
         3. 1タイルに入れるのは、この4つ：
            1. Agent名（アシスタント(物理名) assistant(物理名) / 管理者（論理名）、admin(物理名)）
            2. Roleラベル（Frontdesk / Backoffice）
            3. 直近24hの counts：Allow / Deny（小さなバッジで）
            4. 最終活動時刻（Last seen）
         4. 例イメージ：
            1. 左上：アシスタント
            2. 右上：ROLE: assistant（薄いタグ）
            3. 中央：ALLOW 12 / DENY 3（バッジ）
            4. 下：last seen 03:12
         5. ① Selected 状態を強くする
            1. 選択中タイルだけ枠を強く／背景を薄く変える
            2. 「All」タイルも用意して戻れるようにする
         6. ② 危険操作が起きたときだけ “⚠︎” を出す
            1. 例：update_benefit_status を deny した回数があるなら、assistant タイルに ⚠︎ バッジ
            2. これだけで「やばいこと止めてる」が一発で伝わる
      3. BAN機能を入れる
         1. タイル右上に ステータスピル
            1. Active（緑）
            2. Banned（赤）
         2. 右上の … メニュー（kebab）をクリック → アクション
            1. BAN
            2. Unban
            3. View audit
         3. 1) BANを押したら「2段階」
            1. モーダルを出す
               1. 対象：assistant_agent
               2. 影響：/authorize は DENY（agent banned）
               3. 既存の実行チケット：後述（基本は “発行済みも無効化” が強い）
            2. 理由入力（必須）
               1. 例：PII overreach / Policy violation / Suspicious pattern
            3. 確認ワード入力
               1. BAN と入力させる（デモで「統制してる」感が強い）
            4. 完了したら、
               1. タイルが即座に赤くなって Banned
               2. ログテーブルに「BANイベント」が1行入る
               3. その直後に同agentの /authorize が DENY になるのを見せられる
      4. Map ダッシュボード
         1. Agent Roleという列名をAgentにしてほしい
      5. /graph
         1. 以下のワイヤーフレームで機能追加して

# Judgment Graph ワイヤーフレーム兼仕様書（ClaudeCode読込用）

## 目的
- AI Agent の判断結果を「結果・理由・構造・振る舞い」の4視点で可視化する
- デモにおいて「AI を使っている」ではなく「AI を統治している」ことを直感的に伝える
- 本ドキュメントは UI ワイヤーフレームであると同時に、実装時の仕様定義としても機能する

---

## Judgment Graph（Last 24h）

### 画面前提
- 表示対象は `Judgment Event` および `Execution Event`
- デフォルト表示期間は Last 24h
- agent フィルタ（all / assistant_agent / admin_agent）は画面右上または共通ヘッダで切替可能

---

## 【OVERVIEW｜結果の全体像】

### DECISION DISTRIBUTION

┌──────────────────────────────┐
│ DECISION DISTRIBUTION         │
│                              │
│        ◯ ALLOW 68%            │
│        ◯ DENY  32%            │
│                              │
│  (Donut Chart)                │
└──────────────────────────────┘

### 仕様
- データ元：Judgment Event
- 集計軸：decision（allow / deny）
- フィルタ：期間、agent_id
- 意図：
  - システム全体として「どれくらい止めているか」を即座に理解させる
  - DENY が多い＝異常ではなく、後続のグラフで理由を説明する前提を作る

---

### AGENT-WISE DENY RATE

┌──────────────────────────────┐
│ AGENT-WISE DENY RATE          │
│                              │
│ assistant_agent   ██████ 35% │
│ admin_agent       ██     12% │
│                              │
│  (Horizontal Bars)            │
└──────────────────────────────┘

### 仕様
- データ元：Judgment Event
- 集計軸：
  - group by agent_id
  - metric = deny / total
- 意図：
  - 同じシステムでも agent によって裁量が異なることを示す
  - 「agent が複数存在する」ことを視覚的に伝える

---

## 【GOVERNANCE INSIGHT｜なぜ・どこで止めたか】

### BLOCK REASON BREAKDOWN

┌──────────────────────────────┐
│ BLOCK REASON BREAKDOWN        │
│                              │
│ Role not permitted      40%   │
│ Agent banned            25%   │
│ Scope mismatch          20%   │
│ Human approval required 15%   │
│                              │
│  (Pie / Bar Chart)            │
└──────────────────────────────┘

### 仕様
- データ元：Judgment Event（decision = deny）
- 集計軸：reason（正規化された deny reason）
- 注意：
  - reason は自由文ではなく、内部的には enum / code を推奨
- 意図：
  - DENY が「事故」ではなく「設計通り」であることを示す
  - 審査員に「なぜ止めたか」を即答できる状態を作る

---

### BLOCK LAYER BREAKDOWN

┌──────────────────────────────┐
│ BLOCK LAYER BREAKDOWN         │
│                              │
│ L1 Judgment   ████████ 70%   │
│ L2 Envoy      ██        15%  │
│ L3 Tool       ██        15%  │
│                              │
│  (Stacked Bar)               │
└──────────────────────────────┘

### 仕様
- データ元：Execution Event（result_status = blocked）
- 集計軸：blocked_layer（L1 / L2 / L3）
- 意図：
  - if 文ではなく多層構造で止めていることを示す
  - Action-Gated Authorization の思想を最も端的に表現するグラフ

---

## 【RISK PROFILE｜何が危険か】

### TOOL-WISE RISK PROFILE

┌──────────────────────────────────────────────────────────┐
│ TOOL-WISE RISK PROFILE                                     │
│                                                          │
│ read_resident_record     ████████████        DENY 45%   │
│ update_benefit_status    ██████████████████  DENY 80%   │
│ send_official_notice     ██                  DENY 10%   │
│                                                          │
│ (Horizontal Bars, ordered by deny rate)                  │
└──────────────────────────────────────────────────────────┘

### 仕様
- データ元：Judgment Event
- 集計軸：
  - group by tool
  - metric = deny rate
- 並び順：deny rate 降順
- 意図：
  - 行政文脈における「どの操作が危険か」を直感的に示す
  - read / update / notify の危険度の段階差を可視化する

---

## 【BEHAVIOR｜エージェントの振る舞い】

### AGENT BEHAVIOR TIMELINE

┌──────────────────────────────────────────────────────────┐
│ AGENT BEHAVIOR TIMELINE                                   │
│                                                          │
│ assistant_agent                                           │
│  ALLOW ████ DENY ██ DENY ██ | BAN | DENY ██████         │
│                                                          │
│ admin_agent                                               │
│  ALLOW ██████ DENY █                                     │
│                                                          │
│  |────────────── Time ──────────────▶                   │
│                                                          │
│  ※ BAN 実行時は縦線で明示                               │
└──────────────────────────────────────────────────────────┘

### 仕様
- データ元：
  - Judgment Event
  - Agent Management Event（BAN / UNBAN）
- 表現：
  - 時系列に Allow / Deny を積み上げ
  - BAN 発生時は明確な縦線またはマーカーを表示
- 意図：
  - 異常挙動 → 統治（BAN）→ 影響の可視化、というストーリーを完成させる

---

## 実装上の共通ルール

- 1グラフ = 1メッセージ
- 同一軸（Allow/Deny など）の重複表示は禁止
- 最大グラフ数は 6〜7（これ以上は監査画面になる）
- すべてのグラフは agent フィルタの影響を受ける

---

## 想定イベントフィールド（参照用）

### Judgment Event（抜粋）
- ts
- request_id
- agent_id
- agent_role
- tool
- action
- decision
- reason
- policy_id
- policy_tags

### Execution Event（抜粋）
- ts
- request_id
- agent_id
- tool
- result_status
- blocked_layer
- blocked_reason

---

## 最終的に伝えたいメッセージ
- AI Agent は複数存在する
- 同じ操作でも agent によって結果は変わる
- 危険な操作は理由付きで止められる
- 問題があれば即座に BAN でき、その影響も追跡できる
- Judgment は「AI の判断」ではなく「AI を統治する基盤」である
