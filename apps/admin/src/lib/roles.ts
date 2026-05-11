import { UserRole } from '@srs/shared-types';

/** CRUD сетей / студий / глобальных справочников в админ-каталоге. */
export function canMutateTenantCatalog(role: UserRole): boolean {
  return role === UserRole.SuperAdmin || role === UserRole.NetworkOwner;
}

/** Управление учётными записями сотрудников (специалисты, админы студии и т.д.). */
export function canManageStaff(role: UserRole): boolean {
  return (
    role === UserRole.SuperAdmin ||
    role === UserRole.NetworkOwner ||
    role === UserRole.StudioAdmin
  );
}

/** Приём, протоколы и планы лечения в админке (операции). */
export function canUseClinicalOperations(role: UserRole): boolean {
  return (
    role === UserRole.Specialist ||
    role === UserRole.StudioAdmin ||
    role === UserRole.NetworkOwner ||
    role === UserRole.SuperAdmin
  );
}

/** Терминалы эквайринга и секреты провайдеров — только платформенный суперадмин. */
export function canConfigureAcquiringTerminals(role: UserRole): boolean {
  return role === UserRole.SuperAdmin;
}
