import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import notificationsIcon from '../assets/icons/notifications.png';
import messagesIcon from '../assets/icons/messages.png';
import connectionsIcon from '../assets/icons/connections.png';

const typeIcon: Record<string, string> = {
  system: notificationsIcon,
  mention: messagesIcon,
  reply: messagesIcon,
  zap: notificationsIcon,
  follow: connectionsIcon,
};

export function NotificationsPage() {
  const { isAuthenticated } = useAuth();
  const { notifications, unreadCount, isLoading, error, markRead, markAllRead, refresh } = useNotifications(isAuthenticated);

  return (
    <div className="nm-page max-w-4xl">
      <section className="cy-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="cy-kicker">INBOX</p>
            <h1 className="text-2xl font-semibold text-cyan-100 flex items-center gap-2"><img src={notificationsIcon} alt="" aria-hidden className="nm-icon" />Notifications</h1>
            <p className="text-sm text-cyan-300/70 mt-1">Unread: {unreadCount}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="cy-chip" onClick={() => void refresh()}>Refresh</button>
            <button className="cy-btn" onClick={() => void markAllRead()} disabled={unreadCount === 0}>Mark all read</button>
          </div>
        </div>
      </section>

      {isLoading ? <div className="cy-card p-4 flex items-center justify-center gap-3 text-orange-200"><img src={notificationsIcon} alt="" aria-hidden className="nm-icon animate-pulse" />Loading notifications…</div> : null}
      {error ? <div className="cy-card p-4 text-red-300">{error}</div> : null}

      {!isLoading && notifications.length === 0 ? (
        <div className="cy-card p-4 flex flex-col items-center justify-center py-16 text-center">
          <img src={notificationsIcon} alt="" className="w-20 h-20 mb-4 opacity-80" />
          <p className="text-cyan-300/80">You’re all caught up.</p>
        </div>
      ) : null}

      <section className="space-y-3">
        {notifications.map((item) => {
          const isRead = Boolean(item.readAt);
          return (
            <article key={item.id} className={`cy-card p-4 border ${isRead ? 'border-swordfish-muted/35' : 'border-cyan-400/60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-cyan-300/70">{new Date(item.createdAt).toLocaleString()}</p>
                  <h2 className="text-base text-cyan-100 mt-1 flex items-center gap-2"><img src={typeIcon[item.type] || notificationsIcon} alt="" aria-hidden className="nm-icon" />{item.title}</h2>
                  <p className="text-sm text-cyan-200/80 mt-2">{item.body}</p>
                  {item.link ? <Link to={item.link} className="text-xs text-cyan-300 underline mt-2 inline-block">Open</Link> : null}
                </div>
                {!isRead ? (
                  <button className="cy-chip" onClick={() => void markRead(item.id)}>Mark read</button>
                ) : (
                  <span className="text-xs text-cyan-400/60">Read</span>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
