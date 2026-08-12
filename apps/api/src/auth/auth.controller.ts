import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterMitraDto } from './dto/register-mitra.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from './public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @Post('register/mitra')
  @ApiOperation({
    summary: 'Pendaftaran mandiri mitra menggunakan PIN karyawan',
  })
  registerMitra(@Body() dto: RegisterMitraDto) {
    return this.authService.registerMitra(dto);
  }

  @Get('profile')
  @ApiBearerAuth()
  getProfile(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    return this.authService.profile(userId ?? '');
  }

  @Post('change-password')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Ubah password akun yang sedang login',
  })
  changePassword(
    @Req() req: { user?: { sub?: string } },
    @Body() dto: ChangePasswordDto,
  ) {
    const userId = req.user?.sub;
    return this.authService.changePassword(userId ?? '', dto);
  }

  @Post('logout')
  @ApiBearerAuth()
  logout() {
    return { ok: true };
  }
}
