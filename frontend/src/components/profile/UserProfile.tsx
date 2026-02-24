import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { fetchProfile, truncateNpub } from '../../lib/nostr';
import type { NostrProfile } from '../../types';

export function UserProfile() {
  const { user, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<NostrProfile | null>(null);

  useEffect(() => {
    if (!user?.pubkey) return;

    fetchProfile(user.pubkey)
      .then(setProfile);
  }, [user?.pubkey]);

  if (!isAuthenticated || !user) {
    return null;
  }

  const displayName = profile?.display_name || profile?.name || truncateNpub(user.npub);
  const avatarUrl = profile?.picture || `https://robohash.org/${user.pubkey}.png?set=set4`;

  return (
    <div className="bg-nostr-dark rounded-xl overflow-hidden">
      {/* Banner */}
      <div
        className="h-32 bg-gradient-to-r from-nostr-purple to-nostr-orange"
        style={profile?.banner ? { backgroundImage: `url(${profile.banner})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      />

      {/* Profile content */}
      <div className="px-6 pb-6">
        {/* Avatar */}
        <div className="relative -mt-16 mb-4">
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-32 h-32 rounded-full border-4 border-nostr-dark bg-nostr-darker"
          />
          {user.wotScore > 50 && (
            <div className="absolute bottom-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
              Trusted
            </div>
          )}
        </div>

        {/* Name and npub */}
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            {displayName}
            {profile?.nip05 && (
              <svg className="w-5 h-5 text-nostr-purple" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </h2>
          
          {/* NIP-05 */}
          {profile?.nip05 && (
            <p className="text-nostr-purple font-medium">{profile.nip05}</p>
          )}
          
          {/* npub */}
          <p className="text-gray-400 text-sm font-mono mt-1">
            {truncateNpub(user.npub, 12)}
          </p>
        </div>

        {/* Bio */}
        {profile?.about && (
          <p className="text-gray-300 mb-4">{profile.about}</p>
        )}

        {/* Stats */}
        <div className="flex gap-6 mb-4">
          <div>
            <span className="text-white font-bold">{user.nip05s.length}</span>
            <span className="text-gray-400 ml-1">NIP-05s</span>
          </div>
          <div>
            <span className="text-white font-bold">{user.wotScore.toFixed(0)}</span>
            <span className="text-gray-400 ml-1">WoT Score</span>
          </div>
        </div>

        {/* Subscription badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-nostr-purple/20 rounded-full">
          <span className="text-nostr-purple font-medium">{user.tier}</span>
          {user.subscription?.isActive && user.tier !== 'FREE' && (
            <span className="text-green-400 text-sm">Active</span>
          )}
        </div>

        {/* Links */}
        <div className="mt-4 flex gap-3">
          {profile?.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </a>
          )}
          {profile?.lud16 && (
            <span className="text-nostr-orange flex items-center gap-1 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {profile.lud16}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
