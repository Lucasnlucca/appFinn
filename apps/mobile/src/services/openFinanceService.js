import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  CONNECTED_BANKS: '@finn_connected_banks_v2',
  OPEN_FINANCE_SYNC: '@finn_open_finance_last_sync',
};

export const SUPPORTED_BANKS = [
  {
    id: 'nubank',
    name: 'Nubank',
    code: '260',
    color: '#820AD1',
    icon: 'wallet-outline',
    type: 'Conta Corrente & Cartão Ultravioleta',
    defaultBalance: 2450.80,
  },
  {
    id: 'inter',
    name: 'Banco Inter',
    code: '077',
    color: '#FF7A00',
    icon: 'card-outline',
    type: 'Conta Digital & Investimentos',
    defaultBalance: 1890.30,
  },
  {
    id: 'itau',
    name: 'Itaú Unibanco',
    code: '341',
    color: '#EC7000',
    icon: 'business-outline',
    type: 'Conta Corrente & Poupança',
    defaultBalance: 5120.00,
  },
  {
    id: 'bradesco',
    name: 'Bradesco',
    code: '237',
    color: '#CC092F',
    icon: 'business-outline',
    type: 'Conta Corrente',
    defaultBalance: 980.50,
  },
  {
    id: 'santander',
    name: 'Santander',
    code: '033',
    color: '#EC0000',
    icon: 'business-outline',
    type: 'Conta Corrente Select',
    defaultBalance: 3200.00,
  },
  {
    id: 'c6',
    name: 'C6 Bank',
    code: '336',
    color: '#242424',
    icon: 'card-outline',
    type: 'Conta Corrente & Cartão Carbon',
    defaultBalance: 750.20,
  },
  {
    id: 'xp',
    name: 'XP Investimentos',
    code: '102',
    color: '#000000',
    icon: 'trending-up-outline',
    type: 'Conta Global & Cartão Visa Infinite',
    defaultBalance: 12500.00,
  },
];

/**
 * Obtém os bancos atualmente conectados via Open Finance
 */
export async function getConnectedBanks() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.CONNECTED_BANKS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Conecta um banco com consentimento Open Finance (Somente Leitura)
 */
export async function connectBank(bankId) {
  const bank = SUPPORTED_BANKS.find((b) => b.id === bankId);
  if (!bank) throw new Error('Instituição bancária não suportada');

  const connected = await getConnectedBanks();
  const existingIdx = connected.findIndex((b) => b.id === bankId);

  const connectionRecord = {
    ...bank,
    connectedAt: new Date().toISOString(),
    lastSyncAt: new Date().toISOString(),
    status: 'ACTIVE',
    consentScope: 'READ_ONLY_ACCOUNTS_TRANSACTIONS',
    consentExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 ano de consentimento Bacen
  };

  let updatedList;
  if (existingIdx >= 0) {
    updatedList = [...connected];
    updatedList[existingIdx] = connectionRecord;
  } else {
    updatedList = [connectionRecord, ...connected];
  }

  await AsyncStorage.setItem(STORAGE_KEYS.CONNECTED_BANKS, JSON.stringify(updatedList));
  return connectionRecord;
}

/**
 * Desconecta banco
 */
export async function disconnectBank(bankId) {
  const connected = await getConnectedBanks();
  const filtered = connected.filter((b) => b.id !== bankId);
  await AsyncStorage.setItem(STORAGE_KEYS.CONNECTED_BANKS, JSON.stringify(filtered));
  return true;
}

/**
 * Simula a sincronização automática de transações via Open Finance
 */
export async function syncOpenFinanceTransactions(bankId) {
  const mockSyncTransactions = [
    {
      description: 'Supermercado Pão de Açúcar',
      amount: 245.90,
      type: 'expense',
      category: 'alimentacao',
      date: new Date().toISOString().split('T')[0],
      source: 'Open Finance',
    },
    {
      description: 'Posto Shell Combustível',
      amount: 150.00,
      type: 'expense',
      category: 'transporte',
      date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      source: 'Open Finance',
    },
    {
      description: 'Farmácia Drogasil',
      amount: 68.40,
      type: 'expense',
      category: 'saude',
      date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
      source: 'Open Finance',
    },
  ];

  await AsyncStorage.setItem(STORAGE_KEYS.OPEN_FINANCE_SYNC, new Date().toISOString());
  return mockSyncTransactions;
}

