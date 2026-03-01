import { Link, useLocation } from 'react-router-dom';

type SidebarItem =
  | { type: 'divider' }
  | { type: 'link'; icon: string; label: string; path: string; requiresAuth?: boolean };

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
}

const navItems: SidebarItem[] = [
  { type: 'link', icon: '🏠', label: 'Home', path: '/' },
  { type: 'link', icon: '📰', label: 'Feed', path: '/feed', requiresAuth: true },
  { type: 'link', icon: '🔍', label: 'Discover', path: '/discover', requiresAuth: true },
  { type: 'link', icon: '🧭', label: 'Connections', path: '/connections', requiresAuth: true },
  { type: 'link', icon: '🎬', label: 'Media', path: '/media-discovery', requiresAuth: true },
  { type: 'link', icon: '📋', label: 'Lists', path: '/lists', requiresAuth: true },
  { type: 'link', icon: '🔔', label: 'Notifications', path: '/notifications', requiresAuth: true },
  { type: 'link', icon: '🔖', label: 'Bookmarks', path: '/bookmarks', requiresAuth: true },
  { type: 'link', icon: '💬', label: 'Messages', path: '/messages', requiresAuth: true },
  { type: 'divider' },
  { type: 'link', icon: '🏪', label: 'Marketplace', path: '/marketplace', requiresAuth: true },
  { type: 'link', icon: '🛠️', label: 'Manage', path: '/dashboard', requiresAuth: true },
  { type: 'link', icon: '📊', label: 'Analytics', path: '/analytics', requiresAuth: true },
  { type: 'link', icon: '🌐', label: 'Ecosystem', path: '/ecosystem', requiresAuth: true },
  { type: 'divider' },
  { type: 'link', icon: '👤', label: 'Profile', path: '/profile/me', requiresAuth: true },
  { type: 'link', icon: '⚙️', label: 'Settings', path: '/settings', requiresAuth: true },
  { type: 'link', icon: '🧰', label: 'Admin Config', path: '/admin', requiresAuth: true },
  { type: 'link', icon: '✨', label: 'Get Your NIP-05', path: '/pricing', requiresAuth: true },
];

export function Sidebar({
  collapsed,
  mobileOpen,
  isAuthenticated,
  isAdmin,
  onToggleCollapsed,
  onCloseMobile,
}: SidebarProps) {
  const location = useLocation();

  const widthClass = collapsed ? 'sidebar-collapsed' : 'sidebar-expanded';
  const mobileStateClass = mobileOpen ? 'translate-x-0' : '-translate-x-full';

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        className={[
          'sidebar fixed left-0 top-0 z-40 h-screen border-r border-swordfish-muted/35 bg-swordfish-bg/90 backdrop-blur-xl',
          'transition-[width,transform] duration-200 ease-out',
          widthClass,
          mobileStateClass,
          'md:translate-x-0',
        ].join(' ')}
      >
        <div className="h-full flex flex-col p-2 gap-1">
          <div className="pt-[74px] md:pt-4" />
          {navItems.map((item, index) => {
            if (item.type === 'divider') {
              return <div key={`divider-${index}`} className="my-1 h-px bg-swordfish-muted/30" />;
            }

            if (item.requiresAuth && !isAuthenticated) return null;
            if (item.path === '/admin' && !isAdmin) return null;

            const isActive =
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path + '/'));

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
                className={[
                  'nav-link w-full justify-start gap-2 overflow-hidden',
                  isActive ? 'nav-link-active' : '',
                ].join(' ')}
                title={collapsed ? item.label : undefined}
              >
                <span className="text-lg leading-none min-w-[24px] text-center">{item.icon}</span>
                <span
                  className={[
                    'whitespace-nowrap text-sm transition-all duration-200',
                    collapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto',
                  ].join(' ')}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          <div className="mt-auto pt-2">
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="cy-chip w-full flex items-center justify-center md:justify-start gap-2"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <span>☰</span>
              <span className={collapsed ? 'hidden' : 'block'}>{collapsed ? 'Expand' : 'Collapse'}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
