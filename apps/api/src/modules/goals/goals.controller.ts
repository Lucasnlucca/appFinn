import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GoalsService } from './goals.service';
import { CreateGoalDto, GoalContributionDto, FinancialScope } from '@finn-ai/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Goals')
@Controller('goals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar metas financeiras e progresso' })
  async listGoals(
    @CurrentUser() user: AuthenticatedUser,
    @Query('scope') scope?: FinancialScope,
  ) {
    return this.goalsService.listGoals(user.id, scope);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastrar nova meta financeira' })
  async createGoal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGoalDto,
  ) {
    return this.goalsService.createGoal(user.id, dto);
  }

  @Post(':id/contributions')
  @ApiOperation({ summary: 'Registrar aporte financeiro em uma meta' })
  async addContribution(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') goalId: string,
    @Body() dto: GoalContributionDto,
  ) {
    return this.goalsService.addContribution(user.id, goalId, dto);
  }
}

