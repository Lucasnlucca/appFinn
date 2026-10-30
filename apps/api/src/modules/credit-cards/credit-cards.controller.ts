import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
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
}

