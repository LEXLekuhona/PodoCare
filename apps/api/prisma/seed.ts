/* eslint-disable no-console */

/**
 * Точка входа Prisma seed (`pnpm prisma:seed`, после `migrate reset` / deploy в скриптах).
 * Операционные данные (сеть, студии, FAQ, жалобы, специалисты, услуги, смены) создаются только через админку.
 */
async function main(): Promise<void> {
  console.log(
    '🌱 Seed: записей не добавляем — заводите данные через админку.',
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
