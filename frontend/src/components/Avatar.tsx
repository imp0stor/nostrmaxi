import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchProfileCached } from '../lib/profileCache';

type AvatarProps = {
  pubkey: string;
  size?: number;
  onClick?: () => void;
  className?: string;
  clickable?: boolean;
};

const PALETTE = [
  '#00d4ff',
  '#19f0c1',
  '#5afc6c',
  '#9bff00',
  '#67b7ff',
  '#8f7bff',
  '#ff4dd2',
  '#ff7a59',
];

function hashToColor(pubkey: string): string {
  let hash = 0;
  for (let i = 0; i < pubkey.length; i += 1) {
    hash = ((hash << 5) - hash) + pubkey.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}

function letterFromIdentity(pubkey: string, label?: string): string {
  const trimmed = label?.trim();
  if (trimmed && /[a-zA-Z0-9]/.test(trimmed[0])) return trimmed[0].toUpperCase();
  return pubkey.slice(0, 1).toUpperCase() || '?';
}

export function Avatar({ pubkey, size = 44, onClick, className = '', clickable = true }: AvatarProps) {
  const { user } = useAuth();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [label, setLabel] = useState<string>('');
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setErrored(false);
    fetchProfileCached(pubkey)
      .then((profile) => {
        if (cancelled) return;
        setImageUrl(profile?.picture || null);
        setLabel(profile?.display_name || profile?.name || profile?.nip05 || '');
      })
      .catch(() => {
        if (!cancelled) {
          setImageUrl(null);
          setLabel('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pubkey]);

  const borderColor = hashToColor(pubkey);
  const fallbackLetter = letterFromIdentity(pubkey, label);

  const content = imageUrl && !errored ? (
    <img
      src={imageUrl}
      alt={label || 'Nostr avatar'}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded(true)}
      onError={() => setErrored(true)}
      className="w-full h-full object-cover"
    />
  ) : (
    <span className="font-bold text-sm" style={{ color: borderColor }}>{fallbackLetter}</span>
  );

  const avatarNode = (
    <span
      className={`relative inline-flex items-center justify-center rounded-full overflow-hidden bg-[#060914] border transition-all ${clickable ? 'hover:shadow-[0_0_14px_rgba(0,212,255,0.35)]' : ''} ${className}`}
      style={{ width: size, height: size, borderColor }}
      onClick={onClick}
    >
      {content}
      {!loaded && imageUrl && !errored ? <span className="absolute inset-0 animate-pulse bg-cyan-900/30" /> : null}
      {user?.pubkey === pubkey ? <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-400 border border-[#060914]" /> : null}
    </span>
  );

  if (!clickable) return avatarNode;
  return <Link to={`/profile/${pubkey}`}>{avatarNode}</Link>;
}
