import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { badRequest, notFound } from "../../common/errors";
import { CreateGradeTariffDto } from "./dto/create-grade-tariff.dto";
import { CreateMoistureRuleDto } from "./dto/create-moisture-rule.dto";
import { CreatePecahBonPresetDto } from "./dto/create-pecah-bon-preset.dto";
import { GradeTariffQueryDto } from "./dto/grade-tariff-query.dto";
import { MoistureRuleQueryDto } from "./dto/moisture-rule-query.dto";

@Injectable()
export class RulesService {
  constructor(private readonly prisma: PrismaService) { }

  async createGradeTariff(dto: CreateGradeTariffDto) {
    const grade = await this.prisma.grade.findUnique({
      where: { id: dto.gradeId },
    });

    if (!grade) {
      return notFound("Grade not found", { gradeId: dto.gradeId });
    }

    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (effectiveTo && effectiveTo <= effectiveFrom) {
      return badRequest("effectiveTo must be after effectiveFrom");
    }

    return this.prisma.gradeTariff.create({
      data: {
        gradeId: dto.gradeId,
        rateRpPerGram: dto.rateRpPerGram,
        effectiveFrom,
        effectiveTo,
      },
    });
  }

  async findGradeTariffs(query: GradeTariffQueryDto) {
    const at = query.at ? new Date(query.at) : null;

    return this.prisma.gradeTariff.findMany({
      where: {
        gradeId: query.gradeId,
        ...(at
          ? {
            effectiveFrom: { lte: at },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
          }
          : undefined),
      },
      orderBy: { effectiveFrom: "desc" },
    });
  }

  async createMoistureRule(dto: CreateMoistureRuleDto) {
    if (dto.gradeId) {
      const grade = await this.prisma.grade.findUnique({
        where: { id: dto.gradeId },
      });
      if (!grade) {
        return notFound("Grade not found", { gradeId: dto.gradeId });
      }
    }

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: dto.supplierId },
      });
      if (!supplier) {
        return notFound("Supplier not found", { supplierId: dto.supplierId });
      }
    }

    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (effectiveTo && effectiveTo <= effectiveFrom) {
      return badRequest("effectiveTo must be after effectiveFrom");
    }

    return this.prisma.moistureRule.create({
      data: {
        gradeId: dto.gradeId ?? null,
        supplierId: dto.supplierId ?? null,
        moistureBps: dto.moistureBps,
        effectiveFrom,
        effectiveTo,
      },
    });
  }

  async findMoistureRules(query: MoistureRuleQueryDto) {
    const at = query.at ? new Date(query.at) : null;

    return this.prisma.moistureRule.findMany({
      where: {
        gradeId: query.gradeId,
        supplierId: query.supplierId,
        ...(at
          ? {
            effectiveFrom: { lte: at },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
          }
          : undefined),
      },
      orderBy: { effectiveFrom: "desc" },
    });
  }

  createPecahBonPreset(dto: CreatePecahBonPresetDto) {
    return this.prisma.pecahBonPreset.create({
      data: {
        name: dto.name,
        weightGram: dto.weightGram,
        isActive: dto.isActive ?? true,
      },
    });
  }

  findPecahBonPresets() {
    return this.prisma.pecahBonPreset.findMany({
      orderBy: { createdAt: "asc" },
    });
  }

  async deleteGradeTariff(id: string) {
    const existing = await this.prisma.gradeTariff.findUnique({
      where: { id },
    });

    if (!existing) {
      return notFound("Grade tariff not found", { id });
    }

    return this.prisma.gradeTariff.delete({
      where: { id },
    });
  }

  async deleteMoistureRule(id: string) {
    const existing = await this.prisma.moistureRule.findUnique({
      where: { id },
    });

    if (!existing) {
      return notFound("Moisture rule not found", { id });
    }

    return this.prisma.moistureRule.delete({
      where: { id },
    });
  }

  async deletePecahBonPreset(id: string) {
    const existing = await this.prisma.pecahBonPreset.findUnique({
      where: { id },
    });

    if (!existing) {
      return notFound("Pecah bon preset not found", { id });
    }

    return this.prisma.pecahBonPreset.delete({
      where: { id },
    });
  }
}
