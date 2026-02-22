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

依頼詳細：
1. ブラウザにブックマークしたときやタブで表示されるファビコンを以下で設定して
   1. /Users/fumiyaishiguchi/git/action-gated-authorization-poc/judgment-ui/public/judgment-ui-favicon.svg
2. マウスオーバー
   1. ダッシュボードのログで以下のログのマウスオーバー単位が分かれているが、一緒にしてほしい。
      1. 15:28:42audit-botresidentread_fullALLOW
      2. Allowed: record access for audit/inquiry during business hours
3. Activity画面
   1. Judgment Mapというワードになっているので、Activityに変更してほしい
   2. 「Agent の認可判断ログ」→「AI Agent行動ログ」と変更してほしい
   3. エージェントタイルにおいて、エージェントの名前の左にロゴを表示してほしい
      1. （AIっぽいロゴ）窓口対応エージェント　みたいな感じ
   4. ワーニングマークは消してほしい



仕様書：
# Judgment UI ヘッダー/サイドバー改修指示（ClaudeCode用）
## 目的：審査員向けに“プロダクト”として見えるブランド配置にする
## ロゴ：/Users/fumiyaishiguchi/git/action-gated-authorization-poc/judgment-ui/public/judgment-ui-favicon.svg を使用

---

## 1. 変更ゴール（完成イメージ）

- 左上にロゴ＋プロダクト名＋サブタイトルを2段で表示し、ブランドを強く見せる
- 右上の小さなロゴ表示は撤去（重複をなくす）
- サイドバー上部に表示している「Judgment / Action-Gated Authorization」の重複を撤去
- ナビゲーション名称を「審査員が即理解できる語彙」に変更する

---

## 2. ヘッダー（Top Bar）改修仕様

### 2.1 左上：ブランドブロックを新設（最重要）

#### 構成（2段）
- 1段目：ロゴ（SVG） + `Judgment`
- 2段目：サブタイトル `AI Governance Platform`

#### ロゴ仕様
- 参照パス：
  - public 配下の静的アセットとして参照すること
  - `src="/judgment-ui-favicon.svg"` を使用
    - ※ public 配下のため、import ではなく URL 参照
- サイズ：
  - 高さ 32px（目安 28〜36pxの範囲で調整可）
- ロゴとタイトル間の余白：
  - 8px 程度

#### タイポ仕様
- `Judgment`：太字、視認性優先（例：font-semibold〜bold）
- `AI Governance Platform`：控えめ（例：text-sm、muted）

---

### 2.2 右上：重複ロゴを撤去

- 現在右上に存在する小さなロゴ（またはJudgmentロゴ）表示を削除する
- 右上はユーザーアイコン/アバターのみにする（Project表示を入れる場合は次項）

---

### 2.3 ヘッダー右側：Project表示の改善（任意だが推奨）

#### 現状
- `Project: gov-demo` が弱く、内部名が前に出ている

#### 修正案
- 右上（ユーザーアイコンの左）に以下を表示：
  - `Project: Government AI Oversight`
  - （任意）`Environment: Demo`

※ gov-demo は内部識別として残してもよいが、UI上は自然な英語名で表示する

---

## 3. サイドバー改修仕様

### 3.1 サイドバー上部のブランド表示を削除

- 現状の
  - `Judgment`
  - `Action-Gated Authorization`
  の表示は削除（ヘッダーと重複するため）

※ サイドバー上部は空白または薄い区切り線だけでよい

---

### 3.2 ナビゲーションの名称変更

#### 現状
- Map
- Graph

#### 修正
- Map → `Activity Log`
- Graph → `Governance Insights`

※ ルーティング（/map, /graph）は変更不要。表示ラベルのみ変更。

---

### 3.3 セクション見出しの整理（任意）
- `JUDGMENT` の見出しを `OVERVIEW` に変更、または削除
- `SETTINGS` は今回触らなくてよい（将来拡張で使用）

---

## 4. UIの整合性ルール（重要）

- ロゴは「左上のヘッダー」にのみ出す（重複禁止）
- プロダクト名は `Judgment` に統一
- サブタイトルは `AI Governance Platform` に統一（Map/Graph両ページで共通）
- 表示名（Activity Log / Governance Insights）はサイドバーとページタイトルで一致させる

---

## 5. 実装タスク（ClaudeCode向けチェックリスト）

1. public ロゴを `src="/judgment-ui-favicon.svg"` で参照してヘッダー左に配置
2. ヘッダー左に `Judgment` と `AI Governance Platform` の2段ブランドを実装
3. 右上の重複ロゴ表示を削除
4. サイドバー上部の `Judgment / Action-Gated Authorization` ブロックを削除
5. サイドバーのラベルを `Activity Log` / `Governance Insights` に変更
6. （任意）ヘッダー右に `Project: Government AI Oversight` を表示

---

## 6. 受け入れ基準（Acceptance Criteria）

- どのページでも、左上にロゴ＋Judgment＋AI Governance Platform が表示される
- ロゴは1箇所のみ（右上・サイドバー上部に重複表示がない）
- サイドバーの表示名が Activity Log / Governance Insights になっている
- 画面全体が“プロダクトの管理画面”として自然に見える（プロトタイプ感が減る）
