import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';


// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { CryptoService } from '../../../infrastructure/crypto/crypto.service';

import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { CreateAcquiringTerminalDto } from '../presentation/dto/create-acquiring-terminal.dto';
import type { UpdateAcquiringTerminalDto } from '../presentation/dto/update-acquiring-terminal.dto';
import type { PaymentProvider } from '@prisma/client';

export type AcquiringTerminalListItem = {
  id: string;
  provider: PaymentProvider;
  studioId: string | null;
  studioName: string | null;
  label: string;
  publicId: string;
  notificationUrl: string | null;
  deviceDataJson: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const publicSelect = {
  id: true,
  provider: true,
  studioId: true,
  label: true,
  publicId: true,
  notificationUrl: true,
  deviceDataJson: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  studio: { select: { name: true } },
} as const;

@Injectable()
export class AcquiringTerminalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async list(): Promise<AcquiringTerminalListItem[]> {
    const rows = await this.prisma.acquiringTerminal.findMany({
      orderBy: [{ provider: 'asc' }, { studioId: 'asc' }, { label: 'asc' }],
      select: publicSelect,
    });
    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      studioId: r.studioId,
      studioName: r.studio?.name ?? null,
      label: r.label,
      publicId: r.publicId,
      notificationUrl: r.notificationUrl,
      deviceDataJson: r.deviceDataJson,
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async create(dto: CreateAcquiringTerminalDto) {
    if (dto.studioId) {
      const studio = await this.prisma.studio.findUnique({ where: { id: dto.studioId }, select: { id: true } });
      if (!studio) {
        throw new BadRequestException('Студия не найдена');
      }
    }

    const enc = this.crypto.encrypt(dto.secret);
    const row = await this.prisma.acquiringTerminal.create({
      data: {
        provider: dto.provider,
        studioId: dto.studioId ?? null,
        label: dto.label.trim(),
        publicId: dto.publicId.trim(),
        secretCipherText: Uint8Array.from(enc.cipherText),
        secretIv: Uint8Array.from(enc.iv),
        secretAuthTag: Uint8Array.from(enc.authTag),
        notificationUrl: dto.notificationUrl?.trim() || null,
        deviceDataJson: dto.deviceDataJson?.trim() || null,
        isActive: dto.isActive ?? true,
      },
      select: publicSelect,
    });
    return {
      id: row.id,
      provider: row.provider,
      studioId: row.studioId,
      studioName: row.studio?.name ?? null,
      label: row.label,
      publicId: row.publicId,
      notificationUrl: row.notificationUrl,
      deviceDataJson: row.deviceDataJson,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async update(id: string, dto: UpdateAcquiringTerminalDto) {
    const existing = await this.prisma.acquiringTerminal.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Терминал не найден');
    }

    if (dto.studioId !== undefined && dto.studioId !== null) {
      const studio = await this.prisma.studio.findUnique({ where: { id: dto.studioId }, select: { id: true } });
      if (!studio) {
        throw new BadRequestException('Студия не найдена');
      }
    }

    const enc =
      dto.secret !== undefined ? this.crypto.encrypt(dto.secret) : null;

    const row = await this.prisma.acquiringTerminal.update({
      where: { id },
      data: {
        ...(dto.provider !== undefined ? { provider: dto.provider } : {}),
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.publicId !== undefined ? { publicId: dto.publicId.trim() } : {}),
        ...(dto.studioId !== undefined ? { studioId: dto.studioId } : {}),
        ...(dto.notificationUrl !== undefined
          ? { notificationUrl: dto.notificationUrl?.trim() || null }
          : {}),
        ...(dto.deviceDataJson !== undefined
          ? { deviceDataJson: dto.deviceDataJson?.trim() || null }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(enc
          ? {
              secretCipherText: Uint8Array.from(enc.cipherText),
              secretIv: Uint8Array.from(enc.iv),
              secretAuthTag: Uint8Array.from(enc.authTag),
            }
          : {}),
      },
      select: publicSelect,
    });
    return {
      id: row.id,
      provider: row.provider,
      studioId: row.studioId,
      studioName: row.studio?.name ?? null,
      label: row.label,
      publicId: row.publicId,
      notificationUrl: row.notificationUrl,
      deviceDataJson: row.deviceDataJson,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async remove(id: string) {
    const existing = await this.prisma.acquiringTerminal.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      throw new NotFoundException('Терминал не найден');
    }
    await this.prisma.acquiringTerminal.delete({ where: { id } });
  }
}
