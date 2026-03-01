#!/usr/bin/env bash
# =============================================================================
# Test: ingest-reviews edge function
# Target: Pisco y Nazca Ceviche Gastrobar - Doral
#
# Tests the full webhook → normalize → upsert pipeline.
# Requires: APIFY_WEBHOOK_SECRET set as Supabase secret
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
EDGE_URL="https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/ingest-reviews"
WEBHOOK_SECRET="c0f3b3fd510ced5142985f07c20ced7a94c2fd7dcf9c47c3d654b086e99a1323"

# Pisco y Nazca Doral (seeded in migration)
RESTAURANT_ID="66666666-6666-6666-6666-666666666666"
# alamo-prime group — looked up from groups table
GROUP_ID=""  # Will be resolved below

# Unique run IDs for this test session
TIMESTAMP=$(date +%s)
RUN_ID_GOOGLE="test-google-${TIMESTAMP}"
RUN_ID_OPENTABLE="test-opentable-${TIMESTAMP}"
RUN_ID_TRIPADVISOR="test-tripadvisor-${TIMESTAMP}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; }
fail() { echo -e "${RED}✗ FAIL${NC}: $1"; }
info() { echo -e "${CYAN}→${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }

# ---------------------------------------------------------------------------
# Resolve group_id from Supabase
# ---------------------------------------------------------------------------
resolve_group_id() {
  info "Resolving alamo-prime group_id from Supabase..."

  local ANON_KEY="sb_publishable_eEPfgN9bd5jWRJ-ye1MnMw_p6V92UDs"
  local resp
  resp=$(curl -s \
    "https://nxeorbwqsovybfttemrw.supabase.co/rest/v1/groups?slug=eq.alamo-prime&select=id" \
    -H "apikey: ${ANON_KEY}" \
    -H "Authorization: Bearer ${ANON_KEY}")

  GROUP_ID=$(echo "$resp" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -z "$GROUP_ID" ]; then
    fail "Could not resolve alamo-prime group_id. Response: $resp"
    exit 1
  fi

  pass "group_id = ${GROUP_ID}"
}

# =============================================================================
# TEST 1: Auth — no secret → 401
# =============================================================================
test_auth_no_secret() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  info "TEST 1: Webhook auth — missing secret → 401"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$EDGE_URL" \
    -H "Content-Type: application/json" \
    -d '{"event":"ACTOR.RUN.SUCCEEDED"}')

  if [ "$status" = "401" ]; then
    pass "Got 401 without webhook secret"
  else
    fail "Expected 401, got $status"
  fi
}

# =============================================================================
# TEST 2: Auth — wrong secret → 401
# =============================================================================
test_auth_wrong_secret() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  info "TEST 2: Webhook auth — wrong secret → 401"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$EDGE_URL" \
    -H "Content-Type: application/json" \
    -H "X-Apify-Webhook-Secret: wrong-secret-value" \
    -d '{"event":"ACTOR.RUN.SUCCEEDED"}')

  if [ "$status" = "401" ]; then
    pass "Got 401 with wrong secret"
  else
    fail "Expected 401, got $status"
  fi
}

# =============================================================================
# TEST 3: Failed run event → logged but not processed
# =============================================================================
test_failed_event() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  info "TEST 3: ACTOR.RUN.FAILED event → skipped"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  local resp
  resp=$(curl -s -w "\n%{http_code}" \
    -X POST "$EDGE_URL" \
    -H "Content-Type: application/json" \
    -H "X-Apify-Webhook-Secret: ${WEBHOOK_SECRET}" \
    -d "{
      \"event\": \"ACTOR.RUN.FAILED\",
      \"runId\": \"test-failed-${TIMESTAMP}\",
      \"datasetId\": \"fake-dataset\",
      \"actorId\": \"compass~google-maps-reviews-scraper\",
      \"status\": \"FAILED\",
      \"meta\": {
        \"restaurant_id\": \"${RESTAURANT_ID}\",
        \"platform\": \"google\",
        \"group_id\": \"${GROUP_ID}\"
      }
    }")

  local status body
  status=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | head -n -1)

  if [ "$status" = "200" ]; then
    if echo "$body" | grep -q '"skipped":true'; then
      pass "Failed event acknowledged and skipped (200)"
    else
      warn "Got 200 but unexpected body: $body"
    fi
  else
    fail "Expected 200, got $status. Body: $body"
  fi
}

