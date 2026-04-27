import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterMitraDto } from "./dto/register-mitra.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
export declare class AuthService {
    private readonly jwtService;
    private readonly prisma;
    constructor(jwtService: JwtService, prisma: PrismaService);
    login(email: string, password: string): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
            phone: string | null;
            role: string;
            workerId: string | null;
            pin: string | null;
            useCustomUiAccess: boolean;
            uiAccesses: {
                moduleKey: string;
                level: number;
            }[];
        };
        token: string;
    }>;
    registerMitra(dto: RegisterMitraDto): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
            phone: string | null;
            role: string;
            workerId: string | null;
            pin: string | null;
            useCustomUiAccess: boolean;
            uiAccesses: {
                moduleKey: string;
                level: number;
            }[];
        };
        token: string;
    }>;
    profile(userId: string): Promise<{
        id: string;
        name: string;
        email: string;
        phone: string | null;
        role: string;
        workerId: string | null;
        pin: string | null;
        useCustomUiAccess: boolean;
        uiAccesses: {
            moduleKey: string;
            level: number;
        }[];
    }>;
    changePassword(userId: string, dto: ChangePasswordDto): Promise<{
        ok: boolean;
        message: string;
    }>;
    private buildAuthResponse;
    private normalizePin;
    private normalizePhone;
    private hashPassword;
}
