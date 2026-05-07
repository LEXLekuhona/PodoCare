/**
 * Единые enum'ы, отражающие значения БД. Должны совпадать 1-в-1
 * с enum'ами в prisma/schema.prisma. Бэкенд и клиенты полагаются на эти типы.
 */

// =============================================================================
// ROLES & USERS
// =============================================================================

export enum UserRole {
  /** Клиент — использует мобильное приложение. */
  Client = 'CLIENT',
  /** Специалист (подолог) — использует интерфейс студии на планшете. */
  Specialist = 'SPECIALIST',
  /** Администратор конкретной студии. */
  StudioAdmin = 'STUDIO_ADMIN',
  /** Владелец сети — операционные права на все студии. */
  NetworkOwner = 'NETWORK_OWNER',
  /** Автор контента (личный бренд основателя): отдельная роль для редактирования
   *  контента/программ/квизов независимо от операционки сети. */
  ContentAuthor = 'CONTENT_AUTHOR',
  /** Суперадмин платформы — техподдержка. */
  SuperAdmin = 'SUPER_ADMIN',
}

// =============================================================================
// APPOINTMENTS
// =============================================================================

export enum AppointmentStatus {
  Draft = 'DRAFT',
  Pending = 'PENDING',
  Confirmed = 'CONFIRMED',
  InProgress = 'IN_PROGRESS',
  Completed = 'COMPLETED',
  CancelledByClient = 'CANCELLED_BY_CLIENT',
  CancelledByStudio = 'CANCELLED_BY_STUDIO',
  LateArrival = 'LATE_ARRIVAL',
  EarlyArrival = 'EARLY_ARRIVAL',
  NoShow = 'NO_SHOW',
}

/** Канал создания записи. Solodova Recovery System — единственный источник правды для записей. */
export enum AppointmentSource {
  /** Создана клиентом через мобильное приложение. */
  MobileApp = 'MOBILE_APP',
  /** Создана сотрудником студии через планшет или админ-панель. */
  Studio = 'STUDIO',
  /** Walk-in: клиент пришёл без записи, оформили на месте. */
  WalkIn = 'WALK_IN',
}

// =============================================================================
// NOTIFICATIONS
// =============================================================================

export enum NotificationType {
  AppointmentReminder = 'APPOINTMENT_REMINDER',
  AppointmentConfirmation = 'APPOINTMENT_CONFIRMATION',
  AppointmentCancellation = 'APPOINTMENT_CANCELLATION',
  AppointmentRescheduled = 'APPOINTMENT_RESCHEDULED',
  PromoCodeIssued = 'PROMO_CODE_ISSUED',
  NewContent = 'NEW_CONTENT',
  TreatmentPlanCreated = 'TREATMENT_PLAN_CREATED',
  QuizFollowUp = 'QUIZ_FOLLOW_UP',
  ProgramInquiryReply = 'PROGRAM_INQUIRY_REPLY',
  OrderUpdate = 'ORDER_UPDATE',
  SupportReply = 'SUPPORT_REPLY',
  System = 'SYSTEM',
}

export enum NotificationChannel {
  Push = 'PUSH',
  Sms = 'SMS',
  Email = 'EMAIL',
  InApp = 'IN_APP',
}

export enum NotificationStatus {
  Queued = 'QUEUED',
  Sending = 'SENDING',
  Sent = 'SENT',
  Delivered = 'DELIVERED',
  Failed = 'FAILED',
  Read = 'READ',
  /** Пропущено из-за политики (например, клиент отписался от маркетинга). */
  Suppressed = 'SUPPRESSED',
}

/** Российские SMS-провайдеры. Для MVP подключаем один; абстракция `SmsProvider`
 *  в коде позволит добавить остальных без изменений бизнес-логики. */
export enum SmsProvider {
  SmsRu = 'SMS_RU',
  Smsc = 'SMSC',
  Unisender = 'UNISENDER',
  SmsAero = 'SMS_AERO',
  /** Отправка заглушена (dev-среда) — сообщение только в лог. */
  Console = 'CONSOLE',
}

