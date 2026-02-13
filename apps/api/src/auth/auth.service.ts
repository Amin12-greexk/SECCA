import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { unprocessable } from "../common/errors";

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.appUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return unprocessable("Invalid email or password");
    }

    const passwordHash = this.hashPassword(password);
    if (passwordHash !== user.passwordHash) {
      return unprocessable("Invalid email or password");
    }

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
        role: user.role.toLowerCase(),
        workerId: user.workerId ?? null,
      },
      token,
    };
  }

  async profile(userId: string) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return unprocessable("User not found");
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.toLowerCase(),
      workerId: user.workerId ?? null,
    };
  }

  private hashPassword(password: string) {
    return createHash("sha256").update(password).digest("hex");
  }
}