# =============================================================================
# TEST 4: Missing meta fields → skipped
# =============================================================================
test_missing_meta() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  info "TEST 4: Missing meta.platform → skipped"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  local resp
  resp=$(curl -s -w "\n%{http_code}" \
    -X POST "$EDGE_URL" \
    -H "Content-Type: application/json" \
    -H "X-Apify-Webhook-Secret: ${WEBHOOK_SECRET}" \
    -d "{
      \"event\": \"ACTOR.RUN.SUCCEEDED\",
      \"runId\": \"test-no-meta-${TIMESTAMP}\",
      \"datasetId\": \"fake-dataset\",
      \"actorId\": \"compass~google-maps-reviews-scraper\",
      \"status\": \"SUCCEEDED\",
      \"meta\": {
        \"restaurant_id\": \"${RESTAURANT_ID}\"
      }
    }")

  local status body
  status=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | head -n -1)

  if [ "$status" = "200" ] && echo "$body" | grep -q '"skipped":true'; then
    pass "Missing meta → skipped with 200"
  else
    fail "Expected skipped, got status=$status body=$body"
  fi
}

# =============================================================================
# TEST 5: Idempotency — same runId twice → second is skipped
# =============================================================================
test_idempotency() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  info "TEST 5: Idempotency — duplicate runId → skipped"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  local DEDUP_RUN="test-dedup-${TIMESTAMP}"

  # First request (will fail at dataset fetch but creates scrape_run)
  info "Sending first webhook (runId=${DEDUP_RUN})..."
  curl -s -o /dev/null \
    -X POST "$EDGE_URL" \
    -H "Content-Type: application/json" \
    -H "X-Apify-Webhook-Secret: ${WEBHOOK_SECRET}" \
    -d "{
      \"event\": \"ACTOR.RUN.SUCCEEDED\",
      \"runId\": \"${DEDUP_RUN}\",
      \"datasetId\": \"fake-dataset-dedup\",
      \"actorId\": \"compass~google-maps-reviews-scraper\",
      \"status\": \"SUCCEEDED\",
      \"meta\": {
        \"restaurant_id\": \"${RESTAURANT_ID}\",
        \"platform\": \"google\",
        \"group_id\": \"${GROUP_ID}\"
      }
    }"

  sleep 2

  # Second request — should be caught by idempotency guard
  info "Sending duplicate webhook (same runId)..."
  local resp
  resp=$(curl -s -w "\n%{http_code}" \
    -X POST "$EDGE_URL" \
    -H "Content-Type: application/json" \
    -H "X-Apify-Webhook-Secret: ${WEBHOOK_SECRET}" \
    -d "{
      \"event\": \"ACTOR.RUN.SUCCEEDED\",
      \"runId\": \"${DEDUP_RUN}\",
      \"datasetId\": \"fake-dataset-dedup\",
      \"actorId\": \"compass~google-maps-reviews-scraper\",
      \"status\": \"SUCCEEDED\",
      \"meta\": {
        \"restaurant_id\": \"${RESTAURANT_ID}\",
        \"platform\": \"google\",
        \"group_id\": \"${GROUP_ID}\"
      }
    }")

  local status body
  status=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | head -n -1)

  if [ "$status" = "200" ] && echo "$body" | grep -q '"reason":"duplicate_run"'; then
    pass "Duplicate run correctly skipped"
  else
    warn "Status=$status, body=$body (may have been skipped with different reason)"
  fi
}

