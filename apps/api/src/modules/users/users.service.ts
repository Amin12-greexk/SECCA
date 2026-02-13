import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private hashPassword(password: string) {
    return createHash("sha256").update(password).digest("hex");
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.appUser.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new BadRequestException("Email sudah terdaftar");
    }

    const user = await this.prisma.appUser.create({
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        passwordHash: this.hashPassword(dto.password),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }

  async findAll() {
    return this.prisma.appUser.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
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

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.password) data.passwordHash = this.hashPassword(dto.password);

    const user = await this.prisma.appUser.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }
}
