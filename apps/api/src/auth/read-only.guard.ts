import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  RequestAuthUser,
  normalizeApiRequestPath,
} from './ui-access.constants';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Satu-satunya aksi tulis yang tetap boleh untuk akun hanya-lihat. */
const ALLOWED_WRITES = [/^\/api\/auth\/(logout|change-password)\/?$/i];

export const READ_ONLY_MESSAGE =
  'Akun ini hanya bisa melihat data. Menambah, mengubah, dan menghapus dikunci.';

/**
 * Akun `readOnly` hanya boleh membaca. Dipasang sekali untuk seluruh API
 * (setelah JwtAuthGuard mengisi request.user) sehingga endpoint baru otomatis
 * ikut terkunci — tidak perlu menandai satu per satu. Semua aksi tambah/ubah/
 * hapus di API memakai POST/PUT/PATCH/DELETE.
 */
@Injectable()
export class ReadOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: RequestAuthUser;
      method?: string;
      url?: string;
      raw?: { url?: string };
    }>();
    if (!request.user?.readOnly) return true;

    const method = (request.method ?? '').toUpperCase();
    if (SAFE_METHODS.has(method)) return true;

    const path = normalizeApiRequestPath(request.raw?.url ?? request.url);
    if (ALLOWED_WRITES.some((pattern) => pattern.test(path))) return true;

    throw new ForbiddenException(READ_ONLY_MESSAGE);
  }
}
