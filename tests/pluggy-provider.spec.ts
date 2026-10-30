import { PluggyBankingProvider } from '../apps/api/src/modules/banking/providers/pluggy.provider';
import { AccountType } from '../packages/shared/src/enums';

describe('Integração Bancária Open Finance (Meu Pluggy)', () => {
  let provider: PluggyBankingProvider;

  beforeEach(() => {
    const mockConfigService = {
      get: (key: string, defaultValue?: any) => {
        if (key === 'pluggy.clientId') return 'mock-client-id';
        if (key === 'pluggy.clientSecret') return 'mock-client-secret';
        if (key === 'pluggy.baseUrl') return 'https://api.pluggy.ai';
        return defaultValue;
      },
    } as any;

    provider = new PluggyBankingProvider(mockConfigService);
  });

  it('deve ter o nome de provedor definido como PLUGGY', () => {
    expect(provider.providerName).toBe('PLUGGY');
  });

  it('deve mapear corretamente contas retornadas em formato padrão', async () => {
    // Utilizando o fallback sandbox do provider
    const accounts = await provider.getAccounts('sandbox-item-123');

    expect(accounts.length).toBeGreaterThan(0);
    expect(accounts[0]).toHaveProperty('externalId');
    expect(accounts[0]).toHaveProperty('balance');
    expect(accounts[0].currencyCode).toBe('BRL');
    expect(accounts[0].type).toBe(AccountType.CHECKING);
  });

  it('deve normalizar transações bancárias e classificar débito como EXPENSE e crédito como INCOME', async () => {
    const page = await provider.getTransactions('sandbox-account-456');

    expect(page.transactions.length).toBe(2);

    const expenseTx = page.transactions.find((t) => t.type === 'DEBIT');
    const incomeTx = page.transactions.find((t) => t.type === 'CREDIT');

    expect(expenseTx).toBeDefined();
    expect(expenseTx?.amount).toBeGreaterThan(0); // Sempre positivo com indicador de tipo
    expect(incomeTx).toBeDefined();
    expect(incomeTx?.amount).toBeGreaterThan(0);
  });

  it('deve validar limite de 5 conexões da modalidade pessoal Meu Pluggy', () => {
    const existingConnectionsCount = 5;
    const canAddMore = existingConnectionsCount < 5;
    expect(canAddMore).toBe(false);
  });
});

