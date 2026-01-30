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
    }>;
    logout(): {
        ok: boolean;
    };
}
