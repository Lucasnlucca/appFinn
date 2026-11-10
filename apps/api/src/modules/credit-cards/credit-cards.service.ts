import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCreditCardDto, FinancialScope, SharingAccessLevel } from '@finn-ai/shared';
import { Decimal } from '@finn-ai/database';

@Injectable()
export class CreditCardsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista cartões de crédito com cálculo de limite utilizado e fatura atual
   */
  async listCreditCards(userId: string, scope: FinancialScope = FinancialScope.PERSONAL) {
    let whereCondition: any = { userId, isActive: true };

    if (scope === FinancialScope.HOUSEHOLD) {
      const memberships = await this.prisma.householdMember.findMany({ where: { userId } });
      if (memberships.length > 0) {
        const householdId = memberships[0].householdId;
        const members = await this.prisma.householdMember.findMany({
          where: { householdId },
          select: { userId: true },
        });

        const partnerIds = members.map((m) => m.userId).filter((id) => id !== userId);
        const permissions = await this.prisma.sharingPermission.findMany({
          where: {
            recipientUserId: userId,
            ownerUserId: { in: partnerIds },
            resourceType: 'CREDIT_CARD',
            accessLevel: { in: [SharingAccessLevel.VIEW_ONLY, SharingAccessLevel.VIEW_AND_EDIT] },
          },
          select: { resourceId: true },
        });

        const authorizedCardIds = permissions.map((p) => p.resourceId);
        whereCondition = {
          isActive: true,
          OR: [{ userId }, { id: { in: authorizedCardIds } }],
        };
      }
    }

    const cards = await this.prisma.creditCard.findMany({
      where: whereCondition,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        linkedAccount: { select: { id: true, name: true } },
        bills: {
          where: { status: 'OPEN' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return cards.map((card) => {
      const currentBill = card.bills[0] || null;
      const billAmount = currentBill ? currentBill.totalAmount : new Decimal(0);
      const availableLimit = Decimal.max(0, card.creditLimit.sub(billAmount));

      return {
        ...card,
        currentBill,
        availableLimit,
      };
    });
  }

  /**
   * Cadastra um novo cartão de crédito
   */
  async createCreditCard(userId: string, dto: CreateCreditCardDto) {
    return this.prisma.creditCard.create({
      data: {
        userId,
        name: dto.name.trim(),
        creditLimit: new Decimal(dto.creditLimit),
        closingDay: dto.closingDay,
        dueDay: dto.dueDay,
        financialAccountId: dto.financialAccountId || null,
        colorHex: dto.colorHex || '#6366f1',
      },
    });
  }

  /**
   * Lista faturas do cartão
   */
  async getBills(userId: string, cardId: string) {
    const card = await this.prisma.creditCard.findUnique({
      where: { id: cardId },
    });

    if (!card) {
      throw new NotFoundException('Cartão de crédito não encontrado');
    }

    return this.prisma.creditCardBill.findMany({
      where: { creditCardId: cardId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  /**
   * Atualiza dados do cartão de crédito (limite, vencimento, fechamento, nome)
   */
  async updateCreditCard(
    userId: string,
    cardId: string,
    dto: { name?: string; creditLimit?: number; closingDay?: number; dueDay?: number; colorHex?: string },
  ) {
    const card = await this.prisma.creditCard.findUnique({
      where: { id: cardId },
    });

    if (!card || card.userId !== userId) {
      throw new NotFoundException('Cartão de crédito não encontrado');
    }

    const updateData: Record<string, any> = {};
    if (dto.name !== undefined && dto.name.trim()) {
      updateData.name = dto.name.trim();
    }
    if (dto.creditLimit !== undefined && !Number.isNaN(Number(dto.creditLimit))) {
      updateData.creditLimit = new Decimal(Number(dto.creditLimit));
    }
    if (dto.closingDay !== undefined && !Number.isNaN(Number(dto.closingDay))) {
      updateData.closingDay = Math.min(31, Math.max(1, Math.round(Number(dto.closingDay))));
    }
    if (dto.dueDay !== undefined && !Number.isNaN(Number(dto.dueDay))) {
      updateData.dueDay = Math.min(31, Math.max(1, Math.round(Number(dto.dueDay))));
    }
    if (dto.colorHex !== undefined) {
      updateData.colorHex = dto.colorHex;
    }

    return this.prisma.creditCard.update({
      where: { id: cardId },
      data: updateData,
    });
  }

  /**
   * Desativa um cartão de crédito
   */
  async deleteCreditCard(userId: string, cardId: string) {
    const card = await this.prisma.creditCard.findUnique({
      where: { id: cardId },
    });

    if (!card || card.userId !== userId) {
      throw new NotFoundException('Cartão de crédito não encontrado');
    }

    return this.prisma.creditCard.update({
      where: { id: cardId },
      data: { isActive: false },
    });
  }
}

