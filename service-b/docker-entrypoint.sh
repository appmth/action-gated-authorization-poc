#!/bin/sh
# ===========================================
# OPA (PDP) Entrypoint Script
# ===========================================
# Substitutes environment variables in the config template
# and starts OPA with the generated config.

set -e

TEMPLATE="/etc/opa/config.yaml.template"
CONFIG="/tmp/config.yaml"

# Substitute environment variables
envsubst < "$TEMPLATE" > "$CONFIG"

echo "[entrypoint] Starting OPA (service-b)"
echo "[entrypoint] ENVIRONMENT: ${ENVIRONMENT:-not set}"
echo "[entrypoint] OPA_LOG_LEVEL: ${OPA_LOG_LEVEL:-not set}"

# Start OPA
exec opa run --server --addr=0.0.0.0:8080 --config-file="$CONFIG" /policy
