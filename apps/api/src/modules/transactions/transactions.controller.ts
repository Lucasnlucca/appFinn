import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
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

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar uma movimentação financeira' })
  async updateTransactionPut(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') txId: string,
    @Body() dto: Partial<CreateTransactionDto>,
  ) {
    return this.transactionsService.updateTransaction(user.id, txId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar parcialmente uma movimentação financeira' })
  async updateTransactionPatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') txId: string,
    @Body() dto: Partial<CreateTransactionDto>,
  ) {
    return this.transactionsService.updateTransaction(user.id, txId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir uma movimentação financeira' })
  async deleteTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') txId: string,
  ) {
    return this.transactionsService.deleteTransaction(user.id, txId);
  }
}

