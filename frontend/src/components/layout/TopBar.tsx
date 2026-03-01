import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../Avatar';
import { truncateNpub } from '../../lib/nostr';
import { api } from '../../lib/api';

interface TopBarProps {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: { pubkey: string; npub: string } | null;
  primaryIdentity: string;
  showIdentityMenu: boolean;
  mobileMenuOpen: boolean;
  onMobileMenuToggle: () => void;
  onIdentityMenuToggle: () => void;
  onLogout: () => Promise<void>;
  onLogin: () => void;
  onCloseIdentityMenu: () => void;
}

export function TopBar({
  isLoading,
  isAuthenticated,
  user,
  primaryIdentity,
  showIdentityMenu,
  mobileMenuOpen,
  onMobileMenuToggle,
  onIdentityMenuToggle,
  onLogout,
  onLogin,
  onCloseIdentityMenu,
}: TopBarProps) {
  const [copied, setCopied] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    const loadUnread = async () => {
      try {
        const result = await api.getUnreadNotificationsCount();
        setUnreadCount(result.unread || 0);
      } catch {
        // no-op
      }
    };

    void loadUnread();
    const timer = setInterval(() => {
      void loadUnread();
    }, 30000);

    return () => clearInterval(timer);
  }, [isAuthenticated]);

  const handleCopyNpub = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.npub) return;
    try {
      await navigator.clipboard.writeText(user.npub);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = user.npub;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-swordfish-muted/35 bg-swordfish-bg/78 backdrop-blur-xl">
      <div className="h-16 px-4 flex items-center justify-between gap-3 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMobileMenuToggle}
            className="md:hidden cy-chip"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <Link to="/" className="flex items-center gap-2 text-swordfish-accent font-bold tracking-[0.14em] text-sm sm:text-base nm-kbd-focus rounded-md px-1.5 py-1">
            <span className="cy-mono">&gt;_</span>
            <span>NostrMaxi</span>
          </Link>
        </div>

        <div className="hidden sm:flex flex-1 max-w-md mx-2">
          <input className="cy-input min-h-[38px] py-2" placeholder="Search signal..." aria-label="Search" />
        </div>

        <div className="flex items-center gap-2">
          {!isLoading && !isAuthenticated ? (
            <>
              <Link to="/pricing" className="cy-chip hidden sm:inline-flex">Pricing</Link>
              <Link to="/faq" className="cy-chip hidden sm:inline-flex">FAQ</Link>
            </>
          ) : null}
          {isLoading ? <span className="text-swordfish-muted cy-loading px-2">…</span> : null}
          {!isLoading && isAuthenticated ? (
            <Link to="/notifications" className="cy-chip inline-flex items-center gap-1" aria-label="Notifications">
              <span>🔔</span>
              <span className="text-xs">{unreadCount}</span>
            </Link>
          ) : null}
          {!isLoading && isAuthenticated && user ? (
            <div className="relative">
              <button
                onClick={onIdentityMenuToggle}
                className="cy-chip inline-flex items-center gap-2"
                aria-haspopup="menu"
                aria-expanded={showIdentityMenu}
              >
                <Avatar pubkey={user.pubkey} size={30} clickable={false} />
                <span className="hidden sm:inline">{primaryIdentity || truncateNpub(user.npub, 4)}</span>
                <span>▼</span>
              </button>
              {showIdentityMenu ? (
                <div className="absolute right-0 mt-2 w-72 cy-card p-3 z-50" role="menu">
                  <div className="text-xs text-gray-400">Identity</div>
                  <div className="mt-1 text-sm text-cyan-100 break-all">{primaryIdentity || truncateNpub(user.npub, 4)}</div>
                  <div className="mt-3 text-xs text-gray-400">npub</div>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="cy-mono text-xs text-cyan-200 flex-1 break-all">{user.npub}</code>
                    <button className={`cy-chip ${copied ? 'bg-green-600/30 text-green-300' : ''}`} onClick={handleCopyNpub}>
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    <Link to="/nip05" className="cy-chip text-left" onClick={onCloseIdentityMenu}>Manage Identity</Link>
                    <button
                      className="cy-chip text-left"
                      onClick={async () => {
                        onCloseIdentityMenu();
                        await onLogout();
                      }}
                    >
                      Logout
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {!isLoading && !isAuthenticated ? (
            <button onClick={onLogin} className="cy-btn">Login</button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
