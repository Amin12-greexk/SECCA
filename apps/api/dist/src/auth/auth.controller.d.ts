import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterMitraDto } from "./dto/register-mitra.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(dto: LoginDto): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
            phone: string | null;
            role: string;
            workerId: string | null;
            pin: string | null;
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
        };
        token: string;
    }>;
    getProfile(req: {
        user?: {
            sub?: string;
        };
    }): Promise<{
        id: string;
        name: string;
        email: string;
        phone: string | null;
        role: string;
        workerId: string | null;
        pin: string | null;
    }>;
    changePassword(req: {
        user?: {
            sub?: string;
        };
    }, dto: ChangePasswordDto): Promise<{
        ok: boolean;
        message: string;
    }>;
    logout(): {
        ok: boolean;
    };
}
