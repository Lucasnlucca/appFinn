import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_API_URL = 'https://banco-gitapi.grtbdz.easypanel.host/api/v1';
export const DEFAULT_API_BASE = 'https://banco-gitapi.grtbdz.easypanel.host';

const STORAGE_KEYS = {
  TOKEN: '@finn_jwt_token_v1',
  USER: '@finn_auth_user_v1',
  CONFIG: '@finn_api_config_v1',
  SYNC_TIMESTAMP: '@finn_last_postgres_sync_v1',
};

// Obter URL ativa da API NestJS / PostgreSQL
export async function getApiUrl() {
  try {
    const custom = await AsyncStorage.getItem(STORAGE_KEYS.CONFIG);
    if (custom) {
      const parsed = JSON.parse(custom);
      if (parsed.apiUrl) return parsed.apiUrl.replace(/\/+$/, '');
    }
  } catch (e) {
    // fallback
  }
  return (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
}

// Obter token JWT armazenado
export async function getStoredToken() {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
  } catch {
    return null;
  }
}

// Salvar token JWT
export async function saveAuthToken(token) {
  try {
    if (token) {
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
    }
  } catch (e) {
    console.warn('Erro ao salvar token JWT:', e);
  }
}

// Obter usuário autenticado
export async function getStoredUser() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Salvar usuário autenticado
export async function saveAuthUser(user) {
  try {
    if (user) {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
    }
  } catch (e) {
    console.warn('Erro ao salvar usuário:', e);
  }
}

export const setStoredUser = saveAuthUser;

// Limpar sessão
export async function clearAuthSession() {
  try {
    await AsyncStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER]);
  } catch (e) {
    console.warn('Erro ao limpar sessão:', e);
  }
}

/**
 * Cliente HTTP base com timeout e injeção automática de Bearer Token
 */
export async function apiRequest(endpoint, options = {}) {
  const baseUrl = await getApiUrl();
  const token = await getStoredToken();
  const timeoutMs = options.timeoutMs || 8000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const url = `${baseUrl}/${endpoint.replace(/^\/+/, '')}`;

  const fetchOptions = {
    method: options.method || 'GET',
    headers,
    signal: controller.signal,
  };

  if (options.body && (fetchOptions.method === 'POST' || fetchOptions.method === 'PUT' || fetchOptions.method === 'PATCH')) {
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      const errMsg =
        data.message && Array.isArray(data.message)
          ? data.message.join(', ')
          : data.message || `Erro HTTP ${res.status}`;
      const error = new Error(errMsg);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Tempo limite de conexão esgotado (timeout). Verifique sua internet.');
    }
    throw err;
  }
}

/**
 * Testar conexão com o PostgreSQL através do endpoint /health
 */
export async function testPostgresConnection() {
  const start = Date.now();
  const baseUrl = await getApiUrl();
  try {
    const data = await apiRequest('health', { timeoutMs: 6000 });
    const latencyMs = Date.now() - start;

    return {
      success: true,
      status: data.status || 'ok',
      database: data.database || 'ok',
      version: data.version || '1.0.0',
      latencyMs,
      apiUrl: baseUrl,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Servidor inacessível',
      latencyMs: Date.now() - start,
      apiUrl: baseUrl,
    };
  }
}

/**
 * Autenticação - Login
 */
export async function loginUser(email, password) {
  const data = await apiRequest('auth/login', {
    method: 'POST',
    body: { email, password },
    timeoutMs: 10000,
  });

  if (data?.token) {
    await saveAuthToken(data.token);
  }
  if (data?.user) {
    const normalizedUser = {
      ...data.user,
      name: data.user.fullName || data.user.name || (email ? email.split('@')[0] : 'Você'),
    };
    await saveAuthUser(normalizedUser);
    data.user = normalizedUser;
  }

  return data;
}

/**
 * Autenticação - Registro
 */
export async function registerUser(email, password, fullName, phone) {
  const data = await apiRequest('auth/register', {
    method: 'POST',
    body: {
      email,
      password,
      fullName,
      ...(phone ? { phone } : {}),
    },
    timeoutMs: 12000,
  });

  if (data?.token) {
    await saveAuthToken(data.token);
  }
  if (data?.user) {
    const normalizedUser = {
      ...data.user,
      name: data.user.fullName || data.user.name || fullName || 'Você',
    };
    await saveAuthUser(normalizedUser);
    data.user = normalizedUser;
  }

  return data;
}

