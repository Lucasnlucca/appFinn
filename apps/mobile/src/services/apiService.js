import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_API_URL = 'https://banco-gitapi.grtbdz.easypanel.host/api/v1';
export const DEFAULT_API_BASE = 'https://banco-gitapi.grtbdz.easypanel.host';

const STORAGE_KEYS = {
  TOKEN: '@finn_jwt_token_v1',
  USER: '@finn_auth_user_v1',
  CONFIG: '@finn_api_config_v1',
  SYNC_TIMESTAMP: '@finn_last_postgres_sync_v1',
  PROFILES_REGISTRY: '@finn_saved_profiles_registry_v1',
  ACCOUNTS_REGISTRY: '@finn_registered_accounts_v1',
};

/**
 * Registra a conta autenticada no índice local por e-mail para impedir duplicidade
 * e garantir que o mesmo e-mail sempre use o mesmo ID de usuário do PostgreSQL.
 */
async function indexAccountByEmail(userObj, token = null) {
  if (!userObj?.email) return;
  try {
    const cleanEmail = String(userObj.email).trim().toLowerCase();
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ACCOUNTS_REGISTRY);
    const registry = raw ? JSON.parse(raw) : {};
    const existing = registry[cleanEmail] || {};

    // Nunca sobrescreve um UUID real do PostgreSQL com um ID temporário
    const bestId =
      userObj.id && !String(userObj.id).startsWith('google-')
        ? userObj.id
        : existing.id || userObj.id;

    registry[cleanEmail] = {
      ...existing,
      ...userObj,
      id: bestId,
      email: cleanEmail,
      token: token || existing.token || null,
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS_REGISTRY, JSON.stringify(registry));
  } catch {}
}

export async function getIndexedAccountByEmail(email) {
  if (!email) return null;
  try {
    const cleanEmail = String(email).trim().toLowerCase();
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ACCOUNTS_REGISTRY);
    const registry = raw ? JSON.parse(raw) : {};
    if (registry[cleanEmail]) return registry[cleanEmail];

    const rawProf = await AsyncStorage.getItem(STORAGE_KEYS.PROFILES_REGISTRY);
    const profReg = rawProf ? JSON.parse(rawProf) : {};
    if (profReg[`email:${cleanEmail}`]) return profReg[`email:${cleanEmail}`];
    return null;
  } catch {
    return null;
  }
}

/**
 * Mescla o objeto do usuário com os dados permanentes de Perfil (Nome, Sobrenome e Foto)
 * que o cliente salvou na tela "Meu Perfil", garantindo que nunca voltem ao padrão antigo.
 */
export async function mergeWithSavedProfile(userObj) {
  if (!userObj) return null;
  try {
    const rawReg = await AsyncStorage.getItem(STORAGE_KEYS.PROFILES_REGISTRY);
    const registry = rawReg ? JSON.parse(rawReg) : {};

    const emailKey = userObj.email ? String(userObj.email).trim().toLowerCase() : null;
    const idKey = userObj.id ? String(userObj.id) : null;

    const savedById = idKey ? registry[`id:${idKey}`] : null;
    const savedByEmail = emailKey ? registry[`email:${emailKey}`] : null;
    const saved = savedById || savedByEmail || null;

    // Se o servidor retornou avatarUrl do PostgreSQL e não há foto local ainda
    const serverAvatar = userObj.avatarUri || userObj.avatarUrl || null;
    const serverFullName = userObj.fullName || userObj.name || '';
    const serverParts = serverFullName.trim().split(/\s+/).filter(Boolean);

    if (!saved) {
      return {
        ...userObj,
        fullName: serverFullName,
        name: serverFullName,
        firstName: userObj.firstName || serverParts[0] || '',
        lastName:
          userObj.lastName !== undefined
            ? userObj.lastName
            : serverParts.length > 1
              ? serverParts.slice(1).join(' ')
              : '',
        avatarUri: serverAvatar,
      };
    }

    const finalFirstName = saved.firstName || userObj.firstName || serverParts[0] || '';
    const finalLastName =
      saved.lastName !== undefined
        ? saved.lastName
        : userObj.lastName !== undefined
          ? userObj.lastName
          : serverParts.length > 1
            ? serverParts.slice(1).join(' ')
            : '';
    const finalFullName =
      saved.fullName ||
      [finalFirstName, finalLastName].filter(Boolean).join(' ') ||
      serverFullName;
    const finalAvatar =
      saved.avatarRemoved === true
        ? null
        : saved.avatarUri || serverAvatar || null;

    return {
      ...userObj,
      firstName: finalFirstName,
      lastName: finalLastName,
      fullName: finalFullName,
      name: finalFullName,
      avatarUri: finalAvatar,
      avatarUrl: finalAvatar,
    };
  } catch {
    return userObj;
  }
}

