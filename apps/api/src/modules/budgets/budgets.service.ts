import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SetBudgetDto, FinancialScope } from '@finn-ai/shared';
import { Prisma, Decimal } from '@finn-ai/database';

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista orçamentos mensais comparando o teto planejado com o gasto realizado
   */
  async listBudgets(
    userId: string,
    scope: FinancialScope = FinancialScope.HOUSEHOLD,
    month?: number,
    year?: number,
  ) {
    const memberships = await this.prisma.householdMember.findMany({ where: { userId } });
    if (memberships.length === 0) return [];

    const householdId = memberships[0].householdId;
    const now = new Date();
    const currentMonth = month || now.getMonth() + 1;
    const currentYear = year || now.getFullYear();

    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    // 1. Busca tetos cadastrados para o Household
    const budgets = await this.prisma.budget.findMany({
      where: { householdId },
      include: {
        category: true,
      },
    });

    // 2. Busca despesas reais do mês agrupadas por categoria
    const expenses = await this.prisma.transaction.findMany({
      where: {
        type: 'EXPENSE',
        status: 'POSTED',
        date: { gte: startDate, lte: endDate },
        categoryId: { in: budgets.map((b) => b.categoryId) },
      },
      select: {
        categoryId: true,
        amount: true,
      },
    });

    const expenseMap = new Map<string, Prisma.Decimal>();
    for (const exp of expenses) {
      if (!exp.categoryId) continue;
      const current = expenseMap.get(exp.categoryId) || new Decimal(0);
      expenseMap.set(exp.categoryId, current.plus(exp.amount));
    }

    return budgets.map((b) => {
      const limit = Number(b.amountLimit);
      const spent = Number(expenseMap.get(b.categoryId) || 0);
      const percentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      const remaining = Math.max(0, limit - spent);

      let status = 'NORMAL';
      if (percentage >= 100) {
        status = 'EXCEEDED';
      } else if (percentage >= 80) {
        status = 'WARNING';
      }

      return {
        id: b.id,
        categoryId: b.categoryId,
        categoryName: b.category.name,
        colorHex: b.category.colorHex,
        amountLimit: limit,
        spentAmount: spent,
        remainingAmount: remaining,
        percentageUsed: percentage,
        status,
        month: currentMonth,
        year: currentYear,
      };
    });
  }

  /**
   * Define ou atualiza o teto orçamentário de uma categoria
   */
  async setBudget(userId: string, dto: SetBudgetDto) {
    const memberships = await this.prisma.householdMember.findMany({ where: { userId } });
    if (memberships.length === 0) {
      throw new BadRequestException('Você precisa pertencer a um núcleo familiar para definir orçamentos');
    }

    const householdId = memberships[0].householdId;
    const limitDecimal = new Decimal(dto.amountLimit);

    return this.prisma.budget.upsert({
      where: {
        householdId_categoryId: {
          householdId,
          categoryId: dto.categoryId,
        },
      },
      update: {
        amountLimit: limitDecimal,
      },
      create: {
        householdId,
        categoryId: dto.categoryId,
        amountLimit: limitDecimal,
      },
    });
  }
}
