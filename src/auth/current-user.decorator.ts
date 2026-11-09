import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtUser } from './auth.guard.js';

// @CurrentUser() in a controller method = "the logged-in user" (set by AuthGuard).
// Works like @Body(), but reads the token's user instead of the request body.
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): JwtUser => {
  return context.switchToHttp().getRequest<{ user: JwtUser }>().user;
});
