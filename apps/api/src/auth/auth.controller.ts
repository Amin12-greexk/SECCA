import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { Public } from "./public.decorator";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Get("profile")
  @ApiBearerAuth()
  getProfile(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    return this.authService.profile(userId ?? "");
  }

  @Post("logout")
  @ApiBearerAuth()
  logout() {
    return { ok: true };
  }
}
