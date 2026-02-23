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
const client_1 = require("@prisma/client");
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
            include: {
                worker: {
                    select: { pin: true },
                },
            },
        });
        if (!user) {
            return (0, errors_1.unprocessable)("Invalid email or password");
        }
        const passwordHash = this.hashPassword(password);
        if (passwordHash !== user.passwordHash) {
            return (0, errors_1.unprocessable)("Invalid email or password");
        }
        return this.buildAuthResponse(user);
    }
    async registerMitra(dto) {
        const pin = this.normalizePin(dto.pinKaryawan);
        const phone = this.normalizePhone(dto.phone);
        const email = dto.email.trim().toLowerCase();
        const name = dto.name.trim();
        if (!pin || pin.length < 3 || pin.length > 6) {
            return (0, errors_1.unprocessable)("PIN harus 3-6 digit angka");
        }
        const [emailOwner, phoneOwner] = await Promise.all([
            this.prisma.appUser.findUnique({
                where: { email },
                select: { id: true },
            }),
            this.prisma.appUser.findUnique({
                where: { phone },
                select: { id: true },
            }),
        ]);
        if (emailOwner) {
            return (0, errors_1.conflict)("Email sudah terdaftar");
        }
        if (phoneOwner) {
            return (0, errors_1.conflict)("Nomor WhatsApp sudah terdaftar");
        }
        try {
            const user = await this.prisma.$transaction(async (tx) => {
                const workerByPin = await tx.worker.findUnique({
                    where: { pin },
                    include: { user: true },
                });
                if (workerByPin?.user) {
                    return (0, errors_1.conflict)("PIN ini sudah digunakan untuk mendaftar");
                }
                const worker = workerByPin ??
                    (await tx.worker.create({
                        data: {
                            name,
                            pin,
                        },
                    }));
                return tx.appUser.create({
                    data: {
                        name,
                        email,
                        phone,
                        passwordHash: this.hashPassword(dto.password),
                        role: client_1.UserRole.MITRA,
                        workerId: worker.id,
                    },
                    include: {
                        worker: {
                            select: { pin: true },
                        },
                    },
                });
            });
            return this.buildAuthResponse(user);
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                const target = Array.isArray(error.meta?.target)
                    ? error.meta?.target.join(",")
                    : String(error.meta?.target ?? "");
                if (target.includes("email")) {
                    return (0, errors_1.conflict)("Email sudah terdaftar");
                }
                if (target.includes("phone")) {
                    return (0, errors_1.conflict)("Nomor WhatsApp sudah terdaftar");
                }
                if (target.includes("workerId")) {
                    return (0, errors_1.conflict)("PIN ini sudah digunakan untuk mendaftar");
                }
                if (target.includes("pin")) {
                    return (0, errors_1.conflict)("PIN ini sudah digunakan untuk mendaftar");
                }
                return (0, errors_1.conflict)("Data pendaftaran sudah digunakan");
            }
            throw error;
        }
    }
    async profile(userId) {
        const user = await this.prisma.appUser.findUnique({
            where: { id: userId },
            include: {
                worker: {
                    select: { pin: true },
                },
            },
        });
        if (!user) {
            return (0, errors_1.unprocessable)("User not found");
        }
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone ?? null,
            role: user.role.toLowerCase(),
            workerId: user.workerId ?? null,
            pin: user.worker?.pin ?? null,
        };
    }
    async changePassword(userId, dto) {
        if (!userId) {
            return (0, errors_1.unprocessable)("User not found");
        }
        const user = await this.prisma.appUser.findUnique({
            where: { id: userId },
            select: {
                id: true,
                passwordHash: true,
            },
        });
        if (!user) {
            return (0, errors_1.unprocessable)("User not found");
        }
        const currentPasswordHash = this.hashPassword(dto.currentPassword);
        if (currentPasswordHash !== user.passwordHash) {
            return (0, errors_1.unprocessable)("Password saat ini tidak sesuai");
        }
        if (dto.currentPassword === dto.newPassword) {
            return (0, errors_1.unprocessable)("Password baru harus berbeda dari password saat ini");
        }
        await this.prisma.appUser.update({
            where: { id: userId },
            data: {
                passwordHash: this.hashPassword(dto.newPassword),
            },
        });
        return {
            ok: true,
            message: "Password berhasil diperbarui",
        };
    }
    buildAuthResponse(user) {
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
                phone: user.phone ?? null,
                role: user.role.toLowerCase(),
                workerId: user.workerId ?? null,
                pin: user.worker?.pin ?? null,
            },
            token,
        };
    }
    normalizePin(pin) {
        return pin.replace(/\D/g, "");
    }
    normalizePhone(phone) {
        const trimmed = phone.trim();
        if (trimmed.startsWith("+")) {
            const normalized = `+${trimmed
                .slice(1)
                .replace(/\D/g, "")}`;
            return normalized;
        }
        return trimmed.replace(/\D/g, "");
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