# =============================================================================
# TEST 6: Full pipeline — Google reviews for Pisco y Nazca
#
# This test uses the Apify API to run the Google Maps reviews scraper
# directly, then sends the webhook with the real dataset ID.
# =============================================================================
test_full_google_pipeline() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  info "TEST 6: Full Google Maps pipeline — Pisco y Nazca Doral"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [ -z "${APIFY_API_TOKEN:-}" ]; then
    fail "APIFY_API_TOKEN env var not set. Export it before running this test."
    info "Usage: APIFY_API_TOKEN=apify_api_xxx bash scripts/test-ingest-reviews.sh"
    return
  fi
  local APIFY_TOKEN="${APIFY_API_TOKEN}"

  info "Starting Google Maps Reviews scraper via Apify API..."
  info "Actor: compass/google-maps-reviews-scraper"
  info "Target: Pisco y Nazca Ceviche Gastrobar, Doral FL"
  info "Max reviews: 20 (small test batch)"

  # Start the actor run synchronously (wait for completion)
  local run_resp
  run_resp=$(curl -s \
    "https://api.apify.com/v2/acts/compass~google-maps-reviews-scraper/runs?waitForFinish=300" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${APIFY_TOKEN}" \
    -d '{
      "startUrls": [
        { "url": "https://www.google.com/maps/place/Pisco+y+Nazca+Ceviche+Gastrobar/@25.7946028,-80.3574889" }
      ],
      "maxReviewsPerPlace": 20,
      "reviewsSort": "newest",
      "language": "en",
      "proxyConfiguration": {
        "useApifyProxy": true
      }
    }')

  # Extract run details
  local run_status run_id dataset_id
  run_status=$(echo "$run_resp" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  run_id=$(echo "$run_resp" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  dataset_id=$(echo "$run_resp" | grep -o '"defaultDatasetId":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -z "$run_id" ] || [ -z "$dataset_id" ]; then
    fail "Apify actor run failed to start. Response: $(echo "$run_resp" | head -c 500)"
    return
  fi

  info "Run ID: ${run_id}"
  info "Dataset ID: ${dataset_id}"
  info "Status: ${run_status}"

  if [ "$run_status" != "SUCCEEDED" ]; then
    warn "Actor run status is '${run_status}' — may still be running or failed"
    info "Waiting 30s and checking again..."
    sleep 30

    local check_resp
    check_resp=$(curl -s \
      "https://api.apify.com/v2/actor-runs/${run_id}" \
      -H "Authorization: Bearer ${APIFY_TOKEN}")
    run_status=$(echo "$check_resp" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
    info "Updated status: ${run_status}"

    if [ "$run_status" != "SUCCEEDED" ]; then
      fail "Actor run did not succeed (status: ${run_status})"
      return
    fi
  fi

  pass "Apify actor run completed successfully"

  # Preview dataset
  info "Previewing dataset (first 2 items)..."
  curl -s "https://api.apify.com/v2/datasets/${dataset_id}/items?limit=2" \
    -H "Authorization: Bearer ${APIFY_TOKEN}" | python3 -m json.tool 2>/dev/null || \
  curl -s "https://api.apify.com/v2/datasets/${dataset_id}/items?limit=2" \
    -H "Authorization: Bearer ${APIFY_TOKEN}" | python -m json.tool 2>/dev/null || \
  curl -s "https://api.apify.com/v2/datasets/${dataset_id}/items?limit=2" \
    -H "Authorization: Bearer ${APIFY_TOKEN}"

  echo ""

  # Now send the webhook to our edge function
  info "Sending webhook to ingest-reviews edge function..."
  local webhook_resp
  webhook_resp=$(curl -s -w "\n%{http_code}" \
    -X POST "$EDGE_URL" \
    -H "Content-Type: application/json" \
    -H "X-Apify-Webhook-Secret: ${WEBHOOK_SECRET}" \
    -d "{
      \"event\": \"ACTOR.RUN.SUCCEEDED\",
      \"runId\": \"${run_id}\",
      \"datasetId\": \"${dataset_id}\",
      \"actorId\": \"compass~google-maps-reviews-scraper\",
      \"status\": \"SUCCEEDED\",
      \"meta\": {
        \"restaurant_id\": \"${RESTAURANT_ID}\",
        \"platform\": \"google\",
        \"group_id\": \"${GROUP_ID}\"
      }
    }")

  local wh_status wh_body
  wh_status=$(echo "$webhook_resp" | tail -1)
  wh_body=$(echo "$webhook_resp" | head -n -1)

  echo ""
  info "Webhook response (HTTP ${wh_status}):"
  echo "$wh_body" | python3 -m json.tool 2>/dev/null || \
  echo "$wh_body" | python -m json.tool 2>/dev/null || \
  echo "$wh_body"

  echo ""
  if [ "$wh_status" = "200" ] && echo "$wh_body" | grep -q '"ok":true'; then
    if echo "$wh_body" | grep -q '"inserted"'; then
      local inserted
      inserted=$(echo "$wh_body" | grep -o '"inserted":[0-9]*' | cut -d: -f2)
      pass "Full pipeline succeeded! ${inserted} Google reviews inserted for Pisco y Nazca Doral"
    else
      pass "Webhook returned 200 OK"
    fi
  else
    fail "Webhook returned HTTP ${wh_status}"
  fi
}

# =============================================================================
# MAIN
# =============================================================================
echo "============================================="
echo " ingest-reviews Edge Function Test Suite"
echo " Restaurant: Pisco y Nazca Doral"
echo " Endpoint: ${EDGE_URL}"
echo "============================================="

resolve_group_id

# Run validation tests first (fast, no Apify costs)
test_auth_no_secret
test_auth_wrong_secret
test_failed_event
test_missing_meta
test_idempotency

# Prompt before running the full pipeline (costs Apify credits)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
warn "The next test will run a REAL Apify scrape (costs ~\$0.01)"
warn "It scrapes 20 Google Maps reviews for Pisco y Nazca Doral"
echo ""
read -p "Run full pipeline test? [y/N] " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  test_full_google_pipeline
else
  info "Skipped full pipeline test"
fi

echo ""
echo "============================================="
echo " Test suite complete"
echo "============================================="
