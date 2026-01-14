package authorization

import rego.v1

# 最終アウトプット（PEPが使う）
default decision := {"allow": false, "reason": "default deny: no matching policy"}

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
decision := {"allow": true, "reason": "Allowed: inquiry during business hours"} if {
  allow
}

decision := {"allow": false, "reason": deny_reason} if {
  not allow
  deny_reason
}
