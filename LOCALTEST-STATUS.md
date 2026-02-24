# NostrMaxi Local-Test BTCPay Preflight Status

## Summary
- Added a non-production `local-test` validation path for BTCPay secrets.
- Created synthetic env profile `.env.localtest` with safe, fake values.
- Added a dedicated local-test preflight script with clear labels.

## Files Changed / Added
- **scripts/validate-secrets.sh** (local-test detection + relaxed placeholder checks)
- **scripts/validate-secrets-full.sh** (local-test detection + relaxed origin checks)
- **scripts/preflight-localtest.sh** (new)
- **.env.localtest** (new synthetic profile)
- **.gitignore** (ignore `.env.localtest`)

## Commands (Runbook)
```bash
cd /home/owner/strangesignal/projects/nostrmaxi
./scripts/preflight-localtest.sh .env.localtest

# Optional: Operator BTCPay smoke + report
./scripts/btcpay-localtest-operator.sh
```

## Evidence Output (2026-02-17)
```
━━━ NostrMaxi Local-Test Preflight (BTCPay synthetic) ━━━
OK: Secret validation passed for .env.localtest

━━━ 1) File Safety ━━━
✓ PASS: Env permissions secure (600)

━━━ 2) Core Secrets ━━━
✓ PASS: JWT_SECRET present
✓ PASS: WEBHOOK_SECRET present
✓ PASS: ADMIN_PUBKEYS present
✓ PASS: DB_PASSWORD present
✓ PASS: BASE_URL present
✓ PASS: DOMAIN present
✓ PASS: NIP05_DEFAULT_DOMAIN present
✓ PASS: JWT_SECRET length OK (96)
✓ PASS: WEBHOOK_SECRET length OK (64)
✓ PASS: DB_PASSWORD length OK (48)
✓ PASS: ADMIN_PUBKEYS format OK (2 key(s))

━━━ 3) Payments Provider ━━━
✓ PASS: BTCPAY_URL present
✓ PASS: BTCPAY_API_KEY present
✓ PASS: BTCPAY_STORE_ID present
✓ PASS: BTCPAY_WEBHOOK_SECRET present

━━━ 4) Network/Origin Safety ━━━
✓ PASS: Local test mode - skipping prod origin checks

━━━ 5) Optional but Recommended ━━━
✓ PASS: NIP05_DEFAULT_RELAYS set
⚠ WARN: REDIS_HOST not set
⚠ WARN: REDIS_PORT not set

━━━ Summary ━━━
Passed: 18
Warnings: 2
Failed: 0
READY: Secrets validation passed for .env.localtest
Local-test preflight complete
```

## Rollback Notes
- Remove `.env.localtest` if no longer needed.
- Revert local-test conditionals in:
  - `scripts/validate-secrets.sh`
  - `scripts/validate-secrets-full.sh`
- Delete `scripts/preflight-localtest.sh`.
- Remove `.env.localtest` from `.gitignore`.
