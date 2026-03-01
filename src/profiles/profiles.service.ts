import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { nip19 } from 'nostr-tools';
import { PrismaService } from '../prisma/prisma.service';
import { WotService } from '../wot/wot.service';
import { EndorseSkillDto } from './dto/endorse-skill.dto';
import { ProfileTheme } from './dto/update-profile-theme.dto';

const ENDORSEMENT_RATE_LIMIT_MS = 60_000;

@Injectable()
export class ProfilesService {
  private endorsementRateLimit = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly wotService: WotService,
  ) {}

  private normalizeSkill(skill: string): string {
    return skill.trim().replace(/\s+/g, ' ');
  }

  async resolvePubkey(identifier: string): Promise<string> {
    if (identifier.startsWith('npub')) {
      try {
        const decoded = nip19.decode(identifier);
        if (typeof decoded.data === 'string') return decoded.data;
      } catch {
        // fallback
      }
    }

    if (identifier.includes('@')) {
      const [localPart, domain] = identifier.toLowerCase().split('@');
      const nip05 = await this.prisma.nip05.findFirst({
        where: { localPart, domain, isActive: true },
        include: { user: true },
      });
      if (nip05?.user?.pubkey) return nip05.user.pubkey;
    }

    return identifier;
  }

  async endorseSkill(endorserPubkey: string, endorseePubkey: string, dto: EndorseSkillDto) {
    if (endorserPubkey === endorseePubkey) {
      throw new BadRequestException('You cannot endorse yourself');
    }

    const skill = this.normalizeSkill(dto.skill);
    if (skill.length < 2) {
      throw new BadRequestException('Skill must be at least 2 characters');
    }

    const rateKey = `${endorserPubkey}:${endorseePubkey}`;
    const now = Date.now();
    const lastSeen = this.endorsementRateLimit.get(rateKey);
    if (lastSeen && now - lastSeen < ENDORSEMENT_RATE_LIMIT_MS) {
      throw new HttpException('Please wait before endorsing this profile again', 429);
    }

    const endorsement = await this.prisma.endorsement.upsert({
      where: {
        endorserPubkey_endorseePubkey_skill: {
          endorserPubkey,
          endorseePubkey,
          skill,
        },
      },
      update: {
        createdAt: new Date(),
      },
      create: {
        endorserPubkey,
        endorseePubkey,
        skill,
      },
    });

    this.endorsementRateLimit.set(rateKey, now);

    return endorsement;
  }

  async getEndorsements(endorseePubkey: string) {
    const endorsements = await this.prisma.endorsement.findMany({
      where: { endorseePubkey },
      orderBy: { createdAt: 'desc' },
    });

    const uniqueEndorsers = [...new Set(endorsements.map((item) => item.endorserPubkey))];
    const wotScores = new Map<string, number>();

    await Promise.all(uniqueEndorsers.map(async (pubkey) => {
      try {
        const score = await this.wotService.getScore(pubkey);
        wotScores.set(pubkey, score.trustScore);
      } catch {
        wotScores.set(pubkey, 0);
      }
    }));

    const bySkill = new Map<string, { count: number; weightedScore: number; topEndorsers: Array<{ pubkey: string; wotScore: number }> }>();

    endorsements.forEach((item) => {
      const wotScore = wotScores.get(item.endorserPubkey) ?? 0;
      const existing = bySkill.get(item.skill) || { count: 0, weightedScore: 0, topEndorsers: [] };
      existing.count += 1;
      existing.weightedScore += Math.max(1, wotScore);
      existing.topEndorsers.push({ pubkey: item.endorserPubkey, wotScore });
      bySkill.set(item.skill, existing);
    });

    const skills = [...bySkill.entries()].map(([skill, summary]) => ({
      skill,
      count: summary.count,
      weightedScore: Math.round(summary.weightedScore),
      topEndorsers: summary.topEndorsers
        .sort((a, b) => b.wotScore - a.wotScore)
        .slice(0, 5),
    })).sort((a, b) => b.weightedScore - a.weightedScore || b.count - a.count);

    return {
      pubkey: endorseePubkey,
      totalEndorsements: endorsements.length,
      totalSkills: skills.length,
      skills,
      recent: endorsements.slice(0, 20),
    };
  }

  async updateTheme(pubkey: string, theme: ProfileTheme) {
    return this.prisma.profileSettings.upsert({
      where: { userPubkey: pubkey },
      update: { theme },
      create: { userPubkey: pubkey, theme },
    });
  }

  async getProfileSummary(pubkey: string) {
    const [settings, nip05s, endorsements, wot] = await Promise.all([
      this.prisma.profileSettings.findUnique({ where: { userPubkey: pubkey } }),
      this.prisma.nip05.findMany({
        where: { user: { pubkey }, isActive: true },
        select: { localPart: true, domain: true },
      }),
      this.getEndorsements(pubkey),
      this.wotService.getScore(pubkey).catch(() => null),
    ]);

    return {
      pubkey,
      theme: settings?.theme || 'dark',
      identities: nip05s.map((id) => `${id.localPart}@${id.domain}`),
      wot,
      endorsements,
    };
  }
}
