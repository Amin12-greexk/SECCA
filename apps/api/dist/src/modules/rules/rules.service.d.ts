import { PrismaService } from "../../prisma/prisma.service";
import { CreateGradeTariffDto } from "./dto/create-grade-tariff.dto";
import { CreateMoistureRuleDto } from "./dto/create-moisture-rule.dto";
import { CreatePecahBonPresetDto } from "./dto/create-pecah-bon-preset.dto";
import { GradeTariffQueryDto } from "./dto/grade-tariff-query.dto";
import { MoistureRuleQueryDto } from "./dto/moisture-rule-query.dto";
export declare class RulesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createGradeTariff(dto: CreateGradeTariffDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        gradeId: string;
        rateRpPerGram: number;
        effectiveFrom: Date;
        effectiveTo: Date | null;
    }>;
    findGradeTariffs(query: GradeTariffQueryDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        gradeId: string;
        rateRpPerGram: number;
        effectiveFrom: Date;
        effectiveTo: Date | null;
    }[]>;
    createMoistureRule(dto: CreateMoistureRuleDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        gradeId: string | null;
        effectiveFrom: Date;
        effectiveTo: Date | null;
        supplierId: string | null;
        moistureBps: number;
    }>;
    findMoistureRules(query: MoistureRuleQueryDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        gradeId: string | null;
        effectiveFrom: Date;
        effectiveTo: Date | null;
        supplierId: string | null;
        moistureBps: number;
    }[]>;
    createPecahBonPreset(dto: CreatePecahBonPresetDto): import("@prisma/client").Prisma.Prisma__PecahBonPresetClient<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        weightGram: number;
        isActive: boolean;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findPecahBonPresets(): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        weightGram: number;
        isActive: boolean;
    }[]>;
}
