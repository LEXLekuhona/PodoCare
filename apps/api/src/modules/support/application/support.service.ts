/* eslint-disable import/order */
import { Injectable, NotFoundException } from '@nestjs/common';
import { SupportTicketStatus } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { CreateSupportTicketDto } from '../presentation/dto/create-support-ticket.dto';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async createTicketForClient(userId: string, dto: CreateSupportTicketDto) {
    const subject = dto.subject.trim();
    const message = dto.message.trim();

    const studioId = dto.studioId ? await this.ensureStudioExists(dto.studioId) : null;

    const created = await this.prisma.supportTicket.create({
      data: {
        userId,
        studioId,
        subject,
        status: SupportTicketStatus.OPEN,
        messages: {
          create: {
            senderId: userId,
            body: message,
            attachmentUrls: [],
          },
        },
      },
      select: { id: true },
    });

    return { ticketId: created.id };
  }

  private async ensureStudioExists(id: string): Promise<string> {
    const row = await this.prisma.studio.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException('Студия не найдена');
    return row.id;
  }
}

