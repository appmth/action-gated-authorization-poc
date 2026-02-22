# デモシナリオ実装・モック準備計画（Step 07）

## 1. 目的
- `demo/02-naration.md` に定義された 3 分間のデモ動画を確実に撮影できる環境を整える。
- 判断レイヤがない「Before」状態と、詳細な判断が記録される「After」状態の対比を UI で表現可能にする。
- ナレーション（脚本）に完璧に合致したモックデータおよびシミュレーションツールを作成する。

---

## 2. 必要な機能・開発項目

### ① Before AGA：レガシーログ・ビューワー（現状の不全の可視化）
- **役割**: 脚本 0:00–1:00 の「問題提起フェーズ」で使用する。
- **仕様**:
  - 実行された API / Tool 名と "success" という文字列だけが並ぶ、無機質なリスト画面。
  - 「誰が」「なぜ」という情報が欠落していることを視覚的に強調する。
  - `judgment-ui` の隠しルート（例: `/legacy-logs`）として実装。

### ② シナリオ・データインジェクター（Scenario Injector）
- **役割**: ナレーションに登場する具体的な判断事例を Firestore に流し込む。
- **仕様**:
  - 以下の 3 つのキーシナリオを含むデータを生成する。
    1. **不適切な権限**: `assistant_agent` による `update_benefit_status` → **DENY**（理由：決定権限なし）
    2. **適切な権限**: `admin_agent` による `update_benefit_status` → **ALLOW**（理由：条件付き承認）
    3. **監査対象操作**: `assistant_agent` による `read_resident_record` → **ALLOW**（理由：範囲限定）
  - 各レコードにナレーションで説明可能な `Reason`（判断理由）を日本語で設定する。

### ③ 実行シミュレーター（Mock Agent & PEP）
- **役割**: 静的なデータだけでなく、デモ中に「実際に動いている感」を出すためのトリガー。
- **仕様**:
  - 指定された Role と Action を引数に取り、PEP（service-a）経由で Tool 呼び出しをシミュレートする簡単なスクリプト。
  - デモ撮影時に背後で走らせるか、UI 上のボタンで 1 件ずつトリガーできるようにする。

---

## 3. シナリオ詳細設計（ナレーション対応）

| フェーズ | ターゲット画面 | 必要なデータ・ツール |
| :--- | :--- | :--- |
| **0:00-1:00** | Legacy Log View | 理由・主体不明の成功ログ 10件程度 |
| **1:00-2:15** | Judgment Map | 上記インジェクターで生成した 3 事例を含む履歴 |
| **2:15-3:00** | Judgment Detail | 上記 DENY 事例の詳細。説得力のある `Context` json を含む |
| **2:15-3:00** | Judgment Graph | Allow: 68%, Deny: 32% 前後の統計モックデータ |

---

## 4. 実装ステップ

### Step 7.1: UI モックの「ナレーション同期」
- `judgment-ui` の React コンポーネント内のスタティックな値を、ナレーション原稿と 1 字 1 句合わせる。
- Graph 画面の割合やエージェント名を原稿通りに修正。

### Step 7.2: シナリオデータ・スクリプトの作成
- `scripts/inject-demo-scenario.py` を作成。
- Firestore の `judgments` コレクションおよび `metrics` 用のデータを直接書き換える。

### Step 7.3: 撮影用環境チェック
- OBS で `judgment-ui` をキャプチャし、フォントサイズや色の認識性を確認。
- 画面遷移（Map → Detail → Graph → Map）がスムーズに行えるか確認。

---

## 5. 成果物
- `judgment-ui` におけるレガシーログ表示モード。
- シナリオデータ投入スクリプト（`scripts/inject-demo-scenario.py`）。
- ナレーションに最適化された Firestore 初期データ。

---
## 補足：モックツール（scripts/scenario_runner.py）のインターフェース案
```bash
# 権限不足でブロックされるケースを生成
python scripts/scenario_runner.py --agent assistant --action update_benefit_status

# 権限ありで通過するケースを生成
python scripts/scenario_runner.py --agent admin --action update_benefit_status
```
これにより、デモ動画内で「操作を行ってから Map に反映される」様子をリアルタイムに撮影可能にする。
