/**
 * Одноразовая подготовка локального SUPER_ADMIN для входа в админку (staff/login).
 * Запуск из каталога apps/api с загруженным .env:
 *   pnpm create-dev-admin
 */
import { Prisma, PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = (process.env.DEV_ADMIN_EMAIL ?? 'admin@podocare.local').trim().toLowerCase();
  const password = process.env.DEV_ADMIN_PASSWORD ?? 'DevAdminChangeMe!';
  const phone = (process.env.DEV_ADMIN_PHONE ?? '+79000000000').trim();

  const passwordHash = await argon2.hash(password);

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
        emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
      },
    });
    console.warn(`Обновлён пользователь ${email} → SUPER_ADMIN (пароль из DEV_ADMIN_PASSWORD).`);
    return;
  }

  try {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        phone,
        phoneVerifiedAt: new Date(),
        role: 'SUPER_ADMIN',
        firstName: 'Dev',
        lastName: 'Admin',
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    console.warn(`Создан SUPER_ADMIN: ${email}, телефон ${phone}. Пароль из DEV_ADMIN_PASSWORD.`);
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      console.warn(
        'Конфликт уникальности (email или телефон). Задайте другие DEV_ADMIN_EMAIL / DEV_ADMIN_PHONE.',
      );
      process.exitCode = 1;
      return;
    }
    throw e;
  }
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
