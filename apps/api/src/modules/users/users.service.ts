import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { createHash } from "crypto";
import { CreateUserDto } from "./dto/create-user.dto";

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
}
