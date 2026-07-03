#!/bin/sh
set -e

# Authenticate with Infisical using Universal Auth and get access token
INFISICAL_TOKEN=$(curl -sf -X POST \
  -H "Content-Type: application/json" \
  -d "{\"clientId\":\"$INFISICAL_CLIENT_ID\",\"clientSecret\":\"$INFISICAL_CLIENT_SECRET\"}" \
  "$INFISICAL_API_URL/api/v1/auth/universal-auth/login" | \
  node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).accessToken)})")

export INFISICAL_TOKEN

# Pre-inject secrets so the cleanup script can read PG_* env vars
eval "$(infisical export \
  --domain "$INFISICAL_API_URL" \
  --projectId "$INFISICAL_PROJECT_ID" \
  --env "$INFISICAL_ENV" \
  --token "$INFISICAL_TOKEN" \
  --format dotenv-export 2>/dev/null)" || true

# Clear stale advisory locks from previous container
node release-stale-lock.js || true

# Start the app with full Infisical secret injection
exec infisical run \
  --domain "$INFISICAL_API_URL" \
  --projectId "$INFISICAL_PROJECT_ID" \
  --env "$INFISICAL_ENV" \
  --token "$INFISICAL_TOKEN" \
  --silent \
  -- node index.js
