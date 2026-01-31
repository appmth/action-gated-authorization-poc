# Judgment 管理画面（Dashboard）実装計画書【最終版】

## 目的
- AI Agent の行動が「どれだけ・なぜ・どこで」制御されているかを一目で把握できる管理画面を提供する
- Judgment の価値（構造的強制力・説明責任・監査可能性）をUIで直感的に伝える
- デモで勝ちに行きつつ、将来のプロダクト化に自然に接続できる構成を定義する

---

## 全体方針（重要）
- 実行結果の詳細可視化は **GCP Logging / Trace に委譲**
- Judgment UI は「判断」にのみ責務を集中させる
- 画面数は **3画面に限定**し、理解速度と思想伝達を最優先する
- 実装は **モック → 実データ連携** の2段階で進める

---

## 画面構成概要（最終確定）

### 採用する3画面
1. Judgment Map（主役・思想の可視化）
2. Judgment Detail（説明責任）
3. Judgment Graph（運用・将来性）

### 明示的に作らないもの
- Execution Result 専用画面
- 実行ログの詳細UI（Cloud Logging に委譲）

---

## 共通UI構成（Global Shell 設計）

本管理画面は、GCP Console や Auth0 Dashboard と同様の  
**「管理基盤としての安心感・既視感」**を提供するため、  
各画面に共通する UI 構造（Global Shell）を持つ。

Judgment Map / Judgment Detail / Judgment Graph はすべて、  
この共通レイアウトの **Main Content 領域**に差し替え表示される。

---

## 共通レイアウト全体像

┌──────────────────────────────────────────────────────────────┐
│ Top Bar │
│ Judgment ▸ Project: gov-demo user ◯ │
└──────────────────────────────────────────────────────────────┘
┌───────────────┬──────────────────────────────────────────────┐
│ Sidebar │ Main Content │
│ │ Judgment Map / Detail / Graph │
│ ● Judgment │ │
│ │ │
│ ▸ Map │ │
│ ▸ Graph │ │
│ │ │
│ ● Settings │ │
└───────────────┴──────────────────────────────────────────────┘


---

## 1. サイドバー（左固定ナビゲーション）

### 目的
- プロダクトとしての一貫性・運用感を即座に伝える
- デモ中の画面迷子を防ぎ、Judgment の世界観を固定する

### 構成

[ LOGO ]
Judgment

Judgment
├ Map
└ Graph

Settings


### 設計ルール
- Judgment Detail はサイドバーに表示しない  
  （Map からのみ遷移する「監査・説明用詳細」という位置づけ）
- ナビゲーション項目は最小限
- 展開アニメーション・動的切替なし
- Map / Graph は常に即座に戻れる「基点」として機能させる

---

## 2. ロゴ領域（左上）

### 目的
- Judgment が「単一デモ画面」ではなく  
  **独立した管理プロダクト**であることを一瞬で伝える

### 仕様
- ロゴ＋テキスト表示
  - `Judgment`
  - `Action-Gated Authorization`（サブタイトル・小さく表示）
- ロゴクリックで **Judgment Map に戻る**
  - デモ中の安全な帰還点として機能

---

## 3. Top Bar（上部共通バー）

### 目的
- GCP / Auth0 と同等の「管理基盤感」を演出する
- プロジェクト単位で運用される前提を自然に示す

### 表示内容（固定・非操作）
- プロダクト名：Judgment
- Project / Environment 表示  
  - 例：`Project: gov-demo`
- ユーザーアイコン（ダミーで可）

### 設計ルール
- 操作可能な要素は置かない
- 検索バー・通知・設定ショートカットは入れない
- 常に静的表示（デモ中に変化しない）

---

## 4. 共通で持つ暗黙情報

### Project / Environment
- Top Bar に常時表示
- `gov-demo` / `env: demo` 程度で十分

### 時間・期間
- グローバルには表示しない
- Judgment Graph 内でのみ `Last 24h` 等を明示

---

## 5. 明示的に入れない共通要素

以下は **意図的に実装しない**。

- 検索バー
- フィルタ・ソート
- CSV / Export
- ページング
- ダークモード切替
- 通知・アラート・トースト

理由：
- デモの認知負荷を上げない
- 機能説明より「思想理解」を優先する
- 管理画面としての“完成感”は Shell で担保されている

---

## 6. 各画面との関係整理

| UI要素 | 対応 |
|------|------|
| Sidebar ▸ Map | Judgment Map |
| Sidebar ▸ Graph | Judgment Graph |
| Judgment Detail | Judgment Map からのみ遷移 |

※ Judgment Detail は  
※ サイドバーを持たない「一時的・説明責任用ビュー」とする

---

## 位置づけまとめ

- 共通UI（Global Shell）は **判断を邪魔しない器**
- Judgment Map / Detail / Graph が主役
- GCP / Auth0 と同じ「当たり前さ」を演出し、  
  審査員に UI の説明をさせない

この共通構成を前提として、  
以降の「画面遷移」「個別画面設計」を定義する。

## ① Judgment Map（メイン画面｜思想の中核）

目的：
- AI Agent の「判断履歴」をそのまま可視化する
- 同じ行動でも Agent / 文脈で結果が変わることを一目で伝える

ワイヤーフレーム：

