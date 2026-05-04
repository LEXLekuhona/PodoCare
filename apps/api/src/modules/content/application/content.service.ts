import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async feed() {
    const items = await this.prisma.contentItem.findMany({
      where: { isPublished: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 20,
      select: {
        id: true,
        title: true,
        description: true,
        coverImageUrl: true,
        publishedAt: true,
        format: true,
        seriesId: true,
      },
    });

    return {
      items: items.map((i) => ({
        ...i,
        publishedAt: i.publishedAt ? i.publishedAt.toISOString() : null,
      })),
    };
  }
}

