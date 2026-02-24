# NostrMaxi Subscription + Verification User Flow

## Scope
End-to-end flow for:
1. NIP-05 provisioning with domain verification
2. Email verification
3. Lightning subscription payment
4. Subscription validation for verified users

## User Flow
1. **Login** with NIP-07 or LNURL auth.
2. Open **NIP-05 page**.
3. In **Email Verification**:
   - Enter email
   - Click **Send code**
   - Enter code
   - Click **Verify**
4. (Optional custom domain)
   - Enter domain
   - Click **Verify domain**
   - Add TXT record `_nostrmaxi` with `nostrmaxi-verify=<token>`
   - Click verify again until `verified=true`
5. Open subscription UI and select paid tier.
6. Pay Lightning invoice.
7. Subscription activates after payment webhook confirmation.
8. Create NIP-05 on managed domain or verified custom domain.

## Acceptance Criteria
- [ ] User can request email code via API and verify it.
- [ ] `/api/v1/auth/me` returns `email` and `emailVerified` state.
- [ ] Custom domain verification checks DNS TXT record and persists verified status.
- [ ] `POST /api/v1/payments/invoice` rejects unverified users.
- [ ] Custom domain NIP-05 provisioning rejects users without verified email.
- [ ] Payment flow returns invoice, polls status, and upgrades subscription when paid.
- [ ] Backend build passes.
- [ ] Frontend build passes.
- [ ] Unit tests pass.