┌──────────────────────────────────────────────────────────────┐
│ Judgment Map                                                  │
│ （判断の履歴。実行結果は扱わない）                          │
├──────────────────────────────────────────────────────────────┤
│ Time     │ Agent Role │ Tool        │ Action   │ Decision │ Reason
├──────────────────────────────────────────────────────────────┤
│ 12:03:10 │ assistant  │ benefit     │ update   │ DENY     │ 決定権限なし
│ 12:03:15 │ admin      │ benefit     │ update   │ ALLOW    │ 条件付き承認
│ 12:03:20 │ assistant  │ resident    │ read     │ ALLOW    │ 範囲限定
│ 12:03:25 │ assistant  │ notify      │ send     │ ALLOW    │ 監査対象
│                                                              │
│ （1行 = 1 Judgment。ALLOW / DENY が必ず混在）               │
└──────────────────────────────────────────────────────────────┘

UIルール：
- ALLOW：緑 / DENY：赤（色は最小限）
- ソート・検索・ページングなし
- 行クリックで Judgment Detail に遷移


---

## ② Judgment Detail（詳細画面｜説明責任）

目的：
- 「なぜこの判断になったのか」を 1 件で完全に説明する
- 監査・行政文脈でも耐える情報構造を示す

ワイヤーフレーム：

┌──────────────────────────────────────────────────────────────┐
│ Judgment Detail                                               │
├──────────────────────────────────────────────────────────────┤
│ Decision    : DENY                                           │
│ Agent Role  : assistant                                     │
│ Agent ID    : agent-a                                       │
│ Tool        : update_benefit_status                          │
│ Action      : update                                        │
│ Timestamp   : 2026-02-01 12:03:10                             │
├──────────────────────────────────────────────────────────────┤
│ Reason                                                       │
│  給付ステータスの更新は、                                   │
│  人的確認が必要な操作として定義されているため              │
├──────────────────────────────────────────────────────────────┤
│ Policy                                                       │
│  policy_id : P-UPDATE-001                                   │
│  tags      : [money, human-required]                         │
├──────────────────────────────────────────────────────────────┤
│ Context（sanitized）                                        │
│ {                                                            │
│   "resident_id": "****a92f",                                 │
│   "target": "benefit_status"                                 │
│ }                                                            │
└──────────────────────────────────────────────────────────────┘

UIルール：
- スクロールさせない（1画面完結）
- 数を見せない（1件のみ）
- 読めば判断に納得できる分量に固定


---

## ③ Judgment Graph（グラフ画面｜将来性・運用像）

目的：
- 個々の判断ではなく「運用した結果の傾向」を示す
- AI Agent が増えた未来を自然に想起させる

ワイヤーフレーム（2カラム構成）：

┌──────────────────────────────────────────────────────────────┐
│ Judgment Graph（Last 24h）                                   │
├───────────────────────────────┬──────────────────────────────┤
│ Decision Distribution          │ Agent-wise Deny Rate         │
│                               │                              │
│        ┌─────────────┐        │ assistant_agent   ██████ 35% │
│        │   ALLOW      │ 68%    │ admin_agent       ██     12% │
│        │              │        │                              │
│        │   DENY       │ 32%    │ （future）agent-x ███████ 48%│
│        └─────────────┘        │                              │
│                               │                              │
│ （円グラフ）                  │ （割合のみ。回数は出さない）│
└───────────────────────────────┴──────────────────────────────┘

UIルール：
- アニメーションなし（静的）
- ツールチップなし（説明はナレーション）
- 数値はダミー可（構造で説得）
- 操作不可（見るだけ）

---



---

## 画面遷移（固定）

[Judgment Map]
      ↓（1行クリック）
[Judgment Detail]
      ↓
[Judgment Graph]
      ↓
[Judgment Map に戻る]

※ 最初と最後は必ず Judgment Map
※ 記憶に残るのは「判断の履歴」


---

## データ設計（イベント）

### Judgment Event
- ts
- request_id
- agent_id
- agent_role
- tool
- action
- decision（allow / deny）
- reason
- policy_id
- policy_tags
- expires_in_seconds

### Execution Event（UI直接利用しない）
- ts
- request_id
- jti
- agent_id
- action
- tool_path
- result_status
- blocked_layer
- blocked_reason
- latency_ms

※ Execution Event は Cloud Logging / Trace で参照

---

## データフロー（最終）

1. service-a（Judgment）が Judgment Event / Execution Event を構造化ログ出力
2. Cloud Logging に集約
3. Logging Sink により分析ストアへ転送
4. service-a が集計API（/metrics 系）を提供
5. judgment-ui が集計APIを呼び出し表示

---

## API 方針（UI 用）

- GET /judgments
- GET /judgments/{id}
- GET /metrics/decision-distribution
- GET /metrics/agent-deny-rate

---

## 実装ステップ（更新：2段階計画）

### STEP 1：モック開発（デモ最優先）
**目的**
- ナレーション・画面遷移・思想を完全に固定する
- 「見せ方」を先に完成させ、勝ち筋を確定させる

**内容**
- Judgment Map / Detail / Graph の3画面をモックで実装
- ダミーデータは「意図的に」作る（Allow/Deny が混在）
- 画面遷移：
  - Judgment Map → Judgment Detail → Judgment Graph → Judgment Map
- 実データ連携・API通信は行わない

**成果物**
- デモ用完成UI
- ナレーションと完全に同期した画面構成

---

### STEP 2：実データ連携（プロダクト化）
**目的**
- モックを壊さずに「本物」に置き換える
- PoC からプロダクトへの自然な移行を示す

**内容**
- service-a に集計APIを実装
- Judgment Event を用いた実データ集計
- UI 側はデータソース差し替えのみ
- Execution Result は引き続き GCP ログに委譲

**成果物**
- 実データ連携済み Judgment UI
- 運用・拡張に耐える基盤

---

## 成果物（最終）
- Judgment Map / Detail / Graph の3画面
- 説明責任・構造的強制力・将来性を同時に示すUI
- デモでもプロダクトでも成立する設計
