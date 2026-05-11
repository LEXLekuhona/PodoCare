/* eslint-disable no-console */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import argon2 from 'argon2';
import {
  AppointmentStatus,
  NotificationChannel,
  NotificationTemplateKey,
  ContentAudience,
  ContentCtaTarget,
  ContentFormat,
  FaqCategory,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  PrismaClient,
  ProductType,
  PromoCodeScope,
  PromoCodeType,
  QuizQuestionType,
  QuizResultLevel,
  TreatmentPlanStatus,
  TreatmentPlanStepStatus,
  UserRole,
} from '@prisma/client';

const prisma = new PrismaClient();

type ServicePriceCatalogFile = {
  meta?: { title?: string; effectiveDate?: string; notes?: string };
  items: Array<{
    name: string;
    durationMinutes: number;
    priceRub: number;
    categorySlug: string;
    description?: string;
  }>;
};

function loadServicePriceCatalog(): ServicePriceCatalogFile {
  const catalogPath = join(__dirname, '..', 'data', 'service-price-catalog.json');
  const raw = readFileSync(catalogPath, 'utf8');
  return JSON.parse(raw) as ServicePriceCatalogFile;
}

async function truncateAllTables(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE
      record_row RECORD;
    BEGIN
      FOR record_row IN (
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> '_prisma_migrations'
      ) LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(record_row.tablename) || ' CASCADE';
      END LOOP;
    END
    $$;
  `);
}

async function main(): Promise<void> {
  console.log('🌱 Seed: очищаем таблицы...');
  await truncateAllTables();

  const devAdminEmail = (process.env.DEV_ADMIN_EMAIL ?? 'admin@solodova-recovery.local')
    .trim()
    .toLowerCase();
  const devAdminPassword = process.env.DEV_ADMIN_PASSWORD ?? 'DevAdminChangeMe!';
  const devAdminPhone = (process.env.DEV_ADMIN_PHONE ?? '+79000000000').trim();
  const passwordHash = await argon2.hash(devAdminPassword);
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const network = await prisma.network.create({
    data: {
      name: 'Solodova Recovery System Москва',
      slug: 'solodova-recovery-moscow',
      description:
        'Сеть студий подологии и восстановительного ухода за стопами.',
      logoUrl: 'https://cdn.solodova-recovery.dev/logo/solodova-recovery-moscow.png',
    },
  });

  // Уведомления по записи:
  // - за 24 часа: PUSH
  // - за 2 часа: SMS
  await prisma.notificationTemplate.createMany({
    data: [
      {
        networkId: network.id,
        key: NotificationTemplateKey.APPOINTMENT_REMINDER_24H,
        channel: NotificationChannel.PUSH,
        locale: 'ru',
        subject: 'Напоминание о приёме завтра',
        body:
          'Завтра у вас приём в {{studio.name}} к {{specialist.firstName}} {{specialist.lastName}} ({{service.name}}). Время: {{appointment.startsAt}}',
        variables: [
          'studio.name',
          'specialist.firstName',
          'specialist.lastName',
          'service.name',
          'appointment.startsAt',
        ],
        isActive: true,
      },
      {
        networkId: network.id,
        // В enum пока нет ключа "2H", используем существующий ключ и задаём оффсет политикой.
        key: NotificationTemplateKey.APPOINTMENT_REMINDER_1H,
        channel: NotificationChannel.SMS,
        locale: 'ru',
        subject: '',
        body:
          'Напоминание: через 2 часа приём в {{studio.name}} ({{service.name}}), специалист {{specialist.firstName}} {{specialist.lastName}}. Время: {{appointment.startsAt}}',
        variables: [
          'studio.name',
          'specialist.firstName',
          'specialist.lastName',
          'service.name',
          'appointment.startsAt',
        ],
        isActive: true,
      },
    ],
  });

  await prisma.reminderPolicy.createMany({
    data: [
      {
        networkId: network.id,
        templateKey: NotificationTemplateKey.APPOINTMENT_REMINDER_24H,
        channel: NotificationChannel.PUSH,
        offsetMinutesBefore: 1440,
        isActive: true,
      },
      {
        networkId: network.id,
        templateKey: NotificationTemplateKey.APPOINTMENT_REMINDER_1H,
        channel: NotificationChannel.SMS,
        offsetMinutesBefore: 120,
        isActive: true,
      },
    ],
  });

  await prisma.notificationTemplate.createMany({
    data: [
      {
        networkId: network.id,
        key: NotificationTemplateKey.TREATMENT_PLAN_READY,
        channel: NotificationChannel.PUSH,
        locale: 'ru',
        subject: 'План лечения в {{studio.name}}',
        body: '{{treatmentPlan.title}}. Загляните в раздел «План лечения» в приложении.',
        variables: ['studio.name', 'treatmentPlan.title', 'client.firstName', 'client.lastName'],
        isActive: true,
      },
      {
        networkId: network.id,
        key: NotificationTemplateKey.TREATMENT_PLAN_READY,
        channel: NotificationChannel.SMS,
        locale: 'ru',
        subject: '',
        body:
          '{{treatmentPlan.title}} ({{studio.name}}). План лечения в приложении Solodova Recovery System.',
        variables: ['studio.name', 'treatmentPlan.title', 'client.firstName', 'client.lastName'],
        isActive: true,
      },
    ],
  });

  const studios = await prisma.$transaction(
    [
      {
        name: 'Solodova Recovery System Арбат',
        address: 'ул. Арбат, 23',
        city: 'Москва',
        phone: '+74950001001',
      },
      {
        name: 'Solodova Recovery System Таганка',
        address: 'ул. Таганская, 5',
        city: 'Москва',
        phone: '+74950001002',
      },
      {
        name: 'Solodova Recovery System Белорусская',
        address: 'Ленинградский пр-т, 14',
        city: 'Москва',
        phone: '+74950001003',
      },
      {
        name: 'Solodova Recovery System Сокол',
        address: 'Ленинградский пр-т, 76к1',
        city: 'Москва',
        phone: '+74950001004',
      },
      {
        name: 'Solodova Recovery System Раменки',
        address: 'Мичуринский пр-т, 9к3',
        city: 'Москва',
        phone: '+74950001005',
      },
    ].map((studio, idx) =>
      prisma.studio.create({
        data: {
          networkId: network.id,
          ...studio,
          email: `studio${idx + 1}@solodova-recovery.dev`,
          timezone: 'Europe/Moscow',
          description:
            'Студия подологии с кабинетами аппаратной обработки и ортопедического сопровождения.',
          openingHours: {
            1: { open: '09:00', close: '21:00' },
            2: { open: '09:00', close: '21:00' },
            3: { open: '09:00', close: '21:00' },
            4: { open: '09:00', close: '21:00' },
            5: { open: '09:00', close: '21:00' },
            6: { open: '10:00', close: '20:00' },
            0: { open: '10:00', close: '18:00' },
          },
          latitude: 55.75 + idx * 0.01,
          longitude: 37.61 + idx * 0.01,
        },
      }),
    ),
  );

  const adminUser = await prisma.user.create({
    data: {
      studioId: studios[0].id,
      role: UserRole.SUPER_ADMIN,
      phone: devAdminPhone,
      email: devAdminEmail,
      passwordHash,
      firstName: 'Александр',
      lastName: 'Админов',
      locale: 'ru',
      timezone: 'Europe/Moscow',
      phoneVerifiedAt: now,
      emailVerifiedAt: now,
    },
  });

  const contentAuthor = await prisma.user.create({
    data: {
      role: UserRole.CONTENT_AUTHOR,
      phone: '+79990000002',
      email: 'content@solodova-recovery.dev',
      passwordHash,
      firstName: 'Мария',
      lastName: 'Контентова',
      locale: 'ru',
      timezone: 'Europe/Moscow',
      phoneVerifiedAt: now,
      emailVerifiedAt: now,
    },
  });

  const specialistUsers = await Promise.all(
    [1, 2, 3, 4, 5, 6].map((n) =>
      prisma.user.create({
        data: {
          studioId: studios[(n - 1) % studios.length].id,
          role: UserRole.SPECIALIST,
          phone: `+7999000010${n}`,
          email: `specialist${n}@solodova-recovery.dev`,
          passwordHash,
          firstName: ['Елена', 'Ирина', 'Ольга', 'Наталья', 'Юлия', 'Анна'][
            n - 1
          ],
          lastName: [
            'Смирнова',
            'Кузнецова',
            'Попова',
            'Васильева',
            'Соколова',
            'Морозова',
          ][n - 1],
          phoneVerifiedAt: now,
          emailVerifiedAt: now,
        },
      }),
    ),
  );

  const clientUsers = await Promise.all(
    [1, 2, 3, 4, 5, 6].map((n) =>
      prisma.user.create({
        data: {
          role: UserRole.CLIENT,
          phone: `+7999000020${n}`,
          firstName: ['Иван', 'Светлана', 'Кирилл', 'Екатерина', 'Михаил', 'Дарья'][
            n - 1
          ],
          lastName: ['Петров', 'Лебедева', 'Орлов', 'Федорова', 'Волков', 'Тихонова'][
            n - 1
          ],
          acquisitionSource: [
            'instagram',
            'referral',
            'qr_studio',
            'organic_search',
            'telegram',
            'walkin',
          ][n - 1],
          phoneVerifiedAt: now,
        },
      }),
    ),
  );

  await Promise.all(
    clientUsers.map((user, idx) =>
      prisma.clientProfile.create({
        data: {
          userId: user.id,
          referralCode: `PODO${(idx + 1).toString().padStart(4, '0')}`,
          loyaltyPoints: (idx + 1) * 120,
          tosAcceptedAt: now,
        },
      }),
    ),
  );

  const serviceCategories = await Promise.all(
    [
      ['Подология', 'podology', '#4F46E5'],
      ['Онихология', 'onychology', '#0EA5E9'],
      ['Ортопедия стопы', 'foot-orthopedics', '#14B8A6'],
      ['Реабилитация', 'rehabilitation', '#22C55E'],
      ['Профилактика', 'prevention', '#F59E0B'],
      ['Диагностика', 'diagnostics', '#EF4444'],
    ].map(([name, slug, color], idx) =>
      prisma.serviceCategory.create({
        data: {
          name,
          slug,
          color,
          sortOrder: idx + 1,
        },
      }),
    ),
  );

  const healthConcerns = await Promise.all(
    [
      ['вросший-ноготь', 'Вросший ноготь'],
      ['грибок-ногтей', 'Грибок ногтей'],
      ['трещины-пяток', 'Трещины пяток'],
      ['мозоли-и-натоптыши', 'Мозоли и натоптыши'],
      ['боль-в-стопе', 'Боль в стопе'],
      ['диабетическая-стопа', 'Диабетическая стопа'],
    ].map(([slug, title], idx) =>
      prisma.healthConcern.create({
        data: {
          slug,
          title,
          description: `Профессиональная помощь при проблеме: ${title}.`,
          iconUrl: `https://cdn.solodova-recovery.dev/concerns/${slug}.png`,
          sortOrder: idx + 1,
        },
      }),
    ),
  );

  const recoveryDirectionDescription = [
    '«Система восстановления тела Солодовой» — это комплексный и индивидуальный подход к экологичному восстановлению, поддержанию здоровья и состояния тела человека.',
    'Мы рассматриваем человека не по отдельным симптомам, а как единую систему, где всё взаимосвязано: самочувствие, внешние проявления, симптомы, образ жизни и внутренние процессы организма. Учитывая предрасположенность в генетике.',
    'Работа начинается с внимательного разбора запроса человека: мы слушаем жалобы, анализируем проявления в теле, учитываем результаты исследований качественных и количественных показателей (конкретно данного человека в настоящий период времени). Это помогает увидеть не только симптом, но причину его появления.',
    'Далее по желанию мы выстраиваем персональную стратегию восстановления тела сразу в нескольких направлениях.',
    'Главный принцип системы — работа не с симптомом, а с причиной. Мы не маскируем проявления, а ищем, почему они возникли, и постепенно создаём условия, при которых тело начинает восстанавливаться самостоятельно.',
    '«Система восстановления Солодовой» — это путь к возвращению телу ресурса, баланса и естественного состояния здоровья через комплексную, бережную и индивидуальную работу.',
  ].join('\n\n');

  await prisma.studioDirection.createMany({
    data: [
      {
        slug: 'recovery-system',
        title: 'Система восстановления тела Солодовой',
        description: recoveryDirectionDescription,
        iconKey: 'spa',
        sortOrder: 10,
      },
      {
        slug: 'podology',
        title: 'Подология',
        description:
          'Подология — это направление, которое занимается профилактикой, предотвращением, восстановлением стоп и ногтей.\n\nМы работаем с дискомфортом, изменениями ногтей и кожи, помогаем вернуть стопам комфорт, ухоженный вид и правильное состояние при ходьбе и нагрузке.',
        iconKey: 'shoe-prints',
        sortOrder: 20,
      },
      {
        slug: 'naturopathy',
        title: 'Интегративная натуропатия',
        description:
          'Интегративная натуропатия — это направление, которое рассматривает организм как единую имеющую возможность к саморегулированию систему.\n\nМы помогаем человеку восстановить внутренний баланс через очищение, восстановление, восполнение витаминов и минералов, питание, образ жизни, привычки и естественные ресурсы организма, чтобы улучшалось общее самочувствие, здоровье тела, качество жизни и объём энергии.',
        iconKey: 'leaf',
        sortOrder: 30,
      },
      {
        slug: 'osteopathy',
        title: 'Мастер-остеопрактик',
        description:
          'Мастер-остеопрактик — это специалист, который работает с телом через мягкие ручные техники.\n\nМы помогаем снять внутреннее напряжение, улучшить подвижность тела и восстановить естественное ощущение лёгкости и баланса в движении.',
        iconKey: 'hands',
        sortOrder: 40,
      },
      {
        slug: 'cosmetology',
        title: 'Эстетическая косметология',
        description:
          'Эстетическая косметология — это уход за кожей лица и тела, направленный на улучшение её состояния, внешнего вида и качества.\n\nМы помогаем коже быть более чистой, ровной, увлажнённой и здоровой за счёт бережного профессионального ухода.',
        iconKey: 'magic',
        sortOrder: 50,
      },
    ],
  });

  const specialistProfiles = await Promise.all(
    specialistUsers.map((user, idx) =>
      prisma.specialistProfile.create({
        data: {
          userId: user.id,
          studioId: studios[idx % studios.length].id,
          bio: 'Специалист по комплексному восстановлению стоп с практикой более 5 лет.',
          specializations: [
            serviceCategories[idx % serviceCategories.length].name,
            serviceCategories[(idx + 1) % serviceCategories.length].name,
          ],
          experienceYears: 5 + idx,
          rating: 4.6 + idx * 0.05,
          reviewsCount: 40 + idx * 7,
          isAcceptingNew: true,
        },
      }),
    ),
  );

  await prisma.$transaction(
    specialistProfiles.map((profile, idx) =>
      prisma.specialistCategory.create({
        data: {
          specialistId: profile.id,
          categoryId: serviceCategories[idx % serviceCategories.length].id,
        },
      }),
    ),
  );

  const servicePriceCatalog = loadServicePriceCatalog();
  const categoryBySlug = new Map(serviceCategories.map((c) => [c.slug, c]));

  const catalogCreates = studios.flatMap((studio) =>
    servicePriceCatalog.items.map((item, idx) => {
      const cat = categoryBySlug.get(item.categorySlug);
      if (!cat) {
        throw new Error(
          `service-price-catalog.json: неизвестный categorySlug «${item.categorySlug}» для «${item.name}»`,
        );
      }
      const baseDesc = item.description?.trim()
        ? item.description.trim()
        : `${item.name}. Длительность и стоимость по каталогу студии.`;
      const metaNote = servicePriceCatalog.meta?.effectiveDate
        ? ` Прайс-лист от ${servicePriceCatalog.meta.effectiveDate}.`
        : '';
      return prisma.service.create({
        data: {
          studioId: studio.id,
          categoryId: cat.id,
          name: item.name,
          description: `${baseDesc}${metaNote}`,
          durationMinutes: item.durationMinutes,
          priceMinor: Math.round(item.priceRub * 100),
          currency: 'RUB',
          prepaymentRequired: false,
          prepaymentMinor: null,
          requiresConsultation: false,
          sortOrder: idx + 1,
        },
      });
    }),
  );

  const services = await prisma.$transaction(catalogCreates);

  const servicesByStudioId = new Map<string, typeof services>();
  for (const svc of services) {
    const list = servicesByStudioId.get(svc.studioId) ?? [];
    list.push(svc);
    servicesByStudioId.set(svc.studioId, list);
  }

  await prisma.$transaction(
    specialistProfiles.flatMap((profile) => {
      const studioSvcs = servicesByStudioId.get(profile.studioId) ?? [];
      return studioSvcs.map((svc) =>
        prisma.specialistService.create({
          data: {
            specialistId: profile.id,
            serviceId: svc.id,
          },
        }),
      );
    }),
  );

  await Promise.all(
    specialistProfiles.map((profile, idx) =>
      prisma.specialistShift.create({
        data: {
          specialistId: profile.id,
          studioId: studios[idx % studios.length].id,
          startsAt: new Date(now.getTime() + (idx + 1) * 24 * 60 * 60 * 1000),
          endsAt: new Date(
            now.getTime() + (idx + 1) * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000,
          ),
          note: 'Плановая дневная смена.',
        },
      }),
    ),
  );

  const physicalGoodCategories = await Promise.all(
    [
      ['Кремы', 'creams'],
      ['Сыворотки', 'serums'],
      ['Пилки и инструменты', 'tools'],
      ['Антисептики', 'antiseptics'],
      ['Ортопедические аксессуары', 'orthopedic-accessories'],
      ['Наборы для дома', 'home-kits'],
    ].map(([name, slug], idx) =>
      prisma.physicalGoodCategory.create({
        data: {
          networkId: network.id,
          name,
          slug,
          sortOrder: idx + 1,
        },
      }),
    ),
  );

  const physicalGoods = await Promise.all(
    ([
      ['PODO-CRM-001', 'крем-восстанавливающий-20мочевина', 'Крем 20% мочевина', 129000],
      ['PODO-SRM-002', 'сыворотка-для-ногтей', 'Сыворотка для ногтей', 159000],
      ['PODO-TLS-003', 'пилка-керамическая', 'Пилка керамическая', 79000],
      ['PODO-ANT-004', 'антисептик-спрей', 'Антисептик-спрей', 69000],
      ['PODO-ORT-005', 'силиконовый-разделитель', 'Силиконовый разделитель пальцев', 49000],
      ['PODO-KIT-006', 'домашний-набор-ухода', 'Домашний набор ухода', 249000],
    ] as Array<[string, string, string, number]>).map(([sku, slug, name, priceMinor], idx) =>
      prisma.physicalGood.create({
        data: {
          networkId: network.id,
          categoryId: physicalGoodCategories[idx % physicalGoodCategories.length].id,
          sku,
          slug,
          name,
          description: `${name} для ежедневного поддерживающего ухода.`,
          brand: 'Solodova Recovery System',
          imageUrls: [`https://cdn.solodova-recovery.dev/goods/${slug}.png`],
          priceMinor,
          currency: 'RUB',
          weightGrams: 100 + idx * 20,
          stock: 40 + idx * 15,
          relatedHealthConcernIds: [healthConcerns[idx % healthConcerns.length].id],
          sortOrder: idx + 1,
        },
      }),
    ),
  );

  const programs = await Promise.all(
    ([
      ['podology-reset-90', 'Podology Reset 90', 90, 2990000],
      ['nail-recovery-60', 'Nail Recovery 60', 60, 2490000],
      ['diabetic-foot-support', 'Diabetic Foot Support', 120, 3490000],
      ['anti-crack-protocol', 'Anti-Crack Protocol', 45, 1890000],
      ['pain-free-step', 'Pain-Free Step', 75, 2790000],
      ['office-feet-rehab', 'Office Feet Rehab', 30, 1490000],
    ] as Array<[string, string, number, number]>).map(([slug, title, durationDays, priceMinor], idx) =>
      prisma.program.create({
        data: {
          networkId: network.id,
          authorUserId: contentAuthor.id,
          slug,
          title,
          subtitle: 'Индивидуальное сопровождение подолога',
          description:
            'Программа с поэтапным восстановлением, домашними рекомендациями и регулярным контролем специалиста.',
          durationDays,
          priceMinor,
          currency: 'RUB',
          installmentAvailable: true,
          coverImageUrl: `https://cdn.solodova-recovery.dev/programs/${slug}.png`,
          inclusions: [
            { title: 'Первичный разбор', description: 'Анамнез и диагностика' },
            { title: 'План лечения', description: 'Детальный протокол на дом' },
            { title: 'Контроль прогресса', description: 'Еженедельные чекпоинты' },
          ],
          stages: [
            { weekRange: '1-2', title: 'Диагностика', description: 'Определяем основную причину' },
            { weekRange: '3-5', title: 'Коррекция', description: 'Снимаем симптомы и нагрузку' },
            { weekRange: '6+', title: 'Поддержка', description: 'Закрепляем результат' },
          ],
          faq: [
            { q: 'Можно в рассрочку?', a: 'Да, доступны партнерские банки.' },
            { q: 'Подходит ли при хронических проблемах?', a: 'Да, программа учитывает анамнез.' },
          ],
          isPublished: true,
          sortOrder: idx + 1,
        },
      }),
    ),
  );

  const quiz = await prisma.diagnosticQuiz.create({
    data: {
      networkId: network.id,
      slug: 'foot-health-check',
      title: 'Проверка состояния стоп',
      description: 'Короткий опрос для подбора ухода и следующего шага.',
      outcomeTeaser: 'Получите персональные рекомендации за 2 минуты.',
      isPublished: true,
      version: 1,
    },
  });

  const quizQuestions = await Promise.all(
    [
      'Беспокоит ли вас боль при ходьбе?',
      'Как часто появляются трещины на пятках?',
      'Есть ли изменения формы ногтей?',
      'Бывают ли мозоли после обычной обуви?',
      'Как быстро устают стопы к вечеру?',
      'Как часто вы делаете профессиональный уход?',
    ].map((text, idx) =>
      prisma.diagnosticQuestion.create({
        data: {
          quizId: quiz.id,
          order: idx + 1,
          text,
          type: QuizQuestionType.SINGLE_CHOICE,
          scoringTag: ['pain', 'skin', 'nails', 'load', 'fatigue', 'care'][idx],
        },
      }),
    ),
  );

  await Promise.all(
    quizQuestions.flatMap((question) =>
      ([
        ['Никогда', -1],
        ['Иногда', 0],
        ['Часто', 1],
      ] as Array<[string, number]>).map(([label, weight], idx) =>
        prisma.diagnosticAnswerOption.create({
          data: {
            questionId: question.id,
            order: idx + 1,
            label,
            weight,
          },
        }),
      ),
    ),
  );

  await Promise.all(
    ([
      [QuizResultLevel.LOW, 'Низкий риск', { minScore: -10, maxScore: 1 }],
      [QuizResultLevel.MEDIUM, 'Средний риск', { minScore: 2, maxScore: 4 }],
      [QuizResultLevel.HIGH, 'Высокий риск', { minScore: 5, maxScore: 10 }],
    ] as Array<[QuizResultLevel, string, { minScore: number; maxScore: number }]>).map(
      ([level, title, matchRule], idx) =>
      prisma.diagnosticOutcome.create({
        data: {
          quizId: quiz.id,
          level,
          title,
          description: 'Рекомендуем начать с консультации и персонального плана ухода.',
          matchRule,
          sortOrder: idx + 1,
          recommendedContentSeriesIds: [],
          recommendedProgramId: programs[idx % programs.length].id,
          recommendedPhysicalGoodIds: [physicalGoods[idx % physicalGoods.length].id],
          recommendedServiceIds: [services[idx % services.length].id],
          primaryCtaTarget: ContentCtaTarget.SERVICE,
          primaryCtaLabel: 'Записаться на прием',
        },
      }),
    ),
  );

  const contentSeries = await Promise.all(
    [
      ['daily-foot-care', 'Ежедневный уход за стопами'],
      ['nail-recovery-base', 'Базовое восстановление ногтей'],
      ['diabetic-foot-guide', 'Гид по диабетической стопе'],
      ['healthy-shoes-checklist', 'Как выбирать обувь для стоп'],
      ['anti-crack-home-routine', 'Домашний протокол против трещин'],
      ['post-procedure-support', 'Восстановление после процедуры'],
    ].map(([slug, title], idx) =>
      prisma.contentSeries.create({
        data: {
          networkId: network.id,
          authorUserId: contentAuthor.id,
          slug,
          title,
          subtitle: 'Практические рекомендации от специалистов Solodova Recovery System',
          description: 'Короткие материалы для самостоятельного ухода.',
          audience: ContentAudience.CLIENT,
          tags: ['уход', 'стопы', 'подология'],
          priceMinor: idx < 4 ? 0 : 59000,
          currency: 'RUB',
          isPublished: true,
          publishedAt: now,
          sortOrder: idx + 1,
        },
      }),
    ),
  );

  const contentItems = await Promise.all(
    contentSeries.map((series, idx) =>
      prisma.contentItem.create({
        data: {
          networkId: network.id,
          seriesId: series.id,
          authorUserId: contentAuthor.id,
          slug: `${series.slug}-intro`,
          title: `${series.title}: старт`,
          description: 'Вводный материал для быстрого старта.',
          format: idx % 2 === 0 ? ContentFormat.VIDEO : ContentFormat.ARTICLE,
          audience: ContentAudience.CLIENT,
          body:
            idx % 2 === 0
              ? { videoUrl: `https://cdn.solodova-recovery.dev/videos/${series.slug}.mp4` }
              : {
                  markdown:
                    'Разберите текущие симптомы, зафиксируйте динамику и соблюдайте регулярность ухода.',
                },
          durationSeconds: idx % 2 === 0 ? 420 : null,
          sortOrder: 1,
          isFreePreview: true,
          tags: ['старт', 'практика'],
          isPublished: true,
          publishedAt: now,
        },
      }),
    ),
  );

  await Promise.all(
    contentItems.map((item, idx) =>
      prisma.contentCta.create({
        data: {
          itemId: item.id,
          target: ContentCtaTarget.SERVICE,
          targetServiceId: services[idx % services.length].id,
          label: 'Выбрать подходящую услугу',
          subtitle: 'Специалист подберет персональное решение',
          sortOrder: 1,
        },
      }),
    ),
  );

  await Promise.all(
    [
      {
        category: FaqCategory.BOOKING,
        question: 'Как записаться на прием?',
        answer:
          'Выберите услугу в приложении, затем специалиста и удобное время.',
      },
      {
        category: FaqCategory.PROCEDURES,
        question: 'Сколько длится первичная консультация?',
        answer: 'Обычно 40-45 минут с диагностикой и рекомендациями.',
      },
      {
        category: FaqCategory.PAYMENT,
        question: 'Можно ли оплатить частями?',
        answer:
          'Да, для программ сопровождения доступна рассрочка партнерских банков.',
      },
      {
        category: FaqCategory.PROGRAMS,
        question: 'Как понять, нужна ли мне программа?',
        answer:
          'Пройдите квиз и консультацию, специалист подскажет оптимальный маршрут.',
      },
      {
        category: FaqCategory.DELIVERY,
        question: 'Как доставляются товары ухода?',
        answer:
          'Доставка возможна в ПВЗ или курьером, сроки зависят от региона.',
      },
      {
        category: FaqCategory.ACCOUNT,
        question: 'Как восстановить доступ к аккаунту?',
        answer:
          'Введите номер телефона на экране входа и подтвердите код из SMS.',
      },
    ].map((item, idx) =>
      prisma.faqItem.create({
        data: {
          ...item,
          sortOrder: idx + 1,
        },
      }),
    ),
  );

  await Promise.all(
    ([
      ['WELCOME10', PromoCodeType.PERCENT_DISCOUNT, PromoCodeScope.ALL_SERVICES, 10],
      ['CARE500', PromoCodeType.FIXED_DISCOUNT, PromoCodeScope.ALL_PHYSICAL_GOODS, 50000],
      ['CONSULT15', PromoCodeType.PERCENT_DISCOUNT, PromoCodeScope.SPECIFIC_SERVICE, 15],
      ['PROGRAM7', PromoCodeType.PERCENT_DISCOUNT, PromoCodeScope.PROGRAM, 7],
      ['FIRST20', PromoCodeType.PERCENT_DISCOUNT, PromoCodeScope.ALL_SERVICES, 20],
      ['HOMEKIT', PromoCodeType.FIXED_DISCOUNT, PromoCodeScope.SPECIFIC_PHYSICAL_GOOD, 70000],
    ] as Array<[string, PromoCodeType, PromoCodeScope, number]>).map(
      ([code, type, scope, value], idx) =>
      prisma.promoCode.create({
        data: {
          studioId: studios[idx % studios.length].id,
          code,
          type,
          scope,
          value,
          description: 'Тестовый промокод для демо-среды.',
          serviceIds:
            scope === PromoCodeScope.SPECIFIC_SERVICE
              ? [services[0].id]
              : [],
          physicalGoodIds:
            scope === PromoCodeScope.SPECIFIC_PHYSICAL_GOOD
              ? [physicalGoods[0].id]
              : [],
          programIds: scope === PromoCodeScope.PROGRAM ? [programs[0].id] : [],
          maxUsesTotal: 500,
          maxUsesPerUser: 2,
          validFrom: now,
          validUntil: in30Days,
        },
      }),
    ),
  );

  const appointments = await Promise.all(
    [0, 1, 2, 3, 4].map((idx) => {
      const startsAt = new Date(now.getTime() + (idx + 2) * 24 * 60 * 60 * 1000);
      const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
      return prisma.appointment.create({
        data: {
          studioId: studios[idx % studios.length].id,
          specialistId: specialistProfiles[idx % specialistProfiles.length].id,
          serviceId: services[idx % services.length].id,
          clientUserId: clientUsers[idx % clientUsers.length].id,
          startsAt,
          endsAt,
          status: idx < 2 ? AppointmentStatus.COMPLETED : AppointmentStatus.CONFIRMED,
          completedAt: idx < 2 ? endsAt : null,
          totalMinor: services[idx % services.length].priceMinor,
          currency: 'RUB',
          healthConcernIds: [
            healthConcerns[idx % healthConcerns.length].id,
            healthConcerns[(idx + 1) % healthConcerns.length].id,
          ],
          clientNote: 'Тестовый визит из seed для проверки post-visit контура.',
        },
      });
    }),
  );

  await Promise.all(
    appointments.map((appointment, idx) =>
      prisma.appointmentProtocol.create({
        data: {
          appointmentId: appointment.id,
          authorUserId: specialistUsers[idx % specialistUsers.length].id,
          updatedByUserId: specialistUsers[idx % specialistUsers.length].id,
          proceduresDone: ['Аппаратная обработка', 'Подбор домашнего ухода'],
          diagnosis: 'Гиперкератоз средней степени',
          materialsUsed: 'Антисептик, регенерирующий крем',
          internalNote: 'Контроль динамики через 14 дней',
          clientVisible: true,
          updateReason: 'Закрытие визита',
          updateComment: 'Тестовый протокол из seed',
        },
      }),
    ),
  );

  const treatmentPlans = await Promise.all(
    appointments.map((appointment, idx) => {
      const validFrom = new Date(appointment.startsAt.getTime());
      const validUntil = new Date(validFrom.getTime() + 30 * 24 * 60 * 60 * 1000);
      return prisma.treatmentPlan.create({
        data: {
          clientUserId: appointment.clientUserId!,
          authorUserId: specialistUsers[idx % specialistUsers.length].id,
          updatedByUserId: specialistUsers[idx % specialistUsers.length].id,
          studioId: appointment.studioId,
          appointmentId: appointment.id,
          title: `План ухода #${idx + 1}`,
          steps: [
            { step: 1, text: 'Ежедневно обрабатывать зону антисептиком', status: 'PENDING' },
            { step: 2, text: 'Использовать крем с мочевиной 20%', status: 'PENDING' },
            { step: 3, text: 'Контрольный визит через 14 дней', status: 'PENDING' },
          ],
          validFrom,
          validUntil,
          status: TreatmentPlanStatus.ACTIVE,
          updateComment: 'Первичное назначение после визита',
          planSteps: {
            create: [
              {
                sortOrder: 1,
                title: 'Антисептическая обработка',
                recommendation: '2 раза в день',
                dueDate: new Date(validFrom.getTime() + 7 * 24 * 60 * 60 * 1000),
                status: TreatmentPlanStepStatus.PENDING,
              },
              {
                sortOrder: 2,
                title: 'Наносить крем с мочевиной 20%',
                recommendation: 'На ночь, ежедневно',
                dueDate: new Date(validFrom.getTime() + 14 * 24 * 60 * 60 * 1000),
                status: TreatmentPlanStepStatus.IN_PROGRESS,
              },
              {
                sortOrder: 3,
                title: 'Контрольный осмотр у специалиста',
                recommendation: 'Повторный прием',
                dueDate: new Date(validFrom.getTime() + 21 * 24 * 60 * 60 * 1000),
                status: TreatmentPlanStepStatus.PENDING,
              },
            ],
          },
        },
      });
    }),
  );

  await Promise.all(
    treatmentPlans.map((plan, idx) =>
      prisma.treatmentPlanRevision.create({
        data: {
          treatmentPlanId: plan.id,
          updatedByUserId: specialistUsers[idx % specialistUsers.length].id,
          reason: 'Первичное назначение',
          comment: 'Создано автоматически при seed',
          snapshot: {
            id: plan.id,
            title: plan.title,
            status: plan.status,
            validFrom: plan.validFrom.toISOString(),
            validUntil: plan.validUntil?.toISOString() ?? null,
            steps: plan.steps,
          },
        },
      }),
    ),
  );

  const order = await prisma.order.create({
    data: {
      userId: clientUsers[1].id,
      studioId: studios[1].id,
      orderNumber: 'PC-2026-0001',
      subtotalMinor: physicalGoods[0].priceMinor + physicalGoods[1].priceMinor,
      discountMinor: 0,
      shippingMinor: 30000,
      totalMinor:
        physicalGoods[0].priceMinor + physicalGoods[1].priceMinor + 30000,
      deliveryMethod: 'CDEK_PVZ',
      status: 'PAID',
      paidAt: now,
    },
  });

  await prisma.orderItem.createMany({
    data: [
      {
        orderId: order.id,
        productType: ProductType.PHYSICAL_GOOD,
        physicalGoodId: physicalGoods[0].id,
        nameSnapshot: physicalGoods[0].name,
        quantity: 1,
        unitPriceMinor: physicalGoods[0].priceMinor,
        totalMinor: physicalGoods[0].priceMinor,
      },
      {
        orderId: order.id,
        productType: ProductType.PHYSICAL_GOOD,
        physicalGoodId: physicalGoods[1].id,
        nameSnapshot: physicalGoods[1].name,
        quantity: 1,
        unitPriceMinor: physicalGoods[1].priceMinor,
        totalMinor: physicalGoods[1].priceMinor,
      },
    ],
  });

  await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: PaymentProvider.YOOKASSA,
      method: PaymentMethod.CARD,
      status: PaymentStatus.SUCCEEDED,
      amountMinor: order.totalMinor,
      currency: 'RUB',
      providerTxId: 'demo-seed-payment-0001',
      completedAt: now,
    },
  });

  console.log('✅ Seed готов.');
  console.log(`Логин админа: ${devAdminEmail}`);
  console.log(`Пароль админа: ${devAdminPassword}`);
  console.log(`Создана сеть: ${network.name}`);
  console.log(`Студий: ${studios.length}`);
  console.log(`Категорий услуг: ${serviceCategories.length}`);
  console.log(`Услуг: ${services.length}`);
  console.log(`Специалистов: ${specialistProfiles.length}`);
  console.log(`Товаров: ${physicalGoods.length}`);
  console.log(`Серий контента: ${contentSeries.length}`);
  console.log(`FAQ: 6`);
  console.log(`Жалоб/проблем: ${healthConcerns.length}`);
  console.log(`Промокодов: 6`);
  console.log(`Визитов: ${appointments.length}`);
  console.log(`Протоколов визита: ${appointments.length}`);
  console.log(`Планов лечения: ${treatmentPlans.length}`);
  console.log(`Ревизий планов: ${treatmentPlans.length}`);
  console.log(`Заказов: 1`);
  console.log(`Автор контента: ${contentAuthor.firstName} ${contentAuthor.lastName}`);
  console.log(`Главный администратор: ${adminUser.firstName} ${adminUser.lastName}`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
