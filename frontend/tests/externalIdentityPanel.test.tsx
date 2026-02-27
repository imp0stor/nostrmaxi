import { renderToStaticMarkup } from 'react-dom/server';
import { ExternalIdentityPanel } from '../src/components/profile/ExternalIdentityPanel';

describe('ExternalIdentityPanel UI', () => {
  it('renders github and x cards with status badges', () => {
    const html = renderToStaticMarkup(
      <ExternalIdentityPanel
        identities={[
          {
            platform: 'github',
            identity: 'github:neo',
            verified: true,
            verificationStatus: 'verified',
            github: { login: 'neo', publicRepos: 42, followers: 7, languages: ['TypeScript'], url: 'https://github.com/neo' },
            linkUrl: 'https://github.com/neo',
          },
          {
            platform: 'x',
            identity: 'x:neo',
            verified: false,
            verificationStatus: 'failed',
            twitter: { handle: 'neo', profileUrl: 'https://x.com/neo', proofUrl: 'https://x.com/neo/status/1' },
          },
        ]}
        isVerifying={false}
        onVerifyAll={() => undefined}
        onUpsert={() => undefined}
        canEdit
        proofGuidance={() => 'guidance'}
      />,
    );

    expect(html).toContain('External identities');
    expect(html).toContain('github:neo');
    expect(html).toContain('x:neo');
    expect(html).toContain('verified');
    expect(html).toContain('failed');
    expect(html).toContain('Save claim');
  });
});
