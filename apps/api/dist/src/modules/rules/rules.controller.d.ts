import { CreateGradeTariffDto } from "./dto/create-grade-tariff.dto";
import { CreateMoistureRuleDto } from "./dto/create-moisture-rule.dto";
import { CreatePecahBonPresetDto } from "./dto/create-pecah-bon-preset.dto";
import { GradeTariffQueryDto } from "./dto/grade-tariff-query.dto";
import { MoistureRuleQueryDto } from "./dto/moisture-rule-query.dto";
import { RulesService } from "./rules.service";
export declare class RulesController {
    private readonly rulesService;
    constructor(rulesService: RulesService);
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
    deleteGradeTariff(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        gradeId: string;
        rateRpPerGram: number;
        effectiveFrom: Date;
        effectiveTo: Date | null;
    }>;
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
    deleteMoistureRule(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        gradeId: string | null;
        effectiveFrom: Date;
        effectiveTo: Date | null;
        supplierId: string | null;
        moistureBps: number;
    }>;
    createPreset(dto: CreatePecahBonPresetDto): import("@prisma/client").Prisma.Prisma__PecahBonPresetClient<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        weightGram: number;
        isActive: boolean;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findPresets(): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        weightGram: number;
        isActive: boolean;
    }[]>;
    deletePreset(id: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        weightGram: number;
        isActive: boolean;
    }>;
}
