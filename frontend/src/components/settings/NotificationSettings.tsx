import { useAuth } from '../../hooks/useAuth';
import { useSubscriptions } from '../../hooks/useSubscriptions';

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-2 border-b border-slate-700/40">
      <span className="text-sm text-cyan-100">{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-cyan-200">
      <span>{label}</span>
      <input className="cy-input" type="time" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function NotificationSettings() {
  const { user } = useAuth();
  const { notifPrefs, updateNotificationPrefs } = useSubscriptions(user?.pubkey);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-cyan-100">Notification Preferences</h2>

      <section className="bg-gray-800/50 rounded-lg p-4">
        <h3 className="font-medium text-white mb-2">Notify me about</h3>
        <ToggleRow label="Mentions" value={notifPrefs.mentions} onChange={(v) => void updateNotificationPrefs({ ...notifPrefs, mentions: v })} />
        <ToggleRow label="Replies" value={notifPrefs.replies} onChange={(v) => void updateNotificationPrefs({ ...notifPrefs, replies: v })} />
        <ToggleRow label="Reposts" value={notifPrefs.reposts} onChange={(v) => void updateNotificationPrefs({ ...notifPrefs, reposts: v })} />
        <ToggleRow label="Zaps" value={notifPrefs.zaps} onChange={(v) => void updateNotificationPrefs({ ...notifPrefs, zaps: v })} />
        <ToggleRow label="New followers" value={notifPrefs.follows} onChange={(v) => void updateNotificationPrefs({ ...notifPrefs, follows: v })} />
      </section>

      <section className="bg-gray-800/50 rounded-lg p-4">
        <h3 className="font-medium text-white mb-2">Minimum zap to notify</h3>
        <div className="flex items-center gap-2">
          <input
            className="cy-input max-w-36"
            type="number"
            value={notifPrefs.minZapAmount}
            min={0}
            onChange={(e) => void updateNotificationPrefs({ ...notifPrefs, minZapAmount: Number(e.target.value) || 0 })}
          />
          <span className="text-sm text-gray-300">sats</span>
        </div>
      </section>

      <section className="bg-gray-800/50 rounded-lg p-4">
        <h3 className="font-medium text-white mb-2">Quiet Hours</h3>
        <ToggleRow
          label="Enable quiet hours"
          value={notifPrefs.quietHours.enabled}
          onChange={(v) => void updateNotificationPrefs({
            ...notifPrefs,
            quietHours: { ...notifPrefs.quietHours, enabled: v },
          })}
        />
        {notifPrefs.quietHours.enabled ? (
          <div className="flex gap-4 pt-3">
            <TimeInput
              label="From"
              value={notifPrefs.quietHours.start}
              onChange={(v) => void updateNotificationPrefs({ ...notifPrefs, quietHours: { ...notifPrefs.quietHours, start: v } })}
            />
            <TimeInput
              label="To"
              value={notifPrefs.quietHours.end}
              onChange={(v) => void updateNotificationPrefs({ ...notifPrefs, quietHours: { ...notifPrefs.quietHours, end: v } })}
            />
          </div>
        ) : null}
      </section>

      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span role="img" aria-label="encrypted" className="text-green-500">🔒</span>
        <span>Your notification preferences are encrypted</span>
      </div>
    </div>
  );
}
