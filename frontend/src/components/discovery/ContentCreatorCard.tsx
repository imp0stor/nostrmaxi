import { Link } from 'react-router-dom';

export interface ContentCreator {
  pubkey: string;
  profile: {
    name?: string;
    display_name?: string;
    about?: string;
    picture?: string;
    lud16?: string;
  };
  contentType: Array<'podcast' | 'video' | 'article' | 'music'>;
  platforms: {
    nostr: boolean;
    rss?: string;
    youtube?: string;
    spotify?: string;
    fountain?: string;
    wavlake?: string;
    substack?: string;
    website?: string;
  };
  v4vEnabled: boolean;
  followerCount: number;
  topics: string[];
}

interface ContentCreatorCardProps {
  creator: ContentCreator;
}

export function ContentCreatorCard({ creator }: ContentCreatorCardProps) {
  const name = creator.profile.display_name || creator.profile.name || creator.pubkey.slice(0, 12);
  const npubLike = `${creator.pubkey.slice(0, 12)}…`;

  return (
    <article className="cy-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-cyan-100 font-semibold">{name}</h3>
          <p className="text-xs text-cyan-300">@{npubLike} • {creator.followerCount.toLocaleString()} followers</p>
        </div>
      </div>

      <p className="text-sm text-slate-200">{creator.profile.about || 'Content creator on Nostr and beyond'}</p>

      <div className="flex flex-wrap gap-2">
        <span className="cy-chip text-xs">Nostr ✓</span>
        {creator.platforms.rss ? <span className="cy-chip text-xs">RSS ✓</span> : null}
        {creator.platforms.youtube ? <span className="cy-chip text-xs">YouTube ✓</span> : null}
        {creator.v4vEnabled ? <span className="cy-chip text-xs">V4V ✓</span> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to={`/profile/${creator.pubkey}`} className="cy-btn-secondary text-xs">Follow</Link>
        {creator.platforms.rss ? <a href={creator.platforms.rss} target="_blank" rel="noreferrer" className="cy-btn-secondary text-xs">Subscribe RSS</a> : null}
        {creator.platforms.youtube ? <a href={creator.platforms.youtube} target="_blank" rel="noreferrer" className="cy-btn-secondary text-xs">Watch</a> : null}
        {creator.platforms.website ? <a href={creator.platforms.website} target="_blank" rel="noreferrer" className="cy-btn-secondary text-xs">Visit</a> : null}
      </div>
    </article>
  );
}
