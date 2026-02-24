# NostrMaxi Low-Priority Backlog (Ranked)

> Below current priority tracks (Immortals/NostrCast/Beacon/Nostr primitives). Non-blocking items only.

1) **BTCPay local-test auth PASS**
   - Create Greenfield token on Operator BTCPay and run:
     `./scripts/btcpay-localtest-operator.sh` → ensure 200 + update latest report.

2) **Local-test Redis warnings**
   - Add `REDIS_HOST/REDIS_PORT` to `.env.localtest` (synthetic) to clear warnings.
   - Re-run `./scripts/preflight-localtest.sh` for clean PASS.

3) **Doc drift: local-test reporting**
   - Append latest PASS details to `LOCALTEST-BTCPAY-SMOKE-REPORT-2026-02-17.md` once auth is fixed.
   - Confirm README/Runbooks cross-link (local-test + report).

4) **Deploy/runbook consistency sweep**
   - Ensure `PRODUCTION-CUTOVER-RUNBOOK.md` references `scripts/validate-secrets.sh` and local-test preflight where appropriate.
   - Verify `README-DEPLOY.md` + `DEPLOYMENT.md` link to `PRODUCTION-*` runbooks.

5) **Smoke test output polish**
   - Confirm `run-smoke-tests.sh` summary parsing works with current jest output format.
   - If not, update parsing or log path to avoid confusing summaries.

6) **Localtest artifact hygiene**
   - Verify `.env.localtest` and `.env.localtest.operator` permissions = 600 and remain gitignored.
   - Add short note in `LOCALTEST-STATUS.md` about report file location.

7) **Optional: report bundling**
   - Add a `LOCALTEST-REPORTS/` folder and rotate local-test reports (date-stamped) if repeated testing continues.
