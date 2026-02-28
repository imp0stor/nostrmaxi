import { Link } from 'react-router-dom';
import { Avatar } from '../Avatar';
import { truncateNpub } from '../../lib/nostr';

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
  return (
    <header className="sticky top-0 z-20 border-b border-swordfish-muted/35 bg-swordfish-bg/70 backdrop-blur-xl">
      <div className="h-16 px-4 flex items-center justify-between gap-3">
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
          <Link to="/" className="flex items-center gap-2 text-swordfish-accent font-bold tracking-[0.14em] text-sm sm:text-base">
            <span>⚡</span>
            <span>NostrMaxi</span>
          </Link>
        </div>

        <div className="hidden sm:flex flex-1 max-w-md mx-2">
          <input className="cy-input min-h-[38px] py-2" placeholder="Search signal..." aria-label="Search" />
        </div>

        <div className="flex items-center gap-2">
          {isLoading ? <span className="text-swordfish-muted cy-loading px-2">…</span> : null}
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
                    <button className="cy-chip" onClick={async () => { try { await navigator.clipboard.writeText(user.npub); } catch { /* ignore */ } }}>
                      Copy
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
