import { Injectable } from "@nestjs/common";
import { GradeType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { badRequest, notFound } from "../../common/errors";
import { CreateGradeTariffDto } from "./dto/create-grade-tariff.dto";
import { CreateMoistureRuleDto } from "./dto/create-moisture-rule.dto";
import { CreatePecahBonPresetDto } from "./dto/create-pecah-bon-preset.dto";
import { GradeTariffQueryDto } from "./dto/grade-tariff-query.dto";
import { MoistureRuleQueryDto } from "./dto/moisture-rule-query.dto";

type AuditActor = { sub?: string };

@Injectable()
export class RulesService {
  constructor(private readonly prisma: PrismaService) {}

  private recordTariffAudit(input: {
    tariffType: string;
    tariffId: string;
    action: "CREATE" | "UPDATE" | "DELETE";
    previousRateRpPerGram?: number | null;
    newRateRpPerGram?: number | null;
    actor?: AuditActor;
    metadata?: Record<string, unknown>;
  }) {
    if (!input.actor?.sub) return Promise.resolve(null);
    return this.prisma.tariffAuditLog.create({
      data: {
        tariffType: input.tariffType,
        tariffId: input.tariffId,
        action: input.action,
        previousRateRpPerGram: input.previousRateRpPerGram ?? null,
        newRateRpPerGram: input.newRateRpPerGram ?? null,
        changedByUserId: input.actor.sub,
        metadata: input.metadata as any,
      },
    });
  }

  async createGradeTariff(dto: CreateGradeTariffDto, actor?: AuditActor) {
    const shapeGrade = await this.prisma.grade.findUnique({
      where: { id: dto.shapeGradeId },
    });

    if (!shapeGrade) {
      return notFound("Grade bentuk tidak ditemukan", {
        gradeId: dto.shapeGradeId,
      });
    }

    if (shapeGrade.type !== GradeType.BENTUK) {
      return badRequest("Grade bentuk tidak sesuai", {
        gradeId: dto.shapeGradeId,
        expected: GradeType.BENTUK,
        actual: shapeGrade.type,
      });
    }

    if (dto.colorGradeId && !dto.featherGradeId) {
      return badRequest("Grade warna harus memiliki grade bulu");
    }

    if (dto.featherGradeId) {
      const featherGrade = await this.prisma.grade.findUnique({
        where: { id: dto.featherGradeId },
      });
      if (!featherGrade) {
        return notFound("Grade bulu tidak ditemukan", {
          gradeId: dto.featherGradeId,
        });
      }
      if (featherGrade.type !== GradeType.BULU) {
        return badRequest("Grade bulu tidak sesuai", {
          gradeId: dto.featherGradeId,
          expected: GradeType.BULU,
          actual: featherGrade.type,
        });
      }
    }

    if (dto.colorGradeId) {
      const colorGrade = await this.prisma.grade.findUnique({
        where: { id: dto.colorGradeId },
      });
      if (!colorGrade) {
        return notFound("Grade warna tidak ditemukan", {
          gradeId: dto.colorGradeId,
        });
      }
      if (colorGrade.type !== GradeType.WARNA) {
        return badRequest("Grade warna tidak sesuai", {
          gradeId: dto.colorGradeId,
          expected: GradeType.WARNA,
          actual: colorGrade.type,
        });
      }
    }

    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (effectiveTo && effectiveTo <= effectiveFrom) {
      return badRequest("effectiveTo must be after effectiveFrom");
    }

    const created = await this.prisma.gradeTariff.create({
      data: {
        shapeGradeId: dto.shapeGradeId,
        featherGradeId: dto.featherGradeId ?? null,
        colorGradeId: dto.colorGradeId ?? null,
        rateRpPerGram: dto.rateRpPerGram,
        effectiveFrom,
        effectiveTo,
      },
    });
    await this.recordTariffAudit({
      tariffType: "GRADE",
      tariffId: created.id,
      action: "CREATE",
      newRateRpPerGram: created.rateRpPerGram,
      actor,
      metadata: { effectiveFrom: created.effectiveFrom.toISOString() },
    });
    return created;
  }

  async findGradeTariffs(query: GradeTariffQueryDto) {
    const at = query.at ? new Date(query.at) : null;

    return this.prisma.gradeTariff.findMany({
      where: {
        shapeGradeId: query.shapeGradeId,
        featherGradeId: query.featherGradeId,
        colorGradeId: query.colorGradeId,
        ...(at
          ? {
              effectiveFrom: { lte: at },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
            }
          : undefined),
      },
      orderBy: { effectiveFrom: "desc" },
      include: {
        shapeGrade: true,
        featherGrade: true,
        colorGrade: true,
      },
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

  async deleteGradeTariff(id: string, actor?: AuditActor) {
    const existing = await this.prisma.gradeTariff.findUnique({
      where: { id },
    });

    if (!existing) {
      return notFound("Grade tariff not found", { id });
    }

    const deleted = await this.prisma.gradeTariff.delete({
      where: { id },
    });
    await this.recordTariffAudit({
      tariffType: "GRADE",
      tariffId: deleted.id,
      action: "DELETE",
      previousRateRpPerGram: deleted.rateRpPerGram,
      actor,
    });
    return deleted;
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

  async createResultGradeTariff(dto: { resultGradeTypeId: string; rateRpPerGram: number; effectiveFrom?: string }, actor?: AuditActor) {
    const gradeType = await this.prisma.barangJadiGradeType.findUnique({
      where: { id: dto.resultGradeTypeId },
    });

    if (!gradeType) {
      return notFound("Grade hasil barang jadi tidak ditemukan", { id: dto.resultGradeTypeId });
    }

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();

    const created = await this.prisma.resultGradeTariff.create({
      data: {
        resultGradeTypeId: dto.resultGradeTypeId,
        rateRpPerGram: Math.round(Number(dto.rateRpPerGram)),
        effectiveFrom,
      },
      include: {
        resultGradeType: true,
      },
    });
    await this.recordTariffAudit({
      tariffType: "RESULT",
      tariffId: created.id,
      action: "CREATE",
      newRateRpPerGram: created.rateRpPerGram,
      actor,
      metadata: { effectiveFrom: created.effectiveFrom.toISOString() },
    });
    return created;
  }

  findResultGradeTariffs() {
    return this.prisma.resultGradeTariff.findMany({
      orderBy: { effectiveFrom: "desc" },
      include: {
        resultGradeType: true,
      },
    });
  }

  async deleteResultGradeTariff(id: string, actor?: AuditActor) {
    const existing = await this.prisma.resultGradeTariff.findUnique({
      where: { id },
    });
    if (!existing) {
      return notFound("Result grade tariff not found", { id });
    }
    const deleted = await this.prisma.resultGradeTariff.delete({
      where: { id },
    });
    await this.recordTariffAudit({
      tariffType: "RESULT",
      tariffId: deleted.id,
      action: "DELETE",
      previousRateRpPerGram: deleted.rateRpPerGram,
      actor,
    });
    return deleted;
  }

  async updateGradeTariff(id: string, dto: Partial<CreateGradeTariffDto>, actor?: AuditActor) {
    const existing = await this.prisma.gradeTariff.findUnique({
      where: { id },
    });
    if (!existing) {
      return notFound("Grade tariff not found", { id });
    }

    const data: any = {};

    if (dto.shapeGradeId) {
      const shapeGrade = await this.prisma.grade.findUnique({
        where: { id: dto.shapeGradeId },
      });
      if (!shapeGrade || shapeGrade.type !== GradeType.BENTUK) {
        return badRequest("Grade bentuk tidak valid");
      }
      data.shapeGrade = { connect: { id: dto.shapeGradeId } };
    }

    if (dto.featherGradeId !== undefined) {
      data.featherGrade = dto.featherGradeId
        ? { connect: { id: dto.featherGradeId } }
        : { disconnect: true };
    }

    if (dto.colorGradeId !== undefined) {
      data.colorGrade = dto.colorGradeId
        ? { connect: { id: dto.colorGradeId } }
        : { disconnect: true };
    }

    if (dto.rateRpPerGram !== undefined) {
      data.rateRpPerGram = Math.round(dto.rateRpPerGram);
    }

    if (dto.effectiveFrom) {
      data.effectiveFrom = new Date(dto.effectiveFrom);
    }

    if (dto.effectiveTo !== undefined) {
      data.effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    }

    const updated = await this.prisma.gradeTariff.update({
      where: { id },
      data,
      include: {
        shapeGrade: true,
        featherGrade: true,
        colorGrade: true,
      },
    });
    await this.recordTariffAudit({
      tariffType: "GRADE",
      tariffId: updated.id,
      action: "UPDATE",
      previousRateRpPerGram: existing.rateRpPerGram,
      newRateRpPerGram: updated.rateRpPerGram,
      actor,
      metadata: {
        previousEffectiveFrom: existing.effectiveFrom.toISOString(),
        effectiveFrom: updated.effectiveFrom.toISOString(),
      },
    });
    return updated;
  }

  async updateResultGradeTariff(id: string, dto: { rateRpPerGram?: number; effectiveFrom?: string }, actor?: AuditActor) {
    const existing = await this.prisma.resultGradeTariff.findUnique({
      where: { id },
    });
    if (!existing) {
      return notFound("Result grade tariff not found", { id });
    }

    const data: any = {};
    if (dto.rateRpPerGram !== undefined) {
      data.rateRpPerGram = Math.round(Number(dto.rateRpPerGram));
    }
    if (dto.effectiveFrom) {
      data.effectiveFrom = new Date(dto.effectiveFrom);
    }

    const updated = await this.prisma.resultGradeTariff.update({
      where: { id },
      data,
      include: {
        resultGradeType: true,
      },
    });
    await this.recordTariffAudit({
      tariffType: "RESULT",
      tariffId: updated.id,
      action: "UPDATE",
      previousRateRpPerGram: existing.rateRpPerGram,
      newRateRpPerGram: updated.rateRpPerGram,
      actor,
      metadata: {
        previousEffectiveFrom: existing.effectiveFrom.toISOString(),
        effectiveFrom: updated.effectiveFrom.toISOString(),
      },
    });
    return updated;
  }

  findTariffAudits(tariffType?: string) {
    return this.prisma.tariffAuditLog.findMany({
      where: tariffType ? { tariffType } : undefined,
      orderBy: { changedAt: "desc" },
      take: 200,
      include: { changedBy: { select: { id: true, name: true, email: true, role: true } } },
    });
  }

  async getSetting(key: string) {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });
    return setting ?? { key, value: key === "RAW_MATERIAL_PAYROLL_CALC_BASE" ? "WET" : "" };
  }

  async setSetting(key: string, value: string) {
    return this.prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
