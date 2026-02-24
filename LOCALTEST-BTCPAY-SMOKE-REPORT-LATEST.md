# NostrMaxi BTCPay Localtest Smoke (Latest)

- Timestamp (UTC): 2026-02-17T22:14:56Z
- Env file: .env.localtest.operator
- BTCPAY_URL: http://10.1.10.143:23000
- BTCPAY_STORE_ID: GpkX8r6qPKBqRtGUniqivcLX4bovsxZuGkco5nHHMVXy
- Greenfield server info HTTP status: 200

## Preflight output summary

```
[0;34m━━━ 3) Payments Provider ━━━[0m
[0;32m✓ PASS[0m: BTCPAY_URL present
[0;32m✓ PASS[0m: BTCPAY_API_KEY present
[0;32m✓ PASS[0m: BTCPAY_STORE_ID present
[0;32m✓ PASS[0m: BTCPAY_WEBHOOK_SECRET present

[0;34m━━━ 4) Network/Origin Safety ━━━[0m
[0;32m✓ PASS[0m: Local test mode - skipping prod origin checks

[0;34m━━━ 5) Optional but Recommended ━━━[0m
[0;32m✓ PASS[0m: NIP05_DEFAULT_RELAYS set
[1;33m⚠ WARN[0m: REDIS_HOST not set
[1;33m⚠ WARN[0m: REDIS_PORT not set

[0;34m━━━ Summary ━━━[0m
[0;32mPassed:[0m 18
[1;33mWarnings:[0m 2
[0;31mFailed:[0m 0
[0;32mREADY[0m: Secrets validation passed for .env.localtest.operator
[0;32mLocal-test preflight complete[0m
```

## Server info response snippet

```json
{"syncStatus":[{"chainHeight":101,"syncHeight":101,"nodeInformation":{"headers":101,"blocks":101,"verificationProgress":1.0},"paymentMethodId":"BTC-CHAIN","available":true}],"version":"2.2.0","onion":null,"supportedPaymentMethods":["BTC-CHAIN","BTC-LN","BTC-LNURL"],"fullySynched":true}
```

## Result

✅ PASS: BTCPay local smoke is unlocked (server info reachable with configured API key).
