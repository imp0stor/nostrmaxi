# NostrMaxi - Auth & Payments Completion

## ✅ Completed Features

### 1. Nostr Authentication
- **NIP-07 Browser Extension Login** - Full support via `loginWithExtension()` in useAuth hook
- **Challenge-Response Flow** - `/api/v1/auth/challenge` + `/api/v1/auth/verify` endpoints
- **JWT Session Management** - 30-day sessions with token hashing and revocation
- **Profile Fetch from Relays** - `fetchProfile()` function using nostr-tools SimplePool
- **LNURL-auth** - Alternative login via Lightning wallet QR code

### 2. Lightning Payments
- **LNbits Integration** - Full API integration in `PaymentsService`
- **Invoice Generation** - `/api/v1/payments/invoice` creates BOLT11 invoices
- **Payment Webhook Handler** - `/api/v1/payments/webhook` processes LNbits callbacks
- **Subscription Status Tracking** - Auto-upgrade on payment confirmation

### 3. Subscription Tiers
| Tier | Price | NIP-05 Limit | Features |
|------|-------|--------------|----------|
| FREE | $0 | 1 | Basic NIP-05 @nostrmaxi.com |
| PRO | $9/mo | 1 | Custom domain, analytics |
| BUSINESS | $29/mo | 10 | Multiple identities, API access |
| LIFETIME | $99 | 1 | Pro features forever |

- **Tier Checks in API** - NIP-05 provisioning enforces limits
- **WoT Discounts** - Up to 50% off for trusted users
- **Custom Domain Validation** - Pro+ can use verified domains

### 4. Payment UI
- **PricingPage** - Displays all tiers with features and pricing
- **PaymentModal** - Invoice QR code display with countdown timer
- **InvoiceQrCode** - QR generation with copy/open-wallet actions
- **SubscriptionManager** - View/cancel/reactivate subscriptions
- **ReceiptPage** - Printable payment receipts

### 5. Complete UI Flow
- **HomePage** - Landing page with CTA
- **DashboardPage** - Overview, sessions, API keys
- **Nip05Page** - Claim/manage NIP-05 identities
- **LoginModal** - NIP-07 extension or LNURL-auth

## 📁 File Structure

```
nostrmaxi/
├── src/
│   ├── auth/           # NIP-07, NIP-98, LNURL-auth, JWT
│   ├── payments/       # LNbits, invoices, webhooks
│   ├── subscription/   # Tiers, upgrades, cancellation
│   ├── nip05/          # NIP-05 provisioning with tier checks
│   └── api-keys/       # Business tier API key management
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/       # LoginModal, LnurlQrCode
│   │   │   ├── payments/   # PaymentModal, InvoiceQrCode
│   │   │   ├── pricing/    # PricingPage
│   │   │   ├── profile/    # UserProfile
│   │   │   └── subscription/ # SubscriptionManager
│   │   ├── pages/          # HomePage, DashboardPage, Nip05Page, ReceiptPage
│   │   ├── hooks/          # useAuth
│   │   ├── lib/            # api, nostr
│   │   └── types/          # TypeScript interfaces
│   └── index.html
├── prisma/
│   └── schema.prisma   # User, Session, Subscription, Payment models
└── docker-compose.yml
```

## 🧪 Testing the Flow

### Prerequisites
1. PostgreSQL running (or use docker-compose)
2. LNbits API key in `.env` (optional - uses mock for dev)

### Setup
```bash
# Install dependencies
npm install
cd frontend && npm install && cd ..

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Start backend + frontend
npm run dev
```

### Test Flow
1. **Visit** http://localhost:5173
2. **Click "Get Started"** to open login modal
3. **Login with extension** (nos2x, Alby) or scan LNURL with wallet
4. **Go to Pricing** and select a tier
5. **Pay invoice** (mock in dev mode)
6. **Claim NIP-05** at /nip05
7. **View subscription** at /dashboard?tab=subscription

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/challenge` | POST | Get challenge for signing |
| `/api/v1/auth/verify` | POST | Verify signed challenge, get JWT |
| `/api/v1/auth/me` | GET | Get current user profile |
| `/api/v1/auth/lnurl` | GET | Get LNURL-auth QR data |
| `/api/v1/payments/tiers` | GET | List subscription tiers |
| `/api/v1/payments/invoice` | POST | Create payment invoice |
| `/api/v1/payments/invoice/:id` | GET | Check payment status |
| `/api/v1/subscription` | GET | Get current subscription |
| `/api/v1/nip05/mine` | GET | List user's NIP-05 identities |
| `/api/v1/nip05/provision` | POST | Create new NIP-05 |
| `/.well-known/nostr.json` | GET | Standard NIP-05 lookup |

## 🔒 Environment Variables

```env
# Required
DATABASE_URL=postgresql://user:pass@localhost:5432/nostrmaxi
JWT_SECRET=your-secret-key

# LNbits (optional - uses mock without)
LNBITS_URL=https://legend.lnbits.com
LNBITS_API_KEY=your-api-key

# Optional
BASE_URL=http://localhost:3000
NIP05_DEFAULT_DOMAIN=nostrmaxi.com
WEBHOOK_SECRET=random-webhook-secret
```

## 🚀 Production Deployment

1. Set all env variables
2. Run `npm run build:all`
3. Serve frontend from `frontend/dist/`
4. Run backend with `npm run start:prod`
5. Configure reverse proxy (nginx) for both
6. Set up LNbits webhook URL: `https://yourdomain.com/api/v1/payments/webhook`
