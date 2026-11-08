import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createHouseholdInvitationApi,
  acceptHouseholdInvitationApi,
  fetchCurrentHouseholdApi,
} from './apiService';

const INVITES_REGISTRY_KEY = '@finn_shared_invites_registry';

/**
 * Publica um convite no relay em nuvem de alta disponibilidade (dpaste.org)
 * permitindo que qualquer outro celular resolva o código em milissegundos
 * e conecte-se via PostgreSQL.
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
  const payload = {
    token: invitationToken,
    householdId,
    groupName: name,
    type,
    creator,
    expiresAt: expiresAt || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  };

  let resolvedCode = fallbackCode || '';

  try {
    const res = await fetch('https://dpaste.org/api/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        content: JSON.stringify(payload),
        title: `FINN_INV_${(name || 'GRP').toUpperCase()}`,
        expiry_days: '1',
      }),
    });

    if (res.ok) {
      const rawUrl = await res.text();
      const cleanUrl = rawUrl.replace(/["\r\n\s]/g, '');
      const parts = cleanUrl.split('/').filter(Boolean);
      const slug = parts[parts.length - 1];
      if (slug && slug.length >= 3) {
        resolvedCode = slug.toUpperCase();
      }
    }
  } catch (err) {
    console.warn('Aviso: Falha ao publicar convite no cloud relay, usando registro local:', err.message);
  }

  if (!resolvedCode) {
    resolvedCode = fallbackCode || Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  payload.code = resolvedCode;

  // Salva no registro local do dispositivo também
  try {
    const raw = await AsyncStorage.getItem(INVITES_REGISTRY_KEY);
    const reg = raw ? JSON.parse(raw) : {};
    reg[resolvedCode.toUpperCase()] = payload;
    if (fallbackCode) {
      reg[fallbackCode.toUpperCase()] = payload;
    }
    await AsyncStorage.setItem(INVITES_REGISTRY_KEY, JSON.stringify(reg));
  } catch (e) {
    console.warn('Erro ao salvar no AsyncStorage local:', e.message);
  }

  return {
    code: resolvedCode,
    invitationToken,
    householdId,
    groupName: name,
    expiresAt: payload.expiresAt,
  };
}

/**
 * Resolve um código de convite ou link inserido pelo usuário
 * Suporta:
 * 1. Códigos curtos (ex: 50FNH, R侶6C, ABC123)
 * 2. Links de convite (ex: https://.../accept?token=... ou https://dpaste.org/...)
 * 3. Tokens hexadecimais diretos de 64 caracteres
 */
export async function resolveCloudInvite(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    throw new Error('Informe o código do convite.');
  }

  const cleaned = rawInput.trim();

  // 1. Verifica se já é um token hex direto de 64 caracteres ou link contendo invitationToken
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
  code = code.replace(/[^a-zA-Z0-9_-]/g, '').trim();

  if (!code) {
    throw new Error('Formato de código inválido.');
  }

  // 3. Consulta no registro local do aparelho (caso o convite tenha sido criado nele)
  try {
    const rawLocal = await AsyncStorage.getItem(INVITES_REGISTRY_KEY);
    if (rawLocal) {
      const reg = JSON.parse(rawLocal);
      const localEntry = reg[code.toUpperCase()] || reg[code];
      if (localEntry) {
        if (localEntry.expiresAt && new Date(localEntry.expiresAt).getTime() < Date.now()) {
          throw new Error('Este código de convite expirou (validade de 30 minutos). Solicite um novo código ao criador do grupo.');
        }
        return {
          token: localEntry.token,
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

  // 4. Consulta no cloud relay remoto (dpaste.org/SLUG/raw)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.signal, 6000);
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
            token: data.token,
            householdId: data.householdId,
            groupName: data.groupName || data.name,
            type: data.type || 'Casal',
            creator: data.creator,
            members: data.members,
            code,
          };
        }
      } catch (jsonErr) {
        // Não era JSON
      }
    }
  } catch (netErr) {
    if (netErr.message && netErr.message.includes('expirou')) throw netErr;
    console.warn('Aviso: Falha ao consultar cloud relay remoto:', netErr.message);
  }

  // 5. Se não encontrou nem local nem no cloud relay
  return {
    code,
    token: null,
    notFound: true,
  };
}

