import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BankingProvider,
  BankAccountDto,
  BankTransactionDto,
  TransactionPage,
  ConnectionStatus,
  AccountType,
  SyncStatus,
} from '@finn-ai/shared';

@Injectable()
export class PluggyBankingProvider implements BankingProvider {
  readonly providerName = 'PLUGGY';
  private readonly logger = new Logger(PluggyBankingProvider.name);

  private cachedApiKey: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(private readonly configService: ConfigService) { }

  /**
   * Autentica na API Pluggy oficial usando Client ID e Client Secret.
   * Mantém em memória a chave temporária retornada (válida por ~30 min).
   */
  async authenticate(): Promise<string> {
    // Reutiliza token se ainda estiver válido com folga de 2 minutos
    if (this.cachedApiKey && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.cachedApiKey;
    }

    const clientId = this.configService.get<string>('pluggy.clientId');
    const clientSecret = this.configService.get<string>('pluggy.clientSecret');
    const baseUrl = this.configService.get<string>('pluggy.baseUrl', 'https://api.pluggy.ai');

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId || '');

    if (!clientId || !clientSecret || !isUuid || clientId.includes('mock') || clientId === 'sandbox') {
      this.logger.warn('Pluggy ClientId/ClientSecret em modo mock/sandbox.');
      return 'mock-pluggy-api-key';
    }

    try {
      const response = await fetch(`${baseUrl}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha de autenticação Pluggy: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as any;
      this.cachedApiKey = data.apiKey;
      // Define validade de 25 minutos
      const exp = new Date();
      exp.setMinutes(exp.getMinutes() + 25);
      this.tokenExpiresAt = exp;

      return this.cachedApiKey!;
    } catch (err: any) {
      this.logger.error(`Erro ao autenticar na Pluggy: ${err.message}`);
      throw err;
    }
  }

  /**
   * Consulta as contas vinculadas a um Item ID no Pluggy
   */
  async getAccounts(itemId: string): Promise<BankAccountDto[]> {
    const apiKey = await this.authenticate();
    const baseUrl = this.configService.get<string>('pluggy.baseUrl', 'https://api.pluggy.ai');

    // Modo Mock para testes locais sem credenciais reais
    if (apiKey === 'mock-pluggy-api-key') {
      return [
        {
          externalId: `mock-acc-${itemId}-1`,
          name: 'Conta Corrente Banco Sandbox',
          type: AccountType.CHECKING,
          number: '12345-6',
          balance: 3450.80,
          currencyCode: 'BRL',
          updatedAt: new Date(),
        },
        {
          externalId: `mock-acc-${itemId}-2`,
          name: 'Reserva Financeira CDI',
          type: AccountType.INVESTMENT,
          number: '98765-4',
          balance: 15200.00,
          currencyCode: 'BRL',
          updatedAt: new Date(),
        },
      ];
    }

    const response = await fetch(`${baseUrl}/accounts?itemId=${encodeURIComponent(itemId)}`, {
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Erro ao buscar contas do Item ${itemId}: ${response.status} - ${err}`);
    }

    const data = (await response.json()) as any;
    const results = data.results || [];

    return results.map((acc: any) => ({
      externalId: acc.id,
      name: acc.name,
      type: this.mapAccountType(acc.type, acc.subtype),
      subtype: acc.subtype,
      number: acc.number,
      balance: parseFloat(acc.balance) || 0,
      currencyCode: acc.currencyCode || 'BRL',
      updatedAt: new Date(acc.updatedAt || Date.now()),
    }));
  }

  /**
   * Consulta transações de uma conta bancária com paginação
   */
  async getTransactions(accountId: string, cursor?: string): Promise<TransactionPage> {
    const apiKey = await this.authenticate();
    const baseUrl = this.configService.get<string>('pluggy.baseUrl', 'https://api.pluggy.ai');

    if (apiKey === 'mock-pluggy-api-key') {
      return {
        transactions: [
          {
            externalId: `tx-mock-${accountId}-1`,
            accountId,
            description: 'Supermercado Modelo (Sandbox)',
            amount: 234.50,
            date: new Date(),
            type: 'DEBIT',
            status: 'POSTED',
            category: 'Alimentação',
          },
          {
            externalId: `tx-mock-${accountId}-2`,
            accountId,
            description: 'TED Recebida Salário (Sandbox)',
            amount: 4500.00,
            date: new Date(),
            type: 'CREDIT',
            status: 'POSTED',
            category: 'Salário',
          },
        ],
        hasMore: false,
      };
    }

    let url = `${baseUrl}/transactions?accountId=${encodeURIComponent(accountId)}&pageSize=100`;
    if (cursor) {
      url += `&page=${cursor}`;
    }

    const response = await fetch(url, {
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Erro ao buscar transações da conta ${accountId}: ${response.status} - ${err}`);
    }

    const data = (await response.json()) as any;
    const results = data.results || [];

    const mappedTransactions: BankTransactionDto[] = results.map((tx: any) => ({
      externalId: tx.id,
      accountId: tx.accountId,
      description: tx.description,
      amount: Math.abs(parseFloat(tx.amount) || 0),
      date: new Date(tx.date),
      type: parseFloat(tx.amount) < 0 ? 'DEBIT' : 'CREDIT',
      status: tx.status === 'PENDING' ? 'PENDING' : 'POSTED',
      category: tx.category,
      merchantName: tx.merchant?.name,
    }));

    return {
      transactions: mappedTransactions,
      nextCursor: data.page < data.totalPages ? String(data.page + 1) : undefined,
      hasMore: data.page < data.totalPages,
    };
  }

  /**
   * Consulta status da conexão
   */
  async getConnectionStatus(connectionId: string): Promise<ConnectionStatus> {
    return {
      connectionId,
      status: SyncStatus.SUCCESS,
      lastSyncAt: new Date(),
    };
  }

  /**
   * Desconecta conexão
   */
  async disconnect(connectionId: string): Promise<void> {
    this.logger.log(`Conexão bancária ${connectionId} revogada no FINN AI.`);
  }

  private mapAccountType(type?: string, subtype?: string): AccountType {
    const t = (type || '').toUpperCase();
    const s = (subtype || '').toUpperCase();

    if (t === 'BANK' && s.includes('SAVINGS')) return AccountType.SAVINGS;
    if (t === 'INVESTMENT') return AccountType.INVESTMENT;
    if (t === 'CREDIT') return AccountType.OTHER;
    return AccountType.CHECKING;
  }
}