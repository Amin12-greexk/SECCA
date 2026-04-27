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
exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const core_1 = require("@nestjs/core");
const auth_constants_1 = require("./auth.constants");
const prisma_service_1 = require("../prisma/prisma.service");
let JwtAuthGuard = class JwtAuthGuard {
    jwtService;
    reflector;
    prisma;
    constructor(jwtService, reflector, prisma) {
        this.jwtService = jwtService;
        this.reflector = reflector;
        this.prisma = prisma;
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(auth_constants_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers?.authorization;
        const token = authHeader?.startsWith("Bearer ")
            ? authHeader.slice(7).trim()
            : undefined;
        if (!token) {
            return false;
        }
        try {
            const payload = await this.jwtService.verifyAsync(token);
            const appUser = await this.prisma.appUser.findUnique({
                where: { id: payload.sub },
                select: {
                    id: true,
                    role: true,
                    useCustomUiAccess: true,
                    uiAccesses: {
                        select: {
                            moduleKey: true,
                            level: true,
                        },
                    },
                },
            });
            if (!appUser) {
                return false;
            }
            request.user = {
                ...payload,
                sub: appUser.id,
                role: appUser.role.toLowerCase(),
                useCustomUiAccess: appUser.useCustomUiAccess,
                uiAccesses: appUser.uiAccesses,
            };
            return true;
        }
        catch {
            return false;
        }
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        core_1.Reflector,
        prisma_service_1.PrismaService])
], JwtAuthGuard);
//# sourceMappingURL=jwt-auth.guard.js.map