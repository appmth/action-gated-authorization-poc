# Service B: PDP (OPA) 設計書

Policy Decision Point (PDP) として、ビジネスロジックに基づく認可判断を中央集権的に行います。

## 1. 入力スキーマ (input)
`service-a` から受け取るデータ構造：
```json
{
  "input": {
    "action": "string",
    "context": {
      "purpose": "string",
      "time": "string",
      "data_sensitivity": "string"
    }
  }
}
```

## 2. 判定ロジック (Rego)
`policy/authorization.rego` に定義されたルールに基づき判定を行います。

- **デフォルト**: `allow = false` (Fail Closed)
- **許可条件**:
  - 例: `action == "get_resident_info"` かつ `purpose == "inquiry"` の場合に許可。
- **メタデータの付与**:
  - `policy_id`: 判定に適用されたルールの識別子。
  - `tags`: 判断に関連するタグ（例: `"pii"`, `"audit-required"`）。

## 3. 出力スキーマ (result)
```json
{
  "result": {
    "allow": true,
    "reason": "OK",
    "policy_id": "pol_001",
    "tags": ["pii"]
  }
}
```

## 4. 構成管理
- **Dockerfile**: `envsubst` を用いて、起動時に `config.yaml.template` からログ設定等を動的に反映。
- **環境変数**: `OPA_LOG_FORMAT` 等で、環境に応じたログ形式（text/json）を切り替え。
