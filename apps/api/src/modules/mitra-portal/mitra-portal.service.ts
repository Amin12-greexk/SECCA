import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditDashboardDataset } from '@prisma/client';
import { badRequest } from '../../common/errors';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditDashboardService } from '../audit-dashboard/audit-dashboard.service';
import { normalizePersonName } from '../audit-dashboard/audit-dashboard.parser';
import { parsePinFile, pinKey } from './mitra-portal.pins';

const TOKEN_TYPE = 'mitra-portal';
const SESSION_MINUTES = 30;

/** Salah PIN 30x dari satu perangkat/IP -> IP itu dikunci 15 menit. Login
 * hanya PIN, jadi tidak ada kunci per nama. Dibuat longgar karena HP mitra di
 * Wi-Fi pabrik bisa keluar lewat IP yang sama. */
const MAX_FAILS_PER_IP = 30;
const LOCK_MS = 15 * 60 * 1000;

type Attempt = { fails: number; lockedUntil: number; firstFailAt: number };

const LOGIN_FAILED = 'PIN salah.';

@Injectable()
export class MitraPortalService {
  /**
   * Penghitung percobaan di memori: cukup untuk satu instance API. Restart
   * API = penghitung kembali nol, yang masih bisa diterima untuk PIN
   * perusahaan (bukan kata sandi yang dipakai di tempat lain).
   */
  private readonly attempts = new Map<string, Attempt>();

