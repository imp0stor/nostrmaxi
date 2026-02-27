import { Link } from 'react-router-dom';
import { Avatar } from './Avatar';

export type WotHop = 1 | 2 | 3;

export interface ProfileCardUser {
  pubkey: string;
  name: string;
  nip05?: string;
  about?: string;
  followers: number;
  following: number;
  verifiedNip05: boolean;
}

interface ProfileCardProps {
  user: ProfileCardUser;
  hop: WotHop;
  reason: string;
  isFollowing: boolean;
  onFollow: (pubkey: string) => void;
}

const HOP_STYLES: Record<WotHop, string> = {
  1: 'text-emerald-200 border-emerald-400/40 bg-emerald-500/10',
  2: 'text-blue-200 border-blue-400/40 bg-blue-500/10',
  3: 'text-slate-300 border-slate-500/40 bg-slate-500/10',
};

const HOP_LABELS: Record<WotHop, string> = {
  1: '1st hop',
  2: '2nd hop',
  3: '3rd+ hop',
};

export function ProfileCard({ user, hop, reason, isFollowing, onFollow }: ProfileCardProps) {
  const identityLabel = user.nip05 || user.name;

  return (
    <article className="rounded-xl border border-cyan-400/20 bg-slate-950/85 shadow-[0_0_22px_rgba(34,211,238,0.12)] p-4 hover:border-cyan-300/50 hover:shadow-[0_0_26px_rgba(34,211,238,0.18)] transition">
      <Link to={`/profile/${user.pubkey}`} className="block">
        <div className="flex items-start gap-3">
          <Avatar pubkey={user.pubkey} size={56} clickable={false} className="shrink-0" />
          <div className="min-w-0 w-full">
            <p className="text-cyan-100 font-semibold truncate flex items-center gap-1">
              {identityLabel}
              {user.verifiedNip05 && <span title="Verified NIP-05">✓</span>}
            </p>
            {user.nip05 && user.name !== user.nip05 && <p className="text-sm text-slate-300 truncate">{user.name}</p>}
            <p className="mt-2 text-sm text-slate-400 line-clamp-2">{user.about || 'No bio provided yet.'}</p>
          </div>
        </div>
      </Link>

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
        <span className={`rounded-full px-2 py-0.5 border ${HOP_STYLES[hop]}`}>WoT {HOP_LABELS[hop]}</span>
        <span className="rounded-full px-2 py-0.5 border border-fuchsia-400/40 text-fuchsia-200 bg-fuchsia-500/10">{reason}</span>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>{user.followers.toLocaleString()} followers</span>
        <span>{user.following.toLocaleString()} following</span>
      </div>

      <button
        type="button"
        onClick={() => onFollow(user.pubkey)}
        disabled={isFollowing}
        className={`mt-3 w-full rounded-md px-3 py-2 text-sm font-semibold transition ${isFollowing ? 'bg-slate-800 text-slate-300 border border-slate-700 cursor-default' : 'bg-cyan-500/20 text-cyan-100 border border-cyan-300/60 hover:bg-cyan-500/35'}`}
      >
        {isFollowing ? 'Following' : 'Follow'}
      </button>
    </article>
  );
}
