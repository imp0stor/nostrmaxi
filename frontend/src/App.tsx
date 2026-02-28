import { useEffect, useState } from 'react';
import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
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
import { BookmarksPage } from './pages/BookmarksPage';
import { truncateNpub } from './lib/nostr';
import { IDENTITY_REFRESH_EVENT } from './lib/identityRefresh';
import { resolvePrimaryIdentityDetailed } from './lib/identityResolver';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { useSidebarState } from './hooks/useSidebarState';

export default function App() {
  const { user, isAuthenticated, isLoading, initialize, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showIdentityMenu, setShowIdentityMenu] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [primaryIdentity, setPrimaryIdentity] = useState<string>('');
  const location = useLocation();
  const navigate = useNavigate();
  const { collapsed, toggleCollapsed } = useSidebarState();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    setMobileSidebarOpen(false);
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

  const sidebarWidthClass = collapsed ? 'md:pl-[60px]' : 'md:pl-[200px]';

  return (
    <div className="swordfish-shell min-h-screen flex cyber-grid bg-swordfish-bg text-swordfish-text">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileSidebarOpen}
        isAuthenticated={isAuthenticated}
        onToggleCollapsed={toggleCollapsed}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className={`flex-1 min-h-screen flex flex-col transition-[padding] duration-200 ease-out ${sidebarWidthClass}`}>
        <TopBar
          isLoading={isLoading}
          isAuthenticated={isAuthenticated}
          user={user}
          primaryIdentity={primaryIdentity}
          showIdentityMenu={showIdentityMenu}
          mobileMenuOpen={mobileSidebarOpen}
          onMobileMenuToggle={() => setMobileSidebarOpen((v) => !v)}
          onIdentityMenuToggle={() => setShowIdentityMenu((v) => !v)}
          onLogout={logout}
          onLogin={() => setShowLogin(true)}
          onCloseIdentityMenu={() => setShowIdentityMenu(false)}
        />

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage onLogin={() => setShowLogin(true)} />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/feed" element={isAuthenticated ? <FeedPage /> : <Navigate to="/" replace />} />
            <Route path="/discover" element={isAuthenticated ? <DiscoverPage /> : <Navigate to="/" replace />} />
            <Route path="/media-discovery" element={isAuthenticated ? <MediaDiscoveryPage /> : <Navigate to="/" replace />} />
            <Route path="/lists" element={isAuthenticated ? <ListsPage /> : <Navigate to="/" replace />} />
            <Route path="/bookmarks" element={isAuthenticated ? <BookmarksPage /> : <Navigate to="/" replace />} />
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

        <footer className="border-t border-swordfish-muted/30 py-6 text-center text-xs text-swordfish-muted tracking-[0.12em]">
          NostrMaxi // cinematic social + identity
        </footer>
      </div>

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
