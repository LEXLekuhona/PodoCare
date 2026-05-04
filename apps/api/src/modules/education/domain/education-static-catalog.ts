/**
 * Временный демо-каталог для локальной разработки.
 * В продакшене контент задаётся админ-панелью в БД; при EDUCATION_STATIC_FALLBACK=false
 * этот каталог не используется (см. EducationService).
 */
import { ContentAudience } from '@prisma/client';

export type EducationAudienceParam = 'client' | 'master';

export type EducationScreenPayload = {
  myCourses: Array<{
    id: string;
    title: string;
    coverUrl: string | null;
    progressPercent: number;
    completedLessons: number;
    totalLessons: number;
  }>;
  freeMaterials: Array<{
    id: string;
    title: string;
    coverUrl: string | null;
    kind: 'video' | 'article' | 'pdf';
    metaLabel: string;
  }>;
  featured: Array<{
    id: string;
    format: 'webinar' | 'intensive';
    title: string;
    description: string;
    coverUrl: string | null;
    priceRub: number;
    metaLeft: string;
    metaRight: string;
    cta: 'register' | 'details';
  }>;
};

const IMG = {
  courseClient:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDznslu2t_zHYQ7_DZ002Z9uR2_tI2o9vhN5VWPGxA_Wr4Z4usTrFl4eAosj9YqvyBwNWXcMlQ_OEuDcvcqKZgZYMGRwF4bbJqJ__ZczPg-xDodGfLF37siyV10rRV25Cn-mFFItOVMbvHcS_pTlPEyweYExdVC6OiEAUjlJo5VyizfINDxMqcSaI_P0N5iTseGGmNIHe4pO9o3xX9dr5Zadpuq5Yhyeoyjxl-yO3vrIqHWGjXgzRsGi-fIl7_IhMg1xU5dXfOm8a7O',
  courseMaster:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAu8m0Vx4N-E_BwCNAApAe22cn5jipbVxkJEFxlzfeY8UGO4RFR4LzFR6t-6159kBP83c-vckrpya3ZdXavE00E7kBGSDORPThg6WPsLNy_oVE6RoPlafADQl0HJtPmgBfhzMiSLEKNUjf-Zqa4wMkOELbjVe3f24TGz0YcfKRyyMDMCEFNlGvmVQ5_irZZidlgMW9HsZldvXBw_mnkAEM1DYvZLGwSmN8uayry1xJxs1rOZYfVh_JNqatUslq7ZDSFgZ-d0UOEcUoQ',
  shoe:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCv-52xO_zWIae_vnATyYnMHAEWiGSAFxeiwbTyROu9RAkt82cFmxYgbWpQQrKz1wzRmSbhs3TNCq_HkxtQegWJGAtJ3ttMxXe3WICzgq9DMSgd73ATeynsRjowgHG4TA-v0IQwA3fevJMU_tBi6wMBjq6J-8U-47DNSfHRuULUdtC4hkYHgmsmvd0EqZhtiRJLbSBAGkx987fx3zGzuBNoIpVjrrxKzIcDOdLHTzMNar82pDZzMAz9zftoBPi9ghE6pfRZIt7sXESn',
  gym:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCGWtMUsWDkj9xwnN6eDY01sVTJfQaDNfwJWS6O2qTGJNZb9HRheIj-7FtGLKPeHQVT0xinpVXbWMGmUoONkZXHhyhijs7QjVvXxuXh7jqLC0v_srH2KXqgvP_JNltcSLnkbDX0a8qBZo_5WlqMYIrBJuEw98mV41itV-O9OZYwUECJvb-3fMDEnsC_yAQZsQn5UtloSvfJnBSpK4oJaGiQdt-MI_Q-blVG_4NW91L-mEI3yyofV-9wxy9PhFFYH5s1mswptor0Oagj',
  pdf:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuA98viWGdS8cNJ_FbEvuknCZzUHaB9gOI4_ZP5EyJlx4-kTC7uq8KJmzhDUszAe3UxUlIuZRuyUMBC965txgoS-WrZPO818eNs0ONgyWfNigKS_F3L2ZAcUj-XkFLJliKQOnIusuITaLw95OHlga28NNlbqEX9PGxPAkPoD8VuXVjJhkxPRa0rFZJoHyynMwgCtC_hS0bFnR4fVxTZ5lFx92lM-uysGfSwpbi3Zs0Eub9pKvRMYQJn-CKoPnWoBwLMjvcSh6DmWCxn0',
  webinar:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAu8m0Vx4N-E_BwCNAApAe22cn5jipbVxkJEFxlzfeY8UGO4RFR4LzFR6t-6159kBP83c-vckrpya3ZdXavE00E7kBGSDORPThg6WPsLNy_oVE6RoPlafADQl0HJtPmgBfhzMiSLEKNUjf-Zqa4wMkOELbjVe3f24TGz0YcfKRyyMDMCEFNlGvmVQ5_irZZidlgMW9HsZldvXBw_mnkAEM1DYvZLGwSmN8uayry1xJxs1rOZYfVh_JNqatUslq7ZDSFgZ-d0UOEcUoQ',
  intensive:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBmHzuTf74JpGOreVZi3kIk_odsD2i6m42LP1q9r0kAxdSNM3HBwzh5QEe4vu235u1O60byexjAsBAhPF5m1krQnnQZeq2Yc_sOUTWYVMEMSXA7kMtbo9w4sWZOQOS-U0Ch4keiQxHUUg13WdePTkw4opY8uSN9S6FrNX_IRr2aX41OAvNJUCgpsQj5XgRMDqQgDhW3w0pC6PIN0LavmWqR_vs3Q4oLDcU88fYQlZKkAkyB0a4bKCsqsGGp4KA_pi2oXhe548T3-uKA',
};