/** Провайдер push-уведомлений. Для Expo-приложений — Expo Push. */
export enum PushProvider {
  Expo = 'EXPO',
  Fcm = 'FCM',
  Apns = 'APNS',
  Console = 'CONSOLE',
}

/** Email-провайдер. */
export enum EmailProvider {
  Resend = 'RESEND',
  Postmark = 'POSTMARK',
  Smtp = 'SMTP',
  Console = 'CONSOLE',
}

/** Ключи системных шаблонов сообщений.
 *  В БД (NotificationTemplate) для каждого ключа + канала + языка хранится текст.
 *  Хардкод ключа + рендеринг сообщения в одном месте — единственный способ
 *  не обрасти копипастой. */
export enum NotificationTemplateKey {
  /** Подтверждение создания записи. */
  AppointmentConfirmation = 'APPOINTMENT_CONFIRMATION',
  /** Напоминание за сутки. */
  AppointmentReminder24h = 'APPOINTMENT_REMINDER_24H',
  /** Напоминание за час. */
  AppointmentReminder1h = 'APPOINTMENT_REMINDER_1H',
  /** Напоминание за 15 минут. */
  AppointmentReminder15m = 'APPOINTMENT_REMINDER_15M',
  /** Запись отменена (студией или клиентом). */
  AppointmentCancelled = 'APPOINTMENT_CANCELLED',
  /** Запись перенесена. */
  AppointmentRescheduled = 'APPOINTMENT_RESCHEDULED',
  /** После визита: план лечения готов / отзыв. */
  PostVisitThankyou = 'POST_VISIT_THANKYOU',
  /** Создан план лечения (клиенту). */
  TreatmentPlanReady = 'TREATMENT_PLAN_READY',
  /** OTP-код для входа. */
  AuthOtp = 'AUTH_OTP',
  /** Ответ на заявку по программе. */
  ProgramInquiryReply = 'PROGRAM_INQUIRY_REPLY',
  /** Обновление статуса заказа (для физтоваров). */
  OrderStatusUpdate = 'ORDER_STATUS_UPDATE',
  /** Новый контент / новая серия (подписавшимся). */
  NewContentPublished = 'NEW_CONTENT_PUBLISHED',
  /** Результат квиза готов. */
  QuizResultReady = 'QUIZ_RESULT_READY',
  /** Выдан промокод. */
  PromoCodeIssued = 'PROMO_CODE_ISSUED',
}

// =============================================================================
// PROMO
// =============================================================================

export enum PromoCodeType {
  PercentDiscount = 'PERCENT_DISCOUNT',
  FixedDiscount = 'FIXED_DISCOUNT',
  FreeProduct = 'FREE_PRODUCT',
  FreeService = 'FREE_SERVICE',
}

export enum PromoCodeScope {
  AllServices = 'ALL_SERVICES',
  SpecificService = 'SPECIFIC_SERVICE',
  AllPhysicalGoods = 'ALL_PHYSICAL_GOODS',
  SpecificPhysicalGood = 'SPECIFIC_PHYSICAL_GOOD',
  ContentSeries = 'CONTENT_SERIES',
  Program = 'PROGRAM',
}

// =============================================================================
// CONTENT (контент-first ядро продукта)
// =============================================================================

/** Формат единицы контента. */
export enum ContentFormat {
  Article = 'ARTICLE',
  Video = 'VIDEO',
  Audio = 'AUDIO',
  Webinar = 'WEBINAR',
  Quiz = 'QUIZ',
}

/** Аудитория контента: для клиентов или для мастеров (внутреннее обучение). */
export enum ContentAudience {
  Client = 'CLIENT',
  Specialist = 'SPECIALIST',
  Everyone = 'EVERYONE',
}

/** Куда ведёт CTA в конце единицы контента — главный инструмент прогрева. */
export enum ContentCtaTarget {
  /** Открыть платную/бесплатную серию. */
  ContentSeries = 'CONTENT_SERIES',
  /** Открыть карточку программы (программа долгого сопровождения). */
  Program = 'PROGRAM',
  /** Записаться на услугу/консультацию в студию. */
  Service = 'SERVICE',
  /** Открыть карточку физического товара. */
  PhysicalGood = 'PHYSICAL_GOOD',
  /** Запустить диагностический квиз. */
  Quiz = 'QUIZ',
  /** Открыть форму заявки (например, «узнать о программе»). */
  ProgramInquiry = 'PROGRAM_INQUIRY',
  /** Внешняя ссылка (на крайний случай). */
  ExternalUrl = 'EXTERNAL_URL',
}

