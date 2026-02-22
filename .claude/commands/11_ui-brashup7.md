- architect - 設計・スコープ定義・タスク分割・Done条件の定義などを担当
- Implementer - architectが定義したタスクの実装を担当
- tester - ローカル動作の検証・デモ準備・デプロイ確認を担当
でチームを組んで、
architect エージェントに以下の作業を依頼してください。

前提ドキュメント：
- /Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/02-design
- 本リポジトリ内の各種README
- 本文章下部の仕様書または依頼文

開発ルール：
以下の順番で開発すること
1. 設計書（/Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/02-design）の作成（修正）
2. 実装
3. ローカルへのデプロイ
4. ローカルのテスト仕様書の更新とテスト実施（/Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/03-test）
5. GCP へのデプロイ
6. GCP のテスト仕様書の更新とテスト実施（/Users/fumiyaishiguchi/git/action-gated-authorization-poc/docs/03-test）

以下をそのまま ClaudeCode に渡してください。

---

# Judgment UI 改修依頼（UI整合性・表示不具合・データ整合性）

現状のUIに以下の問題があるため、設計レベルから整理し直し、UI・状態管理・データ取得ロジックを含めて改修してください。

---

# 1. Agent Risk Heatmap（Governance Insights）

## 1-1. レイアウト問題

### ❌ 現状課題

* Heatmap の横幅が他カードと揃っていない
* 右側の Total / Deny / Rate 表示が詰まっている
* エージェント数が正しく表示されていない
* 実際のデータを使っていない可能性がある

### ✅ 改修要件

* 親コンテナと同じ max-width / padding を適用
* 横スクロールではなく、レスポンシブ grid で整列
* 右側の統計エリアは固定幅カラム（例：220px）に分離
* テキスト詰まり防止（line-height / spacing 修正）

### データ要件

* Heatmapは必ず実際のログデータから集計すること
* 集計単位：1時間バケット
* 24時間分を表示
* Deny Rate = deny_count / total_count
* データが存在しない時間帯は N/A 表示

データが疑わしい状態は許容しない。
必ずAPIから取得し、useEffectで再計算ではなく、
バックエンドで集計して返す設計に変更する。

---

# 2. Activity Log（UI整合性）

## 2-1. All Agents アイコン

### ❌ 現状

* 人型アイコンになっている

### ✅ 改修

* 単体人型ではなく「複数エージェント」を示すアイコンに変更
* 例：

  * stacked robots
  * grid robots
  * group icon

デザインはエージェントカードと統一感を持たせること。

---

## 2-2. Last updated の位置

### ❌ 現状

* 右端に単独表示
* UI的に浮いている
* 日本語混在

### ✅ 改修

* 「AI Agent Activity Log」の右側に配置
* 英語に統一（Last updated: xx:xx）
* フォントサイズを小さく
* グレーで弱調表示

---

## 2-3. Selected 表示が被っている

### ❌ 現状

* Selected ラベルがエージェント名と重なっている

### ✅ 改修

* Selected バッジはカード左上に絶対配置
* エージェント名とは重ならない余白を確保
* サイズは小さめ
* もしくは左側に青いボーダーのみでも良い（よりクリーン）

---

# 3. Behavior セクション

## ❌ 現状問題

* エージェント数が少ない
* Total / Deny 表示が詰まっている
* HeatmapとActivityで数が一致していない可能性

## ✅ 改修要件

* エージェントは現在存在する全エージェントを表示
* フィルター適用時のみ絞り込む
* Total数はログ母数と一致すること
* ActivityとGovernanceでロジックを共通化する

UI修正：

* 右側統計を縦並びに変更
* 数値は太字
* ラベルは小さめ
* paddingを増やす

---

# 4. Tool-wise Risk Profile 不具合

## ❌ 問題

benefit / resident をクリックすると
エージェント数が明らかにおかしくなる

## ✅ 改修要件

* Toolフィルター適用時：

  * エージェント数は「そのToolに対して行動したエージェント数」
  * 全体数と混在しない
* フィルター状態はURLクエリと同期
* フィルター解除時に完全リセット

データ整合性チェックを追加：

* フィルター適用後の合計 = 表示ログ件数と一致

---

# 5. パフォーマンス改善（重要）

## 5-1 Activity Log

### 初回表示が遅い

対応：

* 画面枠は即時表示（Skeleton）
* ログテーブルのみ非同期ロード
* React Query / SWR などでキャッシュ

### 詳細画面遷移が遅い

* 一覧取得時に必要最低限の詳細データも一緒に持つ
* 遷移時に再fetchしない

### 戻る時が遅い

* ログ一覧はメモリキャッシュ保持
* React state保持
* 強制リロードしない

---

## 5-2 Governance Insights

* 集計はバックエンド側で事前集計
* 初回表示時にSkeleton表示
* キャッシュ保持（5分）

---

# 6. 設計整理（最重要）

以下を再設計すること：

* ログ取得ロジック
* 集計ロジック
* フィルター状態管理
* URL同期
* キャッシュ戦略

フロントで毎回再計算する設計はやめる。
バックエンドで必要な集計を返す設計に変更。

---

# 7. UI方針まとめ

* 情報の密度は高いが「詰まって見えない」設計
* 数値は視覚的階層を明確に
* 選択状態は一目でわかる
* フィルター状態は常に可視化
* 表示データは必ず整合性が取れていること

---

# 実施後の確認事項

* Heatmapの合計値とActivityの合計値が一致
* Toolフィルターで数値破綻しない
* エージェント全件表示される
* Selected表示が重ならない
* 初回表示が体感高速

---

以上を全て改修してください。
UI修正だけでなく、データ整合性・パフォーマンス含めて全面的に見直してください。
