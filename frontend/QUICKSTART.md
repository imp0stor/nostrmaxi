# Frontend Quick Start

## Run Development Server

```bash
cd ~/strangesignal/projects/nostrmaxi/frontend
npm run dev
```

Frontend will be available at: **http://localhost:5173**

## Build for Production

```bash
npm run build
```

Output will be in `dist/` folder.

## Test the Identity Checker

1. Start the dev server
2. Navigate to homepage
3. Scroll to "Check NIP-05 Identity" section
4. Try these test inputs:

### Valid NIP-05 (if exists):
```
alice@nostrmaxi.com
```

### Valid npub:
```
npub1npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q
```

### Test against live domains:
```
_@fiatjaf.com
mobi@mobi.social
jb55@jb55.com
```

## Features on Landing Page

### 1. Hero Section
- Gradient headline
- "Get Started" and "View Pricing" CTAs

### 2. Identity Checker ⭐
- Input: name@domain or npub
- Real-time verification
- Shows pubkey, relays, verification status

### 3. Features Grid
- NIP-05 Verification
- Lightning Payments
- Web of Trust

### 4. How It Works
- 4-step process visualization

### 5. Pricing
- Link to `/pricing` page
- Full tier comparison

### 6. Footer
- Links to GitHub, Nostr profile

## Tech Stack

- **Framework:** Vite + React 18
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Routing:** React Router v6
- **Nostr:** nostr-tools
- **State:** Zustand

## File Structure

```
src/
├── components/
│   ├── IdentityChecker.tsx     ← NEW! Identity verification UI
│   ├── auth/
│   ├── pricing/
│   ├── payments/
│   └── ...
├── pages/
│   ├── HomePage.tsx            ← Updated with IdentityChecker
│   ├── DashboardPage.tsx
│   ├── Nip05Page.tsx
│   └── ...
├── hooks/
│   └── useAuth.ts
├── lib/
│   ├── api.ts                  ← Backend API client
│   └── nostr.ts
├── App.tsx                     ← Routes and navigation
└── main.tsx                    ← Entry point
```

## API Integration

The frontend expects the backend API at `/api/v1/`:

```typescript
// Defined in src/lib/api.ts
const API_BASE = '/api/v1';

// Examples:
GET  /api/v1/auth/challenge
POST /api/v1/auth/verify
GET  /api/v1/payments/tiers
POST /api/v1/nip05/provision
```

For development, you may need to configure Vite proxy in `vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})
```

## Environment Variables

Create `.env.local` if needed:

```bash
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

## Development Tips

### Hot Module Replacement
Vite HMR is enabled by default. Changes to `.tsx` files will update instantly.

### TypeScript Errors
```bash
npm run build
# or
npx tsc --noEmit
```

### Linting
```bash
npm run lint
```

## Customization

### Change Theme Colors

Edit `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      nostr: {
        purple: '#9945FF',  // Change this
        orange: '#FF6B00',  // And this
        dark: '#1a1a2e',
        darker: '#16162a',
      },
    },
  },
}
```

### Add New Page

1. Create `src/pages/NewPage.tsx`
2. Add route in `App.tsx`:

```tsx
<Route path="/new" element={<NewPage />} />
```

3. Add navigation link in navbar

### Use Identity Checker Elsewhere

```tsx
import { IdentityChecker } from '../components/IdentityChecker';

function MyPage() {
  return (
    <div>
      <h1>My Page</h1>
      <IdentityChecker />
    </div>
  );
}
```

## Troubleshooting

### Port 5173 already in use
```bash
# Kill the process
lsof -ti:5173 | xargs kill -9

# Or use different port
npm run dev -- --port 3001
```

### Module not found
```bash
rm -rf node_modules package-lock.json
npm install
```

### Build fails
```bash
# Clear cache
rm -rf dist node_modules/.vite
npm run build
```

## Production Deployment

### Build
```bash
npm run build
```

### Serve static files
```bash
# Using serve
npx serve -s dist

# Or with nginx
# Point root to /path/to/dist
```

### Docker
See main project's `docker-compose.prod.yml` for full stack deployment.

---

**Happy coding! ⚡**
