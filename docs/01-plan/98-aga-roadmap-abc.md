# AGA ロードマップ：A / B / C 3つの世界

> **前提**: このドキュメントは PoC 完成後の「その後の世界」を示す。
> PoC（Week 0〜4）で証明した3点を土台に、どこへ進むかを決めるためのもの。

---

## 本ドキュメントの位置づけ

| ドキュメント | 内容 |
|-------------|------|
| 01-master-plan.md | ハッカソン実行計画（Week 0〜4） |
| 02-poc-scope.md | PoC で証明する3点の定義 |
| 03-nextjs-catchup-guide.md | Judgment UI 実装 & Next.js 学習 |
| **04-aga-roadmap-abc.md** | **PoC 後のロードマップ（本ドキュメント）** |

---

## 重要な判断基準

- **全部やらない**
- **どれか1つを選ぶ**
- **他は「やらない」と決める**

3つのルートは並行ではなく、選択。

---

## 全体像（5ステージ）

```
Stage 1: OSSとして使われ始める
    ↓
Stage 2: 実装から仕様へ昇格
    ↓
Stage 3: 運用に耐えるプロダクト化
    ↓
Stage 4: プラグイン化（横断導入）
    ↓
Stage 5: 準標準・エコシステム化
```

---

# A. 短期で勝つ世界

**ターゲット**: ハッカソン優勝 / 転職 / CFP 採択

## ゴール

- AGA を「説明可能な設計思想」として確立
- 実装量を増やさず、評価レバレッジを最大化

## 到達ステージ

**Stage 1 → Stage 2**

---

## Stage 1: OSSとして「使われ始める」

### 目的

他人が clone して動かせる。README を読めば思想が伝わる。

### やること

1. **Quickstart を10分以内で完走可能に**
   - docker-compose up で全部立ち上がる
   - curl でリクエスト → Allow/Deny が見える

2. **example 追加（事故シナリオ別）**
   - PII アクセス制御
   - 業務時間外アクセス
   - 金額閾値超過
   - 二人承認（dual approval）
   - 役職制約

3. **README 整備**
   - どこまでが AGA の責務か
   - どこからが利用者責務か
   - 「AGA は IAM を置き換えない」を明記

### 成功指標

- Issue / Slack で「動いた」「ここ詰まった」が来る
- Star が付き始める

---

## Stage 2: AGAを「仕様」にする

### 目的

AGA = 再現可能な構造 になる。他人が「自分の実装は AGA 準拠」と言える。

### やること

1. **AGA Conformance（準拠）定義**

   ```yaml
   # AGA 準拠の最小要件
   - PEP が request_id を発行する
   - PDP が decision + reason を構造化して返す
   - Deny は副作用ゼロ（Tool を呼ばない）
   - Trace に AGENT / PEP / PDP / TOOL が揃う
   ```

2. **Judgment Schema v1 を固定**

   ```json
   {
     "request_id": "uuid",
     "action": "string",
     "context": {},
     "decision": { "allow": "bool", "reason": "string" },
     "pep_enforcement": {
       "pdp_called": "bool",
       "tool_called": "bool",
       "side_effects": "none | unknown"
     },
     "trace": []
   }
   ```

3. **最小 Conformance Test**
   - Deny → `tool_called=false` を保証するテスト
   - reason が空でないことを保証するテスト

### 成功指標

- 他人が「自分の実装は AGA 準拠」と言える
- Conformance バッジが作れる

---

## この世界の価値

| 活用先 | 効果 |
|--------|------|
| CFP | 「設計思想を標準化した」として登壇できる |
| ハッカソン | 審査員に「拡張性・思想」で刺さる |
| 転職 | 「OSS で設計標準を作った人」として語れる |

---

# B. 現場に刺す世界

**ターゲット**: 実プロダクト導入 / 業務システム

## ゴール

AGA を「現場で壊れない仕組み」にする

## 到達ステージ

**Stage 3**

---

## Stage 3: 実運用の壁を越える

### 目的

PoC ではなく、業務に耐える。

### 現実の論点

| 論点 | PoC での状態 | 実運用で必要 |
|------|-------------|-------------|
| スケール | インメモリ | Firestore / BigQuery |
| 改ざん耐性 | なし | 署名 / WORM |
| 環境分離 | なし | dev / stg / prod |
| 監査要件 | ログ出力のみ | 保持期間 / 検索 / エクスポート |

### やること

1. **Judgment 保存設計**
   - Firestore に保存（request_id = document ID）
   - TTL 設定 + アーカイブ先（BigQuery / GCS）

