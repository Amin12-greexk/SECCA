import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { badRequest, throwHttpError, unprocessable } from "../../common/errors";
import { QueryAttendanceDto } from "./dto/query-attendance.dto";

type AttendanceRecord = {
  date: string | null;
  checkIn: string | null;
  checkOut: string | null;
  status: string | null;
  note: string | null;
  raw: Record<string, unknown>;
};

type AttendanceApiConfig = {
  apiUrl: string;
  apiToken: string | null;
};

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyAttendance(userId: string, query: QueryAttendanceDto) {
    if (!userId) {
      return unprocessable("User not found");
    }

    if (query.from && query.to && query.from > query.to) {
      return badRequest("Parameter tanggal tidak valid: from harus <= to", {
        from: query.from,
        to: query.to,
      });
    }

    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        workerId: true,
        worker: {
          select: {
            id: true,
            pin: true,
          },
        },
      },
    });

    if (!user?.workerId || !user.worker?.pin) {
      return unprocessable("Akun mitra belum memiliki PIN absensi");
    }

    const payload = await this.fetchAttendanceByPin(user.worker.pin, query);
    const sourceRecords = this.extractRecords(payload);
    const records = this.toAttendanceRecords(sourceRecords, query);

    const presentDays = records.filter((record) => this.isPresent(record)).length;
    const absentDays = Math.max(0, records.length - presentDays);

    return {
      workerId: user.worker.id,
      pin: user.worker.pin,
      range: {
        from: query.from ?? null,
        to: query.to ?? null,
      },
      summary: {
        totalRecords: records.length,
        presentDays,
        absentDays,
        estimatedPremiumBaseDays: presentDays,
      },
      items: records,
    };
  }

  private async fetchAttendanceByPin(pin: string, query: QueryAttendanceDto) {
    const { apiUrl, apiToken } = this.resolveApiConfig();

    let endpoint: URL;
    try {
      endpoint = new URL(apiUrl);
    } catch {
      return badRequest("ABSEN_API_URL tidak valid", { value: apiUrl });
    }

    endpoint.searchParams.set("pin", pin);
    if (query.from) endpoint.searchParams.set("from", query.from);
    if (query.to) endpoint.searchParams.set("to", query.to);
    if (apiToken) {
      endpoint.searchParams.set("token", apiToken);
    }

    const timeoutMs = this.getTimeoutMs();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(apiToken
            ? {
                Authorization: `Bearer ${apiToken}`,
                "X-API-TOKEN": apiToken,
              }
            : {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        throwHttpError(
          HttpStatus.BAD_GATEWAY,
          "INTERNAL_ERROR",
          "Gagal mengambil data absensi dari server SPL",
          {
            status: response.status,
            statusText: response.statusText,
            response: bodyText.slice(0, 500),
          },
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("application/json")) {
        const bodyText = await response.text().catch(() => "");
        throwHttpError(
          HttpStatus.BAD_GATEWAY,
          "INTERNAL_ERROR",
          "Respons absensi bukan JSON",
          { response: bodyText.slice(0, 500) },
        );
      }

      const payload = await response.json();
      this.validateExternalPayload(payload);
      return payload;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throwHttpError(
          HttpStatus.GATEWAY_TIMEOUT,
          "INTERNAL_ERROR",
          "Timeout saat mengambil data absensi",
          { timeoutMs },
        );
      }
      throwHttpError(
        HttpStatus.BAD_GATEWAY,
        "INTERNAL_ERROR",
        "Koneksi ke server absensi gagal",
        {
          message: error instanceof Error ? error.message : String(error),
        },
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private resolveApiConfig(): AttendanceApiConfig {
    const apiUrl = this.pickEnv([
      "ABSEN_API_URL",
      "ATTENDANCE_API_URL",
      "ABSENSI_API_URL",
    ]);
    const apiToken = this.pickEnv([
      "ABSEN_API_TOKEN",
      "ATTENDANCE_API_TOKEN",
      "ABSENSI_API_TOKEN",
      "ABSEN_TOKEN",
    ]);

    if (!apiUrl) {
      return unprocessable(
        "Konfigurasi absensi belum lengkap (ABSEN_API_URL)",
        {
          acceptedEnv: ["ABSEN_API_URL", "ATTENDANCE_API_URL", "ABSENSI_API_URL"],
        },
      );
    }

    return { apiUrl, apiToken };
  }

  private validateExternalPayload(payload: unknown) {
    if (!this.isRecord(payload)) return;
    const statusValue = payload.status;
    let isSuccess: boolean | null = null;
    if (typeof statusValue === "boolean") {
      isSuccess = statusValue;
    } else if (typeof statusValue === "number") {
      isSuccess = statusValue === 1;
    } else if (typeof statusValue === "string") {
      const normalized = statusValue.trim().toLowerCase();
      isSuccess = ["true", "1", "ok", "success"].includes(normalized);
    }

    if (isSuccess === null || isSuccess) return;

    const message = this.pickString(payload, ["message", "error", "remark"]);
    throwHttpError(
      HttpStatus.BAD_GATEWAY,
      "INTERNAL_ERROR",
      message || "Server absensi mengembalikan status gagal",
      { payload },
    );
  }

  private extractRecords(payload: unknown): Record<string, unknown>[] {
    if (Array.isArray(payload)) {
      return payload.filter((item): item is Record<string, unknown> =>
        this.isRecord(item),
      );
    }
    if (!this.isRecord(payload)) {
      return [];
    }

    const candidates = [
      payload.data,
      this.isRecord(payload.data) ? payload.data.data : undefined,
      payload.items,
      payload.result,
      payload.records,
      payload.absen,
      this.isRecord(payload.result) ? payload.result.data : undefined,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.filter((item): item is Record<string, unknown> =>
          this.isRecord(item),
        );
      }
    }

    return [];
  }

  private toAttendanceRecords(
    sourceRecords: Record<string, unknown>[],
    query: QueryAttendanceDto,
  ): AttendanceRecord[] {
    const hasScanDateEvents = sourceRecords.some((record) =>
      this.pickString(record, ["scan_date"]),
    );

    if (!hasScanDateEvents) {
      return sourceRecords.map((item) => this.normalizeRecord(item));
    }

    const grouped = new Map<
      string,
      {
        checkIn: string | null;
        checkOut: string | null;
        modes: string[];
        raw: Record<string, unknown>[];
      }
    >();

    sourceRecords.forEach((record) => {
      const scanDate = this.pickString(record, ["scan_date", "scanDate"]);
      if (!scanDate) return;
      const day = this.extractDay(scanDate);
      if (!day) return;

      const mode = (this.pickString(record, ["mode"]) ?? "").toLowerCase();
      const time = this.extractTime(scanDate);

      const bucket = grouped.get(day) ?? {
        checkIn: null,
        checkOut: null,
        modes: [],
        raw: [],
      };

      const modeType = this.classifyMode(mode);
      if (time && modeType === "IN") {
        bucket.checkIn =
          bucket.checkIn && bucket.checkIn < time ? bucket.checkIn : time;
      } else if (time && modeType === "OUT") {
        bucket.checkOut =
          bucket.checkOut && bucket.checkOut > time ? bucket.checkOut : time;
      }

      if (mode) {
        bucket.modes.push(mode);
      }
      bucket.raw.push(record);
      grouped.set(day, bucket);
    });

    const records = Array.from(grouped.entries())
      .filter(([date]) => this.isWithinRange(date, query.from, query.to))
      .map(([date, bucket]) => {
        const normalizedModes = Array.from(new Set(bucket.modes));
        const status =
          bucket.checkIn || bucket.checkOut
            ? "Hadir"
            : normalizedModes.length > 0
              ? normalizedModes[0]
              : null;
        const note =
          normalizedModes.length > 0
            ? normalizedModes
                .filter((mode) => !mode.includes("masuk") && !mode.includes("pulang"))
                .join(", ") || null
            : null;

        return {
          date,
          checkIn: bucket.checkIn,
          checkOut: bucket.checkOut,
          status,
          note,
          raw: {
            events: bucket.raw,
          },
        } satisfies AttendanceRecord;
      })
      .sort((left, right) => right.date!.localeCompare(left.date!));

    return records;
  }

  private classifyMode(mode: string): "IN" | "OUT" | "OTHER" {
    if (!mode) return "OTHER";
    const normalized = mode.toLowerCase();

    if (
      normalized.includes("masuk") &&
      !normalized.includes("istirahat")
    ) {
      return "IN";
    }
    if (
      normalized.includes("pulang") ||
      normalized.includes("keluar")
    ) {
      return "OUT";
    }
    return "OTHER";
  }

  private normalizeRecord(source: Record<string, unknown>): AttendanceRecord {
    const date = this.pickString(source, [
      "date",
      "tanggal",
      "attendanceDate",
      "attendance_date",
      "scan_date",
    ]);
    const checkIn = this.pickString(source, [
      "checkIn",
      "check_in",
      "jamMasuk",
      "masuk",
      "in",
      "clockIn",
      "clock_in",
    ]);
    const checkOut = this.pickString(source, [
      "checkOut",
      "check_out",
      "jamPulang",
      "pulang",
      "out",
      "clockOut",
      "clock_out",
    ]);
    const status = this.pickString(source, [
      "status",
      "keterangan",
      "remark",
      "state",
      "mode",
    ]);
    const note = this.pickString(source, ["note", "catatan", "description"]);

    return {
      date,
      checkIn,
      checkOut,
      status,
      note,
      raw: source,
    };
  }

  private isPresent(record: AttendanceRecord) {
    const status = (record.status ?? "").toLowerCase();
    const absentKeywords = [
      "alpha",
      "alpa",
      "absent",
      "izin",
      "sakit",
      "cuti",
      "libur",
    ];
    if (absentKeywords.some((keyword) => status.includes(keyword))) {
      return false;
    }
    if (
      status.includes("hadir") ||
      status.includes("present") ||
      status.includes("masuk") ||
      status.includes("pulang")
    ) {
      return true;
    }
    return Boolean(record.checkIn || record.checkOut);
  }

  private getTimeoutMs() {
    const raw = Number(process.env.ABSEN_API_TIMEOUT_MS ?? 10000);
    if (!Number.isFinite(raw)) return 10000;
    return Math.max(1000, Math.min(30000, Math.round(raw)));
  }

  private pickString(source: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim() !== "") {
        return value.trim();
      }
      if (typeof value === "number") {
        return String(value);
      }
    }
    return null;
  }

  private extractDay(scanDate: string) {
    const value = scanDate.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }

  private extractTime(scanDate: string) {
    const value = scanDate.trim();
    const match = value.match(/\b(\d{2}:\d{2}:\d{2})\b/);
    if (match?.[1]) return match[1];
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(11, 19);
  }

  private isWithinRange(date: string, from?: string, to?: string) {
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private pickEnv(names: string[]) {
    for (const name of names) {
      const value = process.env[name]?.trim();
      if (value) {
        return value;
      }
    }
    return null;
  }
}
