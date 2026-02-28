import { useEffect, useMemo, useState } from 'react';
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
import { MediaDiscoveryPage } from './pages/MediaDiscoveryPage';
import { truncateNpub } from './lib/nostr';
import { Avatar } from './components/Avatar';
import { IDENTITY_REFRESH_EVENT } from './lib/identityRefresh';
import { resolvePrimaryIdentityDetailed } from './lib/identityResolver';

type NavItem = { path: string; label: string; authed?: boolean };

export default function App() {
  const { user, isAuthenticated, isLoading, initialize, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showIdentityMenu, setShowIdentityMenu] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [primaryIdentity, setPrimaryIdentity] = useState<string>('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    setShowMobileNav(false);
    setShowIdentityMenu(false);
  }, [location.pathname]);

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
        if (!cancelled) {
          setPrimaryIdentity(resolution.value || truncateNpub(user.npub, 4));
        }
      } catch {
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

  const navClass = (path: string) => `nav-link ${location.pathname === path ? 'nav-link-active' : ''}`;

  const navItems = useMemo<NavItem[]>(() => [
    { path: '/feed', label: 'Feed' },
    { path: '/discover', label: 'Discover' },
    { path: '/media-discovery', label: 'Media', authed: true },
    { path: '/lists', label: 'Lists', authed: true },
    { path: '/marketplace', label: 'Marketplace', authed: true },
    { path: '/dashboard', label: 'Manage', authed: true },
    { path: '/analytics', label: 'Analytics', authed: true },
    { path: '/ecosystem', label: 'Ecosystem', authed: true },
    { path: '/profile/me', label: 'Profile', authed: true },
    { path: '/settings', label: 'Settings', authed: true },
    { path: '/pricing', label: 'Get Your NIP-05', authed: true },
  ], []);

  return (
    <div className="swordfish-shell min-h-screen flex flex-col cyber-grid bg-swordfish-bg text-swordfish-text">
      <nav className="border-b border-swordfish-muted/35 bg-swordfish-bg/70 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 min-h-16 py-2 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 text-swordfish-accent font-bold tracking-[0.14em] text-sm sm:text-base">
            <span>⚡</span><span>NostrMaxi</span>
          </Link>

          <button
            className="md:hidden cy-chip"
            onClick={() => setShowMobileNav((v) => !v)}
            aria-expanded={showMobileNav}
            aria-label="Toggle navigation"
          >
            {showMobileNav ? 'Close' : 'Menu'}
          </button>

          <div className="hidden md:flex items-center gap-2 lg:gap-3 text-sm">
            {navItems.filter((i) => !i.authed || isAuthenticated).map((item) => (
              <Link key={item.path} to={item.path} className={navClass(item.path)}>{item.label}</Link>
            ))}
            {isLoading ? <span className="text-swordfish-muted cy-loading px-2">…</span> : isAuthenticated && user ? (
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

        {showMobileNav ? (
          <div className="md:hidden border-t border-swordfish-muted/30 px-4 pb-3 animate-content-fade-cinematic">
            <div className="grid grid-cols-2 gap-2 pt-3">
              {navItems.filter((i) => !i.authed || isAuthenticated).map((item) => (
                <Link key={item.path} to={item.path} className={navClass(item.path)}>{item.label}</Link>
              ))}
              {!isAuthenticated && !isLoading ? (
                <button onClick={() => setShowLogin(true)} className="cy-btn col-span-2">Login</button>
              ) : null}
              {isAuthenticated && user ? (
                <button className="cy-chip col-span-2 text-left" onClick={async () => { await logout(); }}>
                  Logout ({primaryIdentity || truncateNpub(user.npub, 4)})
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </nav>

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage onLogin={() => setShowLogin(true)} />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/feed" element={isAuthenticated ? <FeedPage /> : <Navigate to="/" replace />} />
          <Route path="/discover" element={isAuthenticated ? <DiscoverPage /> : <Navigate to="/" replace />} />
          <Route path="/media-discovery" element={isAuthenticated ? <MediaDiscoveryPage /> : <Navigate to="/" replace />} />
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

      <footer className="border-t border-swordfish-muted/30 py-6 text-center text-xs text-swordfish-muted tracking-[0.12em]">NostrMaxi // cinematic social + identity</footer>
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
