import { AiAgentService } from '../apps/api/src/modules/ai-agent/ai-agent.service';
import { FinancialScope } from '../packages/shared/src/enums';

describe('Agente Financeiro FINN (Google Gemini & Function Calling)', () => {
  let service: AiAgentService;
  let mockPrisma: any;
  let mockReportsService: any;
  let mockTransactionsService: any;

  beforeEach(() => {
    mockPrisma = {
      aiConversation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'conv-123', userId: 'user-1' }),
        create: jest.fn().mockResolvedValue({ id: 'conv-123', userId: 'user-1' }),
      },
      aiMessage: {
        create: jest.fn().mockResolvedValue({ id: 'msg-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      householdMember: {
        findMany: jest.fn().mockResolvedValue([{ householdId: 'house-123' }]),
      },
      goal: {
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'goal-999', ...args.data })),
      },
    };

    mockReportsService = {
      getSummary: jest.fn().mockResolvedValue({
        netWorth: 34210.50,
        totalIncome: 18500.00,
        totalExpense: 11240.30,
        netSavings: 7259.70,
        savingsRatePct: 39.2,
      }),
      getCategoriesBreakdown: jest.fn().mockResolvedValue([
        { name: 'Alimentação', totalSpent: 3850, percentage: 34.2 },
        { name: 'Moradia', totalSpent: 4200, percentage: 37.4 },
      ]),
    };

    mockTransactionsService = {
      listTransactions: jest.fn().mockResolvedValue([]),
    };

    const mockConfigService = {
      get: (key: string, defaultValue?: any) => {
        if (key === 'gemini.apiKey') return 'mock-gemini-key';
        return defaultValue;
      },
    } as any;

    service = new AiAgentService(
      mockPrisma,
      mockConfigService,
      mockReportsService,
      mockTransactionsService,
    );
  });

  it('deve disparar getFinancialSummary e retornar diagnóstico com precisão monetária', async () => {
    const res = await service.processUserMessage(
      'user-1',
      'Quanto gastamos este mês e qual nosso saldo?',
      'conv-123',
      FinancialScope.HOUSEHOLD,
    );

    expect(res.conversationId).toBe('conv-123');
    expect(res.response).toContain('Patrimônio Líquido');
    expect(res.response).toContain('39,2%');
    expect(res.toolCalls?.length).toBe(1);
    expect(res.toolCalls?.[0].toolName).toBe('getFinancialSummary');
    expect(mockReportsService.getSummary).toHaveBeenCalledWith('user-1', FinancialScope.HOUSEHOLD);
  });

  it('deve gerar rascunho (Draft) em 2 etapas ao solicitar criação de meta, SEM gravar direto no banco', async () => {
    const res = await service.processUserMessage(
      'user-1',
      'FINN, quero criar uma meta para juntar R$ 12.000 para viagem',
      'conv-123',
      FinancialScope.HOUSEHOLD,
    );

    expect(res.actionDraft).toBeDefined();
    expect(res.actionDraft?.actionType).toBe('CREATE_GOAL');
    expect(res.actionDraft?.targetAmount).toBe(12000);
    expect(res.actionDraft?.draftId).toBeDefined();

    // Prova de que a meta NÃO foi criada diretamente no banco de dados
    expect(mockPrisma.goal.create).not.toHaveBeenCalled();
  });

  it('deve efetivar a criação da meta no banco de dados SOMENTE após confirmação explícita do usuário', async () => {
    // 1. Gera o rascunho
    const chatRes = await service.processUserMessage(
      'user-1',
      'Crie uma meta de R$ 12.000 para férias',
      'conv-123',
    );

    const draftId = chatRes.actionDraft!.draftId;

    // 2. Usuário clica no botão de confirmação
    const confirmRes = await service.confirmDraft('user-1', draftId);

    expect(confirmRes.success).toBe(true);
    expect(mockPrisma.goal.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.goal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          householdId: 'house-123',
          title: 'Reserva de Viagem / Férias',
        }),
      }),
    );
  });
});

