import { AccountType, SyncStatus } from '../enums';

export interface BankAccountDto {
  externalId: string;
  name: string;
  type: AccountType;
  subtype?: string;
  number?: string;
  balance: number;
  currencyCode: string;
  updatedAt: Date;
}

export interface BankTransactionDto {
  externalId: string;
  accountId: string;
  description: string;
  amount: number;
  date: Date;
  type: 'DEBIT' | 'CREDIT';
  status: 'PENDING' | 'POSTED';
  category?: string;
  merchantName?: string;
}

export interface TransactionPage {
  transactions: BankTransactionDto[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface ConnectionStatus {
  connectionId: string;
  status: SyncStatus;
  lastSyncAt?: Date;
  consentExpiresAt?: Date;
  errorMessage?: string;
}

export interface BankingProvider {
  readonly providerName: string;
  authenticate(): Promise<string>;
  getAccounts(connectionId: string): Promise<BankAccountDto[]>;
  getTransactions(accountId: string, cursor?: string): Promise<TransactionPage>;
  getConnectionStatus(connectionId: string): Promise<ConnectionStatus>;
  disconnect(connectionId: string): Promise<void>;
}

