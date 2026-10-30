import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BudgetsService } from './budgets.service';
import { SetBudgetDto, FinancialScope } from '@finn-ai/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Budgets')
@Controller('budgets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar orçamentos por categoria e percentual consumido' })
  async listBudgets(
    @CurrentUser() user: AuthenticatedUser,
    @Query('scope') scope?: FinancialScope,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.budgetsService.listBudgets(user.id, scope, month ? Number(month) : undefined, year ? Number(year) : undefined);
  }

  @Post()
  @ApiOperation({ summary: 'Definir ou atualizar limite de orçamento para categoria' })
  async setBudget(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetBudgetDto,
  ) {
    return this.budgetsService.setBudget(user.id, dto);
  }
}

