#!/bin/sh
# ===========================================
# Tool Executor Entrypoint Script
# ===========================================
# Logs environment variable status and starts the application.

set -e

echo "[entrypoint] Starting Tool Executor (service-c)"
echo "[entrypoint] TOOL_API_KEY is set: $([ -n \"$TOOL_API_KEY\" ] && echo 'yes' || echo 'no')"

# Start the application
exec python main.py
