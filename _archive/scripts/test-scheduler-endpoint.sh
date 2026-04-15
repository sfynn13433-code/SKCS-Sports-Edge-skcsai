#!/bin/bash

# Test script for SKCS scheduler endpoints
# This script validates the idempotency and conflict resolution features

set -e

# Configuration
BACKEND_HOST="${SKCS_BACKEND_HOST:-http://localhost:3000}"
REFRESH_KEY="${SKCS_REFRESH_KEY:-skcs_refresh_key}"

echo "🧪 Testing SKCS Scheduler Endpoints"
echo "Backend: $BACKEND_HOST"
echo ""

# Test 1: Basic refresh (should work)
echo "Test 1: Basic refresh endpoint"
response=$(curl -s -w "%{http_code}" -o /tmp/refresh1.json \
    -X POST \
    -H "x-api-key: $REFRESH_KEY" \
    -H "content-type: application/json" \
    "$BACKEND_HOST/api/refresh-predictions")

http_code="${response: -3}"
if [[ "$http_code" == "200" ]]; then
    echo "✅ Basic refresh: SUCCESS (HTTP $http_code)"
    cat /tmp/refresh1.json | jq '.success, .message, .publish_window' 2>/dev/null || echo "Response: $(cat /tmp/refresh1.json)"
else
    echo "❌ Basic refresh: FAILED (HTTP $http_code)"
    cat /tmp/refresh1.json
fi
echo ""

# Test 2: Duplicate refresh (should be skipped)
echo "Test 2: Duplicate refresh (should be skipped)"
response=$(curl -s -w "%{http_code}" -o /tmp/refresh2.json \
    -X POST \
    -H "x-api-key: $REFRESH_KEY" \
    -H "content-type: application/json" \
    "$BACKEND_HOST/api/refresh-predictions")

http_code="${response: -3}"
if [[ "$http_code" == "200" ]]; then
    skipped=$(cat /tmp/refresh2.json | jq -r '.skipped // false' 2>/dev/null || echo "false")
    if [[ "$skipped" == "true" ]]; then
        echo "✅ Duplicate refresh: SKIPPED (as expected)"
        echo "   Publish window: $(cat /tmp/refresh2.json | jq -r '.publish_window' 2>/dev/null || echo 'unknown')"
    else
        echo "⚠️  Duplicate refresh: NOT SKIPPED (unexpected)"
        cat /tmp/refresh2.json
    fi
else
    echo "❌ Duplicate refresh: FAILED (HTTP $http_code)"
    cat /tmp/refresh2.json
fi
echo ""

# Test 3: Different slot parameter
echo "Test 3: Different slot parameter"
response=$(curl -s -w "%{http_code}" -o /tmp/refresh3.json \
    -X POST \
    -H "x-api-key: $REFRESH_KEY" \
    -H "content-type: application/json" \
    "$BACKEND_HOST/api/refresh-predictions?slot=16")

http_code="${response: -3}"
if [[ "$http_code" == "200" ]]; then
    echo "✅ Slot parameter: SUCCESS (HTTP $http_code)"
    cat /tmp/refresh3.json | jq '.success, .publish_window' 2>/dev/null || echo "Response: $(cat /tmp/refresh3.json)"
else
    echo "❌ Slot parameter: FAILED (HTTP $http_code)"
    cat /tmp/refresh3.json
fi
echo ""

# Test 4: Invalid API key (should fail)
echo "Test 4: Invalid API key"
response=$(curl -s -w "%{http_code}" -o /tmp/refresh4.json \
    -X POST \
    -H "x-api-key: invalid_key" \
    -H "content-type: application/json" \
    "$BACKEND_HOST/api/refresh-predictions")

http_code="${response: -3}"
if [[ "$http_code" == "401" ]]; then
    echo "✅ Invalid API key: REJECTED (HTTP $http_code) - as expected"
else
    echo "❌ Invalid API key: NOT REJECTED (HTTP $http_code) - unexpected"
fi
echo ""

# Test 5: Grading endpoint
echo "Test 5: Grading endpoint"
response=$(curl -s -w "%{http_code}" -o /tmp/grade.json \
    -X POST \
    -H "x-api-key: $REFRESH_KEY" \
    -H "content-type: application/json" \
    "$BACKEND_HOST/api/grade-predictions?sport=football")

http_code="${response: -3}"
if [[ "$http_code" == "200" ]]; then
    echo "✅ Grading endpoint: SUCCESS (HTTP $http_code)"
    cat /tmp/grade.json | jq '.success, .message' 2>/dev/null || echo "Response: $(cat /tmp/grade.json)"
else
    echo "❌ Grading endpoint: FAILED (HTTP $http_code)"
    cat /tmp/grade.json
fi
echo ""

# Cleanup
rm -f /tmp/refresh*.json /tmp/grade.json

echo "🎯 Scheduler endpoint testing complete!"
echo ""
echo "📊 Expected behavior:"
echo "   - First refresh should succeed"
echo "   - Immediate duplicate should be skipped"
echo "   - Different slots should work"
echo "   - Invalid keys should be rejected"
echo "   - Grading should work independently"
