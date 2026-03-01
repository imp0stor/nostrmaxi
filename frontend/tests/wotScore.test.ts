import { mapPrimitiveWotToFeedMetric } from '../src/lib/wotScore';

describe('mapPrimitiveWotToFeedMetric', () => {
  it('maps calculated numeric score and keeps zero when explicitly calculated', () => {
    const result = mapPrimitiveWotToFeedMetric({
      trustScore: 0,
      distanceLabel: '1-hop',
      scoreState: 'calculated',
    });

    expect(result).toMatchObject({
      trustScore: 0,
      scoreLabel: '0',
      distanceLabel: '1-hop',
      scoreState: 'calculated',
    });
    expect(result.ariaLabel).toContain('score 0');
  });

  it('maps unknown score separately from numeric zero', () => {
    const result = mapPrimitiveWotToFeedMetric({
      trustScore: null,
      distanceLabel: 'unknown',
      scoreState: 'unknown',
    });

    expect(result).toMatchObject({
      trustScore: null,
      scoreLabel: 'unknown',
      distanceLabel: 'unknown',
      scoreState: 'unknown',
    });
    expect(result.ariaLabel).toContain('score unknown');
  });
});