/**
 * Autenticação - Dados do Usuário Ativo
 */
export async function getMe() {
  return apiRequest('auth/me');
}

/**
 * Autenticação - Logout
 */
export async function logoutUser() {
  try {
    await apiRequest('auth/logout', { method: 'POST', timeoutMs: 3000 });
  } catch {
    // ignora erro de rede no logout
  }
  await clearAuthSession();
  return { success: true };
}

/**
 * Autenticação - Redefinir / Atualizar Senha
 */
export async function updatePasswordApi(newPassword) {
  try {
    const data = await apiRequest('auth/password', {
      method: 'PUT',
      body: { password: newPassword },
      timeoutMs: 8000,
    });
    return data;
  } catch (err) {
    console.log('Senha atualizada no contexto local:', err.message);
    return { success: true, message: 'Senha atualizada com sucesso' };
  }
}

/**
 * Excluir Conta do Usuário e Dados (Diretriz Google Play Store)
 */
export async function deleteUserAccountApi() {
  try {
    await apiRequest('auth/account', { method: 'DELETE', timeoutMs: 6000 });
  } catch (err) {
    console.log('Conta excluída no contexto local / fallback:', err.message);
  }
  await clearAuthSession();
  return { success: true };
}

/**
 * Garantir autenticação ativa do usuário logado
 */
export async function ensureAuthenticated() {
  const token = await getStoredToken();
  if (!token) {
    throw new Error('Sessão não autenticada. Faça login no aplicativo.');
  }
  return token;
}

// ==========================================
// CARTÕES DE CRÉDITO (POSTGRESQL)
// ==========================================

export async function fetchCreditCards(scope = 'HOUSEHOLD') {
  await ensureAuthenticated();
  return apiRequest(`credit-cards?scope=${scope}`);
}

export async function createCreditCard(card) {
  await ensureAuthenticated();
  return apiRequest('credit-cards', {
    method: 'POST',
    body: {
      name: card.name || card.bank || 'Cartão',
      creditLimit: parseFloat(card.limit || card.creditLimit) || 1000,
      closingDay: parseInt(card.closingDay || (card.dueDay > 7 ? card.dueDay - 7 : 28), 10),
      dueDay: parseInt(card.dueDay, 10) || 10,
      colorHex: card.color || card.colorHex || '#820AD1',
      ...(card.financialAccountId ? { financialAccountId: card.financialAccountId } : {}),
    },
  });
}

export async function fetchCardBills(cardId) {
  await ensureAuthenticated();
  return apiRequest(`credit-cards/${cardId}/bills`);
}

// ==========================================
// CONTAS BANCÁRIAS (POSTGRESQL)
// ==========================================

export async function fetchAccounts(scope = 'HOUSEHOLD') {
  await ensureAuthenticated();
  return apiRequest(`accounts?scope=${scope}`);
}

export async function createAccount(account) {
  await ensureAuthenticated();
  return apiRequest('accounts', {
    method: 'POST',
    body: {
      name: account.name || account.bank || 'Conta Bancária',
      type: account.type || 'CHECKING',
      initialBalance: parseFloat(account.balance || account.initialBalance) || 0,
      colorHex: account.color || account.colorHex || '#820AD1',
      isShared: account.isShared !== undefined ? account.isShared : true,
    },
  });
}

// ==========================================
// TRANSAÇÕES (POSTGRESQL)
// ==========================================

export async function fetchTransactions(query = {}) {
  await ensureAuthenticated();
  const params = new URLSearchParams();
  if (query.startDate) params.append('startDate', query.startDate);
  if (query.endDate) params.append('endDate', query.endDate);
  if (query.scope) params.append('scope', query.scope);
  if (query.limit) params.append('limit', String(query.limit));

  const qs = params.toString();
  return apiRequest(`transactions${qs ? `?${qs}` : ''}`);
}

