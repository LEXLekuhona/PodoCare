import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- токен Nest DI
import { Reflector } from '@nestjs/core';


import { ROLES_KEY } from './roles.decorator';

import type { JwtAccessPayload } from './jwt.strategy';
import type { UserRole } from '@podocare/shared-types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{ user?: JwtAccessPayload }>();
    const user = req.user;
    if (!user?.role) {
      return false;
    }
    return roles.includes(user.role);
  }
}
