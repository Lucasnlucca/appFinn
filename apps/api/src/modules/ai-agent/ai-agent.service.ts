import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { TransactionsService } from '../transactions/transactions.service';
import { FINN_FUNCTION_DECLARATIONS } from './tools/finn-tools';
import { FinancialScope } from '@finn-ai/shared';
import { Decimal } from '@finn-ai/database';

export interface ChatResponseDto {
  conversationId: string;
  response: string;
  toolCalls?: Array<{
    toolName: string;
    args: any;
    result?: any;
  }>;
  actionDraft?: {
    draftId: string;
    actionType: 'CREATE_GOAL';
    title: string;
    targetAmount: number;
    targetDate: string;
    isHouseholdShared: boolean;
  };
}

@Injectable()
export class AiAgentService {
  private readonly logger = new Logger(AiAgentService.name);
  private draftsCache = new Map<string, any>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly reportsService: ReportsService,
    private readonly transactionsService: TransactionsService,
  ) {}

  /**
   * Processa mensagem do usuário com Function Calling e isolamento de permissões
   */
  async processUserMessage(
    userId: string,
    message: string,
    conversationId?: string,
    scope: FinancialScope = FinancialScope.HOUSEHOLD,
  ): Promise<ChatResponseDto> {
    // 1. Obtém ou cria conversa
    let conversation;
    if (conversationId) {
      conversation = await this.prisma.aiConversation.findUnique({
        where: { id: conversationId },
      });
    }

    if (!conversation) {
      conversation = await this.prisma.aiConversation.create({
        data: {
          userId,
          title: message.substring(0, 30) + '...',
        },
      });
    }

    // 2. Grava a mensagem do usuário no histórico
    await this.prisma.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message,
      },
    });

    const apiKey = this.configService.get<string>('gemini.apiKey');
    const modelName = this.configService.get<string>('gemini.model', 'gemini-2.5-flash');

    // MODO INTELIGENTE COM GEMINI OFICIAL OU MOCK DETERMINÍSTICO SE NÃO HOUVER CHAVE
    if (!apiKey || apiKey.includes('your_gemini') || apiKey.includes('mock')) {
      return this.handleLocalAgentInference(userId, conversation.id, message, scope);
    }

    try {
      // Uso do SDK oficial @google/genai
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      // Busca histórico recente para contexto
      const recentMessages = await this.prisma.aiMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'desc' },
        take: 6,
      });

      const formattedContents = recentMessages.reverse().map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      // Chamada com ferramentas
      const response = await ai.models.generateContent({
        model: modelName,
        contents: formattedContents,
        config: {
          systemInstruction: `Você é o FINN, o agente financeiro com inteligência artificial para o casal.
Suas análises são fundamentadas em dados reais das contas.
Você é proativo, empático, educado e rigoroso com a precisão dos centavos.
NUNCA invente números ou tente executar comandos de banco de dados.
Se o usuário solicitar uma alteração ou criação de meta, use createGoalDraft para apresentar uma proposta que exigirá a confirmação dele.`,
          tools: [{ functionDeclarations: FINN_FUNCTION_DECLARATIONS as any }],
        },
      });

      const candidate = response.candidates?.[0];
      const functionCalls = candidate?.content?.parts?.filter((p: any) => p.functionCall)?.map((p: any) => p.functionCall) || [];

      // Se o Gemini não chamou ferramentas, retorna o texto diretamente
      if (functionCalls.length === 0) {
        const textContent = candidate?.content?.parts?.[0]?.text || 'Como posso ajudar com as finanças da sua família hoje?';
        await this.prisma.aiMessage.create({
          data: {
            conversationId: conversation.id,
            role: 'model',
            content: textContent,
          },
        });
        return { conversationId: conversation.id, response: textContent };
      }

      // Executa as ferramentas requisitadas pelo modelo
      let actionDraft: any = undefined;
      const toolResults: any[] = [];

      for (const call of functionCalls) {
        const toolName = call.name;
        const args = call.args || {};
        let result: any = null;

        if (toolName === 'getFinancialSummary') {
          result = await this.reportsService.getSummary(userId, args.scope || scope);
        } else if (toolName === 'getSpendingByCategory') {
          result = await this.reportsService.getCategoriesBreakdown(userId, args.scope || scope);
        } else if (toolName === 'getTransactions') {
          result = await this.transactionsService.listTransactions(userId, { scope: args.scope || scope });
        } else if (toolName === 'simulateSavingsPlan') {
          const months = Math.ceil(args.targetAmount / args.monthlyDeposit);
          result = {
            targetAmount: args.targetAmount,
            monthlyDeposit: args.monthlyDeposit,
            estimatedMonths: months,
            projectedCompletionDate: new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          };
        } else if (toolName === 'createGoalDraft') {
          const draftId = crypto.randomUUID();
          actionDraft = {
            draftId,
            actionType: 'CREATE_GOAL',
            title: args.title,
            targetAmount: args.targetAmount,
            targetDate: args.targetDate,
            isHouseholdShared: args.isHouseholdShared ?? true,
          };
          this.draftsCache.set(draftId, { userId, ...actionDraft });
          result = { status: 'DRAFT_CREATED', draftId, message: 'Rascunho criado. Aguardando aprovação explícita do usuário.' };
        }

        toolResults.push({ toolName, args, result });
      }

      // Segunda chamada com os resultados das ferramentas para gerar o texto final
      const followUp = await ai.models.generateContent({
        model: modelName,
        contents: [
          ...formattedContents,
          {
            role: 'user',
            parts: [{ text: `Resultados das ferramentas executadas pelo sistema: ${JSON.stringify(toolResults)}` }],
          },
        ],
      });

      const finalReply = followUp.candidates?.[0]?.content?.parts?.[0]?.text || 'Analisei os dados financeiros conforme solicitado.';

      await this.prisma.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'model',
          content: finalReply,
        },
      });

      return {
        conversationId: conversation.id,
        response: finalReply,
        toolCalls: toolResults,
        actionDraft,
      };
    } catch (err: any) {
      this.logger.error(`Erro ao consultar Gemini API: ${err.message}. Ativando agente local.`);
      return this.handleLocalAgentInference(userId, conversation.id, message, scope);
    }
  }

  /**
   * Agente Local Inteligente (fallback e desenvolvimento offline)
   */
  private async handleLocalAgentInference(
    userId: string,
    conversationId: string,
    message: string,
    scope: FinancialScope,
  ): Promise<ChatResponseDto> {
    const lower = message.toLowerCase();
    let reply = '';
    let toolCalls: any[] = [];
    let actionDraft: any = undefined;

    if (lower.includes('resumo') || lower.includes('gastamos') || lower.includes('este mês') || lower.includes('saldo') || lower.includes('patrimônio')) {
      const summary = await this.reportsService.getSummary(userId, scope);
      reply = `Aqui está o resumo financeiro consolidado (${scope === FinancialScope.HOUSEHOLD ? 'Familiar' : 'Individual'}):\n\n` +
        `• **Patrimônio Líquido:** R$ ${summary.netWorth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
        `• **Receitas do Mês:** R$ ${summary.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
        `• **Despesas Realizadas:** R$ ${summary.totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
        `• **Economia Líquida:** R$ ${summary.netSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
        `• **Taxa de Poupança:** ${summary.savingsRatePct.toString().replace('.', ',')}%\n\n` +
        (summary.savingsRatePct > 20
          ? ' Vocês estão com uma taxa de poupança excelente neste mês!'
          : ' Fique de olho nos gastos da segunda quinzena para não comprometer a reserva.');

      toolCalls.push({ toolName: 'getFinancialSummary', args: { scope }, result: summary });
    } else if (lower.includes('categoria') || lower.includes('onde estamos gastando') || lower.includes('mercado') || lower.includes('alimentação')) {
      const cats = await this.reportsService.getCategoriesBreakdown(userId, scope);
      const top3 = cats.slice(0, 3);
      reply = `Analisando os gastos por categoria no mês:\n\n` +
        top3.map((c) => `• **${c.name}:** R$ ${c.totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${c.percentage}%)`).join('\n') +
        `\n\nEssa distribuição representa o maior volume de saídas do orçamento do casal.`;

      toolCalls.push({ toolName: 'getSpendingByCategory', args: { scope }, result: cats });
    } else if (lower.includes('meta') || lower.includes('guardar') || lower.includes('economizar') || lower.includes('viagem') || lower.includes('reserva')) {
      // Cria rascunho de meta em 2 etapas
      const draftId = crypto.randomUUID();
      actionDraft = {
        draftId,
        actionType: 'CREATE_GOAL',
        title: 'Reserva de Viagem / Férias',
        targetAmount: 12000,
        targetDate: '2026-12-20',
        isHouseholdShared: true,
      };

      this.draftsCache.set(draftId, { userId, ...actionDraft });

      reply = `Com certeza! Preparei um rascunho de meta para vocês acumularem **R$ 12.000,00** até Dezembro de 2026.\n\n` +
        `Economizando cerca de **R$ 600,00 por mês**, vocês atingirão o objetivo com tranquilidade.\n\n` +
        `Para registrar a meta definitivamente no sistema, clique no botão **[Aprovar Meta]** abaixo:`;

      toolCalls.push({ toolName: 'createGoalDraft', args: actionDraft, result: { status: 'DRAFT_CREATED' } });
    } else {
      reply = `Olá! Sou o **FINN**, seu consultor financeiro familiar com IA.\n\n` +
        `Posso consultar seu fluxo de caixa, calcular sua taxa de poupança, analisar despesas por categoria ou simular planos de metas para o casal. Como posso te ajudar agora?`;
    }

    await this.prisma.aiMessage.create({
      data: {
        conversationId,
        role: 'model',
        content: reply,
      },
    });

    return {
      conversationId,
      response: reply,
      toolCalls,
      actionDraft,
    };
  }

  /**
   * Confirmação explícita de Rascunho (Protocolo de 2 Etapas)
   */
  async confirmDraft(userId: string, draftId: string) {
    const draft = this.draftsCache.get(draftId);
    if (!draft || draft.userId !== userId) {
      throw new BadRequestException('Rascunho não encontrado ou expirado');
    }

    const memberships = await this.prisma.householdMember.findMany({ where: { userId } });
    const householdId = memberships[0]?.householdId;

    if (!householdId) {
      throw new BadRequestException('Você precisa pertencer a um núcleo familiar para criar metas');
    }

    if (draft.actionType === 'CREATE_GOAL') {
      const goal = await this.prisma.goal.create({
        data: {
          householdId,
          title: draft.title,
          targetAmount: new Decimal(draft.targetAmount),
          currentAmount: new Decimal(0),
          targetDate: new Date(draft.targetDate),
          status: 'IN_PROGRESS',
        },
      });

      this.draftsCache.delete(draftId);
      return {
        success: true,
        message: `Meta "${goal.title}" de R$ ${Number(goal.targetAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} criada com sucesso!`,
        goal,
      };
    }

    throw new BadRequestException('Ação de rascunho desconhecida');
  }

  /**
   * Lista conversas do usuário
   */
  async listConversas(userId: string) {
    return this.prisma.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
  }
}

