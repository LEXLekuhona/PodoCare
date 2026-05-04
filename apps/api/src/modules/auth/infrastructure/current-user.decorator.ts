import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { JwtAccessPayload } from './jwt.strategy';

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): JwtAccessPayload => {
  const req = ctx.switchToHttp().getRequest<{ user?: JwtAccessPayload }>();
  return req.user as JwtAccessPayload;
});

