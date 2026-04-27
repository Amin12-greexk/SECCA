import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UiAccessEntryDto } from "./dto/ui-access-entry.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private hashPassword(password: string) {
    return createHash("sha256").update(password).digest("hex");
  }

  private normalizeUiAccesses(uiAccesses: UiAccessEntryDto[] | undefined) {
    if (!uiAccesses) {
      return undefined;
    }

    const byModule = new Map<string, number>();
    for (const item of uiAccesses) {
      const moduleKey = item.moduleKey.trim();
      if (!moduleKey || item.level <= 0) {
        continue;
      }

      byModule.set(moduleKey, Math.max(byModule.get(moduleKey) ?? 0, item.level));
    }

    return Array.from(byModule.entries())
      .map(([moduleKey, level]) => ({ moduleKey, level }))
      .sort((left, right) => left.moduleKey.localeCompare(right.moduleKey));
  }

  private selectUser() {
    return {
      id: true,
      name: true,
      email: true,
      role: true,
      workerId: true,
      useCustomUiAccess: true,
      createdAt: true,
      uiAccesses: {
        select: {
          moduleKey: true,
          level: true,
        },
        orderBy: {
          moduleKey: "asc" as const,
        },
      },
    };
  }

  private serializeUser<T extends {
    role: string;
    uiAccesses?: { moduleKey: string; level: number }[];
  }>(user: T) {
    return {
      ...user,
      role: user.role.toLowerCase(),
      uiAccesses: user.uiAccesses ?? [],
    };
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.appUser.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new BadRequestException("Email sudah terdaftar");
    }

    if (dto.workerId) {
      const worker = await this.prisma.worker.findUnique({
        where: { id: dto.workerId },
        select: { id: true },
      });
      if (!worker) {
        throw new BadRequestException("Worker tidak ditemukan");
      }
      const workerOwner = await this.prisma.appUser.findFirst({
        where: { workerId: dto.workerId },
        select: { id: true },
      });
      if (workerOwner) {
        throw new BadRequestException("Worker sudah terhubung ke akun lain");
      }
    }

    const normalizedUiAccesses = this.normalizeUiAccesses(dto.uiAccesses);

    const user = await this.prisma.appUser.create({
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        passwordHash: this.hashPassword(dto.password),
        workerId: dto.workerId ?? null,
        useCustomUiAccess: dto.useCustomUiAccess ?? false,
        uiAccesses: normalizedUiAccesses
          ? {
              create: normalizedUiAccesses.map((item) => ({
                moduleKey: item.moduleKey,
                level: item.level,
              })),
            }
          : undefined,
      },
      select: this.selectUser(),
    });

    return this.serializeUser(user);
  }

  async findAll() {
    const users = await this.prisma.appUser.findMany({
      orderBy: { createdAt: "desc" },
      select: this.selectUser(),
    });

    return users.map((user) => this.serializeUser(user));
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.appUser.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new BadRequestException("Akun tidak ditemukan");
    }

    if (dto.email) {
      const emailOwner = await this.prisma.appUser.findUnique({
        where: { email: dto.email },
        select: { id: true },
      });

      if (emailOwner && emailOwner.id !== id) {
        throw new BadRequestException("Email sudah terdaftar");
      }
    }

    const data: Prisma.AppUserUpdateInput = {};
    const normalizedUiAccesses = this.normalizeUiAccesses(dto.uiAccesses);

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.password) data.passwordHash = this.hashPassword(dto.password);
    if (dto.useCustomUiAccess !== undefined) {
      data.useCustomUiAccess = dto.useCustomUiAccess;
    }
    if (dto.workerId !== undefined) {
      if (dto.workerId) {
        const worker = await this.prisma.worker.findUnique({
          where: { id: dto.workerId },
          select: { id: true },
        });
        if (!worker) {
          throw new BadRequestException("Worker tidak ditemukan");
        }
        const workerOwner = await this.prisma.appUser.findFirst({
          where: { workerId: dto.workerId },
          select: { id: true },
        });
        if (workerOwner && workerOwner.id !== id) {
          throw new BadRequestException("Worker sudah terhubung ke akun lain");
        }
        data.worker = { connect: { id: dto.workerId } };
      } else {
        data.worker = { disconnect: true };
      }
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.appUser.update({
        where: { id },
        data,
      });

      if (normalizedUiAccesses !== undefined) {
        await tx.userUiAccess.deleteMany({
          where: { userId: id },
        });

        if (normalizedUiAccesses.length > 0) {
          await tx.userUiAccess.createMany({
            data: normalizedUiAccesses.map((item) => ({
              userId: id,
              moduleKey: item.moduleKey,
              level: item.level,
            })),
          });
        }
      }

      return tx.appUser.findUniqueOrThrow({
        where: { id: updatedUser.id },
        select: this.selectUser(),
      });
    });

    return this.serializeUser(user);
  }
}
