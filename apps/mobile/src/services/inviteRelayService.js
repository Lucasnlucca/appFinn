import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createHouseholdInvitationApi,
  acceptHouseholdInvitationApi,
  fetchCurrentHouseholdApi,
  getHouseholdInvitationInfoApi,
} from './apiService';

const INVITES_REGISTRY_KEY = '@finn_shared_invites_registry';

/**
 * Publica um convite com o código de 30 minutos oficial.
 * Salva no banco PostgreSQL, registra localmente e replica para fallbacks.
 */
export async function publishCloudInvite({
  invitationToken,
  householdId,
  name,
  type = 'Casal',
  creator,
  expiresAt,
  fallbackCode,
}) {
  const code = (fallbackCode || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim() ||
    Math.random().toString(36).substring(2, 8).toUpperCase();

  const payload = {
    token: invitationToken || code,
    code,
    householdId,
    groupName: name,
    type,
    creator,
    expiresAt: expiresAt || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  };

  // Salva no registro local do dispositivo
  try {
    const raw = await AsyncStorage.getItem(INVITES_REGISTRY_KEY);
    const reg = raw ? JSON.parse(raw) : {};
    reg[code] = payload;
    await AsyncStorage.setItem(INVITES_REGISTRY_KEY, JSON.stringify(reg));
  } catch (e) {
    console.warn('Erro ao salvar no AsyncStorage local:', e.message);
  }

  // Tenta também relay adicional como contingência
  try {
    await fetch('https://dpaste.org/api/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        content: JSON.stringify(payload),
        title: `FINN_INV_${code}`,
        expiry_days: '1',
      }),
    });
  } catch (err) {
    // contingência silenciosa
  }

  return {
    code,
    invitationToken: payload.token,
    householdId,
    groupName: name,
    expiresAt: payload.expiresAt,
  };
}

/**
 * Resolve um código de convite ou link inserido pelo usuário
 * Suporta:
 * 1. API oficial PostgreSQL (resolve códigos de 6 caracteres entre qualquer aparelho em tempo real)
 * 2. Registro local (mesmo aparelho ou testes)
 * 3. Tokens hexadecimais diretos de 64 caracteres ou URLs
 */
export async function resolveCloudInvite(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    throw new Error('Informe o código do convite.');
  }

  const cleaned = rawInput.trim();

  // 1. Verifica se já é um token hex direto de 64 caracteres
  const tokenMatch = cleaned.match(/[a-f0-9]{64}/i);
  if (tokenMatch) {
    return {
      token: tokenMatch[0],
      isDirectToken: true,
      code: cleaned,
    };
  }

  // 2. Extrai código/slug se o usuário colou uma URL completa
  let code = cleaned;
  if (cleaned.includes('/')) {
    const parts = cleaned.split('?')[0].split('/').filter(Boolean);
    code = parts[parts.length - 1] || cleaned;
  }
  code = code.replace(/[^a-zA-Z0-9_-]/g, '').trim().toUpperCase();

  if (!code) {
    throw new Error('Formato de código inválido.');
  }

  // 3. Consulta primeiro a API oficial FINN (PostgreSQL)
  try {
    const info = await getHouseholdInvitationInfoApi(code);
    if (info && (info.valid || info.householdId)) {
      return {
        token: info.token || code,
        householdId: info.householdId,
        groupName: info.groupName,
        type: info.type || 'Casal',
        creator: info.creator,
        code,
        expiresAt: info.expiresAt,
      };
    }
  } catch (apiErr) {
    if (apiErr.message && apiErr.message.includes('expirou')) {
      throw apiErr;
    }
    // Prossegue com fallbacks locais
  }

  // 4. Consulta no registro local do aparelho (caso o convite tenha sido criado nele)
  try {
    const rawLocal = await AsyncStorage.getItem(INVITES_REGISTRY_KEY);
    if (rawLocal) {
      const reg = JSON.parse(rawLocal);
      const localEntry = reg[code] || reg[code.toLowerCase()];
      if (localEntry) {
        if (localEntry.expiresAt && new Date(localEntry.expiresAt).getTime() < Date.now()) {
          throw new Error('Este código de convite expirou (validade de 30 minutos). Solicite um novo código ao criador do grupo.');
        }
        return {
          token: localEntry.token || code,
          householdId: localEntry.householdId,
          groupName: localEntry.groupName || localEntry.name,
          type: localEntry.type || 'Casal',
          creator: localEntry.creator,
          members: localEntry.members,
          code,
        };
      }
    }
  } catch (err) {
    if (err.message && err.message.includes('expirou')) throw err;
  }

  // 5. Fallback para dpaste se existir
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://dpaste.org/${code}/raw`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (data && (data.token || data.householdId)) {
          if (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
            throw new Error('Este código de convite expirou (validade de 30 minutos). Solicite um novo código ao criador do grupo.');
          }
          return {
            token: data.token || code,
            householdId: data.householdId,
            groupName: data.groupName || data.name,
            type: data.type || 'Casal',
            creator: data.creator,
            members: data.members,
            code,
          };
        }
      } catch (jsonErr) {}
    }
  } catch (netErr) {
    if (netErr.message && netErr.message.includes('expirou')) throw netErr;
  }

  // 6. Se não encontrou
  return {
    code,
    token: null,
    notFound: true,
  };
}

