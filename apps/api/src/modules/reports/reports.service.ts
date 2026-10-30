import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialScope, SharingAccessLevel } from '@finn-ai/shared';
import { Prisma, Decimal } from '@finn-ai/database';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtém os IDs de usuários e contas acessíveis para o escopo solicitado
   */
  private async getAuthorizedScope(userId: string, scope: FinancialScope) {
    if (scope === FinancialScope.PERSONAL) {
      const userAccounts = await this.prisma.financialAccount.findMany({
        where: { userId, isActive: true },
        select: { id: true },
      });
      return {
        userIds: [userId],
        accountIds: userAccounts.map((a) => a.id),
      };
    }

    // Escopo HOUSEHOLD
    const memberships = await this.prisma.householdMember.findMany({ where: { userId } });
    if (memberships.length === 0) {
      const userAccounts = await this.prisma.financialAccount.findMany({
        where: { userId, isActive: true },
        select: { id: true },
      });
      return {
        userIds: [userId],
        accountIds: userAccounts.map((a) => a.id),
      };
    }

    const householdId = memberships[0].householdId;
    const householdMembers = await this.prisma.householdMember.findMany({
      where: { householdId },
      select: { userId: true },
    });

    const partnerIds = householdMembers.map((m) => m.userId).filter((id) => id !== userId);

    // Contas autorizadas pelo cônjuge
    const grantedPermissions = await this.prisma.sharingPermission.findMany({
      where: {
        recipientUserId: userId,
        ownerUserId: { in: partnerIds },
        resourceType: 'ACCOUNT',
        accessLevel: { in: [SharingAccessLevel.VIEW_ONLY, SharingAccessLevel.VIEW_AND_EDIT] },
      },
      select: { resourceId: true },
    });

    const ownAccounts = await this.prisma.financialAccount.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });

    const authorizedPartnerAccountIds = grantedPermissions.map((p) => p.resourceId);
    const allAccountIds = [...ownAccounts.map((a) => a.id), ...authorizedPartnerAccountIds];

    return {
      userIds: [userId, ...partnerIds],
      accountIds: allAccountIds,
    };
  }

  /**
   * Resumo de Métricas Financeiras (Patrimônio, Receitas, Despesas, Taxa de Poupança)
   */
  async getSummary(userId: string, scope: FinancialScope = FinancialScope.HOUSEHOLD, month?: number, year?: number) {
    const { userIds, accountIds } = await this.getAuthorizedScope(userId, scope);

    const targetDate = new Date();
    const currentMonth = month || targetDate.getMonth() + 1;
    const currentYear = year || targetDate.getFullYear();

    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    // 1. Patrimônio Líquido (Saldo das contas bancárias autorizadas)
    const accounts = await this.prisma.financialAccount.findMany({
      where: { id: { in: accountIds }, isActive: true },
      select: { currentBalance: true },
    });

    const totalAccountBalance = accounts.reduce(
      (acc, a) => acc.plus(a.currentBalance),
      new Decimal(0),
    );

    // 2. Faturas Abertas de Cartão de Crédito
    const openBills = await this.prisma.creditCardBill.findMany({
      where: {
        status: 'OPEN',
        creditCard: { userId: { in: userIds }, isActive: true },
      },
      select: { totalAmount: true },
    });

    const openCreditCardDebt = openBills.reduce(
      (acc, b) => acc.plus(b.totalAmount),
      new Decimal(0),
    );

    const netWorth = totalAccountBalance.minus(openCreditCardDebt);

    // 3. Receitas e Despesas do Mês
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId: { in: userIds },
        status: 'POSTED',
        date: { gte: startDate, lte: endDate },
        OR: [
          { userId },
          { isHouseholdShared: true },
          { accountId: { in: accountIds } },
        ],
      },
      select: {
        type: true,
        amount: true,
        isHouseholdShared: true,
      },
    });

    let totalIncome = new Decimal(0);
    let totalExpense = new Decimal(0);

    for (const tx of transactions) {
      // Ignora transferências internas do casal para não inflar receitas nem despesas
      if (tx.type === 'TRANSFER') {
        continue;
      }

      if (tx.type === 'INCOME') {
        totalIncome = totalIncome.plus(tx.amount);
      } else if (tx.type === 'EXPENSE') {
        totalExpense = totalExpense.plus(tx.amount);
      }
    }

    const netSavings = totalIncome.minus(totalExpense);
    const savingsRatePct = totalIncome.gt(0)
      ? Number(netSavings.dividedBy(totalIncome).times(100).toFixed(1))
      : 0;

    return {
      scope,
      month: currentMonth,
      year: currentYear,
      totalAccountBalance: Number(totalAccountBalance),
      openCreditCardDebt: Number(openCreditCardDebt),
      netWorth: Number(netWorth),
      totalIncome: Number(totalIncome),
      totalExpense: Number(totalExpense),
      netSavings: Number(netSavings),
      savingsRatePct,
    };
  }

  /**
   * Distribuição de Gastos por Categoria
   */
  async getCategoriesBreakdown(
    userId: string,
    scope: FinancialScope = FinancialScope.HOUSEHOLD,
    month?: number,
    year?: number,
  ) {
    const { userIds, accountIds } = await this.getAuthorizedScope(userId, scope);

    const targetDate = new Date();
    const currentMonth = month || targetDate.getMonth() + 1;
    const currentYear = year || targetDate.getFullYear();

    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    const expenseTransactions = await this.prisma.transaction.findMany({
      where: {
        userId: { in: userIds },
        type: 'EXPENSE',
        status: 'POSTED',
        date: { gte: startDate, lte: endDate },
        OR: [
          { userId },
          { isHouseholdShared: true },
          { accountId: { in: accountIds } },
        ],
      },
      include: {
        category: true,
      },
    });

    const categoryMap = new Map<string, { name: string; colorHex: string; total: Prisma.Decimal }>();
    let grandTotal = new Decimal(0);

    for (const tx of expenseTransactions) {
      const catId = tx.category?.id || 'uncategorized';
      const catName = tx.category?.name || 'Outros / Sem Categoria';
      const colorHex = tx.category?.colorHex || '#94a3b8';

      grandTotal = grandTotal.plus(tx.amount);

      const existing = categoryMap.get(catId);
      if (existing) {
        existing.total = existing.total.plus(tx.amount);
      } else {
        categoryMap.set(catId, { name: catName, colorHex, total: tx.amount });
      }
    }

    const categories = Array.from(categoryMap.entries()).map(([id, item]) => {
      const percentage = grandTotal.gt(0)
        ? Number(item.total.dividedBy(grandTotal).times(100).toFixed(1))
        : 0;

      return {
        categoryId: id,
        name: item.name,
        colorHex: item.colorHex,
        totalSpent: Number(item.total),
        percentage,
      };
    });

    return categories.sort((a, b) => b.totalSpent - a.totalSpent);
  }

  /**
   * Evolução Mensal dos últimos 6 meses (Receitas vs Despesas)
   */
  async getMonthlyEvolution(userId: string, scope: FinancialScope = FinancialScope.HOUSEHOLD) {
    const { userIds, accountIds } = await this.getAuthorizedScope(userId, scope);

    const months = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthLabel = start.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

      const txs = await this.prisma.transaction.findMany({
        where: {
          userId: { in: userIds },
          status: 'POSTED',
          date: { gte: start, lte: end },
          OR: [
            { userId },
            { isHouseholdShared: true },
            { accountId: { in: accountIds } },
          ],
        },
        select: { type: true, amount: true },
      });

      let income = new Decimal(0);
      let expense = new Decimal(0);

      for (const tx of txs) {
        if (tx.type === 'INCOME') income = income.plus(tx.amount);
        if (tx.type === 'EXPENSE') expense = expense.plus(tx.amount);
      }

      months.push({
        month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        receitas: Number(income),
        despesas: Number(expense),
      });
    }

    return months;
  }

  /**
   * Faturas e Contas a Vencer nos próximos 15 dias
   */
  async getUpcomingBills(userId: string, scope: FinancialScope = FinancialScope.HOUSEHOLD) {
    const { userIds } = await this.getAuthorizedScope(userId, scope);

    const today = new Date();
    const next15Days = new Date();
    next15Days.setDate(today.getDate() + 15);

    const upcomingBills = await this.prisma.creditCardBill.findMany({
      where: {
        status: 'OPEN',
        dueDate: { gte: today, lte: next15Days },
        creditCard: { userId: { in: userIds }, isActive: true },
      },
      include: {
        creditCard: { select: { name: true, colorHex: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    return upcomingBills.map((b) => ({
      id: b.id,
      cardName: b.creditCard.name,
      colorHex: b.creditCard.colorHex,
      dueDate: b.dueDate,
      amount: Number(b.totalAmount),
    }));
  }
}
