# Judgment 要件定義（Agent Governance / Control Plane）

## 1. プロダクト概要

### 1.1 プロダクト名
**Judgment**

### 1.2 プロダクト定義
Judgment は、
**AI Agent が実行するあらゆる Action を「事前に制御し、説明可能な形で統治する」ための Agent Governance / Control Plane** である。

Judgment は AI Agent を賢くするものではない。
**AI Agent を信用しなくても業務・組織・制度が破綻しない構造を提供する。**

---

## 2. 解決したい本質的課題

### 2.1 背景課題
- AI Agent が業務API・SaaS・社内システムを横断的に操作し始めている
- 認証（AuthN）はあるが、**実行可否の判断（AuthZ）が Agent 時代に対応していない**
- 以下が成立していない：
  - 実行前に止められない
  - なぜ実行した／止めたか説明できない
  - エージェント単位での統制・停止ができない

### 2.2 Judgment が解く問い
- **「この Agent が、この Context で、この API を叩いてよいのか？」**
- **「それを誰が・どこで・どういう理由で許可したのか？」**

---

## 3. 想定ユーザー

### 3.1 一次ユーザー（管理・統制側）
- プラットフォームエンジニア
- セキュリティ / ガバナンス担当
- SRE / Platform Team
- 行政・金融・医療など説明責任が必須な組織

### 3.2 二次ユーザー（実行主体）
- AI Agent（社内Agent / SaaS Agent / 外部Agent）
- Agentを開発・運用するエンジニア

---

## 4. Judgment の基本思想（非機能要件の核）

1. **実行前制御（Preventive Control）**
   - 事後検知ではなく、必ず実行前に止められる
2. **責務分離**
   - 判断（PDP）と実行（PEP）を分離
   - Agent は「提案」まで
3. **説明責任（Explainability）**
   - Allow / Deny に必ず理由がある
   - ログとして追跡可能
4. **Agent 非信頼前提**
   - Agent は誤る・暴走する前提で設計

---

## 5. 機能要件

### 5.1 エージェント管理
- Agent の登録・一覧・無効化
- Agent 単位での状態管理（Active / Suspended / Blocked）

**Agent 属性**
| 属性 | 説明 |
|------|------|
| agent_id | Agent の一意識別子 |
| agent_name | Agent の名前 |
| description | Agent の説明 |
| status | 状態（Active / Suspended / Blocked） |
| registered_at | 登録日時 |

---

### 5.2 API 管理（制御対象リソース）
- 制御対象 API の登録
- API の認証方式設定（Access Key / JWT）
- API メタ情報管理

**API 属性**
| 属性 | 説明 |
|------|------|
| api_id | API の一意識別子 |
| endpoint | エンドポイント URL |
| auth_type | 認証方式（Access Key / JWT） |
| description | API の説明 |
| owner | API の所有者 |

---

### 5.3 ポリシー管理（PDP）
- ポリシー登録・更新・削除
- ポリシーに以下を紐付け可能：
  - Agent
  - API
  - Context 条件

**PDP input 例**
```json
{
  "agent": {},
  "action": {},
  "resource": {},
  "context": {}
}
```

**PDP output**
- `allow` / `deny`
- `reason`（必須）

---

### 5.4 Context 制御
| Context | 説明 |
|---------|------|
| purpose | 業務目的 |
| time | 時間帯 |
| data_sensitivity | PIIレベル |
| environment | prod / staging |

**方針**
- Context は Agent が勝手に生成しない
- UI または上位システムが明示的に渡す

---

### 5.5 実行制御（PEP）
- すべての Action 実行前に PDP へ照会
- Allow の場合のみ API 実行
- Deny の場合は副作用ゼロ
- **PEP を通らない実行経路を作らない**

---

### 5.6 トークン発行（許可時）
- Allow 時のみスコープ限定 JWT を Agent に返却
- Agent は JWT を使って API 実行

---

### 5.7 ログ・監査

**必須ログ**
| フィールド | 説明 |
|------------|------|
| request_id | リクエスト識別子 |
| agent_id | Agent 識別子 |
| action | 実行しようとした Action |
| context | 実行時の Context |
| decision | allow / deny |
| reason | 判断理由 |
| timestamp | タイムスタンプ |

**用途**
- 監査
- 事故調査
- Agent 停止判断

---

### 5.8 管理画面（Judgment Console）

**エージェント管理画面**
- 登録済み Agent
- 状態・拒否率
- 強制停止

**実行履歴 / 監査画面**
- Allow / Deny の時系列表示
- reason の可視化
- request_id 追跡

---

## 6. 非機能要件

### 6.1 セキュリティ
- Judgment 自体は閉域（Private）
- 外部公開は最小限

### 6.2 拡張性
- Agent / API / Policy は N:N 関係
- マイクロサービス増加に耐える

