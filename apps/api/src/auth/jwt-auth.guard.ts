import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './auth.constants';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization as string | undefined;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : undefined;

    // Endpoint @Public tetap dilewatkan TANPA token, tapi kalau tokennya ada
    // dan sah, `request.user` tetap diisi. Ini yang membuat satu endpoint bisa
    // publik sekaligus tahu pemanggilnya siapa — dipakai dashboard performa:
    // grafik kapasitas terbuka untuk umum, sementara kolom upah dan PIN hanya
    // ikut terkirim kalau ada yang login. Tanpa ini, endpoint publik selalu
    // anonim sehingga satu-satunya pilihan adalah "semua terbuka" atau
    // "semua tertutup".
    if (!token) {
      return Boolean(isPublic);
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      const appUser = await this.prisma.appUser.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          role: true,
          useCustomUiAccess: true,
          uiAccesses: {
            select: {
              moduleKey: true,
              level: true,
            },
          },
        },
      });

      if (!appUser) {
        return Boolean(isPublic);
      }

      request.user = {
        ...payload,
        sub: appUser.id,
        role: appUser.role.toLowerCase(),
        useCustomUiAccess: appUser.useCustomUiAccess,
        uiAccesses: appUser.uiAccesses,
      };
      return true;
    } catch {
      // Token kedaluwarsa/rusak: route publik tetap boleh diakses sebagai anonim.
      return Boolean(isPublic);
    }
  }
}
