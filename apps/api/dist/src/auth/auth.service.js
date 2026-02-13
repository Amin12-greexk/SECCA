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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const errors_1 = require("../common/errors");
let AuthService = class AuthService {
    jwtService;
    prisma;
    constructor(jwtService, prisma) {
        this.jwtService = jwtService;
        this.prisma = prisma;
    }
    async login(email, password) {
        const user = await this.prisma.appUser.findUnique({
            where: { email: email.toLowerCase() },
        });
        if (!user) {
            return (0, errors_1.unprocessable)("Invalid email or password");
        }
        const passwordHash = this.hashPassword(password);
        if (passwordHash !== user.passwordHash) {
            return (0, errors_1.unprocessable)("Invalid email or password");
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
    async profile(userId) {
        const user = await this.prisma.appUser.findUnique({
            where: { id: userId },
        });
        if (!user) {
            return (0, errors_1.unprocessable)("User not found");
        }
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role.toLowerCase(),
            workerId: user.workerId ?? null,
        };
    }
    hashPassword(password) {
        return (0, crypto_1.createHash)("sha256").update(password).digest("hex");
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        prisma_service_1.PrismaService])
], AuthService);
//# sourceMappingURL=auth.service.js.map