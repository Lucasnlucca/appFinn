import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoalDto, GoalContributionDto, FinancialScope } from '@finn-ai/shared';
import { Decimal } from '@finn-ai/database';

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista metas do Household com cálculos de progresso e prazos
   */
  async listGoals(userId: string, scope: FinancialScope = FinancialScope.HOUSEHOLD) {
    const memberships = await this.prisma.householdMember.findMany({ where: { userId } });
    if (memberships.length === 0) return [];

    const householdId = memberships[0].householdId;

    const goals = await this.prisma.goal.findMany({
      where: { householdId },
      include: {
        contributions: {
          orderBy: { date: 'desc' },
          take: 5,
        },
      },
      orderBy: [{ priority: 'asc' }, { targetDate: 'asc' }],
    });

    const now = new Date();

    return goals.map((goal) => {
      const target = Number(goal.targetAmount);
      const current = Number(goal.currentAmount);
      const remaining = Math.max(0, target - current);
      const progressPct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

      const diffTime = new Date(goal.targetDate).getTime() - now.getTime();
      const diffMonths = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30)));
      const suggestedMonthly = remaining > 0 ? Math.ceil(remaining / diffMonths) : 0;

      return {
        ...goal,
        targetAmount: target,
        currentAmount: current,
        remainingAmount: remaining,
        progressPct,
        diffMonths,
        suggestedMonthly,
      };
    });
  }

  /**
   * Cria nova meta de economia
   */
  async createGoal(userId: string, dto: CreateGoalDto) {
    const memberships = await this.prisma.householdMember.findMany({ where: { userId } });
    if (memberships.length === 0) {
      throw new BadRequestException('Você precisa pertencer a um núcleo familiar para cadastrar metas');
    }

    const householdId = memberships[0].householdId;

    return this.prisma.goal.create({
      data: {
        householdId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        targetAmount: new Decimal(dto.targetAmount),
        currentAmount: new Decimal(0),
        targetDate: new Date(dto.targetDate),
        plannedMonthly: dto.plannedMonthly ? new Decimal(dto.plannedMonthly) : null,
        priority: dto.priority || 1,
        status: 'IN_PROGRESS',
      },
    });
  }

  /**
   * Registra aporte em uma meta existente
   */
  async addContribution(userId: string, goalId: string, dto: GoalContributionDto) {
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal) {
      throw new NotFoundException('Meta financeira não encontrada');
    }

    const amount = new Decimal(dto.amount);

    return this.prisma.$transaction(async (tx) => {
      const contribution = await tx.goalContribution.create({
        data: {
          goalId,
          amount,
          notes: dto.notes || null,
        },
      });

      const updatedGoal = await tx.goal.update({
        where: { id: goalId },
        data: {
          currentAmount: { increment: amount },
        },
      });

      return {
        contributionId: contribution.id,
        newCurrentAmount: Number(updatedGoal.currentAmount),
        amountContributed: Number(amount),
      };
    });
  }
}

