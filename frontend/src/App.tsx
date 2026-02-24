import { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { LoginModal } from './components/auth/LoginModal';
import { PricingPage } from './components/pricing/PricingPage';
import { HomePage } from './pages/HomePage';
import { DashboardPage } from './pages/DashboardPage';
import { Nip05Page } from './pages/Nip05Page';
import { ReceiptPage } from './pages/ReceiptPage';
import { FeedPage } from './pages/FeedPage';
import { EpisodePage } from './pages/EpisodePage';
import { ShowPage } from './pages/ShowPage';
import { NotePage } from './pages/NotePage';
import { DiscoveryPage } from './pages/DiscoveryPage';
import { truncateNpub } from './lib/nostr';

export default function App() {
  const { user, isAuthenticated, isLoading, initialize, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const location = useLocation();

  // Initialize auth on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Close menu on navigation
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="bg-nostr-dark border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2">
                <span className="text-2xl">⚡</span>
                <span className="text-xl font-bold text-gradient">NostrMaxi</span>
              </Link>
            </div>

            {/* Desktop navigation */}
            <div className="hidden md:flex items-center gap-6">
              <Link
                to="/discover"
                className="text-gray-300 hover:text-white font-medium"
              >
                Discover
              </Link>
              <Link
                to="/pricing"
                className="text-gray-300 hover:text-white font-medium"
              >
                Pricing
              </Link>
              {isAuthenticated && (
                <>
                  <Link
                    to="/feed"
                    className="text-gray-300 hover:text-white font-medium"
                  >
                    Feed
                  </Link>
                  <Link
                    to="/dashboard"
                    className="text-gray-300 hover:text-white font-medium"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/nip05"
                    className="text-gray-300 hover:text-white font-medium"
                  >
                    NIP-05
                  </Link>
                </>
              )}
              
              {isLoading ? (
                <div className="w-24 h-10 shimmer rounded-lg" />
              ) : isAuthenticated && user ? (
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-nostr-purple/20 hover:bg-nostr-purple/30"
                  >
                    <img
                      src={`https://robohash.org/${user.pubkey}.png?set=set4&size=32x32`}
                      alt="Avatar"
                      className="w-8 h-8 rounded-full"
                    />
                    <span className="text-white font-medium">
                      {truncateNpub(user.npub, 4)}
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown menu */}
                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-nostr-dark border border-gray-700 rounded-lg shadow-lg py-1">
                      <Link
                        to="/dashboard"
                        className="block px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white"
                      >
                        Dashboard
                      </Link>
                      <Link
                        to="/dashboard?tab=subscription"
                        className="block px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white"
                      >
                        Subscription
                      </Link>
                      <hr className="my-1 border-gray-700" />
                      <button
                        onClick={() => {
                          logout();
                          setMenuOpen(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-red-400 hover:bg-gray-800"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowLogin(true)}
                  className="px-4 py-2 bg-nostr-purple hover:bg-nostr-purple/80 text-white font-semibold rounded-lg"
                >
                  Login
                </button>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="text-gray-400 hover:text-white p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {menuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-800 bg-nostr-dark">
            <div className="px-4 py-3 space-y-3">
              <Link
                to="/discover"
                className="block text-gray-300 hover:text-white font-medium py-2"
              >
                Discover
              </Link>
              <Link
                to="/pricing"
                className="block text-gray-300 hover:text-white font-medium py-2"
              >
                Pricing
              </Link>
              {isAuthenticated ? (
                <>
                  <Link
                    to="/feed"
                    className="block text-gray-300 hover:text-white font-medium py-2"
                  >
                    Feed
                  </Link>
                  <Link
                    to="/dashboard"
                    className="block text-gray-300 hover:text-white font-medium py-2"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/nip05"
                    className="block text-gray-300 hover:text-white font-medium py-2"
                  >
                    NIP-05
                  </Link>
                  <button
                    onClick={logout}
                    className="block w-full text-left text-red-400 hover:text-red-300 font-medium py-2"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowLogin(true)}
                  className="w-full px-4 py-2 bg-nostr-purple hover:bg-nostr-purple/80 text-white font-semibold rounded-lg"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Main content */}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage onLogin={() => setShowLogin(true)} />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route
            path="/feed"
            element={
              isAuthenticated ? (
                <FeedPage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="/episode/:id" element={<EpisodePage />} />
          <Route path="/show/:id" element={<ShowPage />} />
          <Route path="/note/:id" element={<NotePage />} />
          <Route path="/discover" element={<DiscoveryPage />} />
          <Route
            path="/dashboard"
            element={
              isAuthenticated ? (
                <DashboardPage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/nip05"
            element={
              isAuthenticated ? (
                <Nip05Page />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="/receipt/:paymentId" element={<ReceiptPage />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="bg-nostr-dark border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <span className="font-bold text-gradient">NostrMaxi</span>
            </div>
            <div className="flex gap-6 text-gray-400 text-sm">
              <a href="https://github.com/nostrmaxi" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                GitHub
              </a>
              <a href="https://njump.me/npub1nostrmaxi" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                Nostr
              </a>
            </div>
            <p className="text-gray-500 text-sm">
              Built with ⚡ for the Nostr community
            </p>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />

      {/* Click outside to close menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}
