#!/bin/sh
# ===========================================
# Envoy Gateway Entrypoint Script
# ===========================================
# Substitutes environment variables in the template
# and starts Envoy with the generated config.

set -e

TEMPLATE="/etc/envoy/envoy.yaml.template"
CONFIG="/tmp/envoy.yaml"

# Substitute environment variables
envsubst < "$TEMPLATE" > "$CONFIG"

echo "[entrypoint] Generated Envoy config from template"
echo "[entrypoint] TOOL_API_KEY is set: $([ -n \"$TOOL_API_KEY\" ] && echo 'yes' || echo 'no')"

# Start Envoy
exec envoy -c "$CONFIG" --log-level info
