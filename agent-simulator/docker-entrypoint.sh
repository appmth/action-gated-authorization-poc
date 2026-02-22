#!/bin/sh
set -e
echo "[entrypoint] Starting Agent Simulator"
echo "[entrypoint] SERVICE_A_BASE_URL: ${SERVICE_A_BASE_URL:-not set}"
exec python main.py
