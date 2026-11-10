import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, FinancialScope } from '@finn-ai/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Accounts')
@Controller('accounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar contas bancárias (individual ou autorizadas da família)' })
  async listAccounts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('scope') scope?: FinancialScope,
  ) {
    return this.accountsService.listAccounts(user.id, scope);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastrar nova conta financeira manual ou carteira' })
  async createAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAccountDto,
  ) {
    return this.accountsService.createAccount(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalhes de uma conta financeira' })
  async getAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') accountId: string,
  ) {
    return this.accountsService.getAccount(user.id, accountId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar dados e saldo de uma conta financeira' })
  async updateAccountPut(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') accountId: string,
    @Body() dto: { name?: string; currentBalance?: number; initialBalance?: number; colorHex?: string; isShared?: boolean },
  ) {
    return this.accountsService.updateAccount(user.id, accountId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar parcialmente dados e saldo de uma conta financeira' })
  async updateAccountPatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') accountId: string,
    @Body() dto: { name?: string; currentBalance?: number; initialBalance?: number; colorHex?: string; isShared?: boolean },
  ) {
    return this.accountsService.updateAccount(user.id, accountId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover (desativar) uma conta financeira' })
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') accountId: string,
  ) {
    return this.accountsService.deleteAccount(user.id, accountId);
  }
}

