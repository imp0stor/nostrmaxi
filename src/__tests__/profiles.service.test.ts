import { ProfilesService } from '../profiles/profiles.service';

describe('ProfilesService', () => {
  const prisma: any = {
    endorsement: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    profileSettings: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    nip05: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  const wotService: any = {
    getScore: jest.fn(),
  };

  let service: ProfilesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProfilesService(prisma, wotService);
  });

  it('rejects self endorsement', async () => {
    await expect(service.endorseSkill('a', 'a', { skill: 'Nostr Development' })).rejects.toThrow('cannot endorse yourself');
  });

  it('aggregates endorsements with weighted score', async () => {
    prisma.endorsement.findMany.mockResolvedValue([
      { endorserPubkey: 'p1', endorseePubkey: 'target', skill: 'Nostr Development', createdAt: new Date() },
      { endorserPubkey: 'p2', endorseePubkey: 'target', skill: 'Nostr Development', createdAt: new Date() },
      { endorserPubkey: 'p2', endorseePubkey: 'target', skill: 'Bitcoin Development', createdAt: new Date() },
    ]);
    wotService.getScore.mockImplementation(async (pubkey: string) => ({ trustScore: pubkey === 'p1' ? 80 : 40 }));

    const summary = await service.getEndorsements('target');

    expect(summary.totalEndorsements).toBe(3);
    expect(summary.skills[0].skill).toBe('Nostr Development');
    expect(summary.skills[0].weightedScore).toBe(120);
  });

  it('updates profile theme', async () => {
    prisma.profileSettings.upsert.mockResolvedValue({ theme: 'orange' });
    const res = await service.updateTheme('pub', 'orange');
    expect(res.theme).toBe('orange');
    expect(prisma.profileSettings.upsert).toHaveBeenCalled();
  });
});
