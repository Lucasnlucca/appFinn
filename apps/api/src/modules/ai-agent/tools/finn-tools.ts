/**
 * Catálogo de Ferramentas Function Calling do FINN AI
 * Cada ferramenta declara estritamente os parâmetros permitidos.
 * Nenhuma ferramenta permite execução de SQL ou código dinâmico.
 */
export const FINN_FUNCTION_DECLARATIONS = [
  {
    name: 'getFinancialSummary',
    description: 'Consulta o resumo financeiro atual (patrimônio líquido, receitas, despesas e taxa de poupança)',
    parameters: {
      type: 'OBJECT',
      properties: {
        scope: {
          type: 'STRING',
          enum: ['PERSONAL', 'HOUSEHOLD'],
          description: 'Escopo da consulta: PERSONAL (individual) ou HOUSEHOLD (familiar do casal)',
        },
      },
    },
  },
  {
    name: 'getSpendingByCategory',
    description: 'Consulta a distribuição de gastos agrupados por categoria no mês atual',
    parameters: {
      type: 'OBJECT',
      properties: {
        scope: {
          type: 'STRING',
          enum: ['PERSONAL', 'HOUSEHOLD'],
          description: 'Escopo: PERSONAL ou HOUSEHOLD',
        },
      },
    },
  },
  {
    name: 'getTransactions',
    description: 'Lista movimentações financeiras recentes com filtros',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: {
          type: 'NUMBER',
          description: 'Quantidade máxima de movimentações (padrão: 10)',
        },
        scope: {
          type: 'STRING',
          enum: ['PERSONAL', 'HOUSEHOLD'],
        },
      },
    },
  },
  {
    name: 'simulateSavingsPlan',
    description: 'Simula prazos e aportes mensais necessários para alcançar um objetivo financeiro',
    parameters: {
      type: 'OBJECT',
      required: ['targetAmount', 'monthlyDeposit'],
      properties: {
        targetAmount: {
          type: 'NUMBER',
          description: 'Valor total desejado (em Reais)',
        },
        monthlyDeposit: {
          type: 'NUMBER',
          description: 'Aporte mensal que o usuário planeja economizar (em Reais)',
        },
        annualRatePct: {
          type: 'NUMBER',
          description: 'Taxa anual estimada de rendimento (opcional, padrão 0%)',
        },
      },
    },
  },
  {
    name: 'createGoalDraft',
    description: 'Elabora um rascunho de meta financeira para o casal aprovar em 2 etapas. NÃO grava diretamente.',
    parameters: {
      type: 'OBJECT',
      required: ['title', 'targetAmount', 'targetDate'],
      properties: {
        title: {
          type: 'STRING',
          description: 'Título da meta (ex: Viagem de Férias, Reserva de Emergência)',
        },
        targetAmount: {
          type: 'NUMBER',
          description: 'Valor alvo a acumular (em Reais)',
        },
        targetDate: {
          type: 'STRING',
          description: 'Data estimada de conclusão (YYYY-MM-DD)',
        },
        isHouseholdShared: {
          type: 'BOOLEAN',
          description: 'Se a meta é do casal/família ou estritamente pessoal',
        },
      },
    },
  },
];

