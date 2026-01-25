"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NumberingService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const constants_1 = require("../constants");
const prisma_service_1 = require("../../prisma/prisma.service");
let NumberingService = class NumberingService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async nextRawBatchNumber(tx, at) {
        const year = at.getUTCFullYear();
        const sequence = await this.nextSequence(tx, `RAW:${year}`);
        const yearShort = String(year).slice(-2);
        const cardNumber = `K${String(sequence).padStart(4, "0")}/${constants_1.COMPANY_CODE}/${yearShort}`;
        return { cardNumber, sequence };
    }
    async nextLotNumber(tx, at) {
        const year = at.getUTCFullYear();
        const sequence = await this.nextSequence(tx, `LOT:${year}`);
        const yearShort = String(year).slice(-2);
        const lotNumber = `LP${String(sequence).padStart(6, "0")}/${yearShort}`;
        return { lotNumber, sequence };
    }
    async nextSequence(tx, key) {
        const rows = await tx.$queryRaw(client_1.Prisma.sql `
        INSERT INTO "NumberSequence" ("key", "current", "createdAt", "updatedAt")
        VALUES (${key}, 1, NOW(), NOW())
        ON CONFLICT ("key") DO UPDATE
        SET "current" = "NumberSequence"."current" + 1,
            "updatedAt" = NOW()
        RETURNING "current";
      `);
        return rows[0]?.current ?? 1;
    }
};
exports.NumberingService = NumberingService;
exports.NumberingService = NumberingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NumberingService);
//# sourceMappingURL=numbering.service.js.map