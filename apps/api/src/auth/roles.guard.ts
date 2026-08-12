import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './auth.constants';
import {
  RequestAuthUser,
  getApiAccessRequirement,
  hasExplicitUiAccess,
} from './ui-access.constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as
      | (RequestAuthUser & { roles?: string[]; role?: string })
      | undefined;
    if (!user) {
      return false;
    }

    const roles = user.roles ?? (user.role ? [user.role] : []);
    const normalizedRoles = roles.map((role) => role.toLowerCase());
    if (
      requiredRoles.some((role) => normalizedRoles.includes(role.toLowerCase()))
    ) {
      return true;
    }

    const path =
      (request.raw?.url as string | undefined) ??
      (request.url as string | undefined) ??
      '';
    const method = request.method as string | undefined;
    const accessRequirement = getApiAccessRequirement(path, method);

    if (!accessRequirement) {
      return false;
    }

    return accessRequirement.anyOf.some((requirement) =>
      hasExplicitUiAccess(user, requirement.moduleKey, requirement.minLevel),
    );
  }
}