const client: EducationScreenPayload = {
  myCourses: [
    {
      id: 'static-c1',
      title: 'Уход за стопами дома',
      coverUrl: IMG.courseClient,
      progressPercent: 60,
      completedLessons: 3,
      totalLessons: 5,
    },
  ],
  freeMaterials: [
    {
      id: 'static-f1',
      title: 'Гайд: Правильный выбор повседневной обуви',
      coverUrl: IMG.shoe,
      kind: 'video',
      metaLabel: '15 мин',
    },
    {
      id: 'static-f2',
      title: 'Ежедневная гимнастика для профилактики плоскостопия',
      coverUrl: IMG.gym,
      kind: 'article',
      metaLabel: '5 мин чтения',
    },
    {
      id: 'static-f3',
      title: 'Чек-лист: Идеальная домашняя аптечка для ног',
      coverUrl: IMG.pdf,
      kind: 'pdf',
      metaLabel: '1.2 MB',
    },
  ],
  featured: [
    {
      id: 'static-e1',
      format: 'webinar',
      title: 'Здоровье ногтей: мифы и реальность',
      description:
        'Разбираем популярные заблуждения об уходе за ногтями и рассказываем о научно доказанных методах.',
      coverUrl: IMG.webinar,
      priceRub: 1500,
      metaLeft: '12 Октября',
      metaRight: '19:00',
      cta: 'register',
    },
    {
      id: 'static-e2',
      format: 'intensive',
      title: 'Комплексный уход при гиперкератозе',
      description:
        'Глубокое погружение в проблему: от причин возникновения до составления плана домашнего ухода.',
      coverUrl: IMG.intensive,
      priceRub: 3900,
      metaLeft: '4 модуля',
      metaRight: 'Доступ навсегда',
      cta: 'details',
    },
  ],
};

const master: EducationScreenPayload = {
  myCourses: [
    {
      id: 'static-m1',
      title: 'Протоколы кабинета: безопасность и стерилизация',
      coverUrl: IMG.courseMaster,
      progressPercent: 35,
      completedLessons: 2,
      totalLessons: 6,
    },
  ],
  freeMaterials: [
    {
      id: 'static-mf1',
      title: 'Видео: Настройка рабочего места мастера',
      coverUrl: IMG.shoe,
      kind: 'video',
      metaLabel: '22 мин',
    },
    {
      id: 'static-mf2',
      title: 'Статья: Документооборот и журналы',
      coverUrl: IMG.gym,
      kind: 'article',
      metaLabel: '8 мин чтения',
    },
  ],
  featured: [
    {
      id: 'static-me1',
      format: 'webinar',
      title: 'Маркетинг услуг в Instagram',
      description: 'Как оформить профиль и выстроить запись без выгорания.',
      coverUrl: IMG.webinar,
      priceRub: 2500,
      metaLeft: '20 Ноября',
      metaRight: '18:00',
      cta: 'register',
    },
    {
      id: 'static-me2',
      format: 'intensive',
      title: 'Аппаратный маникюр: продвинутый модуль',
      description: 'Фрезы, скорости, работа с проблемными ногтями.',
      coverUrl: IMG.intensive,
      priceRub: 5900,
      metaLeft: '6 модулей',
      metaRight: 'Доступ 12 мес',
      cta: 'details',
    },
  ],
};

export function getStaticEducationCatalog(audience: EducationAudienceParam): EducationScreenPayload {
  return audience === 'master' ? master : client;
}

export function prismaAudience(audience: EducationAudienceParam): ContentAudience {
  return audience === 'master' ? ContentAudience.SPECIALIST : ContentAudience.CLIENT;
}
