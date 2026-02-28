import { useMemo, useState } from 'react';
import { useMuteActions } from '../hooks/useMuteActions';
import type { FeedItem } from '../lib/social';

interface PostActionMenuProps {
  item: FeedItem;
  viewerPubkey?: string;
  onClose?: () => void;
}

export function PostActionMenu({ item, viewerPubkey, onClose }: PostActionMenuProps) {
  const { mutePubkey, unmutePubkey, muteThread, muteHashtag, isPubkeyMuted } = useMuteActions(viewerPubkey);
  const [open, setOpen] = useState(false);

  const authorMuted = isPubkeyMuted(item.pubkey);
  const hashtags = useMemo(
    () => [...new Set((item.tags || []).filter((t) => t[0] === 't' && t[1]).map((t) => t[1]))],
    [item.tags],
  );

  const closeMenu = () => {
    setOpen(false);
    onClose?.();
  };

  const handleToggleAuthorMute = async () => {
    if (authorMuted) await unmutePubkey(item.pubkey);
    else await mutePubkey(item.pubkey);
    closeMenu();
  };

  const handleMuteThread = async () => {
    await muteThread(item.id);
    closeMenu();
  };

  const handleMuteHashtag = async (tag: string) => {
    await muteHashtag(tag);
    closeMenu();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="cy-chip text-xs"
        aria-label="More actions"
        type="button"
      >
        ⋯
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
            <button
              type="button"
              onClick={handleToggleAuthorMute}
              className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
            >
              🔇 {authorMuted ? 'Unmute author' : 'Mute author'}
            </button>

            <button
              type="button"
              onClick={handleMuteThread}
              className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
            >
              🔇 Mute thread
            </button>

            {hashtags.length > 0 && (
              <>
                <div className="border-t border-gray-700 my-1" />
                <div className="px-4 py-1 text-xs text-gray-500">Mute hashtag</div>
                {hashtags.slice(0, 5).map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => handleMuteHashtag(tag)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700"
                  >
                    #{tag}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
