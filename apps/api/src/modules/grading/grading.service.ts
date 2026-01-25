import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { badRequest, conflict, notFound } from "../../common/errors";
import { GradeRawBatchDto } from "./dto/grade-raw-batch.dto";

@Injectable()
export class GradingService {
  constructor(private readonly prisma: PrismaService) {}

  async grade(rawBatchId: string, dto: GradeRawBatchDto) {
    const rawBatch = await this.prisma.rawBatch.findUnique({
      where: { id: rawBatchId },
      include: { gradeStocks: true },
    });

    if (!rawBatch) {
      return notFound("Raw batch not found", { rawBatchId });
    }

    if (rawBatch.gradeStocks.length > 0) {
      return conflict("Raw batch already graded", { rawBatchId });
    }

    const total = dto.items.reduce((sum, item) => sum + item.wetWeightGram, 0);
    if (total > rawBatch.wetWeightGram) {
      return badRequest("Total grading weight exceeds raw batch weight", {
        total,
        rawBatchWeight: rawBatch.wetWeightGram,
      });
    }

    const gradeIdsSet = new Set(dto.items.map((item) => item.gradeId));
    if (gradeIdsSet.size !== dto.items.length) {
      return badRequest("Duplicate gradeId in items");
    }

    const gradeIds = Array.from(gradeIdsSet);
    const grades = await this.prisma.grade.findMany({
      where: { id: { in: gradeIds } },
    });

    if (grades.length !== gradeIds.length) {
      return badRequest("One or more grades not found", {
        missing: gradeIds.filter((id) => !grades.find((g) => g.id === id)),
      });
    }

    await this.prisma.rawBatchGradeStock.createMany({
      data: dto.items.map((item) => ({
        rawBatchId,
        gradeId: item.gradeId,
        wetWeightGram: item.wetWeightGram,
        remainingWetWeightGram: item.wetWeightGram,
      })),
    });

    const gradedStocks = await this.prisma.rawBatchGradeStock.findMany({
      where: { rawBatchId },
      orderBy: { createdAt: "asc" },
    });

    return {
      rawBatchId,
      gradedStocks: gradedStocks.map((stock) => ({
        gradedStockId: stock.id,
        gradeId: stock.gradeId,
        wetWeightGram: stock.wetWeightGram,
        remainingWetWeightGram: stock.remainingWetWeightGram,
      })),
    };
  }
}
