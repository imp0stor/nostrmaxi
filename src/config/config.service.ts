import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_CONFIG, type ConfigValueType } from './default-config';

export interface ConfigEntry {
  key: string;
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'json' | 'array';
  category: string;
  description: string;
  updatedAt: Date;
  updatedBy?: string;
}

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(key: string): Promise<unknown> {
    const entry = await this.prisma.config.findUnique({ where: { key } });
    return entry?.value;
  }

  async set(key: string, value: unknown, updatedBy?: string): Promise<void> {
    const existing = await this.prisma.config.findUnique({ where: { key } });
    const fallback = DEFAULT_CONFIG.find((item) => item.key === key);
    const type = existing?.type as ConfigValueType | undefined ?? fallback?.type ?? this.inferType(value);
    const category = existing?.category ?? fallback?.category ?? key.split('.')[0] ?? 'general';
    const description = existing?.description ?? fallback?.description ?? '';
    await this.upsert(key, value, type, category, description, updatedBy);
  }

  async upsert(
    key: string,
    value: unknown,
    type: ConfigValueType,
    category: string,
    description: string,
    updatedBy?: string,
  ): Promise<void> {
    this.validateType(key, value, type);

    await this.prisma.config.upsert({
      where: { key },
      update: {
        value: value as Prisma.InputJsonValue,
        type,
        category,
        description,
        updatedBy,
      },
      create: {
        key,
        value: value as Prisma.InputJsonValue,
        type,
        category,
        description,
        updatedBy,
      },
    });
  }

  async getCategory(category: string): Promise<ConfigEntry[]> {
    const rows = await this.prisma.config.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });
    return rows.map((row) => this.toEntry(row));
  }

  async getAll(): Promise<ConfigEntry[]> {
    const rows = await this.prisma.config.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
    return rows.map((row) => this.toEntry(row));
  }

  async delete(key: string): Promise<void> {
    await this.prisma.config.delete({ where: { key } });
  }

  async seedDefaults(updatedBy = 'system'): Promise<{ seeded: number; total: number }> {
    let seeded = 0;
    for (const item of DEFAULT_CONFIG) {
      const existing = await this.prisma.config.findUnique({ where: { key: item.key } });
      if (existing) continue;
      await this.prisma.config.create({
        data: {
          key: item.key,
          value: item.value as Prisma.InputJsonValue,
          type: item.type,
          category: item.category,
          description: item.description,
          updatedBy,
        },
      });
      seeded += 1;
    }
    return { seeded, total: DEFAULT_CONFIG.length };
  }

  private toEntry(row: {
    key: string;
    value: Prisma.JsonValue;
    type: string;
    category: string;
    description: string | null;
    updatedAt: Date;
    updatedBy: string | null;
  }): ConfigEntry {
    return {
      key: row.key,
      value: row.value,
      type: row.type as ConfigEntry['type'],
      category: row.category,
      description: row.description ?? '',
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy ?? undefined,
    };
  }

  private inferType(value: unknown): ConfigValueType {
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') return 'string';
    return 'json';
  }

  private validateType(key: string, value: unknown, type: ConfigValueType): void {
    const ok =
      (type === 'string' && typeof value === 'string')
      || (type === 'number' && typeof value === 'number' && Number.isFinite(value))
      || (type === 'boolean' && typeof value === 'boolean')
      || (type === 'array' && Array.isArray(value))
      || (type === 'json' && typeof value === 'object' && value !== undefined);

    if (!ok) {
      throw new BadRequestException(`Invalid value for ${key}. Expected ${type}.`);
    }

    if (key === 'relays.fallback' || key === 'relays.discovery') {
      if (!Array.isArray(value) || !value.every((relay) => typeof relay === 'string' && relay.startsWith('wss://'))) {
        throw new BadRequestException(`${key} must be an array of wss:// relay URLs.`);
      }
    }

    if (key === 'blossom.maxFileSize' && (typeof value !== 'number' || value <= 0)) {
      throw new BadRequestException('blossom.maxFileSize must be a positive number.');
    }

    this.logger.debug(`Validated config key ${key} as type ${type}`);
  }
}
