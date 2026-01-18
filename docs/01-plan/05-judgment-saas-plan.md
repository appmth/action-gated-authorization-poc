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
