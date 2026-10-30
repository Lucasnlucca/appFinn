import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { FinancialScope } from '@finn-ai/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Resumo financeiro consolidado (patrimônio, receitas, despesas, taxa de poupança)' })
  async getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('scope') scope?: FinancialScope,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.reportsService.getSummary(user.id, scope, month ? Number(month) : undefined, year ? Number(year) : undefined);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Distribuição percentual de despesas por categoria' })
  async getCategories(
    @CurrentUser() user: AuthenticatedUser,
    @Query('scope') scope?: FinancialScope,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.reportsService.getCategoriesBreakdown(user.id, scope, month ? Number(month) : undefined, year ? Number(year) : undefined);
  }

  @Get('evolution')
  @ApiOperation({ summary: 'Evolução mensal dos últimos 6 meses (Receitas vs Despesas)' })
  async getEvolution(
    @CurrentUser() user: AuthenticatedUser,
    @Query('scope') scope?: FinancialScope,
  ) {
    return this.reportsService.getMonthlyEvolution(user.id, scope);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Faturas e contas a vencer nos próximos 15 dias' })
  async getUpcoming(
    @CurrentUser() user: AuthenticatedUser,
    @Query('scope') scope?: FinancialScope,
  ) {
    return this.reportsService.getUpcomingBills(user.id, scope);
  }
}

