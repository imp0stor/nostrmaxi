import { quotedRenderModel } from '../../frontend/src/lib/quotedMedia';

describe('quoted note media rendering', () => {
  test('extracts image media for inline quoted rendering', () => {
    const model = quotedRenderModel({
      id: 'q1',
      pubkey: 'p',
      kind: 1,
      created_at: 1,
      sig: '',
      content: 'Look https://cdn.example.com/image.jpg',
      tags: [],
    } as any);

    expect(model.images).toEqual(['https://cdn.example.com/image.jpg']);
  });

  test('removes raw media url text when handler media exists', () => {
    const model = quotedRenderModel({
      id: 'q2',
      pubkey: 'p',
      kind: 1,
      created_at: 1,
      sig: '',
      content: 'before https://cdn.example.com/photo.png after',
      tags: [],
    } as any);

    expect(model.text).toBe('before  after');
    expect(model.text).not.toContain('https://cdn.example.com/photo.png');
    expect(model.images).toHaveLength(1);
  });

  test('renders wavlake audio metadata model for quoted notes', () => {
    const model = quotedRenderModel({
      id: 'q3',
      pubkey: 'p',
      kind: 1,
      created_at: 1,
      sig: '',
      content: 'quoted https://wavlake.com/track/92625eb4-4db4-43e5-950e-c987edbd5495',
      tags: [],
    } as any);

    expect(model.audios).toHaveLength(1);
    expect(model.audios[0].provider).toBe('wavlake');
    expect(model.text).toBe('quoted');
  });
});
