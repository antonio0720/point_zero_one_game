#!/bin/bash

set -euo pipefail

# Set environment variables
export PZOD_API_KEY="your_api_key_here"
export PZOD_SERVER_PORT=8080
export PZOD_SIM_TICKS=720
export PZOD_DAILY_SEED_ENDPOINT="https://example.com/daily-seed"

# Start server
echo "Starting server..."
node scripts/pzo/server.js &

# Wait for server to start
sleep 2

# Run API test
echo "Running API test..."
curl -s -X POST \
  http://localhost:$PZOD_SERVER_PORT/api/simulate \
  -H 'Content-Type: application/json' \
  -d '{"ticks": '$PZOD_SIM_TICKS'}' | jq '.proof_hash'

# Verify proof hash
proof_hash=$(curl -s -X GET http://localhost:$PZOD_SERVER_PORT/api/proof-hash)
if [ "$proof_hash" != "$(jq '.proof_hash' <<< $(curl -s -X POST http://localhost:$PZOD_SERVER_PORT/api/simulate))" ]; then
  echo "FAIL: Proof hash mismatch"
  exit 1
fi

# Check leaderboard
leaderboard=$(curl -s -X GET http://localhost:$PZOD_SERVER_PORT/api/leaderboard)
if [ "$(jq '.[0].score' <<< $leaderboard)" != "100" ]; then
  echo "FAIL: Leaderboard score mismatch"
  exit 1
fi

# Verify daily seed endpoint
daily_seed=$(curl -s -X GET "$PZOD_DAILY_SEED_ENDPOINT")
if [ "$(jq '.seed' <<< $daily_seed)" != "$(jq '.seed' <<< $(curl -s -X POST http://localhost:$PZOD_SERVER_PORT/api/simulate))" ]; then
  echo "FAIL: Daily seed mismatch"
  exit 1
fi

# Kill server
echo "Killing server..."
pkill node

echo "PASS"
