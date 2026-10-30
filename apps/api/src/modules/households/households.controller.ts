import {
  Controller,
  Post,
  Get,
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

  @Post('invitations')
  @ApiOperation({ summary: 'Convidar cônjuge ou membro para a família via token seguro' })
  async createInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteMemberDto,
  ) {
    return this.householdsService.createInvitation(user.id, dto);
  }

  @Post('invitations/accept')
  @ApiOperation({ summary: 'Aceitar convite para ingressar em um núcleo familiar' })
  async acceptInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Query('token') token: string,
  ) {
    return this.householdsService.acceptInvitation(user.id, token);
  }
}

