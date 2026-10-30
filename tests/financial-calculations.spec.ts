import { Decimal } from '../packages/database/src';

describe('Cálculos Financeiros e Não-Duplicação de Renda Familiar', () => {
  it('deve manter precisão decimal absoluta sem erros de ponto flutuante (0.10 + 0.20 = 0.30)', () => {
    // Em JavaScript puro: 0.1 + 0.2 = 0.30000000000000004
    const a = new Decimal('0.10');
    const b = new Decimal('0.20');
    const result = a.plus(b);

    expect(result.toString()).toBe('0.3');
    expect(result.toFixed(2)).toBe('0.30');
  });

  it('deve calcular variações de saldo com centavos exatos em compras sucessivas', () => {
    let saldo = new Decimal('1500.55');

    const despesa1 = new Decimal('342.89');
    const despesa2 = new Decimal('129.99');
    const receita = new Decimal('2500.00');

    saldo = saldo.minus(despesa1).minus(despesa2).plus(receita);

    // 1500.55 - 342.89 - 129.99 + 2500.00 = 3527.67
    expect(saldo.toFixed(2)).toBe('3527.67');
  });

  it('deve neutralizar transferências entre membros do casal no consolidado familiar (soma zero)', () => {
    // Cenário: Esposa transfere R$ 1.500 para o marido ajudar no aluguel
    const transactions = [
      {
        id: 'tx-1',
        description: 'Repasse aluguel para marido',
        type: 'TRANSFER',
        amount: new Decimal('-1500.00'),
        isInternalHousehold: true,
      },
      {
        id: 'tx-2',
        description: 'Repasse aluguel recebido da esposa',
        type: 'TRANSFER',
        amount: new Decimal('1500.00'),
        isInternalHousehold: true,
      },
      {
        id: 'tx-3',
        description: 'Pagamento Imobiliária Aluguel',
        type: 'EXPENSE',
        amount: new Decimal('3000.00'),
        isInternalHousehold: false,
      },
    ];

    // Algoritmo de consolidação da família:
    // Transações do tipo TRANSFER marcadas como isInternalHousehold NÃO entram na soma de receitas ou despesas da família!
    let totalReceitaFamiliar = new Decimal(0);
    let totalDespesaFamiliar = new Decimal(0);

    for (const tx of transactions) {
      if (tx.isInternalHousehold && tx.type === 'TRANSFER') {
        // Ignora repasse interno entre o casal para não inflar receitas nem despesas
        continue;
      }

      if (tx.type === 'INCOME') {
        totalReceitaFamiliar = totalReceitaFamiliar.plus(tx.amount);
      } else if (tx.type === 'EXPENSE') {
        totalDespesaFamiliar = totalDespesaFamiliar.plus(tx.amount);
      }
    }

    // Apenas a despesa real de R$ 3.000 foi contabilizada para a família
    expect(totalDespesaFamiliar.toFixed(2)).toBe('3000.00');
    expect(totalReceitaFamiliar.toFixed(2)).toBe('0.00');
  });

  it('deve calcular corretamente o limite disponível do cartão de crédito', () => {
    const limiteTotal = new Decimal('12000.00');
    const comprasNaCompetencia = [
      new Decimal('450.00'),
      new Decimal('1200.50'),
      new Decimal('89.90'),
    ];

    const totalFaturaAberta = comprasNaCompetencia.reduce(
      (acc, val) => acc.plus(val),
      new Decimal(0),
    );

    const limiteDisponivel = Decimal.max(0, limiteTotal.minus(totalFaturaAberta));

    // 12000 - (450 + 1200.50 + 89.90) = 12000 - 1740.40 = 10259.60
    expect(totalFaturaAberta.toFixed(2)).toBe('1740.40');
    expect(limiteDisponivel.toFixed(2)).toBe('10259.60');
  });
});

