#!/bin/bash
# NostrMaxi API Test Script

BASE_URL="${BASE_URL:-http://localhost:3000}"
PASS=0
FAIL=0

echo "=== NostrMaxi API Test Suite ==="
echo "Testing against: $BASE_URL"
echo ""

# Helper function
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local expected_status="$4"
    
    status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE_URL$endpoint")
    
    if [ "$status" = "$expected_status" ]; then
        echo "✅ PASS: $name (HTTP $status)"
        ((PASS++))
    else
        echo "❌ FAIL: $name (expected $expected_status, got $status)"
        ((FAIL++))
    fi
}

# Health endpoints
echo "--- Health Endpoints ---"
test_endpoint "Root endpoint" "GET" "/" "200"
test_endpoint "Health check" "GET" "/health" "200"

# NIP-05 endpoints
echo ""
echo "--- NIP-05 Endpoints ---"
test_endpoint "NIP-05 lookup (not found)" "GET" "/.well-known/nostr.json?name=test" "404"
test_endpoint "NIP-05 provision (no auth)" "POST" "/api/v1/nip05/provision" "401"
test_endpoint "NIP-05 list mine (no auth)" "GET" "/api/v1/nip05/mine" "401"

# WoT endpoints  
echo ""
echo "--- Web of Trust Endpoints ---"
test_endpoint "WoT score lookup" "GET" "/api/v1/wot/score/e88a691e98d9987c964521dff60025f60700378a4879180dcbbb4a5027850411" "200"
test_endpoint "WoT verify" "GET" "/api/v1/wot/verify/e88a691e98d9987c964521dff60025f60700378a4879180dcbbb4a5027850411" "200"
test_endpoint "WoT network" "GET" "/api/v1/wot/network/e88a691e98d9987c964521dff60025f60700378a4879180dcbbb4a5027850411" "200"
test_endpoint "WoT recalculate" "POST" "/api/v1/wot/recalculate/e88a691e98d9987c964521dff60025f60700378a4879180dcbbb4a5027850411" "201"

# Subscription endpoints
echo ""
echo "--- Subscription Endpoints ---"
test_endpoint "List tiers" "GET" "/api/v1/subscriptions/tiers" "200"
test_endpoint "Current subscription (no auth)" "GET" "/api/v1/subscriptions/current" "401"

# Auth endpoints
echo ""
echo "--- Auth Endpoints ---"
test_endpoint "Get challenge" "GET" "/api/v1/auth/challenge" "200"
test_endpoint "Verify (no auth)" "POST" "/api/v1/auth/verify" "401"

# Admin endpoints
echo ""
echo "--- Admin Endpoints ---"
test_endpoint "Admin stats (no auth)" "GET" "/api/v1/admin/stats" "401"
test_endpoint "Admin users (no auth)" "GET" "/api/v1/admin/users" "401"

# Summary
echo ""
echo "=== Test Summary ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo "Total:  $((PASS + FAIL))"

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
