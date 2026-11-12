import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Delete,
  Body,
  Res,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { PrivacyService } from '../privacy/privacy.service';
import { RegisterDto, LoginDto } from '@finn-ai/shared';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from './decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly privacyService: PrivacyService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Cadastro de novo usuário' })
  @ApiResponse({ status: 201, description: 'Usuário cadastrado com sucesso' })
  async register(
    @Body() dto: RegisterDto,
    @Query('invitationToken') invitationToken: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(dto, invitationToken);
    this.setAuthCookie(response, result.token);
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autenticação de usuário com e-mail e senha' })
  @ApiResponse({ status: 200, description: 'Login realizado com sucesso' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setAuthCookie(response, result.token);
    return result;
  }

  @Post('check-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar se já existe conta cadastrada com o e-mail informado' })
  async checkEmail(@Body() body: { email: string }) {
    return this.authService.checkEmailExists(body?.email);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enviar código de 6 dígitos por e-mail para recuperação de senha' })
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.requestPasswordReset(body?.email);
  }

  @Post('verify-reset-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validar código de 6 dígitos enviado por e-mail' })
  async verifyResetCode(@Body() body: { email: string; code: string }) {
    return this.authService.verifyPasswordResetCode(body?.email, body?.code);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redefinir senha usando o código de 6 dígitos enviado por e-mail' })
  async resetPassword(
    @Body() body: { email: string; code: string; newPassword: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.resetPasswordWithCode(body);
    if (result?.token) {
      this.setAuthCookie(response, result.token);
    }
    return result;
  }

  @Put('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar senha do usuário autenticado' })
  async updatePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { password?: string; newPassword?: string },
  ) {
    return this.authService.changePassword(user.id, body?.newPassword || body?.password);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autenticação e Cadastro Oficial com Google via ID Token Criptográfico' })
  async googleAuth(
    @Body() body: { idToken: string; termsAcceptedVersion?: string; intent?: 'login' | 'register' },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.authenticateGoogle(body);
    if (result?.token) {
      this.setAuthCookie(response, result.token);
    }
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Encerramento de sessão (Logout)' })
  async logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('finn_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return { message: 'Sessão encerrada com sucesso' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter dados do usuário autenticado' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar nome, sobrenome e foto de perfil do usuário no banco' })
  async updateProfilePut(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { fullName?: string; firstName?: string; lastName?: string; avatarUrl?: string | null; avatarUri?: string | null; phone?: string },
  ) {
    return this.authService.updateProfile(user.id, body);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar nome, sobrenome e foto de perfil do usuário no banco' })
  async updateProfilePatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { fullName?: string; firstName?: string; lastName?: string; avatarUrl?: string | null; avatarUri?: string | null; phone?: string },
  ) {
    return this.authService.updateProfile(user.id, body);
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Excluir definitivamente conta e dados do usuário autenticado (LGPD)' })
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.privacyService.purgeUserAccount(user.id);
    response.clearCookie('finn_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return result;
  }

  private setAuthCookie(response: Response, token: string) {
    response.cookie('finn_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
      path: '/',
    });
  }
}

