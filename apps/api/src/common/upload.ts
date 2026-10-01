import type { FastifyRequest } from 'fastify';
import { badRequest } from './errors';

/**
 * Batas ukuran upload workbook Excel (dashboard performa & audit bulanan).
 *
 * Dulu 10 MB, tapi workbook mingguan yang sudah berjalan beberapa bulan —
 * 20+ sheet DATA PERIODE/REKAP PAYROLL beserta sheet bantunya — sudah
 * menembus 13 MB. Dipakai juga oleh registrasi @fastify/multipart di main.ts:
 * batas global di sana harus >= batas per-request ini, kalau tidak batas
 * global yang lebih kecil yang menang.
 */
export const MAX_EXCEL_UPLOAD_BYTES = 50 * 1024 * 1024;

const MAX_MB = Math.round(MAX_EXCEL_UPLOAD_BYTES / (1024 * 1024));

/**
 * Ambil file Excel dari request multipart (field 'file') sebagai Buffer.
 *
 * `toBuffer()` melempar RequestFileTooLargeError bawaan @fastify/multipart
 * ("request file too large") begitu batas terlewati — sebelum pemeriksaan
 * `truncated` sempat jalan — jadi pesan berbahasa Indonesia di bawah dulu
 * tidak pernah sampai ke pengguna. Ditangkap di sini supaya pesannya jelas.
 */
export async function readExcelUpload(
  request: FastifyRequest,
): Promise<{ buffer: Buffer; fileName: string }> {
  if (!request.isMultipart()) {
    badRequest("Request harus multipart/form-data dengan field 'file'.");
  }

  const file = await request.file({
    limits: { fileSize: MAX_EXCEL_UPLOAD_BYTES },
  });
  if (!file) {
    return badRequest(
      "File tidak ditemukan. Kirim file Excel di field 'file'.",
    );
  }

  let buffer: Buffer;
  try {
    buffer = await file.toBuffer();
  } catch (error) {
    if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
      return badRequest(`Ukuran file melebihi ${MAX_MB} MB.`);
    }
    throw error;
  }

  if (file.file.truncated) {
    badRequest(`Ukuran file melebihi ${MAX_MB} MB.`);
  }
  if (buffer.length === 0) {
    badRequest('File kosong. Upload file Excel yang berisi data.');
  }

  return { buffer, fileName: file.filename };
}
