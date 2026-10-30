import { Controller, Get, Delete, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrivacyService } from './privacy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('privacy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('privacy')
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  @Get('export')
  @ApiOperation({ summary: 'Exportar todos os dados pessoais do titular (LGPD Art. 18)' })
  async exportData(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.privacyService.exportUserData(userId);
  }

  @Delete('purge')
  @ApiOperation({ summary: 'Excluir definitivamente conta e dados do usuário (LGPD Art. 18)' })
  async purgeAccount(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.privacyService.purgeUserAccount(userId);
  }
}
