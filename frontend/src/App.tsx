import { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { LoginModal } from './components/auth/LoginModal';
import { PricingPage } from './components/pricing/PricingPage';
import { HomePage } from './pages/HomePage';
import { DashboardPage } from './pages/DashboardPage';
import { Nip05Page } from './pages/Nip05Page';
import { ReceiptPage } from './pages/ReceiptPage';
import { ProfilePage } from './pages/ProfilePage';
import { FeedPage } from './pages/FeedPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { MarketplaceListingPage } from './pages/MarketplaceListingPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { EcosystemCatalogPage } from './pages/EcosystemCatalogPage';
import { ListsPage } from './pages/ListsPage';
import { truncateNpub } from './lib/nostr';
import { Avatar } from './components/Avatar';
import { IDENTITY_REFRESH_EVENT } from './lib/identityRefresh';
import { resolvePrimaryIdentityDetailed } from './lib/identityResolver';

export default function App() {
  const { user, isAuthenticated, isLoading, initialize, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showIdentityMenu, setShowIdentityMenu] = useState(false);
  const [primaryIdentity, setPrimaryIdentity] = useState<string>('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const isLandingRoute = location.pathname === '/' || location.pathname === '/home';
    if (isLandingRoute) {
      navigate('/feed', { replace: true });
    }
  }, [isAuthenticated, user, location.pathname, navigate]);

  useEffect(() => {
    let cancelled = false;

    const loadIdentity = async (forceRefresh = false) => {
      if (!isAuthenticated || !user) {
        setPrimaryIdentity('');
        return;
      }

      try {
        const resolution = await resolvePrimaryIdentityDetailed(user, { forceRefresh });
        if (typeof console !== 'undefined') {
          console.info('[app] loadIdentity resolved', {
            pubkey: user.pubkey,
            npub: user.npub,
            forceRefresh,
            source: resolution.source,
            value: resolution.value,
            externalNip05: resolution.externalNip05 ?? null,
            managedNip05: resolution.managedNip05 ?? null,
          });
        }
        if (!cancelled) {
          setPrimaryIdentity(resolution.value || truncateNpub(user.npub, 4));
        }
      } catch (error) {
        if (typeof console !== 'undefined') {
          console.error('[app] loadIdentity failed', {
            pubkey: user.pubkey,
            npub: user.npub,
            forceRefresh,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        if (!cancelled) {
          setPrimaryIdentity(truncateNpub(user.npub, 4));
        }
      }
    };

    const handleIdentityRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ pubkey?: string }>).detail;
      if (detail?.pubkey && user && detail.pubkey !== user.pubkey) return;
      void loadIdentity(true);
    };

    void loadIdentity(showIdentityMenu);

    if (typeof window !== 'undefined') {
      window.addEventListener(IDENTITY_REFRESH_EVENT, handleIdentityRefresh as EventListener);
    }

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener(IDENTITY_REFRESH_EVENT, handleIdentityRefresh as EventListener);
      }
    };
  }, [isAuthenticated, user, showIdentityMenu]);

  return (
    <div className="min-h-screen flex flex-col cyber-grid bg-[#0a0e27]">
      <nav className="border-b border-cyan-900/60 bg-[#060914]/95 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-cyan-300 font-bold tracking-wider"><span>⚡</span><span>NostrMaxi</span></Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/feed" className="text-blue-200 hover:text-cyan-300">Feed</Link>
            <Link to="/discover" className="text-blue-200 hover:text-cyan-300">Discover</Link>
            {isAuthenticated && <Link to="/lists" className="text-blue-200 hover:text-cyan-300">Lists</Link>}
            {isAuthenticated && <Link to="/marketplace" className="text-blue-200 hover:text-cyan-300">Marketplace</Link>}
            {isAuthenticated && <Link to="/dashboard" className="text-blue-200 hover:text-cyan-300">Manage</Link>}
            {isAuthenticated && <Link to="/analytics" className="text-blue-200 hover:text-cyan-300">Analytics</Link>}
            {isAuthenticated && <Link to="/ecosystem" className="text-blue-200 hover:text-cyan-300">Ecosystem</Link>}
            {isAuthenticated && <Link to="/profile/me" className="text-blue-200 hover:text-cyan-300">Profile</Link>}
            {isAuthenticated && <Link to="/settings" className="text-blue-200 hover:text-cyan-300">Settings</Link>}
            {isAuthenticated && <Link to="/pricing" className="text-fuchsia-200 hover:text-fuchsia-100">Get Your NIP-05</Link>}
            {isLoading ? <span className="text-gray-500">…</span> : isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setShowIdentityMenu((v) => !v)}
                  className="cy-chip inline-flex items-center gap-2"
                  aria-haspopup="menu"
                  aria-expanded={showIdentityMenu}
                >
                  <Avatar pubkey={user.pubkey} size={30} clickable={false} />
                  <span>{primaryIdentity || truncateNpub(user.npub, 4)}</span>
                  <span>▼</span>
                </button>
                {showIdentityMenu ? (
                  <div className="absolute right-0 mt-2 w-72 cy-card p-3 z-50" role="menu">
                    <div className="text-xs text-gray-400">Identity</div>
                    <div className="mt-1 text-sm text-cyan-100 break-all">{primaryIdentity || truncateNpub(user.npub, 4)}</div>
                    <div className="mt-3 text-xs text-gray-400">npub</div>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="cy-mono text-xs text-cyan-200 flex-1 break-all">{user.npub}</code>
                      <button className="cy-chip" onClick={async () => { try { await navigator.clipboard.writeText(user.npub); } catch { /* ignore */ } }}>
                        Copy
                      </button>
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                      <Link to="/nip05" className="cy-chip text-left" onClick={() => setShowIdentityMenu(false)}>Manage Identity</Link>
                      <button
                        className="cy-chip text-left"
                        onClick={async () => {
                          setShowIdentityMenu(false);
                          await logout();
                        }}
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <button onClick={() => setShowLogin(true)} className="cy-btn">Login</button>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage onLogin={() => setShowLogin(true)} />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/feed" element={isAuthenticated ? <FeedPage /> : <Navigate to="/" replace />} />
          <Route path="/discover" element={isAuthenticated ? <DiscoverPage /> : <Navigate to="/" replace />} />
          <Route path="/lists" element={isAuthenticated ? <ListsPage /> : <Navigate to="/" replace />} />
          <Route path="/marketplace" element={isAuthenticated ? <MarketplacePage /> : <Navigate to="/" replace />} />
          <Route path="/marketplace/:listingId" element={isAuthenticated ? <MarketplaceListingPage /> : <Navigate to="/" replace />} />
          <Route path="/dashboard" element={isAuthenticated ? <DashboardPage /> : <Navigate to="/" replace />} />
          <Route path="/analytics" element={isAuthenticated ? <AnalyticsPage /> : <Navigate to="/" replace />} />
          <Route path="/ecosystem" element={isAuthenticated ? <EcosystemCatalogPage /> : <Navigate to="/" replace />} />
          <Route path="/nip05" element={isAuthenticated ? <Nip05Page /> : <Navigate to="/" replace />} />
          <Route path="/profile/:npub" element={isAuthenticated ? <ProfilePage /> : <Navigate to="/" replace />} />
          <Route path="/settings" element={isAuthenticated ? <SettingsPage /> : <Navigate to="/" replace />} />
          <Route path="/receipt/:paymentId" element={<ReceiptPage />} />
        </Routes>
      </main>

      <footer className="border-t border-cyan-900/60 py-6 text-center text-xs text-gray-500">NostrMaxi // cyber social + identity</footer>
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
