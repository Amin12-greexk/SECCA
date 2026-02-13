import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(dto: LoginDto): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
            role: string;
            workerId: string | null;
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
        role: string;
        workerId: string | null;
    }>;
    logout(): {
        ok: boolean;
    };
}
