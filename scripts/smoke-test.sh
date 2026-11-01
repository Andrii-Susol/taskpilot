#!/bin/bash
# Smoke test: start TaskPilot, hit /health, stop it.
# NOTE: intentionally fragile - this script is hardened by Copilot cloud agent in Lab 3.2.
PORT=${PORT:-3456}
node src/server.js &
PID=$!
sleep 1
curl -s http://localhost:$PORT/health
kill $PID
