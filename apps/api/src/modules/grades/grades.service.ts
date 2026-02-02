import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { conflict, notFound } from "../../common/errors";
import { CreateGradeDto } from "./dto/create-grade.dto";
import { UpdateGradeDto } from "./dto/update-grade.dto";

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

  async update(id: string, dto: UpdateGradeDto) {
    const existing = await this.prisma.grade.findUnique({
      where: { id },
    });

    if (!existing) {
      return notFound("Grade not found", { gradeId: id });
    }

    return this.prisma.grade.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.grade.findUnique({
      where: { id },
    });

    if (!existing) {
      return notFound("Grade not found", { gradeId: id });
    }

    try {
      return await this.prisma.grade.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2003") {
          return conflict("Grade is in use and cannot be deleted", { gradeId: id });
        }
      }
      throw error;
    }
  }
}
