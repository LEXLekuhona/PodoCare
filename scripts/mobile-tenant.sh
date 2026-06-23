#!/usr/bin/env bash
# White-label tenant presets for apps/mobile.
#
# Usage (from repo root):
#   ./scripts/mobile-tenant.sh list
#   ./scripts/mobile-tenant.sh use solodova
#   ./scripts/mobile-tenant.sh show solodova
#   ./scripts/mobile-tenant.sh new my-studio
#
# pnpm: mobile:tenant, mobile:tenant:solodova, dev:mobile:solodova

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="${ROOT_DIR}/apps/mobile"
TENANTS_DIR="${MOBILE_DIR}/tenants"
ENV_FILE="${MOBILE_DIR}/.env"
ACTIVE_FILE="${MOBILE_DIR}/.tenant-active"
TEMPLATE="${TENANTS_DIR}/_template.env"

slugify() {
  echo "$1" \
    | tr 'A-Z' 'a-z' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g; s/-+/-/g'
}

tenant_file() {
  local slug="$1"
  echo "${TENANTS_DIR}/${slug}.env"
}

cmd_list() {
  echo "Доступные tenant-пресеты (apps/mobile/tenants/*.env):"
  local f slug
  for f in "${TENANTS_DIR}"/*.env; do
    [[ -f "$f" ]] || continue
    slug="$(basename "$f" .env)"
    [[ "$slug" == "_template" ]] && continue
    if [[ -f "$ACTIVE_FILE" ]] && [[ "$(cat "$ACTIVE_FILE")" == "$slug" ]]; then
      echo "  * ${slug}  (активен)"
    else
      echo "    ${slug}"
    fi
  done
  echo
  echo "Активация: pnpm mobile:tenant use <slug>"
}

read_nonempty() {
  local prompt="$1"
  local default="${2:-}"
  local value=""
  if [[ -n "$default" ]]; then
    read -r -p "${prompt} [${default}]: " value
    echo "${value:-$default}"
  else
    while [[ -z "$value" ]]; do
      read -r -p "${prompt}: " value
    done
    echo "$value"
  fi
}

cmd_new() {
  local slug="${1:-}"
  if [[ -z "$slug" ]]; then
    slug="$(slugify "$(read_nonempty "Slug файла (латиница, напр. solodova)")")"
  fi
  if [[ ! "$slug" =~ ^[a-z][a-z0-9-]*$ ]]; then
    echo "mobile-tenant: invalid slug '${slug}'" >&2
    exit 1
  fi

  local out
  out="$(tenant_file "$slug")"
  if [[ -f "$out" ]]; then
    echo "mobile-tenant: already exists: ${out}" >&2
    exit 1
  fi

  echo "=== Новый tenant: ${slug} ==="
  local brand legal short_name api_url privacy_url privacy_email support_email support_phone
  local app_display android_pkg ios_bundle app_slug

  brand="$(read_nonempty "Название бренда в приложении" "Моя студия")"
  short_name="$(read_nonempty "Короткое имя (календарь, поддержка)" "$(echo "$brand" | awk '{print $1}')")"
  legal="$(read_nonempty "Юрлицо оператора ПДн" "ООО «${brand}»")"
  api_url="$(read_nonempty "URL API" "http://localhost:3000/api/v1")"
  privacy_url="$(read_nonempty "URL политики конфиденциальности" "https://example.com/privacy")"
  privacy_email="$(read_nonempty "Email для отзыва согласия (privacy)" "privacy@example.com")"
  support_email="$(read_nonempty "Email поддержки" "support@example.com")"
  support_phone="$(read_nonempty "Телефон поддержки E.164" "+79000000000")"

  app_slug="$(slugify "$(read_nonempty "EAS slug" "$slug")")"
  app_display="$(read_nonempty "Имя в сторе (короткое)" "$short_name")"
  android_pkg="$(read_nonempty "Android package" "com.${slug//-/.}.app")"
  ios_bundle="$(read_nonempty "iOS bundle id" "$android_pkg")"

  cat >"$out" <<EOF
# Tenant: ${slug}
# Создан: $(date -u +%Y-%m-%d)

TENANT_SLUG=${slug}
TENANT_DISPLAY_NAME=${brand}

EXPO_PUBLIC_API_BASE_URL=${api_url}

EXPO_PUBLIC_APP_DISPLAY_NAME=${app_display}
EXPO_PUBLIC_APP_SLUG=${app_slug}
EXPO_PUBLIC_ANDROID_PACKAGE=${android_pkg}
EXPO_PUBLIC_IOS_BUNDLE_ID=${ios_bundle}
EXPO_PUBLIC_APP_SCHEME=${slug}

EXPO_PUBLIC_BRAND_NAME=${brand}
EXPO_PUBLIC_BRAND_SHORT_NAME=${short_name}
EXPO_PUBLIC_STUDIO_LEGAL_NAME=${legal}
EXPO_PUBLIC_PLATFORM_LEGAL_NAME=Podocare

EXPO_PUBLIC_PRIVACY_POLICY_URL=${privacy_url}
EXPO_PUBLIC_PRIVACY_EMAIL=${privacy_email}
EXPO_PUBLIC_SUPPORT_EMAIL=${support_email}
EXPO_PUBLIC_SUPPORT_PHONE=${support_phone}
EOF

  echo
  echo "Создан: ${out}"
  echo "Активировать: pnpm mobile:tenant use ${slug}"
}

cmd_use() {
  local slug="${1:-}"
  if [[ -z "$slug" ]]; then
    echo "usage: $0 use <slug>" >&2
    cmd_list
    exit 1
  fi

  local src
  src="$(tenant_file "$slug")"
  if [[ ! -f "$src" ]]; then
    echo "mobile-tenant: tenant not found: ${slug} (expected ${src})" >&2
    exit 1
  fi

  cp "$src" "$ENV_FILE"
  echo "$slug" >"$ACTIVE_FILE"

  local display=""
  display="$(grep -E '^TENANT_DISPLAY_NAME=' "$src" | head -1 | cut -d= -f2- || true)"
  display="${display:-$slug}"

  echo "mobile-tenant: active → ${display} (${slug})"
  echo "  .env ← ${src}"
  echo
  grep -E '^EXPO_PUBLIC_(BRAND_NAME|API_BASE_URL|ANDROID_PACKAGE)=' "$src" | sed 's/^/  /'
  echo
  echo "Перезапустите Metro: pnpm dev:mobile  (или pnpm dev:mobile:solodova)"
}

cmd_show() {
  local slug="${1:-}"
  if [[ -z "$slug" ]]; then
    if [[ -f "$ACTIVE_FILE" ]]; then
      slug="$(cat "$ACTIVE_FILE")"
    else
      echo "mobile-tenant: no active tenant; usage: $0 show <slug>" >&2
      exit 1
    fi
  fi
  local src
  src="$(tenant_file "$slug")"
  if [[ ! -f "$src" ]]; then
    echo "mobile-tenant: tenant not found: ${slug}" >&2
    exit 1
  fi
  cat "$src"
}

main() {
  local cmd="${1:-}"
  shift || true
  case "$cmd" in
    list | ls) cmd_list ;;
    use) cmd_use "${1:-}" ;;
    show) cmd_show "${1:-}" ;;
    new) cmd_new "${1:-}" ;;
    ''|help|-h|--help)
      echo "usage: $0 {list|use <slug>|show [slug]|new [slug]}"
      ;;
    *)
      echo "mobile-tenant: unknown command: ${cmd}" >&2
      exit 1
      ;;
  esac
}

main "$@"
