import { FinancialScope, TransactionType } from '../enums';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface HouseholdSummary {
  id: string;
  name: string;
  currency: string;
  membersCount: number;
  currentUserRole: string;
}

export interface FinancialSummary {
  scope: FinancialScope;
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  savingsRatePct: number;
  totalAccountBalance: number;
  openCreditCardDebt: number;
}

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  colorHex?: string | null;
  icon?: string | null;
  totalSpent: number;
  percentageOfExpenses: number;
  budgetLimit?: number | null;
  budgetUsedPct?: number | null;
}

export interface GoalProgress {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  progressPct: number;
  remainingAmount: number;
  recommendedMonthlySavings: number;
  isHouseholdShared: boolean;
}

