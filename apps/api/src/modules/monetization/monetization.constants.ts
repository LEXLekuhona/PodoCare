import { UserRole } from '@srs/shared-types';

/** Сотрудники, работающие с заявками, рассрочкой и доставкой в сети. */
export const COMMERCE_STAFF_ROLES = [
  UserRole.Specialist,
  UserRole.StudioAdmin,
  UserRole.NetworkOwner,
  UserRole.SuperAdmin,
] as const;
