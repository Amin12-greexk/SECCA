import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateGradeDto } from "./dto/create-grade.dto";

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateGradeDto) {
    return this.prisma.grade.create({
      data: {
        name: dto.name,
        code: dto.code,
      },
    });
  }

  findAll() {
    return this.prisma.grade.findMany({
      orderBy: { createdAt: "asc" },
    });
  }
}
