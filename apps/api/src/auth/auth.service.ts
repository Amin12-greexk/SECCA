import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash } from "crypto";
import { Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { conflict, unprocessable } from "../common/errors";
import { RegisterMitraDto } from "./dto/register-mitra.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.appUser.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        worker: {
          select: { pin: true },
        },
        uiAccesses: {
          select: {
            moduleKey: true,
            level: true,
          },
          orderBy: { moduleKey: "asc" },
        },
      },
    });

    if (!user) {
      return unprocessable("Invalid email or password");
    }

    const passwordHash = this.hashPassword(password);
    if (passwordHash !== user.passwordHash) {
      return unprocessable("Invalid email or password");
    }

    return this.buildAuthResponse(user);
  }

  async registerMitra(dto: RegisterMitraDto) {
    const pin = this.normalizePin(dto.pinKaryawan);
    const phone = this.normalizePhone(dto.phone);
    const email = dto.email.trim().toLowerCase();
    const name = dto.name.trim();

    if (!pin || pin.length < 3 || pin.length > 6) {
      return unprocessable("PIN harus 3-6 digit angka");
    }

    const [emailOwner, phoneOwner] = await Promise.all([
      this.prisma.appUser.findUnique({
        where: { email },
        select: { id: true },
      }),
      this.prisma.appUser.findUnique({
        where: { phone },
        select: { id: true },
      }),
    ]);

    if (emailOwner) {
      return conflict("Email sudah terdaftar");
    }

    if (phoneOwner) {
      return conflict("Nomor WhatsApp sudah terdaftar");
    }

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const workerByPin = await tx.worker.findUnique({
          where: { pin },
          include: { user: true },
        });

        if (workerByPin?.user) {
          return conflict("PIN ini sudah digunakan untuk mendaftar");
        }

        const worker =
          workerByPin ??
          (await tx.worker.create({
            data: {
              name,
              pin,
            },
          }));

        return tx.appUser.create({
          data: {
            name,
            email,
            phone,
            passwordHash: this.hashPassword(dto.password),
            role: UserRole.MITRA,
            workerId: worker.id,
          },
          include: {
            worker: {
              select: { pin: true },
            },
            uiAccesses: {
              select: {
                moduleKey: true,
                level: true,
              },
              orderBy: { moduleKey: "asc" },
            },
          },
        });
      });
      return this.buildAuthResponse(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = Array.isArray(error.meta?.target)
          ? error.meta?.target.join(",")
          : String(error.meta?.target ?? "");
        if (target.includes("email")) {
          return conflict("Email sudah terdaftar");
        }
        if (target.includes("phone")) {
          return conflict("Nomor WhatsApp sudah terdaftar");
        }
        if (target.includes("workerId")) {
          return conflict("PIN ini sudah digunakan untuk mendaftar");
        }
        if (target.includes("pin")) {
          return conflict("PIN ini sudah digunakan untuk mendaftar");
        }
        return conflict("Data pendaftaran sudah digunakan");
      }
      throw error;
    }
  }

  async profile(userId: string) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      include: {
        worker: {
          select: { pin: true },
        },
        uiAccesses: {
          select: {
            moduleKey: true,
            level: true,
          },
          orderBy: { moduleKey: "asc" },
        },
      },
    });

    if (!user) {
      return unprocessable("User not found");
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      role: user.role.toLowerCase(),
      workerId: user.workerId ?? null,
      pin: user.worker?.pin ?? null,
      useCustomUiAccess: user.useCustomUiAccess,
      uiAccesses: user.uiAccesses,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (!userId) {
      return unprocessable("User not found");
    }

    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return unprocessable("User not found");
    }

    const currentPasswordHash = this.hashPassword(dto.currentPassword);
    if (currentPasswordHash !== user.passwordHash) {
      return unprocessable("Password saat ini tidak sesuai");
    }

    if (dto.currentPassword === dto.newPassword) {
      return unprocessable("Password baru harus berbeda dari password saat ini");
    }

    await this.prisma.appUser.update({
      where: { id: userId },
      data: {
        passwordHash: this.hashPassword(dto.newPassword),
      },
    });

    return {
      ok: true,
      message: "Password berhasil diperbarui",
    };
  }

  private buildAuthResponse(user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: UserRole;
    workerId: string | null;
    useCustomUiAccess: boolean;
    worker?: {
      pin: string | null;
    } | null;
    uiAccesses?: {
      moduleKey: string;
      level: number;
    }[];
  }) {
    const payload = {
      sub: user.id,
      role: user.role.toLowerCase(),
    };

    const token = this.jwtService.sign(payload);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone ?? null,
        role: user.role.toLowerCase(),
        workerId: user.workerId ?? null,
        pin: user.worker?.pin ?? null,
        useCustomUiAccess: user.useCustomUiAccess,
        uiAccesses: user.uiAccesses ?? [],
      },
      token,
    };
  }

  private normalizePin(pin: string) {
    return pin.replace(/\D/g, "");
  }

  private normalizePhone(phone: string) {
    const trimmed = phone.trim();
    if (trimmed.startsWith("+")) {
      const normalized = `+${trimmed
        .slice(1)
        .replace(/\D/g, "")}`;
      return normalized;
    }
    return trimmed.replace(/\D/g, "");
  }

  private hashPassword(password: string) {
    return createHash("sha256").update(password).digest("hex");
  }
}
