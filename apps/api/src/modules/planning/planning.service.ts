import { Injectable } from '@nestjs/common';
import { SimulatePlanDto } from '@finn-ai/shared';

export interface ScenarioResult {
  name: string;
  monthlyRatePct: number;
  annualRatePct: number;
  monthsToReach: number;
  totalContributed: number;
  totalInterestEarned: number;
  description: string;
}

@Injectable()
export class PlanningService {
  /**
   * Simula os 3 cenários financeiros com aportes mensais e juros compostos
   */
  simulateScenarios(dto: SimulatePlanDto): {
    targetAmount: number;
    monthlyContribution: number;
    scenarios: ScenarioResult[];
  } {
    const target = dto.targetAmount;
    const pmt = dto.monthlyContribution;

    // 1. Conservador: Poupança / Reserva simples (0.45% a.m.)
    const conservative = this.calculateMonthsToTarget(target, pmt, 0.0045, 'Conservador (Poupança)', 5.5);

    // 2. Base: Tesouro Selic / 100% CDI Líquido (0.80% a.m.)
    const baseline = this.calculateMonthsToTarget(target, pmt, 0.0080, 'Cenário Base (100% CDI)', 10.0);

    // 3. Otimista: Carteira Diversificada de Médio Prazo (1.05% a.m.)
    const optimistic = this.calculateMonthsToTarget(target, pmt, 0.0105, 'Otimista (Carteira Diversificada)', 13.3);

    return {
      targetAmount: target,
      monthlyContribution: pmt,
      scenarios: [conservative, baseline, optimistic],
    };
  }

  private calculateMonthsToTarget(
    target: number,
    pmt: number,
    rateMonthly: number,
    name: string,
    annualRatePct: number,
  ): ScenarioResult {
    let accumulated = 0;
    let months = 0;

    // Simulação mês a mês
    while (accumulated < target && months < 360) {
      accumulated = (accumulated + pmt) * (1 + rateMonthly);
      months++;
    }

    const totalContributed = months * pmt;
    const totalInterestEarned = Math.max(0, accumulated - totalContributed);

    return {
      name,
      monthlyRatePct: Number((rateMonthly * 100).toFixed(2)),
      annualRatePct,
      monthsToReach: months,
      totalContributed: Math.round(totalContributed),
      totalInterestEarned: Math.round(totalInterestEarned),
      description: `Alcança o objetivo em cerca de ${months} meses (${(months / 12).toFixed(1)} anos), gerando R$ ${Math.round(totalInterestEarned).toLocaleString('pt-BR')} em rendimentos de juros compostos.`,
    };
  }
}