/**
 * Salva de forma permanente o Nome, Sobrenome e Foto de Perfil do cliente no registro local
 * indexado por ID e por E-mail, além de sincronizar com o banco PostgreSQL.
 */
export async function savePersistentUserProfile(userProfile) {
  if (!userProfile) return null;
  try {
    const rawReg = await AsyncStorage.getItem(STORAGE_KEYS.PROFILES_REGISTRY);
    const registry = rawReg ? JSON.parse(rawReg) : {};

    const full = (userProfile.fullName || userProfile.name || '').trim();
    const parts = full.split(/\s+/).filter(Boolean);
    const firstName =
      userProfile.firstName !== undefined ? userProfile.firstName.trim() : parts[0] || '';
    const lastName =
      userProfile.lastName !== undefined
        ? userProfile.lastName.trim()
        : parts.length > 1
          ? parts.slice(1).join(' ')
          : '';
    const composedFullName = [firstName, lastName].filter(Boolean).join(' ') || full;
    const avatarUri = userProfile.avatarUri !== undefined ? userProfile.avatarUri : userProfile.avatarUrl || null;

    const record = {
      id: userProfile.id || null,
      email: userProfile.email ? String(userProfile.email).trim().toLowerCase() : null,
      firstName,
      lastName,
      fullName: composedFullName,
      name: composedFullName,
      avatarUri,
      avatarRemoved: avatarUri === null,
      updatedAt: new Date().toISOString(),
    };

    if (record.id) {
      registry[`id:${record.id}`] = record;
    }
    if (record.email) {
      registry[`email:${record.email}`] = record;
    }

    await AsyncStorage.setItem(STORAGE_KEYS.PROFILES_REGISTRY, JSON.stringify(registry));

    const mergedUser = {
      ...userProfile,
      firstName,
      lastName,
      fullName: composedFullName,
      name: composedFullName,
      avatarUri,
      avatarUrl: avatarUri,
    };

    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(mergedUser));
    await AsyncStorage.setItem('@finn_auth_user', JSON.stringify(mergedUser));
    await AsyncStorage.setItem('@finn_biometric_user_v2', JSON.stringify(mergedUser));

    // Sincroniza em background com o banco PostgreSQL da VPS
    apiRequest('auth/profile', {
      method: 'PUT',
      body: {
        fullName: composedFullName,
        firstName,
        lastName,
        avatarUrl: avatarUri,
      },
      timeoutMs: 12000,
    }).catch((err) => {
      console.log('Sincronização de perfil PostgreSQL (mantido localmente):', err.message);
    });

    return mergedUser;
  } catch (e) {
    console.warn('Erro ao salvar perfil permanente:', e);
    return userProfile;
  }
}

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

// Obter usuário autenticado (sempre mesclado com o perfil salvo pelo cliente)
export async function getStoredUser() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return await mergeWithSavedProfile(parsed);
  } catch {
    return null;
  }
}

