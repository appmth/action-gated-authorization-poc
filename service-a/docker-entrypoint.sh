#!/bin/sh
# ===========================================
# Judgment (PEP) Entrypoint Script
# ===========================================
# Logs environment variable status and starts the application.

set -e

echo "[entrypoint] Starting Judgment (service-a)"
echo "[entrypoint] PDP_URL: ${PDP_URL:-not set}"
echo "[entrypoint] ENVOY_URL: ${ENVOY_URL:-not set}"
echo "[entrypoint] VERTEX_PROJECT: ${VERTEX_PROJECT:-not set}"

# Start the application
exec python main.py
