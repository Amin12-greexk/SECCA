import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
export declare class AuthService {
    private readonly jwtService;
    private readonly prisma;
    constructor(jwtService: JwtService, prisma: PrismaService);
    login(email: string, password: string): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
            role: string;
            workerId: string | null;
        };
        token: string;
    }>;
    profile(userId: string): Promise<{
        id: string;
        name: string;
        email: string;
        role: string;
        workerId: string | null;
    }>;
    private hashPassword;
}