### 6.3 実装方針
| フェーズ | 方式 |
|----------|------|
| PoC | アプリ内 PEP |
| 本命 | Envoy / Sidecar PEP |

---

## 7. スコープ外（やらないこと）

- Agent の思考最適化
- Agent オーケストレーション
- LLM 精度競争
- 業務ロジックの自動化

---

## 8. Judgment の位置付け

| 分類 | Judgment か？ |
|------|---------------|
| IAM | ❌ |
| Agent Framework | ❌ |
| LLM Platform | ❌ |

👉 **Agent 時代の実行権限・責任・統制を引き受ける Control Plane**

---

## 9. 一文定義（対外用）

> **Judgment は、AI Agent が「何を実行してよいか」を実行前に判断し、理由付きで止められる Agent Governance プラットフォームです。**

---

## 10. プロダクトロードマップ

### フェーズ0：思想の固定（完了）

**期間：** 〜現在（完了）

**作るもの**
- AGA（Action-Gated Authorization）の思想整理
- なぜ AI Agent に既存認可が効かないかの言語化
- 自治体・PII・説明責任を軸にした問題設定
- Zenn 記事（思想編・技術選定編）

**作らないもの**
- 管理画面
- マルチエージェント
- SaaS要素

**目的**
- 「この問題は存在する」ことを世の中に認識させる
- **Judgment = 問題提起者** というポジション確立

---

### フェーズ1：最小PoC（ハッカソン提出物）

**期間：** 今〜2/15

**作るもの（すでにほぼ達成）**
- Agent（Gemini）※計画生成のみ
- PEP（Cloud Run）
- PDP（OPA on Cloud Run）
- Action + Context による Allow / Deny
- 実行前ブロック（副作用ゼロ）
- reason（判断理由）の返却とログ
- request_id による監査トレース
- 最小UI
  - 問い合わせ画面（市民側）
  - Judgment 管理画面（ログ・判断理由・停止）

**作らないもの**
- 認証（Auth0）
- Envoy
- 複数エージェント管理
- 永続データ基盤（本格DB）

**目的**
- 「構造が成立する」ことの証明
- 審査員に **「これ、ないと事故るやつだ」** と思わせる

---

### フェーズ2：Judgment Core OSS（信用の確立）

**期間：** ハッカソン後〜1ヶ月

**作るもの（OSS）**
- Judgment Core（最小）
  - PEP → PDP 呼び出しインターフェース
  - Context schema（purpose / time / sensitivity）
  - Rego ポリシー例
  - audit log フォーマット
- README / Design Doc
  - AGAとは何か
  - 何を解決し、何を解決しないか
  - なぜ Agent を信用しないのか

**作らないもの**
- 管理UIの完成形
- マルチテナント
- 課金
- 高度なIAM連携

**目的**
- OPA / Security / Platform界隈からの信頼獲得
- 「触れる思想」にする
- **Judgment = 実在する構造** という認知

---

### フェーズ3：運用視点の拡張（プロダクトの芽）

**期間：** 〜3ヶ月

**作るもの**
- Judgment 管理画面 v1
  - エージェント登録
  - ポリシー登録（エージェント単位）
  - API登録（叩いてよいAPIの定義）
  - 実行ログ・拒否率の可視化
  - エージェント停止（Kill Switch）
  - ポリシー変更の即時反映

**作らないもの**
- フルSaaS
- 課金
- 高度なUX最適化

**目的**
- 「運用できる」ことの証明
- PoC → プロダクト手前 への進化
- B2B SaaS の匂いを出す

---

### フェーズ4：エージェント統制プラットフォーム化

**期間：** 〜6ヶ月

**作るもの**
- 複数エージェント管理
- エージェントごとのポリシー束
- APIアクセスの動的制御
- PDP判断結果に応じた JWT 発行
- Envoy 導入（横断PEP）
- 組織 / プロジェクト単位の管理

**作らないもの**
- 汎用ワークフローエンジン
- AIの中身の最適化

**目的**
- **Judgment = AI Agent 統制レイヤー**
- 「エージェントオーケストレーション × 認可」の確立
- 競合不在ゾーンに入る

---

### フェーズ5：B2B SaaS or エコシステム

**期間：** 1年〜

**選択肢A：SaaS**
- マルチテナント
- 課金
- SOC2 / ISMS
- 企業導入

**選択肢B：OSS + Commercial**
- Core OSS
- Enterprise版
- コンサル / 導入支援

**目的**
- Judgmentを「ないと困る存在」にする
- AI Agent時代の **"認可の標準語"** を握る

---

### ロードマップ一行まとめ

| フェーズ | ゴール |
|----------|--------|
| フェーズ1 | 事故を止められることを見せる |
| フェーズ2 | 思想を奪われない形でOSS化 |
| フェーズ3 | 運用できると分かる |
| フェーズ4 | 唯一無二の統制レイヤーになる |
| フェーズ5 | 市場を作る |
