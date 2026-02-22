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

---

# Judgment UI 速度改善 仕様書（Activity Log / Governance Insights）

## 0. 目的

Judgment UI の **初回表示・遷移・戻る操作**が遅く、デモ体験を損ねている。
以下を満たす形で **体感速度を最大化**する。

* **Activity Log**

  * 初回アクセスで「画面枠（KPI/Agent/Control bar/テーブル枠）」は **即時表示**
  * ログテーブルは **遅延ロード**（Skeleton → データ反映）
  * ログ行クリック → 詳細画面は **一瞬で表示**（prefetch / キャッシュ）
  * 詳細 → 一覧へ戻るときも **即時復帰**（ブラウザ内キャッシュ）

* **Governance Insights**

  * 初回アクセスで「ページ枠」は **即時表示**
  * 集計（メトリクス）は **遅延ロード**（セクション単位で段階表示）
  * 一度表示した集計は **キャッシュ**し、戻ったときに再集計で待たない

> 既存の API/データモデルは原則維持。必要なら軽微な API 追加は可。

---

## 1. 現状前提（仕様ソース）

* Activity Log は `GET /activity`（Firestore `judgment_events`）の **カーソルページング**を使う想定【】
* Judgment Detail は `GET /judgments/{id}`【】
* Governance 側は `/metrics/*` 系で集計（Firestore 集計が原因で重い可能性）【】
* Firestore は `ttl_at` により **3日 TTL**（72h）で自動削除【】
* UI 側は Activity/Governance/Detail を持つ構成【】、Cross-page filter は URL query を使う【】

---

## 2. 速度改善 方針（UI）

### 2.1 “画面枠” と “重いデータ” を分離

* ページ初回描画では以下を **先に描画**して “表示された感” を作る

  * Header / Sidebar
  * KPI カード（値は Skeleton でも可）
  * Agents 行（一覧は先に、カウントは Skeleton でも可）
  * Control Bar（操作可能状態で出す）
  * Table のヘッダーと Skeleton rows

* **重い取得**は後から差し込む

  * Activity: `/activity` のページ 1 取得
  * Governance: `/metrics/overview` など集計 API 群

### 2.2 クライアントキャッシュの標準化

以下を導入して、**戻る/再訪問で待たない**ようにする（どちらでも可、実装しやすい方で）

* React Query（TanStack Query）推奨 / もしくは SWR
  要件：
* ページ単位ではなく、**データ単位**でキャッシュ（例：activity list、detail、metrics）
* `staleTime` を設定し「すぐ戻る」ケースは再 fetch しない
* `keepPreviousData` を活用しフィルタ切替でチラつかない

---

## 3. Activity Log（/activity）要件

### 3.1 初回表示の体感改善

**要件**

* 初回アクセス時、`/activity` は **即座に UI 枠を表示**し、ログ取得完了を待たない
* ログ一覧は「Loading…」ではなく **テーブル Skeleton**で表現
* 取得完了後に rows を差し替え（レイアウトジャンプを最小化）

**対象データ**

* `GET /activity?limit=...&cursor=...&agent_id=...&decision=...&tool=...`【】

### 3.2 ページング（既存要望の再整理）

* `/activity` は **カーソルページング**を前提とする【】
* UI は「Next/Prev」＋「Page size」＋「現在件数/総件数（総件数が取れない場合は “Loaded N items”）」で良い
  （Firestore の都合で total を正確に出せないなら無理に出さない）

### 3.3 ログ行 → 詳細が遅い問題（最重要）

**要件**

* 行クリックした瞬間に **画面遷移は発生**し、Detail ページ枠を即時表示
* クリック時点で、可能なら **prefetch** を実施して体感を短縮
* Detail データが到着するまで Skeleton（ただし「白紙待ち」を作らない）

**取得**

* `GET /judgments/{request_id}`【】

### 3.4 詳細 → 一覧へ戻るが遅い問題（キャッシュ）

**要件**

* Detail から Back したら **瞬時に一覧へ復帰**する（スクロール位置も可能なら復元）
* 一覧のフィルタ状態（agent/tool/decision/reason）は URL query のまま維持【】
* 一覧データはキャッシュに残し、戻った直後は再 fetch でブロックしない
  （必要なら裏で revalidate は OK）

### 3.5 “ログ蓄積を配慮できていない” への対応（UI観点）

* UI は常に `/activity` をソースにする（旧 `/judgments` は非推奨）【】
* Live モード（数秒ポーリング）がある場合：

  * 既存 rows を保持しつつ「新着だけ上に差し込む」または「最新ページを再取得して差分反映」
  * ただし**表示ブロック禁止**（更新中でも UI は操作可能）

---

## 4. Governance Insights（/governance）要件

### 4.1 初回表示の体感改善（段階表示）

**要件**

* `/governance` の初回アクセス時、ページ枠を即時表示
* メトリクスは **セクション単位で遅延ロード**し、表示できたところから順に出す

  * 例：Overview（軽い）→ Tool-wise Risk → Reason breakdown → Heatmap の順
* 各セクションは Skeleton / Placeholder を持つ

**想定 API**

* `/metrics/overview` 等【】

### 4.2 キャッシュ

**要件**

* 一度表示したメトリクスはキャッシュ（短時間の再訪で待たない）
* フィルタ条件（agent/tool 等）でキー分割してキャッシュする（混線防止）
* “Refresh” 操作時のみ明示的に invalidate して再取得

---

## 5. 受け入れ条件（Acceptance Criteria）

### 5.1 Activity Log

* `/activity` 初回アクセス：**テーブル枠が即表示**、rows は Skeleton → データ反映
* 行クリック：**Detail 画面に即遷移**、1秒以内に「何か」が表示される（Skeleton含む）
* Detail → Back：**即座に一覧復帰**、フィルタ維持、可能ならスクロール復元
* Live ON 中でも UI が固まらない

### 5.2 Governance Insights

* `/governance` 初回アクセス：ページ枠が即表示、各セクションが順に埋まる
* `/activity` ↔ `/governance` の往復で、2回目以降は待ちが体感で大幅減（キャッシュ効果）

---

## 6. 実装タスク（ClaudeCode向け）

1. 現状のデータ取得実装を確認し、**ページ初回描画をブロックしている箇所**を特定
2. Activity:

   * list 取得を遅延化（Skeleton 先出し）
   * detail prefetch（クリック or hover）導入
   * list/detail のキャッシュ導入、Back 復帰の高速化
3. Governance:

   * 各メトリクスをセクション単位で遅延取得
   * キャッシュ導入（Refresh でのみ invalidate）
4. 計測：

   * ブラウザの Performance / Network で、初回のボトルネックが API/レンダリングどちらか判定し、改善前後を簡易比較
5. 既存 API 仕様（/activity, /judgments/{id}, /metrics/*）に沿って動作確認【】【】

---

## 7. 補足（データ側の前提）

* Firestore `judgment_events` は `ttl_at` で 3日 TTL 運用【】
  UI は古いログを前提にしない（常に直近の範囲で快適に閲覧できればOK）

---