// =============================================================================
// PRODUCTS / CATALOGUE
// =============================================================================

/** Тип продукта в каталоге. */
export enum ProductType {
  /** Услуга/процедура в студии (см. модель Service). */
  Service = 'SERVICE',
  /** Длинная программа сопровождения (натуропатия 6 мес и т.п.). */
  Program = 'PROGRAM',
  /** Цифровой контент: серия видео/статей, доступная после оплаты. */
  DigitalContent = 'DIGITAL_CONTENT',
  /** Физический товар: средства для стоп, натуропатические продукты. */
  PhysicalGood = 'PHYSICAL_GOOD',
  /** Внешняя ссылка (партнёрский каталог). */
  Affiliate = 'AFFILIATE',
}

// =============================================================================
// QUIZ (диагностический квиз — маркетинговый, не клинический)
// =============================================================================

/** Тип ответа на вопрос квиза. */
export enum QuizQuestionType {
  SingleChoice = 'SINGLE_CHOICE',
  MultipleChoice = 'MULTIPLE_CHOICE',
  Scale = 'SCALE',
  YesNo = 'YES_NO',
  Text = 'TEXT',
}

/** Сводный уровень результата квиза для сегментации. */
export enum QuizResultLevel {
  Low = 'LOW',
  Medium = 'MEDIUM',
  High = 'HIGH',
  Critical = 'CRITICAL',
}

// =============================================================================
// TREATMENT PLAN / VISIT PROTOCOL (документация, заполняет мастер)
// =============================================================================

export enum TreatmentPlanStatus {
  Draft = 'DRAFT',
  Active = 'ACTIVE',
  Completed = 'COMPLETED',
  Cancelled = 'CANCELLED',
}

export enum TreatmentPlanStepStatus {
  Pending = 'PENDING',
  InProgress = 'IN_PROGRESS',
  Done = 'DONE',
  Skipped = 'SKIPPED',
}

// =============================================================================
// PROGRAM INQUIRY (заявка на программу 250к → менеджер → договор)
// =============================================================================

export enum ProgramInquiryStatus {
  /** Только что создана клиентом. */
  New = 'NEW',
  /** Менеджер взял в работу. */
  InProgress = 'IN_PROGRESS',
  /** Был созвон/встреча. */
  Contacted = 'CONTACTED',
  /** Подписан договор / клиент конвертирован. */
  Converted = 'CONVERTED',
  /** Клиент отказался / не отвечает. */
  Lost = 'LOST',
}

// =============================================================================
// ORDERS / PAYMENTS
// =============================================================================

export enum OrderStatus {
  /** Корзина создана, оплата ещё не инициирована. */
  Pending = 'PENDING',
  /** Ждём оплату (платёж инициирован). */
  AwaitingPayment = 'AWAITING_PAYMENT',
  /** Оплачено. */
  Paid = 'PAID',
  /** Собрано/отправлено (для физтоваров). */
  Shipped = 'SHIPPED',
  /** Доставлено / выполнено. */
  Completed = 'COMPLETED',
  /** Отменён клиентом или системой. */
  Cancelled = 'CANCELLED',
  /** Возвращён. */
  Refunded = 'REFUNDED',
}

export enum PaymentMethod {
  /** Система быстрых платежей. */
  Sbp = 'SBP',
  /** Банковская карта. */
  Card = 'CARD',
  /** Рассрочка через банк (Т-Рассрочка / Halva и т.п.). */
  Installment = 'INSTALLMENT',
  /** Оплата в студии при визите (бронь без онлайн-оплаты). */
  InStudio = 'IN_STUDIO',
}

export enum PaymentStatus {
  Pending = 'PENDING',
  Processing = 'PROCESSING',
  Succeeded = 'SUCCEEDED',
  Failed = 'FAILED',
  Cancelled = 'CANCELLED',
  Refunded = 'REFUNDED',
  PartiallyRefunded = 'PARTIALLY_REFUNDED',
}

