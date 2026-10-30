import { FinancialScope } from '../enums';

export interface AiChatMessage {
  role: 'user' | 'model' | 'system';
  content: string;
  toolCalls?: AiToolCallPayload[];
}

export interface AiToolCallPayload {
  toolName: string;
  args: Record<string, unknown>;
  result?: Record<string, unknown>;
}

export interface GoalDraftPayload {
  title: string;
  description?: string;
  targetAmount: number;
  targetDate: string;
  monthlyContribution?: number;
  isHouseholdShared: boolean;
}

export interface BudgetDraftPayload {
  categoryId: string;
  monthlyLimit: number;
  scope: FinancialScope;
}

export interface AiActionDraft {
  draftId: string;
  actionType: 'CREATE_GOAL' | 'UPDATE_BUDGET' | 'CLASSIFY_TRANSACTION';
  summary: string;
  payload: GoalDraftPayload | BudgetDraftPayload | Record<string, unknown>;
  expiresAt: Date;
}