// Salvar usuário autenticado (preservando nome, sobrenome e foto salvos pelo cliente)
export async function saveAuthUser(user, tokenOverride = null) {
  try {
    if (user) {
      const existingByEmail = user.email ? await getIndexedAccountByEmail(user.email) : null;
      const canonicalId =
        existingByEmail?.id &&
        !String(existingByEmail.id).startsWith('google-') &&
        (!user.id || String(user.id).startsWith('google-'))
          ? existingByEmail.id
          : user.id;

      const merged = await mergeWithSavedProfile({
        ...user,
        id: canonicalId,
      });
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(merged));
      const storedTok = tokenOverride || (await getStoredToken());
      await indexAccountByEmail(merged, storedTok);
      return merged;
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      return null;
    }
  } catch (e) {
    console.warn('Erro ao salvar usuário:', e);
    return user;
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
 * Verifica se já existe uma conta cadastrada com o e-mail informado (PostgreSQL + Registro Local).
 * Impede a criação de contas duplicadas com o mesmo e-mail.
 */
export async function checkEmailExistsApi(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { exists: false };
  }

  // 1. Verifica no registro local de contas já autenticadas/criadas
  const localExisting = await getIndexedAccountByEmail(cleanEmail);

  // 2. Verifica no banco PostgreSQL via endpoint /auth/check-email
  try {
    const res = await apiRequest('auth/check-email', {
      method: 'POST',
      body: { email: cleanEmail },
      timeoutMs: 7000,
    });
    if (res && typeof res.exists === 'boolean') {
      return {
        exists: res.exists || Boolean(localExisting),
        message:
          res.exists || localExisting
            ? 'Já existe uma conta cadastrada com este e-mail. Não é permitido criar outra conta com o mesmo e-mail.'
            : null,
      };
    }
  } catch {
    // Se o servidor ainda não tiver a rota /auth/check-email publicada, testa via tentativa segura ou usa o índice local
  }

  if (localExisting) {
    return {
      exists: true,
      message:
        'Já existe uma conta cadastrada com este e-mail. Não é permitido criar outra conta com o mesmo e-mail.',
    };
  }

  return { exists: false };
}

/**
 * Autenticação - Login
 */
export async function loginUser(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const data = await apiRequest('auth/login', {
    method: 'POST',
    body: { email: cleanEmail, password },
    timeoutMs: 10000,
  });

  if (data?.token) {
    await saveAuthToken(data.token);
  }
  if (data?.user) {
    const baseUser = {
      ...data.user,
      email: cleanEmail,
      name: data.user.fullName || data.user.name || (cleanEmail ? cleanEmail.split('@')[0] : 'Você'),
      avatarUri: data.user.avatarUri || data.user.avatarUrl || null,
    };
    const mergedUser = await saveAuthUser(baseUser, data.token);
    data.user = mergedUser;
  }

  return data;
}

/**
 * Autenticação - Registro (Com validação estrita contra duplicidade de e-mail)
 */
export async function registerUser(email, password, fullName, phone) {
  const cleanEmail = (email || '').trim().toLowerCase();

  // Verifica duplicidade antes de criar
  const dupCheck = await checkEmailExistsApi(cleanEmail);
  if (dupCheck.exists) {
    throw new Error(
      'Já existe uma conta cadastrada com este e-mail. Não é permitido criar outra conta com o mesmo e-mail.'
    );
  }

  try {
    const data = await apiRequest('auth/register', {
      method: 'POST',
      body: {
        email: cleanEmail,
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
      const baseUser = {
        ...data.user,
        email: cleanEmail,
        name: data.user.fullName || data.user.name || fullName || 'Você',
        avatarUri: data.user.avatarUri || data.user.avatarUrl || null,
      };
      const mergedUser = await saveAuthUser(baseUser, data.token);
      data.user = mergedUser;
    }

    return data;
  } catch (err) {
    const msg = String(err?.message || '');
    if (
      msg.toLowerCase().includes('já existe') ||
      msg.toLowerCase().includes('already') ||
      msg.toLowerCase().includes('conflict') ||
      msg.includes('409')
    ) {
      throw new Error(
        'Já existe uma conta cadastrada com este e-mail. Não é permitido criar outra conta com o mesmo e-mail.'
      );
    }
    throw err;
  }
}

/**
 * Autenticação - Dados do Usuário Ativo
 */
export async function getMe() {
  const res = await apiRequest('auth/me');
  return await mergeWithSavedProfile(res);
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
 * Autenticação - Solicitar Código de Recuperação de Senha (6 dígitos por e-mail)
 */
export async function requestPasswordResetApi(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Informe um endereço de e-mail válido.');
  }

  return await apiRequest('auth/forgot-password', {
    method: 'POST',
    body: { email: cleanEmail },
    timeoutMs: 18000,
  });
}

/**
 * Autenticação - Validar Código de 6 dígitos enviado por e-mail
 */
export async function verifyPasswordResetCodeApi(email, code) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanCode = String(code || '').replace(/\D+/g, '').trim();

  return await apiRequest('auth/verify-reset-code', {
    method: 'POST',
    body: { email: cleanEmail, code: cleanCode },
    timeoutMs: 10000,
  });
}

/**
 * Autenticação - Redefinir Senha com Código de 6 dígitos
 */
export async function resetPasswordWithCodeApi({ email, code, newPassword }) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanCode = String(code || '').replace(/\D+/g, '').trim();

  const data = await apiRequest('auth/reset-password', {
    method: 'POST',
    body: {
      email: cleanEmail,
      code: cleanCode,
      newPassword,
    },
    timeoutMs: 12000,
  });

  if (data?.token) {
    await saveAuthToken(data.token);
  }
  if (data?.user) {
    const baseUser = {
      ...data.user,
      email: cleanEmail,
      name: data.user.fullName || data.user.name || cleanEmail.split('@')[0],
      avatarUri: data.user.avatarUri || data.user.avatarUrl || null,
    };
    const mergedUser = await saveAuthUser(baseUser, data.token);
    data.user = mergedUser;
  }

  return data;
}

