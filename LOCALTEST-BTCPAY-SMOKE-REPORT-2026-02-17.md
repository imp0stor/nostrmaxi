# NostrMaxi BTCPay Local-Test Smoke (Operator) — 2026-02-17

## Scope
- Use `local-test` profile with Operator BTCPay endpoint (`http://10.1.10.143:23000`).
- Run end-to-end payment config validation (local-test preflight).
- Execute at least one non-destructive API smoke path against BTCPay.
- **No production DNS/secret changes.**

## Commands Executed (exact)
```bash
# Prepare local-test env pointing at Operator BTCPay
cd /home/owner/strangesignal/projects/nostrmaxi
cp .env.localtest .env.localtest.operator
sed -i 's#BTCPAY_URL=.*#BTCPAY_URL=http://10.1.10.143:23000#' .env.localtest.operator

# Local-test preflight validation
./scripts/preflight-localtest.sh .env.localtest.operator

# BTCPay API smoke (non-destructive)
curl -sS -o /dev/null -w "%{http_code}\n" http://10.1.10.143:23000/api/v1/server/info
```

## Results
### Preflight Output (local-test)
- ✅ Secrets validation passed
- ✅ Core secret checks pass
- ✅ BTCPay env values present
- ⚠️ Warnings: `REDIS_HOST` / `REDIS_PORT` not set (local-test only)

### BTCPay API Smoke
- `GET /api/v1/server/info` → **401** (authentication required)

## PASS/FAIL Matrix
| Check | Status | Notes |
| --- | --- | --- |
| Local-test preflight (BTCPay synthetic) | **PASS** | Uses Operator endpoint in `.env.localtest.operator` |
| BTCPay API smoke: `GET /api/v1/server/info` | **FAIL** | 401 unauthenticated — needs valid Greenfield API key |

## Rollback Notes
- Safe cleanup (no production impact):
  ```bash
  cd /home/owner/strangesignal/projects/nostrmaxi
  rm -f .env.localtest.operator
  ```
- No DNS, secrets, or production configs changed.

## Next Actions (to reach full PASS)
1. Create a BTCPay Greenfield API key on the Operator BTCPay instance.
2. Populate `BTCPAY_API_KEY` (and store id if not already known) in the local-test env.
3. Re-run the API smoke to confirm 200 response.
