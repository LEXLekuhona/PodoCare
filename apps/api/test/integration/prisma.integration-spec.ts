import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';

import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';

/**
 * Smoke-тест, чтобы убедиться: testcontainers + Prisma migrate deploy +
 * PrismaService работают вместе и БД реально доступна.
 */
describe('PrismaService (integration)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  beforeEach(async () => {
    await prisma.truncateAll();
  });

  it('подключается к БД и выполняет простой SELECT', async () => {
    const [row] = await prisma.$queryRaw<Array<{ one: number }>>`SELECT 1 as one`;
    expect(row.one).toBe(1);
  });

  it('создаёт Network и Studio и читает обратно', async () => {
    const network = await prisma.network.create({
      data: { name: 'Test Network', slug: `net-${randomUUID()}` },
    });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Test Studio',
        address: 'Test Address 1',
        city: 'Moscow',
        openingHours: {
          '1': { open: '09:00', close: '21:00' },
          '2': { open: '09:00', close: '21:00' },
        },
      },
    });

    const found = await prisma.studio.findUnique({
      where: { id: studio.id },
      include: { network: true },
    });

    expect(found).not.toBeNull();
    expect(found?.name).toBe('Test Studio');
    expect(found?.network.id).toBe(network.id);
  });

  it('truncateAll действительно очищает таблицы', async () => {
    const network = await prisma.network.create({
      data: { name: 'N', slug: `n-${randomUUID()}` },
    });
    expect(network).toBeDefined();
    await prisma.truncateAll();
    expect(await prisma.network.count()).toBe(0);
  });
});
