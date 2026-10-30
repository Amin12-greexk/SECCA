import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { Workbook } from 'exceljs';
import { normalizePersonName } from '../audit-dashboard/audit-dashboard.parser';

/** PIN perusahaan: angka 3–6 digit (diberi sedikit kelonggaran sampai 8). */
const PIN_PATTERN = /^\d{3,8}$/;

export type ParsedPin = {
  name: string;
  normalizedName: string;
  aliases: string[];
  pin: string;
};

export type PinFileIssue = { row: string; name: string; reason: string };

export type ParsedPinFile = { pins: ParsedPin[]; issues: PinFileIssue[] };

const normalizeHeader = (raw: string) =>
  raw.trim().replace(/\s+/g, ' ').toLowerCase();

const NAME_HEADERS = [
  'nama',
  'nama lengkap',
  'nama mitra',
  'nama pekerja',
  'name',
];
const PIN_HEADERS = ['pin', 'pin pekerja', 'user id', 'userid', 'kode pin'];
const ALIAS_HEADERS = ['alias', 'nama lain', 'nama di excel', 'nama excel'];

/**
 * Sheet yang dibaca dari file PIN perusahaan: mitra borongan, bulanan, dan
 * anak harian (Cleaning Service, QC, Trainer, dst — mereka hanya melihat
 * riwayat gaji). File tanpa sheet bernama begini (mis. .csv atau daftar satu
 * sheet) dibaca sheet pertamanya.
 */
const MITRA_SHEET = /^(borong|borongan|bulanan|harian)$/i;

type Sheet = { name: string; grid: string[][] };

/**
 * Baca file PIN dari perusahaan (.xlsx atau .csv). Cukup kolom "Nama" dan
 * "PIN"; kolom lain (no. rekening, upah, dst) diabaikan dan tidak disimpan.
 * Kolom "Nama Lain" opsional untuk nama berbeda di Excel performa (pisahkan
 * dengan ; atau ,). Header boleh di baris mana saja dalam 10 baris pertama.
 */
export async function parsePinFile(
  buffer: Buffer,
  fileName: string,
): Promise<ParsedPinFile> {
  const sheets: Sheet[] = /\.csv$/i.test(fileName)
    ? [{ name: 'CSV', grid: readCsv(buffer) }]
    : await readXlsx(buffer);
  const mitraSheets = sheets.filter((sheet) =>
    MITRA_SHEET.test(sheet.name.trim()),
  );
  const selected = mitraSheets.length > 0 ? mitraSheets : sheets.slice(0, 1);

  const pins: ParsedPin[] = [];
  const issues: PinFileIssue[] = [];
  const seen = new Map<string, ParsedPin>();
  let anyHeader = false;

  for (const sheet of selected) {
    const prefix = selected.length > 1 ? `${sheet.name} ` : '';
    const header = findHeader(sheet.grid);
    if (!header) continue;
    anyHeader = true;

    for (let r = header.index + 1; r < sheet.grid.length; r++) {
      const cells = sheet.grid[r];
      const name = (cells[header.nameCol] ?? '').trim().replace(/\s+/g, ' ');
      const pin = (cells[header.pinCol] ?? '').trim().replace(/\.0+$/, '');
      if (!name && !pin) continue;
      const row = `${prefix}baris ${r + 1}`;

      if (!name) {
        issues.push({ row, name: '', reason: 'Nama kosong' });
        continue;
      }
      if (!PIN_PATTERN.test(pin)) {
        issues.push({
          row,
          name,
          reason: pin ? `PIN "${pin}" bukan angka 3–6 digit` : 'PIN kosong',
        });
        continue;
      }

      const normalizedName = normalizePersonName(name);
      const existing = seen.get(normalizedName);
      if (existing) {
        // Orang yang sama tercatat di BORONG dan BULANAN dengan PIN sama
        // itu wajar (pindah skema); PIN berbeda tidak bisa diputuskan.
        if (existing.pin !== pin) {
          issues.push({
            row,
            name,
            reason: `Nama dobel dengan PIN berbeda — dipakai PIN pertama`,
          });
        }
        continue;
      }

      const aliases =
        header.aliasCol === -1
          ? []
          : (cells[header.aliasCol] ?? '')
              .split(/[;,]/)
              .map((alias) => normalizePersonName(alias))
              .filter((alias) => alias && alias !== normalizedName);

      const parsed = { name, normalizedName, aliases, pin };
      seen.set(normalizedName, parsed);
      pins.push(parsed);
    }
  }

  if (!anyHeader) {
    throw new Error(
      'Kolom "Nama" dan "PIN" tidak ditemukan. Pastikan baris judul berisi Nama dan PIN.',
    );
  }

  // Login hanya dengan PIN: PIN yang dipakai >1 orang tidak bisa menentukan
  // siapa yang masuk, jadi semua pemiliknya dilewati sampai filenya diperbaiki.
  const byPin = new Map<string, ParsedPin[]>();
  for (const p of pins) byPin.set(p.pin, [...(byPin.get(p.pin) ?? []), p]);
  const clashing = new Set<ParsedPin>();
  for (const group of byPin.values()) {
    if (group.length < 2) continue;
    for (const p of group) {
      clashing.add(p);
      const others = group.filter((o) => o !== p).map((o) => o.name);
      issues.push({
        row: 'PIN dobel',
        name: p.name,
        reason: `PIN sama dengan ${others.join(', ')} — tidak bisa dipakai masuk`,
      });
    }
  }
  return { pins: pins.filter((p) => !clashing.has(p)), issues };
}

