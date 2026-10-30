import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  parsePinFile,
  passwordProblem,
  pinCandidates,
  pinKey,
  verifyPassword,
} from './mitra-portal.pins';

describe('password mitra', () => {
  it('menerima password 8+ karakter berisi huruf dan angka', () => {
    expect(passwordProblem('kucing123')).toBeNull();
    expect(passwordProblem('Ab1defgh')).toBeNull();
  });

  it('menolak password pendek, tanpa angka, tanpa huruf, atau terlalu panjang', () => {
    expect(passwordProblem('abc123')).toMatch(/minimal 8/);
    expect(passwordProblem('hanyahuruf')).toMatch(/huruf dan angka/);
    expect(passwordProblem('12345678')).toMatch(/huruf dan angka/);
    expect(passwordProblem('a1'.repeat(40))).toMatch(/maksimal 72/);
  });

  it('hash bergaram: sama password beda hash, tapi tetap terverifikasi', async () => {
    const a = await hashPassword('kucing123');
    const b = await hashPassword('kucing123');
    expect(a).not.toBe(b);
    expect(await verifyPassword('kucing123', a)).toBe(true);
    expect(await verifyPassword('kucing124', a)).toBe(false);
  });

  it('hash tiruan tidak pernah cocok dan tidak melempar error', async () => {
    expect(await verifyPassword('apa-saja1', DUMMY_PASSWORD_HASH)).toBe(false);
    expect(await verifyPassword('apa-saja1', 'rusak')).toBe(false);
  });
});

describe('PIN dengan nol di depan', () => {
  it('mencoba apa adanya dan tanpa nol di depan', () => {
    expect(pinCandidates('012345')).toEqual(['012345', '12345']);
    expect(pinCandidates('0012')).toEqual(['0012', '12']);
    expect(pinCandidates('123456')).toEqual(['123456']);
  });

  it('PIN "000" tidak jadi string kosong', () => {
    expect(pinCandidates('000')).toEqual(['000', '0']);
  });

  it('kunci PIN stabil per rahasia dan berbeda antar PIN', () => {
    expect(pinKey('1234', 's')).toBe(pinKey('1234', 's'));
    expect(pinKey('1234', 's')).not.toBe(pinKey('1235', 's'));
    expect(pinKey('1234', 's')).not.toBe(pinKey('1234', 't'));
  });
});

describe('parsePinFile', () => {
  const csv = (rows: string[]) =>
    Buffer.from(['Nama;PIN', ...rows].join('\n'), 'utf8');

  it('melewati semua pemilik PIN yang dobel', async () => {
    const { pins, issues } = await parsePinFile(
      csv(['SATU;1111', 'DUA;1111', 'TIGA;2222']),
      'pin.csv',
    );
    expect(pins.map((p) => p.name)).toEqual(['TIGA']);
    expect(issues.filter((i) => i.row === 'PIN dobel')).toHaveLength(2);
  });
});
