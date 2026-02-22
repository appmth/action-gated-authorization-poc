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

# Set of known actions
known_actions := {"get_resident_info", "read_resident_record", "update_benefit_status", "send_official_notice"}

# ===== Allow rules =====

# get_resident_info
allow if {
  input.action == "get_resident_info"
  input.context.purpose == "inquiry"
  input.context.time == "business_hours"
}

# read_resident_record
allow if {
  input.action == "read_resident_record"
  input.context.purpose in {"audit", "inquiry"}
  input.context.time == "business_hours"
}

# update_benefit_status
allow if {
  input.action == "update_benefit_status"
  input.context.purpose == "approval"
  input.context.time == "business_hours"
}

# send_official_notice (business hours notification)
allow if {
  input.action == "send_official_notice"
  input.context.purpose == "notification"
  input.context.time == "business_hours"
}

# send_official_notice (emergency any time)
allow if {
  input.action == "send_official_notice"
  input.context.purpose == "emergency"
}

# ===== Deny reasons =====

# get_resident_info deny reasons
deny_reason := "Denied: purpose must be 'inquiry'" if {
  input.action == "get_resident_info"
  input.context.purpose != "inquiry"
}

deny_reason := "Denied: access allowed only during business hours" if {
  input.action == "get_resident_info"
  input.context.purpose == "inquiry"
  input.context.time != "business_hours"
}

# read_resident_record deny reason
deny_reason := "Denied: full record access requires audit or inquiry purpose during business hours" if {
  input.action == "read_resident_record"
  not allow
}

# update_benefit_status deny reason
deny_reason := "Denied: benefit status update requires approval purpose during business hours" if {
  input.action == "update_benefit_status"
  not allow
}

# send_official_notice deny reason
deny_reason := "Denied: official notice requires notification purpose during business hours or emergency" if {
  input.action == "send_official_notice"
  not allow
}

# Unknown action deny reason
deny_reason := "Denied: action is not allowed" if {
  not input.action in known_actions
}

# ===== Decision blocks =====

# get_resident_info ALLOW
decision := {
  "allow": true,
  "reason": "Allowed: inquiry during business hours",
  "policy_id": "P-001",
  "tags": ["pii", "audit-required"],
} if {
  allow
  input.action == "get_resident_info"
}

# get_resident_info DENY
decision := {
  "allow": false,
  "reason": deny_reason,
  "policy_id": "P-002",
  "tags": ["pii-deny"],
} if {
  not allow
  input.action == "get_resident_info"
  deny_reason
}

# read_resident_record ALLOW
decision := {
  "allow": true,
  "reason": "Allowed: record access for audit/inquiry during business hours",
  "policy_id": "P-003",
  "tags": ["pii", "full-record", "audit-required"],
} if {
  allow
  input.action == "read_resident_record"
}

# read_resident_record DENY
decision := {
  "allow": false,
  "reason": deny_reason,
  "policy_id": "P-004",
  "tags": ["pii", "full-record", "denied"],
} if {
  not allow
  input.action == "read_resident_record"
  deny_reason
}

# update_benefit_status ALLOW
decision := {
  "allow": true,
  "reason": "Allowed: benefit status update with approval during business hours",
  "policy_id": "P-005",
  "tags": ["money", "human-required", "high-risk"],
} if {
  allow
  input.action == "update_benefit_status"
}

# update_benefit_status DENY
decision := {
  "allow": false,
  "reason": deny_reason,
  "policy_id": "P-006",
  "tags": ["money", "high-risk", "denied"],
} if {
  not allow
  input.action == "update_benefit_status"
  deny_reason
}

# send_official_notice ALLOW
decision := {
  "allow": true,
  "reason": "Allowed: official notice permitted",
  "policy_id": "P-007",
  "tags": ["official", "notification"],
} if {
  allow
  input.action == "send_official_notice"
}

# send_official_notice DENY
decision := {
  "allow": false,
  "reason": deny_reason,
  "policy_id": "P-008",
  "tags": ["official", "notification", "denied"],
} if {
  not allow
  input.action == "send_official_notice"
  deny_reason
}

# Unknown action DENY
decision := {
  "allow": false,
  "reason": deny_reason,
  "policy_id": "default",
  "tags": [],
} if {
  not input.action in known_actions
  deny_reason
}