function findHeader(grid: string[][]) {
  for (let r = 0; r < Math.min(grid.length, 10); r++) {
    const headers = (grid[r] ?? []).map((cell) => normalizeHeader(cell ?? ''));
    const nameCol = headers.findIndex((h) => NAME_HEADERS.includes(h));
    const pinCol = headers.findIndex((h) => PIN_HEADERS.includes(h));
    if (nameCol !== -1 && pinCol !== -1) {
      return {
        index: r,
        nameCol,
        pinCol,
        aliasCol: headers.findIndex((h) => ALIAS_HEADERS.includes(h)),
      };
    }
  }
  return null;
}

async function readXlsx(buffer: Buffer): Promise<Sheet[]> {
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new Error('File tidak bisa dibaca. Gunakan format .xlsx atau .csv.');
  }

  return workbook.worksheets
    .filter((ws) => ws.state === 'visible')
    .map((sheet) => {
      const grid: string[][] = [];
      sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          // `text` = teks yang tampil di Excel, jadi PIN berformat "0123"
          // tetap punya nol di depan (nilai mentahnya angka 123).
          cells[col - 1] = cell.text ?? '';
        });
        grid[rowNumber - 1] = cells;
      });
      return {
        name: sheet.name,
        grid: Array.from(grid, (cells) => cells ?? []),
      };
    });
}

function readCsv(buffer: Buffer): string[][] {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/);
  const delimiter =
    (lines[0]?.split(';').length ?? 0) > (lines[0]?.split(',').length ?? 0)
      ? ';'
      : ',';
  return lines.map((line) =>
    line.split(delimiter).map((cell) => cell.trim().replace(/^"(.*)"$/, '$1')),
  );
}

/* ── Kunci PIN ────────────────────────────────────────────────── */

/**
 * Login cukup PIN, jadi PIN harus bisa dicari langsung (hash bergaram tidak
 * bisa). HMAC dengan rahasia server: isi database saja tidak cukup untuk
 * menebak PIN tanpa rahasianya. Rahasia berubah = semua PIN perlu di-upload
 * ulang.
 */
export function pinKey(pin: string, secret: string): string {
  return createHmac('sha256', secret).update(pin).digest('hex');
}

/**
 * PIN di file perusahaan disimpan Excel sebagai angka, jadi nol di depan
 * ("012345") sudah hilang di sumbernya ("12345"). Mitra yang mengetik dengan
 * nol tetap harus bisa masuk: dicoba apa adanya dan tanpa nol di depan.
 */
export function pinCandidates(pin: string): string[] {
  const stripped = pin.replace(/^0+(?=\d)/, '');
  return stripped === pin ? [pin] : [pin, stripped];
}

/* ── Password mitra ───────────────────────────────────────────── */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

/** Alasan password ditolak, atau null kalau boleh. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) {
    return `Password minimal ${PASSWORD_MIN} karakter.`;
  }
  if (password.length > PASSWORD_MAX) {
    return `Password maksimal ${PASSWORD_MAX} karakter.`;
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password harus berisi huruf dan angka.';
  }
  return null;
}

// Password jarang dipakai (sekali per login), jadi biaya scrypt standar Node
// (N=16384) tidak masalah — beda dengan ratusan PIN yang di-hash sekaligus.
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_SCRYPT = { N: 16384, r: 8, p: 1 };

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      PASSWORD_KEY_LENGTH,
      PASSWORD_SCRYPT,
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(':');
  if (!saltHex || !keyHex) return false;
  const key = await scryptAsync(password, Buffer.from(saltHex, 'hex'));
  const expected = Buffer.from(keyHex, 'hex');
  return expected.length === key.length && timingSafeEqual(expected, key);
}

/** Hash tiruan: menyamakan waktu respons saat nama tidak terdaftar. */
export const DUMMY_PASSWORD_HASH = `${'0'.repeat(32)}:${'0'.repeat(PASSWORD_KEY_LENGTH * 2)}`;