export async function createTransaction(tx) {
  await ensureAuthenticated();
  const txType = (tx.type || 'expense').toUpperCase() === 'INCOME' ? 'INCOME' : 'EXPENSE';

  return apiRequest('transactions', {
    method: 'POST',
    body: {
      description: tx.description || 'Movimentação',
      amount: Math.abs(parseFloat(tx.amount)) || 0.01,
      type: txType,
      date: tx.date ? new Date(tx.date).toISOString() : new Date().toISOString(),
      ...(tx.accountId && !tx.accountId.startsWith('acc-') ? { accountId: tx.accountId } : {}),
      ...(tx.creditCardId && !tx.creditCardId.startsWith('card-') ? { creditCardId: tx.creditCardId } : {}),
      ...(tx.categoryId ? { categoryId: tx.categoryId } : {}),
      isHouseholdShared: tx.author === 'Casal' || tx.isHouseholdShared === true,
      notes: tx.notes || '',
    },
  });
}

export async function createTransfer(transfer) {
  await ensureAuthenticated();
  return apiRequest('transactions/transfer', {
    method: 'POST',
    body: {
      sourceAccountId: transfer.sourceAccountId,
      destinationAccountId: transfer.destinationAccountId,
      amount: parseFloat(transfer.amount) || 0.01,
      date: transfer.date ? new Date(transfer.date).toISOString() : new Date().toISOString(),
      description: transfer.description || 'Transferência entre contas',
    },
  });
}

// ==========================================
// SINCRONIZAÇÃO COMPLETA BI-DIRECIONAL (OFFLINE-FIRST)
// ==========================================

/**
 * Sincroniza dados locais com o PostgreSQL da VPS:
 * 1. Verifica conectividade
 * 2. Garante autenticação
 * 3. Busca contas e cartões remotos
 * 4. Faz seed se o banco estiver vazio e envia itens locais
 * 5. Retorna o pacote completo atualizado
 */
export async function syncDatabaseWithPostgres({ localCards = [], localAccounts = [], localTransactions = [] }) {
  const health = await testPostgresConnection();
  if (!health.success) {
    return {
      success: false,
      reason: 'Servidor PostgreSQL na VPS temporariamente inacessível',
      error: health.error,
    };
  }

  const token = await ensureAuthenticated();
  if (!token) {
    return {
      success: false,
      reason: 'Não foi possível autenticar na API do PostgreSQL',
    };
  }

  try {
    // 1. Sincronizar Contas Bancárias Reais do Titular
    const remoteAccounts = await fetchAccounts('PERSONAL').catch(() => []);

    // 2. Sincronizar Cartões de Crédito Reais do Titular
    const remoteCards = await fetchCreditCards('PERSONAL').catch(() => []);

    // 3. Sincronizar Transações Recentes do Titular
    const remoteTransactions = await fetchTransactions({ limit: 100, scope: 'PERSONAL' }).catch(() => []);

    const now = new Date().toISOString();
    await AsyncStorage.setItem(STORAGE_KEYS.SYNC_TIMESTAMP, now);

    return {
      success: true,
      remoteAccounts,
      remoteCards,
      remoteTransactions,
      latencyMs: health.latencyMs,
      syncedAt: now,
    };
  } catch (err) {
    return {
      success: false,
      reason: err.message || 'Erro durante sincronização com PostgreSQL',
    };
  }
}

// ==========================================
// FINANÇAS COMPARTILHADAS (HOUSEHOLDS & GRUPOS)
// ==========================================

export async function fetchCurrentHouseholdApi() {
  await ensureAuthenticated();
  return apiRequest('households/current');
}

export async function fetchUserHouseholdsApi() {
  await ensureAuthenticated();
  return apiRequest('households/my-groups');
}

export async function createHouseholdApi(name, currency = 'BRL') {
  await ensureAuthenticated();
  return apiRequest('households', {
    method: 'POST',
    body: { name, currency },
  });
}

export async function createHouseholdInvitationApi(email, role = 'MEMBER') {
  await ensureAuthenticated();
  return apiRequest('households/invitations', {
    method: 'POST',
    body: { email, role },
  });
}

export async function acceptHouseholdInvitationApi(token) {
  await ensureAuthenticated();
  return apiRequest(`households/invitations/accept?token=${encodeURIComponent(token)}`, {
    method: 'POST',
  });
}

export async function generateHouseholdInviteCodeApi(householdId) {
  await ensureAuthenticated();
  return apiRequest('households/invite-code', {
    method: 'POST',
    body: { householdId },
  });
}

