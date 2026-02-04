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
        type: dto.type,
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
        type: dto.type,
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

    const [
      tariffCount,
      stockCount,
      lotCount,
      payrollCount,
      pecahBonCount,
      moistureRuleCount,
    ] = await Promise.all([
      this.prisma.gradeTariff.count({
        where: {
          OR: [
            { shapeGradeId: id },
            { featherGradeId: id },
            { colorGradeId: id },
          ],
        },
      }),
      this.prisma.rawBatchGradeStock.count({ where: { gradeId: id } }),
      this.prisma.productionLot.count({
        where: {
          OR: [
            { gradeId: id },
            { featherGradeId: id },
            { colorGradeId: id },
          ],
        },
      }),
      this.prisma.payrollEntry.count({ where: { gradeId: id } }),
      this.prisma.pecahBonEntry.count({
        where: {
          OR: [
            { gradeId: id },
            { featherGradeId: id },
            { colorGradeId: id },
          ],
        },
      }),
      this.prisma.moistureRule.count({ where: { gradeId: id } }),
    ]);

    if (tariffCount > 0) {
      return conflict(
        "Grade sudah memiliki tarif. Tidak bisa dihapus, hubungi pengawas.",
        { gradeId: id },
      );
    }

    const usageCount =
      stockCount + lotCount + payrollCount + pecahBonCount + moistureRuleCount;
    if (usageCount > 0) {
      return conflict(
        "Grade sudah dipakai di transaksi (pecah bon/stock/lot/payroll) dan tidak bisa dihapus.",
        { gradeId: id },
      );
    }

    try {
      return await this.prisma.grade.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2003") {
          return conflict("Grade sedang dipakai dan tidak bisa dihapus", {
            gradeId: id,
          });
        }
      }
      throw error;
    }
  }
}