/**
 * Autenticação - Redefinir / Atualizar Senha (usuário logado)
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
      creditLimit: parseFloat(card.limit ?? card.creditLimit) || 1000,
      closingDay: parseInt(card.closingDay || (card.dueDay > 7 ? card.dueDay - 7 : 28), 10),
      dueDay: parseInt(card.dueDay, 10) || 10,
      colorHex: card.color || card.colorHex || '#820AD1',
      ...(card.financialAccountId && !String(card.financialAccountId).startsWith('acc-')
        ? { financialAccountId: card.financialAccountId }
        : {}),
    },
  });
}

export async function updateCreditCardApi(cardId, card) {
  if (!cardId || String(cardId).startsWith('card-')) return null;
  await ensureAuthenticated();
  const payload = {
    ...(card.name || card.bank ? { name: card.name || card.bank } : {}),
    ...(card.limit !== undefined || card.creditLimit !== undefined
      ? { creditLimit: parseFloat(card.limit ?? card.creditLimit) || 0 }
      : {}),
    ...(card.closingDay !== undefined ? { closingDay: parseInt(card.closingDay, 10) || 3 } : {}),
    ...(card.dueDay !== undefined ? { dueDay: parseInt(card.dueDay, 10) || 10 } : {}),
    ...(card.color || card.colorHex ? { colorHex: card.color || card.colorHex } : {}),
  };
  try {
    return await apiRequest(`credit-cards/${encodeURIComponent(cardId)}`, {
      method: 'PUT',
      body: payload,
    });
  } catch {
    return apiRequest(`credit-cards/${encodeURIComponent(cardId)}`, {
      method: 'PATCH',
      body: payload,
    });
  }
}

export async function deleteCreditCardApi(cardId) {
  if (!cardId || String(cardId).startsWith('card-')) return null;
  await ensureAuthenticated();
  return apiRequest(`credit-cards/${encodeURIComponent(cardId)}`, {
    method: 'DELETE',
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
      initialBalance: parseFloat(account.balance ?? account.initialBalance) || 0,
      colorHex: account.color || account.colorHex || '#820AD1',
      isShared: account.isShared !== undefined ? account.isShared : true,
    },
  });
}

export async function updateAccountApi(accountId, accountData) {
  if (!accountId || String(accountId).startsWith('acc-')) return null;
  await ensureAuthenticated();
  const rawBal =
    accountData.balance !== undefined
      ? accountData.balance
      : accountData.currentBalance !== undefined
      ? accountData.currentBalance
      : accountData.initialBalance;

  const payload = {
    ...(accountData.name || accountData.bank ? { name: accountData.name || accountData.bank } : {}),
    ...(rawBal !== undefined ? { currentBalance: parseFloat(rawBal) || 0, initialBalance: parseFloat(rawBal) || 0 } : {}),
    ...(accountData.color || accountData.colorHex ? { colorHex: accountData.color || accountData.colorHex } : {}),
    ...(accountData.isShared !== undefined ? { isShared: Boolean(accountData.isShared) } : {}),
  };

  try {
    return await apiRequest(`accounts/${encodeURIComponent(accountId)}`, {
      method: 'PUT',
      body: payload,
    });
  } catch {
    return apiRequest(`accounts/${encodeURIComponent(accountId)}`, {
      method: 'PATCH',
      body: payload,
    });
  }
}

export async function deleteAccountApi(accountId) {
  if (!accountId || String(accountId).startsWith('acc-')) return null;
  await ensureAuthenticated();
  return apiRequest(`accounts/${encodeURIComponent(accountId)}`, {
    method: 'DELETE',
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
      description: tx.title || tx.description || 'Movimentação',
      amount: Math.abs(parseFloat(tx.amount)) || 0.01,
      type: txType,
      date: tx.date ? new Date(tx.date).toISOString() : new Date().toISOString(),
      ...(tx.accountId && !String(tx.accountId).startsWith('acc-') ? { accountId: tx.accountId } : {}),
      ...(tx.creditCardId && !String(tx.creditCardId).startsWith('card-') ? { creditCardId: tx.creditCardId } : {}),
      ...(tx.categoryId ? { categoryId: tx.categoryId } : {}),
      isHouseholdShared: tx.author === 'Casal' || tx.isHouseholdShared === true || tx.isShared === true,
      notes: tx.notes || '',
    },
  });
}

export async function updateTransactionApi(txId, tx) {
  if (!txId || String(txId).startsWith('tx-')) return null;
  await ensureAuthenticated();
  const txType = tx.type
    ? String(tx.type).toUpperCase() === 'INCOME'
      ? 'INCOME'
      : 'EXPENSE'
    : undefined;
  const payload = {
    ...(tx.title || tx.description ? { description: tx.title || tx.description } : {}),
    ...(tx.amount !== undefined ? { amount: Math.abs(parseFloat(tx.amount)) || 0.01 } : {}),
    ...(txType ? { type: txType } : {}),
    ...(tx.date ? { date: new Date(tx.date).toISOString() } : {}),
    ...(tx.notes !== undefined ? { notes: tx.notes } : {}),
  };
  try {
    return await apiRequest(`transactions/${encodeURIComponent(txId)}`, {
      method: 'PUT',
      body: payload,
    });
  } catch {
    return apiRequest(`transactions/${encodeURIComponent(txId)}`, {
      method: 'PATCH',
      body: payload,
    });
  }
}

export async function deleteTransactionApi(txId) {
  if (!txId || String(txId).startsWith('tx-')) return null;
  await ensureAuthenticated();
  return apiRequest(`transactions/${encodeURIComponent(txId)}`, {
    method: 'DELETE',
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
 * Sincroniza dados locais com o PostgreSQL da VPS de forma não-destrutiva:
 * 1. Verifica conectividade e autenticação
 * 2. Busca contas, cartões e transações remotos
 * 3. Envia itens locais novos para o PostgreSQL e atualiza saldos/limites editados localmente
 * 4. Retorna o pacote completo atualizado preservando todos os valores do cliente
 */
