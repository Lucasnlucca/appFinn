import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { HouseholdsService } from './households.service';
import { CreateHouseholdDto, InviteMemberDto } from '@finn-ai/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Households')
@Controller('households')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar núcleo familiar (Household)' })
  @ApiResponse({ status: 201, description: 'Família criada com sucesso' })
  async createHousehold(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateHouseholdDto,
  ) {
    return this.householdsService.createHousehold(user.id, dto);
  }

  @Get('current')
  @ApiOperation({ summary: 'Consultar núcleo familiar ativo do usuário e seus membros' })
  async getCurrentHousehold(@CurrentUser() user: AuthenticatedUser) {
    return this.householdsService.getCurrentHousehold(user.id);
  }

  @Get('my-groups')
  @ApiOperation({ summary: 'Consultar todos os grupos/núcleos familiares do usuário' })
  async getUserHouseholds(@CurrentUser() user: AuthenticatedUser) {
    return this.householdsService.getUserHouseholds(user.id);
  }

  @Post('invitations')
  @ApiOperation({ summary: 'Convidar cônjuge ou membro para a família via token seguro' })
  async createInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteMemberDto,
  ) {
    return this.householdsService.createInvitation(user.id, dto);
  }

  @Post('invite-code')
  @ApiOperation({ summary: 'Gerar código de convite rápido válido por 30 minutos' })
  async generateInviteCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body('householdId') householdId?: string,
    @Body('code') code?: string,
  ) {
    return this.householdsService.generateGroupInviteCode(user.id, householdId, code);
  }

  @Get('invitations/info')
  @ApiOperation({ summary: 'Consultar informações do convite ou código de 30 min' })
  async getInvitationInfo(
    @Query('token') token?: string,
    @Query('code') code?: string,
  ) {
    return this.householdsService.getInvitationInfo(token || code || '');
  }

  @Post('invitations/accept')
  @ApiOperation({ summary: 'Aceitar convite para ingressar em um núcleo familiar' })
  async acceptInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Query('token') token?: string,
    @Query('code') code?: string,
    @Body('token') bodyToken?: string,
    @Body('code') bodyCode?: string,
  ) {
    const effectiveToken = token || code || bodyToken || bodyCode || '';
    return this.householdsService.acceptInvitation(user.id, effectiveToken);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir grupo financeiro (apenas o criador/dono pode excluir)' })
  async deleteHousehold(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.householdsService.deleteHousehold(user.id, id);
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'Sair do grupo financeiro (participantes saem e dono é notificado)' })
  async leaveHousehold(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.householdsService.leaveHousehold(user.id, id);
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Expulsar participante do grupo financeiro (apenas o criador/dono)' })
  async kickMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.householdsService.kickMember(user.id, id, memberId);
  }
}

