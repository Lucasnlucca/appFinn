import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreditCardsService } from './credit-cards.service';
import { CreateCreditCardDto, FinancialScope } from '@finn-ai/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('CreditCards')
@Controller('credit-cards')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CreditCardsController {
  constructor(private readonly creditCardsService: CreditCardsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar cartões de crédito (individual ou familiar)' })
  async listCreditCards(
    @CurrentUser() user: AuthenticatedUser,
    @Query('scope') scope?: FinancialScope,
  ) {
    return this.creditCardsService.listCreditCards(user.id, scope);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastrar novo cartão de crédito' })
  async createCreditCard(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCreditCardDto,
  ) {
    return this.creditCardsService.createCreditCard(user.id, dto);
  }

  @Get(':id/bills')
  @ApiOperation({ summary: 'Listar faturas do cartão de crédito' })
  async getBills(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') cardId: string,
  ) {
    return this.creditCardsService.getBills(user.id, cardId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar limite, vencimento e dados do cartão de crédito' })
  async updateCreditCardPut(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') cardId: string,
    @Body() dto: { name?: string; creditLimit?: number; closingDay?: number; dueDay?: number; colorHex?: string },
  ) {
    return this.creditCardsService.updateCreditCard(user.id, cardId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar parcialmente dados do cartão de crédito' })
  async updateCreditCardPatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') cardId: string,
    @Body() dto: { name?: string; creditLimit?: number; closingDay?: number; dueDay?: number; colorHex?: string },
  ) {
    return this.creditCardsService.updateCreditCard(user.id, cardId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover (desativar) cartão de crédito' })
  async deleteCreditCard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') cardId: string,
  ) {
    return this.creditCardsService.deleteCreditCard(user.id, cardId);
  }
}

