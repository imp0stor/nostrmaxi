# NostrMaxi Local-Test BTCPay Greenfield Key Runbook (Operator)

**Purpose:** obtain/configure a valid BTCPay Greenfield API key for the Operator BTCPay instance, then re-run the local-test smoke to move `401` → `PASS`.

**Scope:** local-test only (`.env.localtest.operator`). No production DNS/secret changes.

---

## 0) Prereqs
- Operator BTCPay reachable: `http://10.1.10.143:23000`
- Store exists in Operator BTCPay (use the store intended for NostrMaxi)
- Local repo: `/home/owner/strangesignal/projects/nostrmaxi`

---

## 1) Create Greenfield API key (manual capture flow)
### 1A) First-time BTCPay bootstrap (if no admin exists yet)
1. Open BTCPay UI: `http://10.1.10.143:23000`
2. Click **Register** and create the first admin account (email + password).
3. After login, click **Create a new store** and name it (e.g., `NostrMaxi Localtest`).
4. In store creation, choose **Internal wallet** (regtest) and finish setup.

### 1B) Create the Greenfield API key
1. Sign in with Operator admin.
2. Select the target **Store** (top-left store selector).
3. Go to **Store Settings → Access Tokens** (Greenfield).
4. Create new token with **minimum scopes**:
   - `btcpay.server.canviewinfo`
   - `btcpay.store.canviewstoresettings`
   - `btcpay.store.cancreateinvoice`
   - `btcpay.store.canviewinvoices`
   - `btcpay.store.canmodifywebhooks`
5. Save the token **once** (copy it now; it will not be shown again).
6. Copy the Store ID:
   - Store Settings → General → **Store ID**
7. (Optional) Configure webhook secret in BTCPay:
   - Store Settings → Webhooks → create webhook
   - Use a random secret; keep it local-test only for now

**You now have:**
- `BTCPAY_API_KEY` (Greenfield token)
- `BTCPAY_STORE_ID`
- (Optional) `BTCPAY_WEBHOOK_SECRET`

---

## 2) Configure local-test env + run smoke (automated)
Use the included script (prompts safely, writes local env, runs tests):

```bash
cd /home/owner/strangesignal/projects/nostrmaxi
./scripts/btcpay-localtest-operator.sh
```

What it does:
- Creates/updates `.env.localtest.operator`
- Pins `BTCPAY_URL=http://10.1.10.143:23000`
- Prompts for Store ID + API key (secret input)
- Runs `./scripts/preflight-localtest.sh`
- Runs BTCPay API smoke:
  - `GET /api/v1/server/info`
  - Header: `Authorization: token <API_KEY>`

**Expected PASS:** `HTTP 200` and `PASS: BTCPay Greenfield auth OK`

**Report output:**
- `LOCALTEST-BTCPAY-SMOKE-REPORT-LATEST.md`

---

## 3) Manual smoke (if needed)
```bash
cd /home/owner/strangesignal/projects/nostrmaxi
set -a; source .env.localtest.operator; set +a
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: token ${BTCPAY_API_KEY}" \
  "${BTCPAY_URL}/api/v1/server/info"
```

---

## Secure handling (mandatory)
- `.env.localtest.operator` is **local-only** and ignored by git.
- File perms are restricted: `chmod 600 .env.localtest.operator`.
- **Do not** paste API keys into chat or commit them.
- If you need to store the key elsewhere, use a secrets manager.

---

## Rollback / cleanup
1. Revoke token in BTCPay UI (Store Settings → Access Tokens → revoke).
2. Delete local-test env file:
   ```bash
   cd /home/owner/strangesignal/projects/nostrmaxi
   rm -f .env.localtest.operator
   ```
3. If you added a webhook for local-test, delete it in BTCPay UI.

---

## Success criteria
- Local-test preflight: **PASS**
- BTCPay API smoke (`/api/v1/server/info`): **200**
- Report update: add a new entry noting PASS

---

## Evidence to capture
- Console output from `./scripts/btcpay-localtest-operator.sh`
- Updated local-test smoke report entry
