import { Link, useLocation } from 'react-router-dom';
import analyticsIcon from '../../assets/icons/analytics.png';
import bookmarksIcon from '../../assets/icons/bookmarks.png';
import composeIcon from '../../assets/icons/compose.png';
import connectionsIcon from '../../assets/icons/connections.png';
import messagesIcon from '../../assets/icons/messages.png';
import notificationsIcon from '../../assets/icons/notifications.png';
import profileIcon from '../../assets/icons/profile.png';
import settingsIcon from '../../assets/icons/settings.png';
import homeIcon from '../../assets/icons/home.png';
import mediaIcon from '../../assets/icons/media.png';
import listsIcon from '../../assets/icons/lists.png';
import marketplaceIcon from '../../assets/icons/marketplace.png';
import manageIcon from '../../assets/icons/manage.png';
import ecosystemIcon from '../../assets/icons/ecosystem.png';
import nip05Icon from '../../assets/icons/nip05.png';

type SidebarItem =
  | { type: 'divider' }
  | { type: 'link'; icon: string; iconSrc?: string; label: string; path: string; requiresAuth?: boolean; requiresPaid?: boolean };

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  hasPaidEntitlement: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
}

const navItems: SidebarItem[] = [
  { type: 'link', icon: '⌂', iconSrc: homeIcon, label: 'Home', path: '/' },
  { type: 'link', icon: '?', label: 'FAQ', path: '/faq' },
  { type: 'link', icon: 'FD', iconSrc: profileIcon, label: 'Feed', path: '/feed', requiresAuth: true },
  { type: 'link', icon: 'FS', iconSrc: profileIcon, label: 'Feeds', path: '/feeds', requiresAuth: true },
  { type: 'link', icon: 'DS', iconSrc: composeIcon, label: 'Discover', path: '/discover', requiresAuth: true },
  { type: 'link', icon: 'CN', iconSrc: connectionsIcon, label: 'Connections', path: '/connections', requiresAuth: true },
  { type: 'link', icon: 'MD', iconSrc: mediaIcon, label: 'Media', path: '/media-discovery', requiresAuth: true },
  { type: 'link', icon: 'LS', iconSrc: listsIcon, label: 'Lists', path: '/lists', requiresAuth: true },
  { type: 'link', icon: 'NT', iconSrc: notificationsIcon, label: 'Notifications', path: '/notifications', requiresAuth: true },
  { type: 'link', icon: 'BM', iconSrc: bookmarksIcon, label: 'Bookmarks', path: '/bookmarks', requiresAuth: true },
  { type: 'link', icon: 'BK', label: 'Books', path: '/books', requiresAuth: true },
  { type: 'link', icon: 'DM', iconSrc: messagesIcon, label: 'Messages', path: '/messages', requiresAuth: true },
  { type: 'divider' },
  { type: 'link', icon: 'MP', iconSrc: marketplaceIcon, label: 'Marketplace', path: '/marketplace', requiresAuth: true },
  { type: 'link', icon: 'GC', label: 'Gift Cards', path: '/gift-cards', requiresAuth: true },
  { type: 'link', icon: 'RD', label: 'Redeem', path: '/gift-cards/redeem' },
  { type: 'link', icon: 'MG', iconSrc: manageIcon, label: 'Manage', path: '/dashboard', requiresAuth: true },
  { type: 'link', icon: 'AN', iconSrc: analyticsIcon, label: 'Analytics', path: '/analytics', requiresAuth: true, requiresPaid: true },
  { type: 'link', icon: 'EC', iconSrc: ecosystemIcon, label: 'Ecosystem', path: '/ecosystem', requiresAuth: true },
  { type: 'link', icon: 'QA', label: 'Q&A', path: '/qa', requiresAuth: true },
  { type: 'link', icon: 'TG', label: 'Tags', path: '/qa/tags', requiresAuth: true },
  { type: 'divider' },
  { type: 'link', icon: 'PF', iconSrc: profileIcon, label: 'Profile', path: '/profile/me', requiresAuth: true },
  { type: 'link', icon: 'ST', iconSrc: settingsIcon, label: 'Settings', path: '/settings', requiresAuth: true },
  { type: 'link', icon: 'DM', iconSrc: settingsIcon, label: 'Domains', path: '/domains', requiresAuth: true },
  { type: 'link', icon: 'AD', iconSrc: settingsIcon, label: 'Admin Config', path: '/admin', requiresAuth: true },
  { type: 'link', icon: 'ID', iconSrc: nip05Icon, label: 'Get Your NIP-05', path: '/pricing', requiresAuth: true },
];

export function Sidebar({
  collapsed,
  mobileOpen,
  isAuthenticated,
  isAdmin,
  hasPaidEntitlement,
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
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'nav-link w-full justify-start gap-2 overflow-hidden nm-kbd-focus',
                  isActive ? 'nav-link-active' : '',
                ].join(' ')}
                title={collapsed ? item.label : undefined}
              >
                {item.iconSrc ? (
                  <img src={item.iconSrc} alt="" aria-hidden className="nm-icon" />
                ) : (
                  <span className="cy-mono text-[11px] tracking-[0.08em] leading-none min-w-[24px] text-center opacity-90">{item.icon}</span>
                )}
                <span
                  className={[
                    'whitespace-nowrap text-sm transition-all duration-200',
                    collapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto',
                  ].join(' ')}
                >
                  {item.label}
                </span>
                {item.requiresPaid && !hasPaidEntitlement && !collapsed ? (
                  <span className="ml-auto rounded bg-orange-500/20 border border-orange-400/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-orange-200">
                    Locked
                  </span>
                ) : null}
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
