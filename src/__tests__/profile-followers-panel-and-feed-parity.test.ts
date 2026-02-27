import fs from 'fs';
import path from 'path';

const profilePagePath = path.resolve(__dirname, '../../frontend/src/pages/ProfilePage.tsx');

describe('profile followers/following panel + feed rendering parity guards', () => {
  const source = fs.readFileSync(profilePagePath, 'utf8');

  test('profile feed uses inline token rendering pipeline', () => {
    expect(source).toContain('parseMediaFromFeedItem(evt)');
    expect(source).toContain('<InlineContent tokens={media.tokens} quotedEvents={quotedEvents} quotedProfiles={quotedProfiles} />');
    expect(source).toContain('extractQuoteRefsFromTokens');
    expect(source).toContain('resolveQuotedEvents');
  });

  test('raw profile event text is not rendered directly', () => {
    expect(source).not.toContain('evt.content');
  });

  test('followers/following panel has open/close affordances and pagination controls', () => {
    expect(source).toContain("onClick={() => togglePanel('followers')}");
    expect(source).toContain("onClick={() => togglePanel('following')}");
    expect(source).toContain('data-testid="profile-contact-panel"');
    expect(source).toContain('onClick={() => setPanelMode(null)}');
    expect(source).toContain('Load more');
  });

  test('panel supports search/sort and follow state actions', () => {
    expect(source).toContain('placeholder="Search NIP-05, name, npub..."');
    expect(source).toContain('Sort: Followers');
    expect(source).toContain('Sort: Following');
    expect(source).toContain('Sort: Name');
    expect(source).toContain("isFollowingNow ? 'Unfollow' : 'Follow'");
  });
});