  // Rahasia token sengaja beda dari token login aplikasi: token mitra tidak
  // akan pernah lolos JwtAuthGuard sebagai pengguna, jadi tidak bisa dipakai
  // membuka endpoint payroll milik manager.
  private readonly secret = `${process.env.APP_JWT_SECRET ?? 'CHANGE_ME'}::${TOKEN_TYPE}`;
  private readonly pinSecret = `${process.env.APP_JWT_SECRET ?? 'CHANGE_ME'}::mitra-pin`;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditDashboardService: AuditDashboardService,
  ) {}

  /* ── Login ─────────────────────────────────────────────────── */

  async login(rawPin: string, ip: string) {
    const pin = (rawPin ?? '').trim();
    if (!pin) badRequest('Isi PIN.');

    const ipKey = `ip:${ip}`;
    this.assertNotLocked(ipKey);

    const record = /^\d{3,8}$/.test(pin)
      ? await this.prisma.mitraPortalPin.findUnique({
          where: { pinKey: pinKey(pin, this.pinSecret) },
        })
      : null;

    if (!record) {
      this.registerFail(ipKey, MAX_FAILS_PER_IP);
      throw new UnauthorizedException(LOGIN_FAILED);
    }

    const token = await this.jwtService.signAsync(
      { typ: TOKEN_TYPE, sub: record.normalizedName },
      { secret: this.secret, expiresIn: `${SESSION_MINUTES}m` },
    );
    return {
      token,
      name: record.name,
      expiresAt: new Date(Date.now() + SESSION_MINUTES * 60_000).toISOString(),
    };
  }

  private assertNotLocked(key: string) {
    const entry = this.attempts.get(key);
    if (!entry || entry.lockedUntil <= Date.now()) return;
    const minutes = Math.ceil((entry.lockedUntil - Date.now()) / 60_000);
    throw new HttpException(
      {
        error: 'TOO_MANY_ATTEMPTS',
        message: `Terlalu banyak percobaan. Coba lagi ${minutes} menit lagi.`,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private registerFail(key: string, max: number) {
    const now = Date.now();
    const entry = this.attempts.get(key);
    // Kegagalan lama (> masa kunci) tidak ikut dihitung.
    const fresh =
      !entry || now - entry.firstFailAt > LOCK_MS
        ? { fails: 0, lockedUntil: 0, firstFailAt: now }
        : entry;
    fresh.fails += 1;
    if (fresh.fails >= max) {
      fresh.lockedUntil = now + LOCK_MS;
      fresh.fails = 0;
      fresh.firstFailAt = now;
    }
    this.attempts.set(key, fresh);

    if (this.attempts.size > 10_000) {
      for (const [k, v] of this.attempts) {
        if (v.lockedUntil < now && now - v.firstFailAt > LOCK_MS) {
          this.attempts.delete(k);
        }
      }
    }
  }

  /* ── Data milik mitra yang login ───────────────────────────── */

  async getMyData(authorization: string | undefined) {
    const normalizedName = await this.verifyToken(authorization);
    const record = await this.prisma.mitraPortalPin.findUnique({
      where: { normalizedName },
    });
    // PIN-nya sudah dihapus/diganti lewat upload baru -> sesi tidak berlaku.
    if (!record) throw new UnauthorizedException('Sesi berakhir. Masuk lagi.');

    const names = [record.normalizedName, ...record.aliases];
    const [persons, harianPersons] = await Promise.all([
      this.prisma.auditDashboardPerson.findMany({
        where: { normalizedName: { in: names } },
        select: { id: true },
      }),
      this.prisma.auditDashboardHarianPerson.findMany({
        where: { normalizedName: { in: names } },
        select: { id: true },
      }),
    ]);
    const [periods, harian] = await Promise.all([
      this.auditDashboardService.getPersonHistory(persons.map((p) => p.id)),
      this.auditDashboardService.getHarianHistory(
        harianPersons.map((p) => p.id),
      ),
    ]);

    return { name: record.name, periods, harian };
  }

  private async verifyToken(authorization: string | undefined) {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';
    try {
      const payload = await this.jwtService.verifyAsync<{
        typ?: string;
        sub?: string;
      }>(token, { secret: this.secret });
      if (payload.typ !== TOKEN_TYPE || !payload.sub) throw new Error();
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Sesi berakhir. Masuk lagi.');
    }
  }

  /* ── Kelola file PIN (manager) ─────────────────────────────── */

  async importPins(buffer: Buffer, fileName: string) {
    let parsed: Awaited<ReturnType<typeof parsePinFile>>;
    try {
      parsed = await parsePinFile(buffer, fileName);
    } catch (error) {
      return badRequest((error as Error).message);
    }
    if (parsed.pins.length === 0) {
      badRequest('Tidak ada baris Nama + PIN yang valid di file ini.', {
        issues: parsed.issues.slice(0, 50),
      });
    }

    // Nama Lain yang sudah dihubungkan manager lewat layar (linkExcelName)
    // ikut dibawa: upload ulang file PIN mingguan tidak boleh menghapusnya.
    const previous = await this.prisma.mitraPortalPin.findMany({
      select: { normalizedName: true, aliases: true },
    });
    const previousAliases = new Map(
      previous.map((p) => [p.normalizedName, p.aliases]),
    );

    const data = parsed.pins.map((p) => ({
      name: p.name,
      normalizedName: p.normalizedName,
      aliases: [
        ...new Set([
          ...(previousAliases.get(p.normalizedName) ?? []),
          ...p.aliases,
        ]),
      ],
      pinKey: pinKey(p.pin, this.pinSecret),
    }));

    // File PIN = daftar lengkap karyawan aktif: upload baru menggantikan
    // semua PIN lama (yang sudah keluar otomatis tidak bisa masuk lagi).
    await this.prisma.$transaction([
      this.prisma.mitraPortalPin.deleteMany({}),
      this.prisma.mitraPortalPin.createMany({ data }),
    ]);

    return { ...(await this.getPinStatus()), issues: parsed.issues };
  }

  /**
   * Hubungkan nama lengkap (file PIN) ke nama yang dipakai di Excel performa,
   * mis. "SITI SARIAH" -> "SARIAH". `excelName` null = lepaskan semua.
   */
  async linkExcelName(name: string, excelName: string | null) {
    const normalizedName = normalizePersonName(name ?? '');
    const record = await this.prisma.mitraPortalPin.findUnique({
      where: { normalizedName },
    });
    if (!record) return badRequest('Nama tidak ada di daftar PIN.');

    let aliases: string[] = [];
    if (excelName) {
      const alias = normalizePersonName(excelName);
      const person = (await this.loadExcelPeople()).find(
        (p) => p.normalizedName === alias,
      );
      if (!person) return badRequest('Nama tidak ditemukan di data performa.');
      const owner = await this.prisma.mitraPortalPin.findFirst({
        where: {
          normalizedName: { not: normalizedName },
          OR: [{ normalizedName: alias }, { aliases: { has: alias } }],
        },
      });
      if (owner) {
        return badRequest(`"${person.name}" sudah terhubung ke ${owner.name}.`);
      }
      aliases = [...new Set([...record.aliases, alias])];
    }

    await this.prisma.mitraPortalPin.update({
      where: { normalizedName },
      data: { aliases },
    });
    return this.getPinStatus();
  }

  /**
   * Ringkasan PIN terdaftar vs nama di Excel performa: siapa yang belum
   * punya data (nama di file PIN tidak ditemukan di Excel) beserta saran nama
   * yang mirip, plus daftar nama Excel yang belum dimiliki siapa pun untuk
   * dihubungkan manual.
   */
  async getPinStatus() {
    const [pins, persons] = await Promise.all([
      this.prisma.mitraPortalPin.findMany({ orderBy: { name: 'asc' } }),
      this.loadExcelPeople(),
    ]);
    const personNames = new Set(persons.map((p) => p.normalizedName));
    const claimed = new Set<string>();
    for (const pin of pins) {
      for (const n of [pin.normalizedName, ...pin.aliases]) claimed.add(n);
    }

    // Nama Excel yang belum dimiliki siapa pun, yang paling baru aktif dulu.
    const unclaimed = persons
      .filter((p) => !claimed.has(p.normalizedName))
      .sort((a, b) => b.lastSeen - a.lastSeen || a.name.localeCompare(b.name));

    const unmatched = pins
      .filter(
        (pin) =>
          ![pin.normalizedName, ...pin.aliases].some((n) => personNames.has(n)),
      )
      .map((pin) => ({
        name: pin.name,
        suggestions: unclaimed
          .map((p) => ({
            p,
            score: nameSimilarity(pin.normalizedName, p.normalizedName),
          }))
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score || b.p.lastSeen - a.p.lastSeen)
          .slice(0, 3)
          .map(({ p }) => p.name),
      }));

    const linked = pins
      .filter((pin) => pin.aliases.length > 0)
      .map((pin) => ({
        name: pin.name,
        excelNames: persons
          .filter((p) => pin.aliases.includes(p.normalizedName))
          .map((p) => p.name),
      }));

    return {
      total: pins.length,
      matched: pins.length - unmatched.length,
      /** PIN tersimpan sebelum login PIN-saja: belum bisa dipakai masuk. */
      needsReupload: pins.filter((p) => !p.pinKey).length,
      unmatched,
      linked,
      excelNames: unclaimed.map((p) => p.name),
      updatedAt: pins.reduce<Date | null>(
        (latest, p) => (!latest || p.updatedAt > latest ? p.updatedAt : latest),
        null,
      ),
    };
  }

  /**
   * Semua nama di Excel DATA PEMBAYARAN (yang dilihat mitra di /cek) yang
   * bisa dimiliki satu PIN: mitra (DATA PERIODE) dan anak harian (tabel harian
   * di REKAP PAYROLL), dengan periode terakhir ia muncul. Nama yang ada di
   * keduanya digabung. Excel dashboard performa sengaja tidak ikut.
   */
  private async loadExcelPeople() {
    const inPembayaran = {
      period: { dataset: AuditDashboardDataset.PEMBAYARAN },
    };
    const periodOrder = {
      where: inPembayaran,
      select: { period: { select: { sortOrder: true } } },
    };
    const [mitra, harian] = await Promise.all([
      this.prisma.auditDashboardPerson.findMany({
        where: { metrics: { some: inPembayaran } },
        select: { name: true, normalizedName: true, metrics: periodOrder },
      }),
      this.prisma.auditDashboardHarianPerson.findMany({
        where: { rows: { some: inPembayaran } },
        select: { name: true, normalizedName: true, rows: periodOrder },
      }),
    ]);

    const people = new Map<
      string,
      { name: string; normalizedName: string; lastSeen: number }
    >();
    const add = (name: string, normalizedName: string, orders: number[]) => {
      const lastSeen = Math.max(-1, ...orders);
      const existing = people.get(normalizedName);
      if (!existing || lastSeen > existing.lastSeen) {
        people.set(normalizedName, { name, normalizedName, lastSeen });
      }
    };
    for (const p of mitra) {
      add(
        p.name,
        p.normalizedName,
        p.metrics.map((m) => m.period.sortOrder),
      );
    }
    for (const p of harian) {
      add(
        p.name,
        p.normalizedName,
        p.rows.map((r) => r.period.sortOrder),
      );
    }
    return [...people.values()];
  }
}

/**
 * Skor kemiripan nama lengkap vs nama di Excel performa (0 = tidak mirip).
 * Excel sering memakai sebagian nama ("SITI SARIAH" -> "SARIAH") atau
 * ejaan sedikit beda ("AZIZAH TUTAKIYAH" vs "AZIZAHTUTOKIYAH").
 */
export function nameSimilarity(full: string, excel: string): number {
  const fullTokens = full.split(' ');
  const excelTokens = excel.split(' ');
  const a = full.replace(/[^A-Z]/g, '');
  const b = excel.replace(/[^A-Z]/g, '');
  const longest = Math.max(a.length, b.length);
  const ratio = longest > 0 ? 1 - levenshtein(a, b) / longest : 0;
  // Hampir sama persis (salah ketik/spasi) mengalahkan potongan nama umum
  // seperti "SITI" yang cocok dengan banyak orang.
  if (ratio >= 0.85) return 4;
  if (excelTokens.every((t) => fullTokens.includes(t))) return 3;
  if (ratio >= 0.75) return 2;
  // "ZAHRO" untuk "ZAHROTUN NAFISAH": awalan salah satu kata.
  if (
    excelTokens.length === 1 &&
    excelTokens[0].length >= 4 &&
    fullTokens.some((t) => t.startsWith(excelTokens[0]))
  ) {
    return 1.5;
  }
  if (fullTokens[0] === excelTokens[0] && fullTokens[0].length >= 4) return 1;
  return 0;
}

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length];
}
