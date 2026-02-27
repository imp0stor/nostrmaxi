import { buildZapButtonLabel, formatZapIndicator, getDefaultZapAmountOptions } from '../src/lib/zaps';

describe('zap UI helpers', () => {
  it('returns sane default amount selector options', () => {
    expect(getDefaultZapAmountOptions()).toEqual([21, 100, 500, 1000]);
  });

  it('builds zap button labels for idle and busy states', () => {
    expect(buildZapButtonLabel(false)).toBe('⚡ Zap');
    expect(buildZapButtonLabel(true)).toBe('Sending…');
  });

  it('renders visual zap badge indicator', () => {
    expect(formatZapIndicator({ count: 3, totalMsat: 123000, totalSat: 123 })).toContain('⚡ 123 sats');
    expect(formatZapIndicator({ count: 3, totalMsat: 123000, totalSat: 123 })).toContain('· 3');
  });
});
