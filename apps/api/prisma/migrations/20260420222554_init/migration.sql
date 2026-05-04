-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('CLIENT', 'SPECIALIST', 'STUDIO_ADMIN', 'NETWORK_OWNER', 'CONTENT_AUTHOR', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('DRAFT', 'PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_STUDIO', 'LATE_ARRIVAL', 'EARLY_ARRIVAL', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "appointment_source" AS ENUM ('MOBILE_APP', 'STUDIO', 'WALK_IN');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('APPOINTMENT_REMINDER', 'APPOINTMENT_CONFIRMATION', 'APPOINTMENT_CANCELLATION', 'APPOINTMENT_RESCHEDULED', 'PROMO_CODE_ISSUED', 'NEW_CONTENT', 'TREATMENT_PLAN_CREATED', 'QUIZ_FOLLOW_UP', 'PROGRAM_INQUIRY_REPLY', 'ORDER_UPDATE', 'SUPPORT_REPLY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('PUSH', 'SMS', 'EMAIL', 'IN_APP');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "sms_provider" AS ENUM ('SMS_RU', 'SMSC', 'UNISENDER', 'SMS_AERO', 'CONSOLE');

-- CreateEnum
CREATE TYPE "push_provider" AS ENUM ('EXPO', 'FCM', 'APNS', 'CONSOLE');

-- CreateEnum
CREATE TYPE "email_provider" AS ENUM ('RESEND', 'POSTMARK', 'SMTP', 'CONSOLE');

-- CreateEnum
CREATE TYPE "notification_template_key" AS ENUM ('APPOINTMENT_CONFIRMATION', 'APPOINTMENT_REMINDER_24H', 'APPOINTMENT_REMINDER_1H', 'APPOINTMENT_REMINDER_15M', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_RESCHEDULED', 'POST_VISIT_THANKYOU', 'TREATMENT_PLAN_READY', 'AUTH_OTP', 'PROGRAM_INQUIRY_REPLY', 'ORDER_STATUS_UPDATE', 'NEW_CONTENT_PUBLISHED', 'QUIZ_RESULT_READY', 'PROMO_CODE_ISSUED');

-- CreateEnum
CREATE TYPE "promo_code_type" AS ENUM ('PERCENT_DISCOUNT', 'FIXED_DISCOUNT', 'FREE_PRODUCT', 'FREE_SERVICE');

-- CreateEnum
CREATE TYPE "promo_code_scope" AS ENUM ('ALL_SERVICES', 'SPECIFIC_SERVICE', 'ALL_PHYSICAL_GOODS', 'SPECIFIC_PHYSICAL_GOOD', 'CONTENT_SERIES', 'PROGRAM');

-- CreateEnum
CREATE TYPE "content_format" AS ENUM ('ARTICLE', 'VIDEO', 'AUDIO', 'WEBINAR', 'QUIZ');

-- CreateEnum
CREATE TYPE "content_audience" AS ENUM ('CLIENT', 'SPECIALIST', 'EVERYONE');

-- CreateEnum
CREATE TYPE "content_cta_target" AS ENUM ('CONTENT_SERIES', 'PROGRAM', 'SERVICE', 'PHYSICAL_GOOD', 'QUIZ', 'PROGRAM_INQUIRY', 'EXTERNAL_URL');

-- CreateEnum
CREATE TYPE "product_type" AS ENUM ('SERVICE', 'PROGRAM', 'DIGITAL_CONTENT', 'PHYSICAL_GOOD', 'AFFILIATE');

-- CreateEnum
CREATE TYPE "quiz_question_type" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE', 'YES_NO', 'TEXT');

-- CreateEnum
CREATE TYPE "quiz_result_level" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "treatment_plan_status" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "program_inquiry_status" AS ENUM ('NEW', 'IN_PROGRESS', 'CONTACTED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PENDING', 'AWAITING_PAYMENT', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('SBP', 'CARD', 'INSTALLMENT', 'IN_STUDIO');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('YOOKASSA', 'TINKOFF', 'SBER', 'MANUAL');

-- CreateEnum
CREATE TYPE "installment_provider" AS ENUM ('TINKOFF_INSTALLMENT', 'SOVCOMBANK_HALVA', 'OTHER');

-- CreateEnum
CREATE TYPE "installment_request_status" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "delivery_method" AS ENUM ('PICKUP', 'CDEK_PVZ', 'CDEK_COURIER', 'RUSSIAN_POST', 'YANDEX_DELIVERY');

-- CreateEnum
CREATE TYPE "shipment_status" AS ENUM ('NEW', 'PACKED', 'HANDED_TO_CARRIER', 'IN_TRANSIT', 'READY_FOR_PICKUP', 'DELIVERED', 'RETURNED');

-- CreateEnum
CREATE TYPE "funnel_event_type" AS ENUM ('APP_OPEN', 'SIGNUP', 'QUIZ_STARTED', 'QUIZ_COMPLETED', 'CONTENT_VIEWED', 'CONTENT_COMPLETED', 'CTA_CLICKED', 'APPOINTMENT_BOOKED', 'APPOINTMENT_ATTENDED', 'PROGRAM_INQUIRY_SUBMITTED', 'ORDER_CREATED', 'PAYMENT_SUCCEEDED', 'PROGRAM_CONVERTED');

-- CreateEnum
CREATE TYPE "shift_status" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "consent_type" AS ENUM ('PERSONAL_DATA', 'MEDICAL_INFORMATION', 'PROCEDURE_CONSENT', 'MARKETING_COMMUNICATIONS', 'TERMS_OF_SERVICE');

-- CreateEnum
CREATE TYPE "support_ticket_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "faq_category" AS ENUM ('BOOKING', 'PAYMENT', 'PROCEDURES', 'EDUCATION', 'PROGRAMS', 'ACCOUNT', 'DELIVERY', 'OTHER');

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'FAILED_LOGIN', 'SENSITIVE_DATA_ACCESS');

-- CreateTable
CREATE TABLE "networks" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "networks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studios" (
    "id" UUID NOT NULL,
    "network_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "phone" TEXT,
    "email" TEXT,
    "description" TEXT,
    "cover_image_url" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "opening_hours" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "studios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_closed_days" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_closed_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "studio_id" UUID,
    "role" "user_role" NOT NULL,
    "phone" TEXT NOT NULL,
    "phone_verified_at" TIMESTAMPTZ(6),
    "email" TEXT,
    "email_verified_at" TIMESTAMPTZ(6),
    "password_hash" TEXT,
    "pin_hash" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "birth_date" DATE,
    "gender" TEXT,
    "avatar_url" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "acquisition_source" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialist_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "bio" TEXT,
    "specializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certificate_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experience_years" INTEGER,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "reviews_count" INTEGER NOT NULL DEFAULT 0,
    "is_accepting_new" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "specialist_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "loyalty_points" INTEGER NOT NULL DEFAULT 0,
    "referral_code" TEXT NOT NULL,
    "referred_by_user_id" UUID,
    "tos_accepted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "walk_in_clients" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "note" TEXT,
    "linked_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "walk_in_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "device_type" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "price_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "prepayment_required" BOOLEAN NOT NULL DEFAULT false,
    "prepayment_minor" INTEGER,
    "image_url" TEXT,
    "requires_consultation" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialist_services" (
    "specialist_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,

    CONSTRAINT "specialist_services_pkey" PRIMARY KEY ("specialist_id","service_id")
);

-- CreateTable
CREATE TABLE "specialist_shifts" (
    "id" UUID NOT NULL,
    "specialist_id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "shift_status" NOT NULL DEFAULT 'SCHEDULED',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "specialist_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "specialist_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "client_user_id" UUID,
    "walk_in_client_id" UUID,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "appointment_status" NOT NULL DEFAULT 'PENDING',
    "source" "appointment_source" NOT NULL DEFAULT 'MOBILE_APP',
    "total_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "applied_promo_code_id" UUID,
    "discount_minor" INTEGER NOT NULL DEFAULT 0,
    "health_concern_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "client_note" TEXT,
    "specialist_note" TEXT,
    "checked_in_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_medical_cards" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "data_encrypted" BYTEA,
    "data_iv" BYTEA,
    "data_auth_tag" BYTEA,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "client_medical_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_protocols" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "procedures_done" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "diagnosis" TEXT,
    "materials_used" TEXT,
    "internal_note" TEXT,
    "client_visible" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "appointment_protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_plans" (
    "id" UUID NOT NULL,
    "client_user_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "appointment_id" UUID,
    "title" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "recommended_physical_good_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "recommended_content_series_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "valid_from" TIMESTAMPTZ(6) NOT NULL,
    "valid_until" TIMESTAMPTZ(6),
    "status" "treatment_plan_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "treatment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_concerns" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_concerns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "consent_type" NOT NULL,
    "document_version" TEXT NOT NULL,
    "document_url" TEXT,
    "appointment_id" UUID,
    "accepted" BOOLEAN NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_info" TEXT,
    "signed_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_series" (
    "id" UUID NOT NULL,
    "network_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "cover_image_url" TEXT,
    "audience" "content_audience" NOT NULL DEFAULT 'CLIENT',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price_minor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "content_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" UUID NOT NULL,
    "network_id" UUID NOT NULL,
    "series_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "format" "content_format" NOT NULL,
    "audience" "content_audience" NOT NULL DEFAULT 'CLIENT',
    "body" JSONB NOT NULL,
    "cover_image_url" TEXT,
    "duration_seconds" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_free_preview" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_ctas" (
    "id" UUID NOT NULL,
    "series_id" UUID,
    "item_id" UUID,
    "target" "content_cta_target" NOT NULL,
    "target_program_id" UUID,
    "target_series_id" UUID,
    "target_service_id" UUID,
    "target_physical_good_id" UUID,
    "target_quiz_id" UUID,
    "target_external_url" TEXT,
    "label" TEXT NOT NULL,
    "subtitle" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "content_ctas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_item_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "percent" INTEGER NOT NULL DEFAULT 0,
    "last_position_seconds" INTEGER,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "content_item_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_quizzes" (
    "id" UUID NOT NULL,
    "network_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cover_image_url" TEXT,
    "outcome_teaser" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "diagnostic_quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_questions" (
    "id" UUID NOT NULL,
    "quiz_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "subtitle" TEXT,
    "type" "quiz_question_type" NOT NULL,
    "scoring_tag" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "diagnostic_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_answer_options" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "diagnostic_answer_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_outcomes" (
    "id" UUID NOT NULL,
    "quiz_id" UUID NOT NULL,
    "level" "quiz_result_level" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "match_rule" JSONB NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "recommended_content_series_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "recommended_program_id" UUID,
    "recommended_physical_good_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "recommended_service_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "primaryCtaTarget" "content_cta_target",
    "primary_cta_label" TEXT,

    CONSTRAINT "diagnostic_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_quiz_responses" (
    "id" UUID NOT NULL,
    "quiz_id" UUID NOT NULL,
    "user_id" UUID,
    "anonymous_session_id" TEXT,
    "quiz_version" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "total_score" INTEGER NOT NULL,
    "tag_scores" JSONB NOT NULL,
    "outcome_id" UUID,
    "resultLevel" "quiz_result_level" NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "diagnostic_quiz_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" UUID NOT NULL,
    "network_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "price_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "installment_available" BOOLEAN NOT NULL DEFAULT true,
    "cover_image_url" TEXT,
    "inclusions" JSONB NOT NULL,
    "stages" JSONB NOT NULL,
    "faq" JSONB,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "physical_goods" (
    "id" UUID NOT NULL,
    "network_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "category" TEXT,
    "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "weight_grams" INTEGER,
    "stock" INTEGER,
    "related_health_concern_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "physical_goods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_inquiries" (
    "id" UUID NOT NULL,
    "network_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "client_user_id" UUID,
    "first_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "message" TEXT,
    "assigned_user_id" UUID,
    "status" "program_inquiry_status" NOT NULL DEFAULT 'NEW',
    "activity_log" JSONB NOT NULL DEFAULT '[]',
    "installment_request_id" UUID,
    "converted_at" TIMESTAMPTZ(6),
    "lost_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "studio_id" UUID,
    "order_number" TEXT NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "subtotal_minor" INTEGER NOT NULL,
    "discount_minor" INTEGER NOT NULL DEFAULT 0,
    "applied_promo_code_id" UUID,
    "shipping_minor" INTEGER NOT NULL DEFAULT 0,
    "total_minor" INTEGER NOT NULL,
    "deliveryMethod" "delivery_method",
    "shipping_address_id" UUID,
    "customer_note" TEXT,
    "paid_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_type" "product_type" NOT NULL,
    "physical_good_id" UUID,
    "content_series_id" UUID,
    "name_snapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price_minor" INTEGER NOT NULL,
    "total_minor" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_addresses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'RU',
    "region" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "building" TEXT NOT NULL,
    "apartment" TEXT,
    "pvz_code" TEXT,
    "note" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shipping_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "method" "delivery_method" NOT NULL,
    "status" "shipment_status" NOT NULL DEFAULT 'NEW',
    "carrier" TEXT,
    "tracking_number" TEXT,
    "shipped_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "status_history" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "method" "payment_method" NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "provider_tx_id" TEXT,
    "provider_payload" JSONB,
    "confirmation_url" TEXT,
    "idempotency_key" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "refunded_minor" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installment_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "program_id" UUID,
    "order_id" UUID,
    "provider" "installment_provider" NOT NULL,
    "status" "installment_request_status" NOT NULL DEFAULT 'SUBMITTED',
    "amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "term_months" INTEGER NOT NULL,
    "monthly_payment_minor" INTEGER,
    "provider_request_id" TEXT,
    "provider_payload" JSONB,
    "rejection_reason" TEXT,
    "approved_at" TIMESTAMPTZ(6),
    "activated_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "installment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnel_events" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "anonymous_session_id" TEXT,
    "type" "funnel_event_type" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funnel_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" UUID NOT NULL,
    "studio_id" UUID,
    "code" TEXT NOT NULL,
    "type" "promo_code_type" NOT NULL,
    "scope" "promo_code_scope" NOT NULL,
    "value" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "description" TEXT,
    "service_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "physical_good_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "content_series_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "program_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "min_order_minor" INTEGER,
    "max_uses_total" INTEGER,
    "max_uses_per_user" INTEGER NOT NULL DEFAULT 1,
    "uses_count" INTEGER NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMPTZ(6) NOT NULL,
    "valid_until" TIMESTAMPTZ(6) NOT NULL,
    "auto_issue_trigger" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "network_id" UUID NOT NULL,
    "key" "notification_template_key" NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sender_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_policies" (
    "id" UUID NOT NULL,
    "network_id" UUID NOT NULL,
    "template_key" "notification_template_key" NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "offset_minutes_before" INTEGER NOT NULL,
    "conditions" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reminder_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "push_provider" NOT NULL,
    "token" TEXT NOT NULL,
    "device_type" TEXT NOT NULL,
    "device_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "template_key" "notification_template_key",
    "channel" "notification_channel" NOT NULL,
    "status" "notification_status" NOT NULL DEFAULT 'QUEUED',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "payload" JSONB,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "sms_provider" "sms_provider",
    "push_provider" "push_provider",
    "email_provider" "email_provider",
    "provider_message_id" TEXT,
    "provider_payload" JSONB,
    "cost_minor" INTEGER,
    "sent_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "read_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "failure_reason" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "marketing_sms_enabled" BOOLEAN NOT NULL DEFAULT true,
    "marketing_push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "marketing_email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "new_content_push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminder_sms_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminder_push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "quiet_hours_start" TEXT,
    "quiet_hours_end" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_items" (
    "id" UUID NOT NULL,
    "category" "faq_category" NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "studio_id" UUID,
    "subject" TEXT NOT NULL,
    "status" "support_ticket_status" NOT NULL DEFAULT 'OPEN',
    "assigned_user_id" UUID,
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "attachment_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_surveys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "appointment_id" UUID,
    "ratings" JSONB NOT NULL,
    "comment" TEXT,
    "allow_publish" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" "audit_action" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PromoCodeProgram" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_PromoCodeProgram_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_PromoCodePhysicalGood" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_PromoCodePhysicalGood_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_PromoCodeService" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_PromoCodeService_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "networks_slug_key" ON "networks"("slug");

-- CreateIndex
CREATE INDEX "studios_network_id_idx" ON "studios"("network_id");

-- CreateIndex
CREATE INDEX "studios_is_active_idx" ON "studios"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "studio_closed_days_studio_id_date_key" ON "studio_closed_days"("studio_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_studio_id_idx" ON "users"("studio_id");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "users_acquisition_source_idx" ON "users"("acquisition_source");

-- CreateIndex
CREATE UNIQUE INDEX "specialist_profiles_user_id_key" ON "specialist_profiles"("user_id");

-- CreateIndex
CREATE INDEX "specialist_profiles_studio_id_idx" ON "specialist_profiles"("studio_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_profiles_user_id_key" ON "client_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_profiles_referral_code_key" ON "client_profiles"("referral_code");

-- CreateIndex
CREATE INDEX "walk_in_clients_studio_id_phone_idx" ON "walk_in_clients"("studio_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key" ON "auth_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "otp_codes_phone_expires_at_idx" ON "otp_codes"("phone", "expires_at");

-- CreateIndex
CREATE INDEX "services_studio_id_is_active_idx" ON "services"("studio_id", "is_active");

-- CreateIndex
CREATE INDEX "specialist_shifts_specialist_id_starts_at_idx" ON "specialist_shifts"("specialist_id", "starts_at");

-- CreateIndex
CREATE INDEX "specialist_shifts_studio_id_starts_at_idx" ON "specialist_shifts"("studio_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_studio_id_starts_at_idx" ON "appointments"("studio_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_specialist_id_starts_at_idx" ON "appointments"("specialist_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_client_user_id_idx" ON "appointments"("client_user_id");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- CreateIndex
CREATE INDEX "appointments_source_idx" ON "appointments"("source");

-- CreateIndex
CREATE UNIQUE INDEX "client_medical_cards_user_id_key" ON "client_medical_cards"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_protocols_appointment_id_key" ON "appointment_protocols"("appointment_id");

-- CreateIndex
CREATE INDEX "appointment_protocols_author_user_id_idx" ON "appointment_protocols"("author_user_id");

-- CreateIndex
CREATE INDEX "treatment_plans_client_user_id_status_idx" ON "treatment_plans"("client_user_id", "status");

-- CreateIndex
CREATE INDEX "treatment_plans_studio_id_idx" ON "treatment_plans"("studio_id");

-- CreateIndex
CREATE UNIQUE INDEX "health_concerns_slug_key" ON "health_concerns"("slug");

-- CreateIndex
CREATE INDEX "consents_user_id_type_idx" ON "consents"("user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "content_series_slug_key" ON "content_series"("slug");

-- CreateIndex
CREATE INDEX "content_series_network_id_is_published_idx" ON "content_series"("network_id", "is_published");

-- CreateIndex
CREATE INDEX "content_series_audience_idx" ON "content_series"("audience");

-- CreateIndex
CREATE UNIQUE INDEX "content_items_slug_key" ON "content_items"("slug");

-- CreateIndex
CREATE INDEX "content_items_series_id_sort_order_idx" ON "content_items"("series_id", "sort_order");

-- CreateIndex
CREATE INDEX "content_items_format_audience_is_published_idx" ON "content_items"("format", "audience", "is_published");

-- CreateIndex
CREATE INDEX "content_ctas_series_id_idx" ON "content_ctas"("series_id");

-- CreateIndex
CREATE INDEX "content_ctas_item_id_idx" ON "content_ctas"("item_id");

-- CreateIndex
CREATE INDEX "content_ctas_target_idx" ON "content_ctas"("target");

-- CreateIndex
CREATE UNIQUE INDEX "content_item_progress_user_id_item_id_key" ON "content_item_progress"("user_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_quizzes_slug_key" ON "diagnostic_quizzes"("slug");

-- CreateIndex
CREATE INDEX "diagnostic_quizzes_network_id_is_published_idx" ON "diagnostic_quizzes"("network_id", "is_published");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_questions_quiz_id_order_key" ON "diagnostic_questions"("quiz_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_answer_options_question_id_order_key" ON "diagnostic_answer_options"("question_id", "order");

-- CreateIndex
CREATE INDEX "diagnostic_outcomes_quiz_id_sort_order_idx" ON "diagnostic_outcomes"("quiz_id", "sort_order");

-- CreateIndex
CREATE INDEX "diagnostic_quiz_responses_user_id_completed_at_idx" ON "diagnostic_quiz_responses"("user_id", "completed_at");

-- CreateIndex
CREATE INDEX "diagnostic_quiz_responses_quiz_id_completed_at_idx" ON "diagnostic_quiz_responses"("quiz_id", "completed_at");

-- CreateIndex
CREATE INDEX "diagnostic_quiz_responses_anonymous_session_id_idx" ON "diagnostic_quiz_responses"("anonymous_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "programs_slug_key" ON "programs"("slug");

-- CreateIndex
CREATE INDEX "programs_network_id_is_published_idx" ON "programs"("network_id", "is_published");

-- CreateIndex
CREATE UNIQUE INDEX "physical_goods_sku_key" ON "physical_goods"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "physical_goods_slug_key" ON "physical_goods"("slug");

-- CreateIndex
CREATE INDEX "physical_goods_network_id_is_active_idx" ON "physical_goods"("network_id", "is_active");

-- CreateIndex
CREATE INDEX "physical_goods_category_idx" ON "physical_goods"("category");

-- CreateIndex
CREATE INDEX "program_inquiries_network_id_status_idx" ON "program_inquiries"("network_id", "status");

-- CreateIndex
CREATE INDEX "program_inquiries_program_id_idx" ON "program_inquiries"("program_id");

-- CreateIndex
CREATE INDEX "program_inquiries_phone_idx" ON "program_inquiries"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_user_id_status_idx" ON "orders"("user_id", "status");

-- CreateIndex
CREATE INDEX "orders_studio_id_status_idx" ON "orders"("studio_id", "status");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "shipping_addresses_user_id_idx" ON "shipping_addresses"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_order_id_key" ON "shipments"("order_id");

-- CreateIndex
CREATE INDEX "shipments_tracking_number_idx" ON "shipments"("tracking_number");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_tx_id_key" ON "payments"("provider_tx_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_order_id_status_idx" ON "payments"("order_id", "status");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "installment_requests_provider_request_id_key" ON "installment_requests"("provider_request_id");

-- CreateIndex
CREATE INDEX "installment_requests_user_id_status_idx" ON "installment_requests"("user_id", "status");

-- CreateIndex
CREATE INDEX "installment_requests_provider_request_id_idx" ON "installment_requests"("provider_request_id");

-- CreateIndex
CREATE INDEX "funnel_events_user_id_occurred_at_idx" ON "funnel_events"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "funnel_events_type_occurred_at_idx" ON "funnel_events"("type", "occurred_at");

-- CreateIndex
CREATE INDEX "funnel_events_anonymous_session_id_idx" ON "funnel_events"("anonymous_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- CreateIndex
CREATE INDEX "promo_codes_code_is_active_idx" ON "promo_codes"("code", "is_active");

-- CreateIndex
CREATE INDEX "promo_codes_studio_id_idx" ON "promo_codes"("studio_id");

-- CreateIndex
CREATE INDEX "notification_templates_network_id_is_active_idx" ON "notification_templates"("network_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_network_id_key_channel_locale_key" ON "notification_templates"("network_id", "key", "channel", "locale");

-- CreateIndex
CREATE INDEX "reminder_policies_network_id_is_active_idx" ON "reminder_policies"("network_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_policies_network_id_template_key_channel_offset_mi_key" ON "reminder_policies"("network_id", "template_key", "channel", "offset_minutes_before");

-- CreateIndex
CREATE INDEX "push_devices_user_id_is_active_idx" ON "push_devices"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "push_devices_provider_token_key" ON "push_devices"("provider", "token");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_idempotency_key_key" ON "notifications"("idempotency_key");

-- CreateIndex
CREATE INDEX "notifications_user_id_status_idx" ON "notifications"("user_id", "status");

-- CreateIndex
CREATE INDEX "notifications_type_created_at_idx" ON "notifications"("type", "created_at");

-- CreateIndex
CREATE INDEX "notifications_entity_type_entity_id_idx" ON "notifications"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "faq_items_category_is_active_idx" ON "faq_items"("category", "is_active");

-- CreateIndex
CREATE INDEX "support_tickets_user_id_status_idx" ON "support_tickets"("user_id", "status");

-- CreateIndex
CREATE INDEX "support_messages_ticket_id_idx" ON "support_messages"("ticket_id");

-- CreateIndex
CREATE INDEX "feedback_surveys_studio_id_created_at_idx" ON "feedback_surveys"("studio_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "_PromoCodeProgram_B_index" ON "_PromoCodeProgram"("B");

-- CreateIndex
CREATE INDEX "_PromoCodePhysicalGood_B_index" ON "_PromoCodePhysicalGood"("B");

-- CreateIndex
CREATE INDEX "_PromoCodeService_B_index" ON "_PromoCodeService"("B");

-- AddForeignKey
ALTER TABLE "studios" ADD CONSTRAINT "studios_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_closed_days" ADD CONSTRAINT "studio_closed_days_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specialist_profiles" ADD CONSTRAINT "specialist_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specialist_profiles" ADD CONSTRAINT "specialist_profiles_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "walk_in_clients" ADD CONSTRAINT "walk_in_clients_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specialist_services" ADD CONSTRAINT "specialist_services_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "specialist_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specialist_services" ADD CONSTRAINT "specialist_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specialist_shifts" ADD CONSTRAINT "specialist_shifts_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "specialist_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specialist_shifts" ADD CONSTRAINT "specialist_shifts_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "specialist_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_user_id_fkey" FOREIGN KEY ("client_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_walk_in_client_id_fkey" FOREIGN KEY ("walk_in_client_id") REFERENCES "walk_in_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_applied_promo_code_id_fkey" FOREIGN KEY ("applied_promo_code_id") REFERENCES "promo_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_medical_cards" ADD CONSTRAINT "client_medical_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_protocols" ADD CONSTRAINT "appointment_protocols_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_protocols" ADD CONSTRAINT "appointment_protocols_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_client_user_id_fkey" FOREIGN KEY ("client_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_series" ADD CONSTRAINT "content_series_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_series" ADD CONSTRAINT "content_series_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "content_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_ctas" ADD CONSTRAINT "content_ctas_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "content_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_ctas" ADD CONSTRAINT "content_ctas_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_ctas" ADD CONSTRAINT "content_ctas_target_program_id_fkey" FOREIGN KEY ("target_program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_ctas" ADD CONSTRAINT "content_ctas_target_series_id_fkey" FOREIGN KEY ("target_series_id") REFERENCES "content_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_ctas" ADD CONSTRAINT "content_ctas_target_service_id_fkey" FOREIGN KEY ("target_service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_ctas" ADD CONSTRAINT "content_ctas_target_physical_good_id_fkey" FOREIGN KEY ("target_physical_good_id") REFERENCES "physical_goods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_ctas" ADD CONSTRAINT "content_ctas_target_quiz_id_fkey" FOREIGN KEY ("target_quiz_id") REFERENCES "diagnostic_quizzes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_item_progress" ADD CONSTRAINT "content_item_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_item_progress" ADD CONSTRAINT "content_item_progress_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_quizzes" ADD CONSTRAINT "diagnostic_quizzes_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_questions" ADD CONSTRAINT "diagnostic_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "diagnostic_quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_answer_options" ADD CONSTRAINT "diagnostic_answer_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "diagnostic_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_outcomes" ADD CONSTRAINT "diagnostic_outcomes_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "diagnostic_quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_outcomes" ADD CONSTRAINT "diagnostic_outcomes_recommended_program_id_fkey" FOREIGN KEY ("recommended_program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_quiz_responses" ADD CONSTRAINT "diagnostic_quiz_responses_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "diagnostic_quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_quiz_responses" ADD CONSTRAINT "diagnostic_quiz_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_quiz_responses" ADD CONSTRAINT "diagnostic_quiz_responses_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "diagnostic_outcomes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_goods" ADD CONSTRAINT "physical_goods_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_inquiries" ADD CONSTRAINT "program_inquiries_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_inquiries" ADD CONSTRAINT "program_inquiries_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_inquiries" ADD CONSTRAINT "program_inquiries_client_user_id_fkey" FOREIGN KEY ("client_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_inquiries" ADD CONSTRAINT "program_inquiries_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_inquiries" ADD CONSTRAINT "program_inquiries_installment_request_id_fkey" FOREIGN KEY ("installment_request_id") REFERENCES "installment_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_applied_promo_code_id_fkey" FOREIGN KEY ("applied_promo_code_id") REFERENCES "promo_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_address_id_fkey" FOREIGN KEY ("shipping_address_id") REFERENCES "shipping_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_physical_good_id_fkey" FOREIGN KEY ("physical_good_id") REFERENCES "physical_goods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_requests" ADD CONSTRAINT "installment_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_requests" ADD CONSTRAINT "installment_requests_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_policies" ADD CONSTRAINT "reminder_policies_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_surveys" ADD CONSTRAINT "feedback_surveys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_surveys" ADD CONSTRAINT "feedback_surveys_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PromoCodeProgram" ADD CONSTRAINT "_PromoCodeProgram_A_fkey" FOREIGN KEY ("A") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PromoCodeProgram" ADD CONSTRAINT "_PromoCodeProgram_B_fkey" FOREIGN KEY ("B") REFERENCES "promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PromoCodePhysicalGood" ADD CONSTRAINT "_PromoCodePhysicalGood_A_fkey" FOREIGN KEY ("A") REFERENCES "physical_goods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PromoCodePhysicalGood" ADD CONSTRAINT "_PromoCodePhysicalGood_B_fkey" FOREIGN KEY ("B") REFERENCES "promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PromoCodeService" ADD CONSTRAINT "_PromoCodeService_A_fkey" FOREIGN KEY ("A") REFERENCES "promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PromoCodeService" ADD CONSTRAINT "_PromoCodeService_B_fkey" FOREIGN KEY ("B") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
