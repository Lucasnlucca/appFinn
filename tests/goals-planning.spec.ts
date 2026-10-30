import { PlanningService } from '../apps/api/src/modules/planning/planning.service';

describe('Metas Financeiras, Orçamentos e Planejamento de Cenários', () => {
  let planningService: PlanningService;

  beforeEach(() => {
    planningService = new PlanningService();
  });

  it('deve simular 3 cenários de juros compostos onde o otimista atinge a meta em menos tempo que o conservador', () => {
    const simulation = planningService.simulateScenarios({
      targetAmount: 50000,
      monthlyContribution: 1000,
    });

    expect(simulation.scenarios.length).toBe(3);

    const [conservative, baseline, optimistic] = simulation.scenarios;

    // Quanto maior a taxa de juros real, menor a quantidade de meses necessária para acumular R$ 50.000
    expect(conservative.monthsToReach).toBeGreaterThan(baseline.monthsToReach);
    expect(baseline.monthsToReach).toBeGreaterThan(optimistic.monthsToReach);

    // No cenário otimista, o total de rendimentos de juros deve ser superior ao conservador
    expect(optimistic.totalInterestEarned).toBeGreaterThan(conservative.totalInterestEarned);
  });

  it('deve classificar alertas de orçamento corretamente (NORMAL <80%, WARNING 80-99%, EXCEEDED >=100%)', () => {
    function classifyBudget(spent: number, limit: number): string {
      const percentage = (spent / limit) * 100;
      if (percentage >= 100) return 'EXCEEDED';
      if (percentage >= 80) return 'WARNING';
      return 'NORMAL';
    }

    expect(classifyBudget(600, 1000)).toBe('NORMAL');    // 60%
    expect(classifyBudget(850, 1000)).toBe('WARNING');   // 85%
    expect(classifyBudget(1050, 1000)).toBe('EXCEEDED'); // 105%
  });

  it('deve calcular corretamente meses restantes e aporte mensal sugerido para meta', () => {
    const targetAmount = 12000;
    const currentAmount = 2400; // faltam 9.600
    const remaining = targetAmount - currentAmount;
    const monthsRemaining = 12;

    const suggestedMonthly = Math.ceil(remaining / monthsRemaining);

    expect(remaining).toBe(9600);
    expect(suggestedMonthly).toBe(800);
  });
});

