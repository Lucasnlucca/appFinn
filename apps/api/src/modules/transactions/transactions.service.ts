import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTransactionDto,
  CreateTransferDto,
  FinancialQueryDto,
  FinancialScope,
  SharingAccessLevel,
} from '@finn-ai/shared';
import { Decimal } from '@finn-ai/database';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra uma nova movimentação (Receita ou Despesa) com atualização de saldo em Decimal
   */
  async createTransaction(userId: string, dto: CreateTransactionDto) {
    const amount = new Decimal(dto.amount);
    const date = new Date(dto.date);

    return this.prisma.$transaction(async (tx) => {
      // 1. Cria a transação
      const transaction = await tx.transaction.create({
        data: {
          userId,
          description: dto.description.trim(),
          amount,
          type: dto.type,
          date,
          status: dto.status || 'POSTED',
          accountId: dto.accountId || null,
          creditCardId: dto.creditCardId || null,
          categoryId: dto.categoryId || null,
          isHouseholdShared: dto.isHouseholdShared || false,
          notes: dto.notes || null,
        },
      });

      // 2. Se for vinculada a uma conta bancária e estiver confirmada (POSTED)
      if (dto.accountId && transaction.status === 'POSTED') {
        const balanceChange = dto.type === 'INCOME' ? amount : amount.negated();
        await tx.financialAccount.update({
          where: { id: dto.accountId },
          data: {
            currentBalance: { increment: balanceChange },
            calculatedBalance: { increment: balanceChange },
          },
        });
      }

      // 3. Se for despesa no cartão de crédito, atualiza a fatura aberta correspondente
      if (dto.creditCardId && dto.type === 'EXPENSE') {
        const month = date.getMonth() + 1;
        const year = date.getFullYear();

        // Localiza ou cria a fatura do mês
        let bill = await tx.creditCardBill.findUnique({
          where: {
            creditCardId_month_year: {
              creditCardId: dto.creditCardId,
              month,
              year,
            },
          },
        });

        if (!bill) {
          const card = await tx.creditCard.findUnique({ where: { id: dto.creditCardId } });
          const closingDate = new Date(year, month - 1, card?.closingDay || 20);
          const dueDate = new Date(year, month - 1, card?.dueDay || 28);

          bill = await tx.creditCardBill.create({
            data: {
              creditCardId: dto.creditCardId,
              month,
              year,
              closingDate,
              dueDate,
              totalAmount: amount,
            },
          });
        } else {
          bill = await tx.creditCardBill.update({
            where: { id: bill.id },
            data: {
              totalAmount: { increment: amount },
            },
          });
        }

        // Vincula a transação à fatura
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { creditCardBillId: bill.id },
        });
      }

      return transaction;
    });
  }

  /**
   * Realiza uma transferência atômica entre contas.
   * Identifica se é repasse entre membros da mesma família para evitar distorção contábil.
   */
  async createTransfer(userId: string, dto: CreateTransferDto) {
    if (dto.sourceAccountId === dto.destinationAccountId) {
      throw new BadRequestException('A conta de origem e destino devem ser diferentes');
    }

    const amount = new Decimal(dto.amount);
    const date = new Date(dto.date);

    return this.prisma.$transaction(async (tx) => {
      const sourceAccount = await tx.financialAccount.findUnique({
        where: { id: dto.sourceAccountId },
      });
      const destAccount = await tx.financialAccount.findUnique({
        where: { id: dto.destinationAccountId },
      });

      if (!sourceAccount || !destAccount) {
        throw new NotFoundException('Conta de origem ou destino não encontrada');
      }

      // Detecta se ambas as contas pertencem à mesma família
      const isInternalHousehold = dto.isInternalHousehold || sourceAccount.userId !== destAccount.userId;

      // 1. Cria transação de débito na conta de origem
      const sourceTx = await tx.transaction.create({
        data: {
          userId: sourceAccount.userId,
          accountId: sourceAccount.id,
          type: 'TRANSFER',
          amount: amount.negated(),
          date,
          description: dto.description || `Transferência para ${destAccount.name}`,
          isHouseholdShared: isInternalHousehold,
        },
      });

      // 2. Cria transação de crédito na conta de destino
      const destTx = await tx.transaction.create({
        data: {
          userId: destAccount.userId,
          accountId: destAccount.id,
          type: 'TRANSFER',
          amount,
          date,
          description: dto.description || `Transferência recebida de ${sourceAccount.name}`,
          isHouseholdShared: isInternalHousehold,
        },
      });

      // 3. Registra o vínculo na tabela transfers
      const transfer = await tx.transfer.create({
        data: {
          sourceTransactionId: sourceTx.id,
          destinationTransactionId: destTx.id,
          isInternalHousehold,
        },
      });

      // 4. Atualiza os saldos com precisão Decimal
      await tx.financialAccount.update({
        where: { id: sourceAccount.id },
        data: {
          currentBalance: { decrement: amount },
          calculatedBalance: { decrement: amount },
        },
      });

      await tx.financialAccount.update({
        where: { id: destAccount.id },
        data: {
          currentBalance: { increment: amount },
          calculatedBalance: { increment: amount },
        },
      });

      return {
        transferId: transfer.id,
        amount,
        isInternalHousehold,
        sourceTransactionId: sourceTx.id,
        destinationTransactionId: destTx.id,
      };
    });
  }

  /**
   * Lista transações filtrando por data, categoria, conta e escopo (individual vs familiar)
   */
  async listTransactions(userId: string, query: FinancialQueryDto) {
    let whereCondition: any = { userId };

    if (query.scope === FinancialScope.HOUSEHOLD) {
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
            accessLevel: { in: [SharingAccessLevel.VIEW_ONLY, SharingAccessLevel.VIEW_AND_EDIT] },
          },
          select: { resourceId: true },
        });

        const authorizedAccountIds = permissions.map((p) => p.resourceId);

        whereCondition = {
          OR: [
            { userId },
            { isHouseholdShared: true, userId: { in: partnerIds } },
            { accountId: { in: authorizedAccountIds } },
          ],
        };
      }
    }

    if (query.accountId) {
      whereCondition.accountId = query.accountId;
    }

    if (query.categoryId) {
      whereCondition.categoryId = query.categoryId;
    }

    if (query.startDate || query.endDate) {
      whereCondition.date = {};
      if (query.startDate) whereCondition.date.gte = new Date(query.startDate);
      if (query.endDate) whereCondition.date.lte = new Date(query.endDate);
    }

    return this.prisma.transaction.findMany({
      where: whereCondition,
      include: {
        category: true,
        account: { select: { id: true, name: true, colorHex: true } },
        creditCard: { select: { id: true, name: true, colorHex: true } },
        user: { select: { id: true, fullName: true } },
      },
      orderBy: { date: 'desc' },
      take: 100,
    });
  }
}

