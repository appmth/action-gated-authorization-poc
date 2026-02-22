#!/bin/bash

# Demo Scenario Data Injection Script
# Injects Allow and Deny pattern authorization requests to service-a

set -e

# Configuration
API_URL="${API_URL:-http://localhost:8080}"
AUTHORIZE_ENDPOINT="${API_URL}/authorize"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "Demo Scenario Data Injection"
echo "========================================"
echo "Target API: ${API_URL}"
echo ""

# Function to print response
print_response() {
    local pattern_name=$1
    local response=$2
    local http_code=$3

    echo "----------------------------------------"
    echo -e "${YELLOW}Pattern: ${pattern_name}${NC}"
    echo "HTTP Status: ${http_code}"

    # Try to pretty-print JSON if jq is available
    if command -v jq &> /dev/null; then
        echo "$response" | jq '.'
    else
        echo "$response"
    fi
    echo ""
}

# Allow Pattern (assistant role)
echo -e "${GREEN}[1/7] Injecting Allow Pattern (assistant role)...${NC}"
ALLOW_PAYLOAD='{
  "agent_id": "gov-ui-agent",
  "agent_role": "assistant",
  "action": "get_resident_info",
  "context": {
    "purpose": "inquiry",
    "time": "business_hours",
    "data_sensitivity": "required"
  }
}'

ALLOW_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${AUTHORIZE_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d "${ALLOW_PAYLOAD}")

ALLOW_HTTP_CODE=$(echo "$ALLOW_RESPONSE" | tail -n1)
ALLOW_BODY=$(echo "$ALLOW_RESPONSE" | sed '$d')

print_response "Allow (assistant)" "$ALLOW_BODY" "$ALLOW_HTTP_CODE"

# Deny Pattern (assistant role)
echo -e "${RED}[2/7] Injecting Deny Pattern (assistant role)...${NC}"
DENY_PAYLOAD='{
  "agent_id": "gov-ui-agent",
  "agent_role": "assistant",
  "action": "get_resident_info",
  "context": {
    "purpose": "audit",
    "time": "after_hours",
    "data_sensitivity": "required"
  }
}'

DENY_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${AUTHORIZE_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d "${DENY_PAYLOAD}")

DENY_HTTP_CODE=$(echo "$DENY_RESPONSE" | tail -n1)
DENY_BODY=$(echo "$DENY_RESPONSE" | sed '$d')

print_response "Deny (assistant)" "$DENY_BODY" "$DENY_HTTP_CODE"

# Admin Pattern (for agent diversity in Graph)
echo -e "${GREEN}[3/7] Injecting Admin Pattern (admin role)...${NC}"
ADMIN_PAYLOAD='{
  "agent_id": "admin-agent",
  "agent_role": "admin",
  "action": "get_resident_info",
  "context": {
    "purpose": "inquiry",
    "time": "business_hours",
    "data_sensitivity": "required"
  }
}'

ADMIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${AUTHORIZE_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d "${ADMIN_PAYLOAD}")

ADMIN_HTTP_CODE=$(echo "$ADMIN_RESPONSE" | tail -n1)
ADMIN_BODY=$(echo "$ADMIN_RESPONSE" | sed '$d')

print_response "Allow (admin)" "$ADMIN_BODY" "$ADMIN_HTTP_CODE"

# BAN Scenario
echo -e "${RED}[4/7] Banning assistant agent...${NC}"
BAN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/agents/assistant/ban" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Suspicious pattern"}')

BAN_HTTP_CODE=$(echo "$BAN_RESPONSE" | tail -n1)
BAN_BODY=$(echo "$BAN_RESPONSE" | sed '$d')

print_response "Ban assistant" "$BAN_BODY" "$BAN_HTTP_CODE"

# Verify BAN: should get DENY with agent banned reason
echo -e "${RED}[5/7] Verifying BAN: authorize with banned agent...${NC}"
BAN_VERIFY_PAYLOAD='{
  "agent_id": "gov-ui-agent",
  "agent_role": "assistant",
  "action": "get_resident_info",
  "context": {
    "purpose": "inquiry",
    "time": "business_hours",
    "data_sensitivity": "required"
  }
}'

BAN_VERIFY_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${AUTHORIZE_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d "${BAN_VERIFY_PAYLOAD}")

BAN_VERIFY_HTTP_CODE=$(echo "$BAN_VERIFY_RESPONSE" | tail -n1)
BAN_VERIFY_BODY=$(echo "$BAN_VERIFY_RESPONSE" | sed '$d')

print_response "Verify BAN (should be DENY)" "$BAN_VERIFY_BODY" "$BAN_VERIFY_HTTP_CODE"

# UNBAN assistant
echo -e "${GREEN}[6/7] Unbanning assistant agent...${NC}"
UNBAN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/agents/assistant/unban")

UNBAN_HTTP_CODE=$(echo "$UNBAN_RESPONSE" | tail -n1)
UNBAN_BODY=$(echo "$UNBAN_RESPONSE" | sed '$d')

print_response "Unban assistant" "$UNBAN_BODY" "$UNBAN_HTTP_CODE"

# Verify UNBAN: should get ALLOW again
echo -e "${GREEN}[7/7] Verifying Unban: authorize with unbanned agent...${NC}"
UNBAN_VERIFY_PAYLOAD='{
  "agent_id": "gov-ui-agent",
  "agent_role": "assistant",
  "action": "get_resident_info",
  "context": {
    "purpose": "inquiry",
    "time": "business_hours",
    "data_sensitivity": "required"
  }
}'

UNBAN_VERIFY_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${AUTHORIZE_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d "${UNBAN_VERIFY_PAYLOAD}")

UNBAN_VERIFY_HTTP_CODE=$(echo "$UNBAN_VERIFY_RESPONSE" | tail -n1)
UNBAN_VERIFY_BODY=$(echo "$UNBAN_VERIFY_RESPONSE" | sed '$d')

print_response "Verify Unban (should be ALLOW)" "$UNBAN_VERIFY_BODY" "$UNBAN_VERIFY_HTTP_CODE"

# Summary
echo "========================================"
echo -e "${GREEN}Injection Complete!${NC}"
echo "========================================"
echo "Injected patterns:"
echo "  1. Allow (assistant role)       - purpose: inquiry, time: business_hours"
echo "  2. Deny (assistant role)        - purpose: audit, time: after_hours"
echo "  3. Allow (admin role)           - purpose: inquiry, time: business_hours"
echo "  4. BAN assistant agent          - reason: Suspicious pattern"
echo "  5. Verify BAN (expect DENY)     - same as pattern 1, but agent is banned"
echo "  6. UNBAN assistant agent        - restore agent to active state"
echo "  7. Verify UNBAN (expect ALLOW)  - same as pattern 1, should allow again"
echo ""
echo "You can now view these records in:"
echo "  - Judgment UI Map: http://localhost:3001/map"
echo "  - Judgment UI Graph: http://localhost:3001/graph"
echo "========================================"