2. **改ざん耐性**
   - Judgment に署名を付与
   - WORM（Write Once Read Many）的保管の検討

3. **最低限の RBAC**
   - 誰が Judgment を見られるか
   - 誰が Policy を変更できるか

4. **Policy versioning の厳密化**
   - 判断時の policy_version を必ず記録
   - 過去の判断を再現可能に

### 成功指標

- 「デモは動く」ではなく「入れても事故らない」
- 実際のプロダクトに導入される

---

## この世界の価値

| 活用先 | 効果 |
|--------|------|
| プロダクト導入 | 「壊れない」設計として採用される |
| Platform / Security | 信頼される基盤として評価される |
| 組織内評価 | 任される設計になる |

---

# C. 業界に広げる世界

**ターゲット**: OPA コミュニティ / AI Agent エコシステム

## ゴール

AGA が「概念」として自走する。自分の手を離れて広がる。

## 到達ステージ

**Stage 4 → Stage 5**

---

## Stage 4: プラグイン化

### 目的

どの Agent にも前段で差せる。導入コスト極小化。

### やること（順番固定）

1. **PEP SDK（最小）**
   - Python / Node / Go のいずれか
   - `@aga.gate` デコレータで関数をラップ

   ```python
   from aga import gate

   @gate(action="get_resident_info")
   def get_resident_info(context):
       # PEP → PDP → 判断 が自動で挟まる
       return fetch_data(context)
   ```

2. **OPA Policy Pack**
   - 業務時間制御
   - 金額閾値
   - PII アクセス制御
   - 再利用可能なルールセット

3. **Tool Wrapper 標準**
   - 既存 Tool を AGA 対応にする最小ラッパー
   - OpenAI Function Calling / LangChain Tool への対応

### 成功指標

- 「1時間で AGA を入れた」が可能
- GitHub で「aga-plugin-*」が増える

---

## Stage 5: 準標準化

### 目的

AGA が個人名から切り離される。検索・引用される概念になる。

### やること

1. **OPA コミュニティでの議論**
   - Styra / OPA Slack での紹介
   - Policy Patterns としての提案

2. **IAM では足りない理由の文章化**
   - 「認証 ≠ 認可 ≠ Action 制御」の説明
   - RBAC / ABAC / ReBAC との違い

3. **ワークショップ資料（手順重視）**
   - 「Agent を AGA で守る」ハンズオン
   - 30分で動かせる教材

4. **利用事例の蓄積**
   - 公開できるユースケース
   - Before / After の比較

### 成功指標

- "AGA" が検索・引用される
- Issue / PR が自分以外から来る
- BigTech の AI 安全性ドキュメントに言及される

---

## この世界の価値

| 活用先 | 効果 |
|--------|------|
| 業界影響力 | 概念の提唱者として認知される |
| OSS キャリア | メンテナとしての実績 |
| 標準化 | Agent 認可の標準を作った人になる |

---

# 3つの世界の比較

| | A. 短期 | B. 現場 | C. 業界 |
|---|---------|--------|--------|
| **ターゲット** | ハッカソン / 転職 / CFP | プロダクト導入 | エコシステム |
| **到達ステージ** | 1→2 | 3 | 4→5 |
| **必要期間** | 1〜3ヶ月 | 3〜6ヶ月 | 6ヶ月〜 |
| **主なアウトプット** | 仕様書 / Conformance | 本番稼働 | SDK / Policy Pack |
| **リスク** | 実績が浅い | 運用負荷 | 広がらない |

---

# 次のアクション

## PoC 完成後に決めること

1. **A / B / C のどれを選ぶか**
   - 複数選ばない
   - 選ばなかったものは「やらない」と明示

2. **選んだルートの Stage 1 を具体化**
   - タスク分解
   - 期限設定

3. **PoC の成果物を整理**
   - デモ URL
   - GitHub リポジトリ
   - Zenn 記事
   - アーキテクチャ図

---

## PoC との接続（Week 4 終了時点）

```
PoC で証明済み:
├── Agent の Action を実行前に止められる
├── Context で Allow/Deny が変わる
└── 判断理由が説明可能な形で残る

→ A/B/C どのルートでも、この3点が土台になる
```

---

# やらないこと（明示）

- 3つのルートを同時に進めない
- 完璧な IAM を作らない
- LLM の賢さを競わない
- UI の作り込みに時間を使いすぎない

**選択と集中**が、PoC 後も最重要。