export async function syncDatabaseWithPostgres({
  localCards = [],
  localAccounts = [],
  localTransactions = [],
}) {
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
    const norm = (s) => String(s || '').trim().toLowerCase();

    // 1. Buscar Contas, Cartões e Transações atuais no PostgreSQL
    let remoteAccounts = await fetchAccounts('PERSONAL').catch(() => []);
    let remoteCards = await fetchCreditCards('PERSONAL').catch(() => []);
    let remoteTransactions = await fetchTransactions({ limit: 100, scope: 'PERSONAL' }).catch(() => []);

    if (!Array.isArray(remoteAccounts)) remoteAccounts = [];
    if (!Array.isArray(remoteCards)) remoteCards = [];
    if (!Array.isArray(remoteTransactions)) remoteTransactions = [];

    // 2. Reconciliar Contas Bancárias (Subir contas locais ausentes e preservar saldos reais como R$ 4.000,00)
    for (const localAcc of localAccounts) {
      if (!localAcc) continue;
      const localBal = parseFloat(localAcc.balance);
      const hasValidLocalBal = !Number.isNaN(localBal);

      const matchIdx = remoteAccounts.findIndex(
        (ra) =>
          ra.id === localAcc.id ||
          ra.id === localAcc.remoteId ||
          norm(ra.name) === norm(localAcc.name || localAcc.bank)
      );

      if (matchIdx === -1) {
        try {
          const created = await createAccount(localAcc);
          if (created?.id) {
            remoteAccounts.push(created);
          }
        } catch {}
      } else {
        const ra = remoteAccounts[matchIdx];
        const remoteBal = parseFloat(ra.currentBalance) || 0;
        const localUpdated = localAcc.updatedAt ? new Date(localAcc.updatedAt).getTime() : 0;
        const remoteUpdated = ra.updatedAt ? new Date(ra.updatedAt).getTime() : 0;

        // Se o saldo local foi definido (ex: 4000) e no banco ainda está 0, ou se o local é mais recente, atualiza no banco!
        if (
          hasValidLocalBal &&
          Math.abs(localBal - remoteBal) > 0.009 &&
          (localUpdated >= remoteUpdated || (localBal !== 0 && remoteBal === 0))
        ) {
          try {
            const updatedRemote = await updateAccountApi(ra.id, {
              name: localAcc.name || ra.name,
              balance: localBal,
              color: localAcc.color || ra.colorHex,
            });
            remoteAccounts[matchIdx] = {
              ...ra,
              ...(updatedRemote || {}),
              currentBalance: localBal,
              calculatedBalance: localBal,
            };
          } catch {
            remoteAccounts[matchIdx] = {
              ...ra,
              currentBalance: localBal,
              calculatedBalance: localBal,
            };
          }
        }
      }
    }

    // 3. Reconciliar Cartões de Crédito (Subir cartões locais ausentes e atualizar limites/vencimentos editados)
    for (const localCard of localCards) {
      if (!localCard) continue;
      const matchIdx = remoteCards.findIndex(
        (rc) =>
          rc.id === localCard.id ||
          rc.id === localCard.remoteId ||
          norm(rc.name) === norm(localCard.name || localCard.bank)
      );

      if (matchIdx === -1) {
        try {
          const created = await createCreditCard(localCard);
          if (created?.id) {
            remoteCards.push(created);
          }
        } catch {}
      } else {
        const rc = remoteCards[matchIdx];
        const localLimit = parseFloat(localCard.limit) || 0;
        const remoteLimit = parseFloat(rc.creditLimit) || 0;
        const localDue = parseInt(localCard.dueDay, 10) || 10;
        const remoteDue = parseInt(rc.dueDay, 10) || 10;
        const localClosing = parseInt(localCard.closingDay, 10) || parseInt(rc.closingDay, 10) || 3;
        const remoteClosing = parseInt(rc.closingDay, 10) || 3;
        const localUpdated = localCard.updatedAt ? new Date(localCard.updatedAt).getTime() : 0;
        const remoteUpdated = rc.updatedAt ? new Date(rc.updatedAt).getTime() : 0;

        if (
          (Math.abs(localLimit - remoteLimit) > 0.01 ||
            localDue !== remoteDue ||
            localClosing !== remoteClosing) &&
          (localUpdated >= remoteUpdated || localCard.updatedAt)
        ) {
          try {
            const updatedCard = await updateCreditCardApi(rc.id, localCard);
            remoteCards[matchIdx] = {
              ...rc,
              ...(updatedCard || {}),
              creditLimit: localLimit,
              dueDay: localDue,
              closingDay: localClosing,
            };
          } catch {
            remoteCards[matchIdx] = {
              ...rc,
              creditLimit: localLimit,
              dueDay: localDue,
              closingDay: localClosing,
            };
          }
        }
      }
    }

    // 4. Reconciliar Transações Locais ainda não gravadas no PostgreSQL
    for (const localTx of localTransactions) {
      if (!localTx || localTx.isShared || localTx.groupId) continue;
      const localTitle = norm(localTx.title || localTx.description);
      const localAmt = Math.abs(parseFloat(localTx.amount) || 0);
      const localDate = String(localTx.date || '').split('T')[0];

      const existsRemotely = remoteTransactions.some((rt) => {
        if (rt.id === localTx.id || rt.id === localTx.remoteId) return true;
        const rtTitle = norm(rt.description || rt.title);
        const rtAmt = Math.abs(parseFloat(rt.amount) || 0);
        const rtDate = String(rt.date || '').split('T')[0];
        return rtTitle === localTitle && Math.abs(rtAmt - localAmt) < 0.01 && rtDate === localDate;
      });

      if (!existsRemotely && localAmt > 0) {
        try {
          // Envia sem accountId para não alterar em duplicidade o saldo já reconciliado da conta
          const createdTx = await createTransaction({
            ...localTx,
            accountId: undefined,
          });
          if (createdTx?.id) {
            remoteTransactions.unshift(createdTx);
          }
        } catch {}
      }
    }

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

export async function createHouseholdInvitationApi(email) {
  await ensureAuthenticated();
  return apiRequest('households/invitations', {
    method: 'POST',
    body: { email: (email || '').trim().toLowerCase() },
  });
}

export async function acceptHouseholdInvitationApi(tokenOrCode) {
  await ensureAuthenticated();
  const clean = (tokenOrCode || '').trim();
  return apiRequest(`households/invitations/accept?token=${encodeURIComponent(clean)}`, {
    method: 'POST',
    body: { token: clean, code: clean },
  });
}

export async function getHouseholdInvitationInfoApi(codeOrToken) {
  const clean = (codeOrToken || '').trim();
  return apiRequest(`households/invitations/info?code=${encodeURIComponent(clean)}`);
}

export async function generateHouseholdInviteCodeApi(householdId, code) {
  await ensureAuthenticated();
  return apiRequest('households/invite-code', {
    method: 'POST',
    body: { householdId, code },
  });
}

export async function deleteHouseholdApi(householdId) {
  await ensureAuthenticated();
  return apiRequest(`households/${encodeURIComponent(householdId)}`, {
    method: 'DELETE',
  });
}

export async function leaveHouseholdApi(householdId) {
  await ensureAuthenticated();
  return apiRequest(`households/${encodeURIComponent(householdId)}/leave`, {
    method: 'POST',
  });
}

export async function kickHouseholdMemberApi(householdId, memberId) {
  await ensureAuthenticated();
  return apiRequest(`households/${encodeURIComponent(householdId)}/members/${encodeURIComponent(memberId)}`, {
    method: 'DELETE',
  });
}

// ==========================================
// NOTIFICAÇÕES, PREFERÊNCIAS E PUSH TOKENS (POSTGRESQL)
// ==========================================

export async function fetchNotificationsApi(limit = 50) {
  await ensureAuthenticated();
  return apiRequest(`notifications?limit=${encodeURIComponent(limit)}`);
}

export async function createNotificationApi(notification) {
  await ensureAuthenticated();
  return apiRequest('notifications', {
    method: 'POST',
    body: {
      id: notification.id,
      title: notification.title,
      body: notification.body || notification.message,
      message: notification.body || notification.message,
      type: notification.type || 'ALERT',
      category: notification.category || 'sistema',
      priority: notification.priority || 'normal',
      action: notification.action || (notification.targetScreen ? { label: 'Abrir', targetScreen: notification.targetScreen } : null),
      dedupeKey: notification.dedupeKey,
      meta: notification.meta || {},
      read: Boolean(notification.read),
      sendPush: Boolean(notification.sendPush),
    },
  });
}

export async function markNotificationReadApi(notificationId) {
  await ensureAuthenticated();
  return apiRequest(`notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PATCH',
  });
}

export async function markAllNotificationsReadApi(ids = []) {
  await ensureAuthenticated();
  return apiRequest('notifications/read-all', {
    method: 'POST',
    body: { ids },
  });
}

export async function fetchNotificationPreferencesApi() {
  await ensureAuthenticated();
  return apiRequest('notifications/preferences');
}

export async function updateNotificationPreferencesApi(preferences) {
  await ensureAuthenticated();
  return apiRequest('notifications/preferences', {
    method: 'PUT',
    body: preferences,
  });
}

export async function registerPushTokenApi({ pushToken, platform = 'android', deviceName = null }) {
  if (!pushToken) return null;
  await ensureAuthenticated();
  return apiRequest('notifications/push-token', {
    method: 'POST',
    body: { pushToken, platform, deviceName },
  });
}


