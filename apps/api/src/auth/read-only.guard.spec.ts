import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ReadOnlyGuard } from './read-only.guard';

function contextFor(request: {
  method: string;
  url: string;
  user?: { readOnly?: boolean };
}): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('ReadOnlyGuard', () => {
  const guard = new ReadOnlyGuard();
  const readOnly = { readOnly: true };

  it.each(['GET', 'HEAD', 'OPTIONS'])('akun hanya-lihat boleh %s', (method) => {
    expect(
      guard.canActivate(
        contextFor({ method, url: '/api/stock', user: readOnly }),
      ),
    ).toBe(true);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'akun hanya-lihat ditolak %s',
    (method) => {
      expect(() =>
        guard.canActivate(
          contextFor({ method, url: '/api/baku/receive', user: readOnly }),
        ),
      ).toThrow(ForbiddenException);
    },
  );

  it('tetap boleh logout dan ganti password sendiri', () => {
    for (const url of ['/api/auth/logout', '/api/auth/change-password?x=1']) {
      expect(
        guard.canActivate(contextFor({ method: 'POST', url, user: readOnly })),
      ).toBe(true);
    }
  });

  it('endpoint lain di bawah /api/auth tidak ikut dikecualikan', () => {
    expect(() =>
      guard.canActivate(
        contextFor({
          method: 'POST',
          url: '/api/auth/change-password/../users',
          user: readOnly,
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('akun biasa dan pengunjung tanpa login tidak terpengaruh', () => {
    expect(
      guard.canActivate(
        contextFor({ method: 'POST', url: '/api/baku/receive', user: {} }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(contextFor({ method: 'POST', url: '/api/auth/login' })),
    ).toBe(true);
  });
});
