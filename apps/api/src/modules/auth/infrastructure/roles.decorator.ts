import { SetMetadata } from '@nestjs/common';

import type { UserRole } from '@srs/shared-types';

export const ROLES_KEY = 'roles';

/** Ограничение доступа по роли JWT (после JwtAuthGuard). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