export enum PaymentProvider {
  Yookassa = 'YOOKASSA',
  Tinkoff = 'TINKOFF',
  Sber = 'SBER',
  /** Ручная отметка администратором (оплата в студии, тех.возврат и т.п.). */
  Manual = 'MANUAL',
}

export enum InstallmentProvider {
  TinkoffInstallment = 'TINKOFF_INSTALLMENT',
  SovcombankHalva = 'SOVCOMBANK_HALVA',
  Other = 'OTHER',
}

export enum InstallmentRequestStatus {
  Submitted = 'SUBMITTED',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
  Active = 'ACTIVE',
  Completed = 'COMPLETED',
  Cancelled = 'CANCELLED',
}

// =============================================================================
// DELIVERY (для физических товаров)
// =============================================================================

export enum DeliveryMethod {
  Pickup = 'PICKUP',
  CdekPvz = 'CDEK_PVZ',
  CdekCourier = 'CDEK_COURIER',
  RussianPost = 'RUSSIAN_POST',
  YandexDelivery = 'YANDEX_DELIVERY',
}

export enum ShipmentStatus {
  New = 'NEW',
  Packed = 'PACKED',
  HandedToCarrier = 'HANDED_TO_CARRIER',
  InTransit = 'IN_TRANSIT',
  ReadyForPickup = 'READY_FOR_PICKUP',
  Delivered = 'DELIVERED',
  Returned = 'RETURNED',
}

// =============================================================================
// FUNNEL ANALYTICS (события прогрева — для метрик и сегментации)
// =============================================================================

export enum FunnelEventType {
  AppOpen = 'APP_OPEN',
  Signup = 'SIGNUP',
  QuizStarted = 'QUIZ_STARTED',
  QuizCompleted = 'QUIZ_COMPLETED',
  ContentViewed = 'CONTENT_VIEWED',
  ContentCompleted = 'CONTENT_COMPLETED',
  CtaClicked = 'CTA_CLICKED',
  AppointmentBooked = 'APPOINTMENT_BOOKED',
  AppointmentAttended = 'APPOINTMENT_ATTENDED',
  ProgramInquirySubmitted = 'PROGRAM_INQUIRY_SUBMITTED',
  OrderCreated = 'ORDER_CREATED',
  PaymentSucceeded = 'PAYMENT_SUCCEEDED',
  ProgramConverted = 'PROGRAM_CONVERTED',
}

// =============================================================================
// SHIFTS, CONSENTS, SUPPORT, FAQ, AUDIT (без изменений)
// =============================================================================

export enum ShiftStatus {
  Scheduled = 'SCHEDULED',
  Active = 'ACTIVE',
  Completed = 'COMPLETED',
  Cancelled = 'CANCELLED',
}

export enum ConsentType {
  PersonalData = 'PERSONAL_DATA',
  MedicalInformation = 'MEDICAL_INFORMATION',
  ProcedureConsent = 'PROCEDURE_CONSENT',
  MarketingCommunications = 'MARKETING_COMMUNICATIONS',
  TermsOfService = 'TERMS_OF_SERVICE',
}

export enum SupportTicketStatus {
  Open = 'OPEN',
  InProgress = 'IN_PROGRESS',
  Resolved = 'RESOLVED',
  Closed = 'CLOSED',
}

export enum FaqCategory {
  Booking = 'BOOKING',
  Payment = 'PAYMENT',
  Procedures = 'PROCEDURES',
  Education = 'EDUCATION',
  Programs = 'PROGRAMS',
  Account = 'ACCOUNT',
  Delivery = 'DELIVERY',
  Other = 'OTHER',
}

export enum AuditAction {
  Create = 'CREATE',
  Update = 'UPDATE',
  Delete = 'DELETE',
  Login = 'LOGIN',
  Logout = 'LOGOUT',
  FailedLogin = 'FAILED_LOGIN',
  /** Доступ к чувствительным данным (медкарта). */
  SensitiveDataAccess = 'SENSITIVE_DATA_ACCESS',
}
