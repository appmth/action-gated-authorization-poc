package authorization

import rego.v1

# OPA Input Schema (Fixed)
# {
#   "action": string,          # e.g., "get_resident_info"
#   "context": {
#     "purpose": string,       # e.g., "inquiry", "emergency"
#     "time": string,          # e.g., "business_hours", "after_hours"
#     "data_sensitivity": string # e.g., "required", "optional"
#   }
# }

# 最終アウトプット（PEPが使う）
default decision := {"allow": false, "reason": "default deny: no matching policy", "policy_id": "default", "tags": []}

# Allow 条件（あなたの PoC の最小）
allow if {
  input.action == "get_resident_info"
  input.context.purpose == "inquiry"
  input.context.time == "business_hours"
}

# Deny の理由（順番が大事：より具体的なものを上に）
deny_reason := "Denied: purpose must be 'inquiry'" if {
  input.action == "get_resident_info"
  input.context.purpose != "inquiry"
}

deny_reason := "Denied: access allowed only during business hours" if {
  input.action == "get_resident_info"
  input.context.purpose == "inquiry"
  input.context.time != "business_hours"
}

deny_reason := "Denied: action is not allowed" if {
  input.action != "get_resident_info"
}

# decision を組み立てる
decision := {
  "allow": true,
  "reason": "Allowed: inquiry during business hours",
  "policy_id": "P-001",
  "tags": ["pii", "audit-required"]
} if {
  allow
}

decision := {
  "allow": false,
  "reason": deny_reason,
  "policy_id": "P-002",
  "tags": ["pii-deny"]
} if {
  not allow
  deny_reason
}

