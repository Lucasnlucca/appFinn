import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import {
  CreateTransactionDto,
  CreateTransferDto,
  FinancialQueryDto,
} from '@finn-ai/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar movimentações financeiras com filtros' })
  async listTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FinancialQueryDto,
  ) {
    return this.transactionsService.listTransactions(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Lançar nova movimentação (Receita ou Despesa)' })
  async createTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactionsService.createTransaction(user.id, dto);
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Realizar transferência atômica entre contas' })
  async createTransfer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransferDto,
  ) {
    return this.transactionsService.createTransfer(user.id, dto);
  }
}

