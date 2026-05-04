import { UserRole } from '@podocare/shared-types';

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
