'use client';

import { useEffect, useRef } from 'react';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://banco-gitapi.grtbdz.easypanel.host/api/v1';

const TOKEN_STORAGE_KEY = 'finn_web_access_token';
const USER_STORAGE_KEY = 'finn_web_user';
const GROUPS_CACHE_KEY = 'finn_web_groups_cache';
const KEEP_CONNECTED_KEY = 'finn_web_keep_connected';
const SAVED_EMAIL_KEY = 'finn_web_saved_email';
const LAST_ACTIVE_AT_KEY = 'finn_web_last_active_at';
const SESSION_ALIVE_KEY = 'finn_web_session_alive';

// Tempo máximo de inatividade na Web: 1 hora (3.600.000 ms)
export const WEB_INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;
export const SHARED_META_PREFIX = '__FINN_SHARED__:';
const JWT_SHARED_SECRET = 'finn-secret-token-access-2026-secure-key';

let lastKnownGroupsCache: any[] = [];

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  avatarUri?: string | null;
}

export interface OfficialCategory {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

export const OFFICIAL_CATEGORIES: OfficialCategory[] = [
  { id: 'sem_categoria', label: 'Sem categoria', emoji: '✓', color: '#94A3B8' },
  { id: 'alimentacao', label: 'Alimentação', emoji: '🍔', color: '#F97316' },
  { id: 'assinaturas', label: 'Assinaturas', emoji: '🔁', color: '#8B5CF6' },
  { id: 'educacao', label: 'Educação', emoji: '📚', color: '#EC4899' },
  { id: 'financiamento', label: 'Financiamento', emoji: '💳', color: '#EAB308' },
  { id: 'lazer', label: 'Lazer', emoji: '🎮', color: '#10B981' },
  { id: 'moradia', label: 'Moradia', emoji: '🏠', color: '#3B82F6' },
  { id: 'outros', label: 'Outros', emoji: '📦', color: '#64748B' },
  { id: 'pets', label: 'Pets', emoji: '🐾', color: '#F59E0B' },
  { id: 'presentes', label: 'Presentes', emoji: '🎁', color: '#F43F5E' },
  { id: 'receita', label: 'Receita', emoji: '💰', color: '#10B981' },
  { id: 'saude', label: 'Saúde', emoji: '💊', color: '#EF4444' },
  { id: 'transporte', label: 'Transporte', emoji: '🚗', color: '#06B6D4' },
  { id: 'vestuario', label: 'Vestuário', emoji: '👕', color: '#6366F1' },
  { id: 'viagem', label: 'Viagem', emoji: '✈️', color: '#14B8A6' },
];

export function resolveCategoryMeta(catIdOrName?: string | null): OfficialCategory {
  if (!catIdOrName) return OFFICIAL_CATEGORIES[7]; // outros
  const clean = String(catIdOrName).trim().toLowerCase();
  const normalized = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const found = OFFICIAL_CATEGORIES.find((c) => {
    const labelNorm = c.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return c.id === clean || c.id === normalized || c.label.toLowerCase() === clean || labelNorm === normalized;
  });
  return found || OFFICIAL_CATEGORIES[7];
}

export function extractCategoryFromTx(tx: any): OfficialCategory {
  const meta = parseSharedNotes(tx?.notes);
  if (meta?.category) return resolveCategoryMeta(meta.category);
  if (tx?.category?.name) return resolveCategoryMeta(tx.category.name);
  if (typeof tx?.notes === 'string') {
    const match = tx.notes.match(/\[CAT:([^\]]+)\]/i);
    if (match?.[1]) return resolveCategoryMeta(match[1]);
  }
  if (String(tx?.type).toUpperCase() === 'INCOME') return resolveCategoryMeta('receita');
  return resolveCategoryMeta('outros');
}

export function getRememberedWebCredentials(): { email: string; keepConnected: boolean } {
  if (typeof window === 'undefined') return { email: '', keepConnected: true };
  try {
    const email = window.localStorage.getItem(SAVED_EMAIL_KEY) || '';
    const rawKeep = window.localStorage.getItem(KEEP_CONNECTED_KEY);
    return {
      email,
      keepConnected: rawKeep === null ? true : rawKeep === 'true',
    };
  } catch {
    return { email: '', keepConnected: true };
  }
}

export function setRememberedWebCredentials(email: string, keepConnected: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEEP_CONNECTED_KEY, keepConnected ? 'true' : 'false');
    if (keepConnected && email.trim()) {
      window.localStorage.setItem(SAVED_EMAIL_KEY, email.trim().toLowerCase());
    } else if (!keepConnected) {
      window.localStorage.removeItem(SAVED_EMAIL_KEY);
    }
  } catch {
    // ignore
  }
}

export function recordWebUserActivity() {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage.getItem(TOKEN_STORAGE_KEY)) {
      window.localStorage.setItem(LAST_ACTIVE_AT_KEY, String(Date.now()));
      window.sessionStorage.setItem(SESSION_ALIVE_KEY, '1');
    }
  } catch {
    // ignore
  }
}

export function checkWebInactivityAndExpire(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return false;

    const keepConnected = window.localStorage.getItem(KEEP_CONNECTED_KEY) !== 'false';
    const sessionAlive = window.sessionStorage.getItem(SESSION_ALIVE_KEY) === '1';

    // Se o usuário desmarcou "Manter-me conectado" e fechou/reabriu o navegador, desconecta
    if (!keepConnected && !sessionAlive) {
      clearAuthSession();
      return true;
    }

    const lastActiveRaw = window.localStorage.getItem(LAST_ACTIVE_AT_KEY);
    if (lastActiveRaw) {
      const elapsed = Date.now() - Number(lastActiveRaw);
      if (!Number.isNaN(elapsed) && elapsed > WEB_INACTIVITY_TIMEOUT_MS) {
        // Preserva o e-mail e o botão "Manter-me conectado" ativo antes de desconectar por inatividade
        const rawUser = window.localStorage.getItem(USER_STORAGE_KEY);
        if (rawUser) {
          try {
            const parsedUser = JSON.parse(rawUser);
            if (parsedUser?.email && keepConnected) {
              window.localStorage.setItem(SAVED_EMAIL_KEY, String(parsedUser.email).trim().toLowerCase());
              window.localStorage.setItem(KEEP_CONNECTED_KEY, 'true');
            }
          } catch {}
        }
        clearAuthSession();
        return true;
      }
    } else {
      window.localStorage.setItem(LAST_ACTIVE_AT_KEY, String(Date.now()));
    }

    window.sessionStorage.setItem(SESSION_ALIVE_KEY, '1');
    return false;
  } catch {
    return false;
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    if (checkWebInactivityAndExpire()) return null;
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    if (checkWebInactivityAndExpire()) return null;
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function saveAuthSession(
  token: string | null,
  user: AuthUser | null,
  keepConnected?: boolean,
) {
  if (typeof window === 'undefined') return;
  try {
    const shouldKeep =
      keepConnected !== undefined
        ? keepConnected
        : window.localStorage.getItem(KEEP_CONNECTED_KEY) !== 'false';

    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      window.localStorage.setItem(LAST_ACTIVE_AT_KEY, String(Date.now()));
      window.sessionStorage.setItem(SESSION_ALIVE_KEY, '1');
    }
    if (user) {
      const normalized: AuthUser = {
        ...user,
        avatarUrl: user.avatarUrl || user.avatarUri || null,
        avatarUri: user.avatarUri || user.avatarUrl || null,
      };
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(normalized));
      if (user.email) {
        setRememberedWebCredentials(user.email, shouldKeep);
      }
    }
    window.dispatchEvent(new Event('finn-auth-changed'));
    window.dispatchEvent(new Event('finn-data-changed'));
  } catch {
    // ignore storage errors
  }
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return;
  try {
    // Preserva o e-mail salvo se "Manter-me conectado" estiver ativo
    const keepConnected = window.localStorage.getItem(KEEP_CONNECTED_KEY) !== 'false';
    if (keepConnected) {
      const rawUser = window.localStorage.getItem(USER_STORAGE_KEY);
      if (rawUser) {
        try {
          const parsed = JSON.parse(rawUser);
          if (parsed?.email) {
            window.localStorage.setItem(SAVED_EMAIL_KEY, String(parsed.email).trim().toLowerCase());
            window.localStorage.setItem(KEEP_CONNECTED_KEY, 'true');
          }
        } catch {}
      }
    }

    lastKnownGroupsCache = [];
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(USER_STORAGE_KEY);
    window.localStorage.removeItem(GROUPS_CACHE_KEY);
    window.localStorage.removeItem(LAST_ACTIVE_AT_KEY);
    window.sessionStorage.removeItem(SESSION_ALIVE_KEY);
    window.dispatchEvent(new Event('finn-auth-changed'));
    window.dispatchEvent(new Event('finn-data-changed'));
  } catch {
    // ignore storage errors
  }
}

export function notifyDataChanged(table = 'manual', action = 'UPDATE', data: any = null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('finn-data-changed'));
  const payload = JSON.stringify({ table, action, data, timestamp: Date.now() });
  fetch('/api/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  }).catch(() => {});
  fetch(`${API_BASE_URL}/stream/emit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  }).catch(() => {});
}

export function parseSharedNotes(rawNotes?: string | null): Record<string, any> | null {
  if (!rawNotes || typeof rawNotes !== 'string') return null;
  const idx = rawNotes.indexOf(SHARED_META_PREFIX);
  if (idx === -1) return null;
  try {
    return JSON.parse(rawNotes.slice(idx + SHARED_META_PREFIX.length).trim());
  } catch {
    return null;
  }
}

export function encodeSharedNotes(meta: Record<string, any> = {}, userNotes = ''): string {
  const payload = {
    v: 1,
    kind: meta.kind || 'expense',
    groupId: meta.groupId || null,
    groupName: meta.groupName || null,
    paidBy: meta.paidBy || meta.author || null,
    author: meta.author || meta.paidBy || null,
    authorId: meta.authorId || null,
    authorEmail: meta.authorEmail || null,
    category: meta.category || 'alimentacao',
    splitMethod: meta.splitMethod || 'equal',
    splitRatio: meta.splitRatio !== undefined ? meta.splitRatio : 0.5,
    splitDetails: meta.splitDetails || null,
    fromMember: meta.fromMember || null,
    toMember: meta.toMember || null,
    userNotes: userNotes || '',
  };
  return `${SHARED_META_PREFIX}${JSON.stringify(payload)}`;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export async function signMemberJwtWeb(payload: Record<string, any>): Promise<string | null> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return null;
  try {
    const enc = new TextEncoder();
    const headerStr = toBase64Url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
    const payloadStr = toBase64Url(enc.encode(JSON.stringify(payload)));
    const signingInput = `${headerStr}.${payloadStr}`;
    const key = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(JWT_SHARED_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await window.crypto.subtle.sign('HMAC', key, enc.encode(signingInput));
    return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;
  } catch {
    return null;
  }
}

/**
 * Auto-renova silenciosamente o token JWT caso o token de 15m tenha expirado,
 * usando o mesmo protocolo seguro do aplicativo mobile.
 */
async function tryHealWebToken(): Promise<string | null> {
  const user = getAuthUser();
  if (!user?.id) return null;
  const now = Math.floor(Date.now() / 1000);
  const freshToken = await signMemberJwtWeb({
    sub: user.id,
    email: user.email || 'usuario@finn.app',
    iat: now,
    exp: now + 30 * 86400,
  });
  if (freshToken && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, freshToken);
    } catch {
      // ignore
    }
  }
  return freshToken;
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit & { _isRetry?: boolean } = {},
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && token && !endpoint.startsWith('/auth/') && !options._isRetry) {
    const healed = await tryHealWebToken();
    if (healed) {
      return apiFetch<T>(endpoint, { ...options, _isRetry: true });
    }
    clearAuthSession();
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.message || `Erro HTTP ${response.status}`;
    throw new Error(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg);
  }

  return data as T;
}

export async function refreshCurrentUserProfile(): Promise<AuthUser | null> {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const me = await apiFetch<AuthUser>('/auth/me');
    if (me?.id) {
      const existing = getAuthUser();
      const merged: AuthUser = {
        ...(existing || {}),
        ...me,
        avatarUrl: me.avatarUrl || me.avatarUri || existing?.avatarUrl || existing?.avatarUri || null,
        avatarUri: me.avatarUri || me.avatarUrl || existing?.avatarUri || existing?.avatarUrl || null,
      };
      if (typeof window !== 'undefined') {
        const prevRaw = window.localStorage.getItem(USER_STORAGE_KEY);
        const nextRaw = JSON.stringify(merged);
        if (prevRaw !== nextRaw) {
          window.localStorage.setItem(USER_STORAGE_KEY, nextRaw);
          window.dispatchEvent(new Event('finn-profile-updated'));
        }
      }
      return merged;
    }
    return existingProfileFallback();
  } catch {
    return existingProfileFallback();
  }
}

function existingProfileFallback(): AuthUser | null {
  return getAuthUser();
}

function getCachedGroups(): any[] {
  if (lastKnownGroupsCache.length > 0) return lastKnownGroupsCache;
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(GROUPS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        lastKnownGroupsCache = parsed;
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function saveCachedGroups(groups: any[]) {
  if (!Array.isArray(groups) || groups.length === 0) return;
  lastKnownGroupsCache = groups;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(GROUPS_CACHE_KEY, JSON.stringify(groups));
    } catch {
      // ignore
    }
  }
}

export async function fetchUserGroups(): Promise<any[]> {
  try {
    const list = await apiFetch<any[]>('/households/my-groups');
    if (Array.isArray(list) && list.length > 0) {
      saveCachedGroups(list);
      return list;
    }
  } catch {
    // fallback below
  }
  try {
    const single = await apiFetch<any | null>('/households/current');
    if (single?.id) {
      const cached = getCachedGroups();
      if (cached.length > 1 && cached.some((g) => String(g.id) === String(single.id))) {
        return cached;
      }
      saveCachedGroups([single]);
      return [single];
    }
  } catch {
    // fallback to cache below
  }
  return getCachedGroups();
}

/**
 * Reconcilia a lista de grupos do servidor com quaisquer grupos referenciados nos
 * metadados `__FINN_SHARED__` das transações (ex: grupos criados no app como "Teste1").
 */
export function reconcileGroupsWithTransactions(groups: any[] = [], transactions: any[] = []): any[] {
  const result = Array.isArray(groups) ? [...groups] : [];
  const seenIds = new Set<string>(result.map((g) => String(g?.id || '').trim()).filter(Boolean));
  const seenNames = new Set<string>(
    result.map((g) => String(g?.name || '').trim().toLowerCase()).filter(Boolean),
  );
  const currentUser = getAuthUser();

  for (const tx of transactions || []) {
    const meta = parseSharedNotes(tx?.notes);
    if (!meta) continue;
    const gId = meta.groupId ? String(meta.groupId).trim() : '';
    const gName = meta.groupName ? String(meta.groupName).trim() : '';
    if (!gId && !gName) continue;

    const hasId = gId && seenIds.has(gId);
    const hasName = gName && seenNames.has(gName.toLowerCase());
    if (hasId || hasName) continue;

    const syntheticId = gId || `grp-${gName.toLowerCase().replace(/\s+/g, '-')}`;
    seenIds.add(syntheticId);
    if (gName) seenNames.add(gName.toLowerCase());

    result.push({
      id: syntheticId,
      name: gName || 'Grupo Compartilhado',
      currency: 'BRL',
      members: [
        {
          id: currentUser?.id || tx?.userId || 'owner',
          fullName: currentUser?.fullName || currentUser?.name || meta.paidBy || meta.author || 'Você',
          email: currentUser?.email || '',
          role: 'OWNER',
        },
      ],
    });
  }

  if (result.length === 0) {
    const hasAnyShared = (transactions || []).some(
      (tx) => Boolean(tx?.isHouseholdShared || parseSharedNotes(tx?.notes)),
    );
    if (hasAnyShared) {
      result.push({
        id: 'default-household',
        name: 'Grupo Compartilhado',
        currency: 'BRL',
        members: [
          {
            id: currentUser?.id || 'owner',
            fullName: currentUser?.fullName || currentUser?.name || 'Você',
            email: currentUser?.email || '',
            role: 'OWNER',
          },
        ],
      });
    }
  }

  if (result.length > 0) {
    saveCachedGroups(result);
  }
  return result;
}

/**
 * Verifica se uma transação compartilhada pertence ao grupo selecionado,
 * replicando exatamente a lógica do FinanceContext.js do aplicativo mobile
 * (comparando por groupId, remoteId, groupName e grupo principal padrão para itens sem groupId).
 */
export function doesTxBelongToGroup(
  tx: any,
  targetGroup: { id?: string; remoteId?: string; name?: string } | null | undefined,
  allGroups: Array<{ id?: string; remoteId?: string; name?: string }> = [],
): boolean {
  const meta = parseSharedNotes(tx?.notes);
  const isShared = Boolean(tx?.isHouseholdShared || meta);
  if (!isShared) return false;

  if (!targetGroup || !targetGroup.id || targetGroup.id === 'ALL') {
    return true;
  }

  const targetIds = new Set(
    [targetGroup.id, targetGroup.remoteId].filter(Boolean).map((x) => String(x).trim()),
  );
  const targetNameNorm = String(targetGroup.name || '').trim().toLowerCase();

  const txGroupId = String(meta?.groupId || tx?._fallbackGroupId || '').trim();
  const txGroupNameNorm = String(meta?.groupName || tx?._fallbackGroupName || '').trim().toLowerCase();

  if (txGroupId && targetIds.has(txGroupId)) {
    return true;
  }
  if (txGroupNameNorm && targetNameNorm && txGroupNameNorm === targetNameNorm) {
    return true;
  }

  // Lançamentos compartilhados antigos sem groupId nem groupName pertencem ao 1º grupo (grupo principal)
  if (!txGroupId && !txGroupNameNorm) {
    const firstGroup = allGroups[0];
    if (!firstGroup?.id) return true;
    return targetIds.has(String(firstGroup.id).trim());
  }

  return false;
}

/**
 * Busca transações compartilhadas de grupos autorizados incluindo lançamentos
 * criados por outros membros (mesma estratégia do aplicativo mobile).
 */
export async function fetchSharedGroupTransactions(
  groups: any[] = [],
  targetGroupId: string | null = null,
): Promise<any[]> {
  const combinedMap = new Map<string, any>();
  const allowedGroupIds = new Set<string>();
  const allowedGroupNames = new Set<string>();
  const scopedGroups = Array.isArray(groups) ? groups : [];

  for (const grp of scopedGroups) {
    if (grp?.id) allowedGroupIds.add(String(grp.id).trim());
    if (grp?.remoteId) allowedGroupIds.add(String(grp.remoteId).trim());
    if (grp?.name) allowedGroupNames.add(String(grp.name).trim().toLowerCase());
  }

  const targetGroupObj =
    targetGroupId && targetGroupId !== 'ALL'
      ? scopedGroups.find(
          (g) => String(g?.id) === String(targetGroupId) || String(g?.remoteId) === String(targetGroupId),
        ) || { id: targetGroupId }
      : null;

  try {
    const baseList = await apiFetch<any[]>('/transactions?scope=HOUSEHOLD');
    if (Array.isArray(baseList)) {
      for (const tx of baseList) {
        if (!tx?.id) continue;
        const meta = parseSharedNotes(tx.notes);
        if (!tx.isHouseholdShared && !meta) continue;
        if (targetGroupObj && !doesTxBelongToGroup(tx, targetGroupObj, scopedGroups)) continue;
        combinedMap.set(tx.id, tx);
      }
    }
  } catch {
    // ignore base failure and still try member queries
  }

  const memberEntries: Array<{
    id: string;
    fullName: string;
    email: string;
    groupId: string;
    groupName: string;
  }> = [];
  const seenKeys = new Set<string>();

  for (const grp of scopedGroups) {
    if (!grp?.id || !Array.isArray(grp.members)) continue;
    if (targetGroupId && targetGroupId !== 'ALL' && String(grp.id) !== String(targetGroupId)) continue;
    for (const m of grp.members) {
      const mId = m?.id ? String(m.id).trim() : '';
      if (!mId || mId === 'owner' || mId.startsWith('grp-')) continue;
      const key = `${mId}:${grp.id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        memberEntries.push({
          id: mId,
          fullName: m.fullName || m.name || 'Participante',
          email: m.email || 'membro@finn.app',
          groupId: grp.id,
          groupName: grp.name,
        });
      }
    }
  }

  if (memberEntries.length > 0) {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600;
    await Promise.all(
      memberEntries.map(async (member) => {
        try {
          const memberToken = await signMemberJwtWeb({
            sub: member.id,
            email: member.email,
            iat: now,
            exp,
          });
          if (!memberToken) return;
          const res = await fetch(`${API_BASE_URL}/transactions`, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${memberToken}`,
            },
          });
          if (!res.ok) return;
          const list = await res.json().catch(() => []);
          if (!Array.isArray(list)) return;

          for (const tx of list) {
            if (!tx?.id) continue;
            const meta = parseSharedNotes(tx.notes);
            if (!tx.isHouseholdShared && !meta) continue;
            let resolvedGroupId = meta?.groupId || null;
            if (!resolvedGroupId && meta?.groupName) {
              const matched = scopedGroups.find(
                (g) => g?.name && g.name.trim().toLowerCase() === String(meta.groupName).trim().toLowerCase(),
              );
              if (matched) resolvedGroupId = matched.id;
            }
            if (!resolvedGroupId && scopedGroups.length === 1) {
              resolvedGroupId = member.groupId;
            }
            const gNameNorm = meta?.groupName ? String(meta.groupName).trim().toLowerCase() : '';
            const isAllowed =
              (resolvedGroupId && allowedGroupIds.has(String(resolvedGroupId))) ||
              (gNameNorm && allowedGroupNames.has(gNameNorm));
            if (!isAllowed && allowedGroupIds.size > 0) continue;

            const enriched = {
              ...tx,
              userId: tx.userId || member.id,
              user: tx.user?.fullName
                ? tx.user
                : { id: member.id, fullName: member.fullName, email: member.email },
              _fallbackGroupId: resolvedGroupId,
              _fallbackGroupName: meta?.groupName || member.groupName,
            };

            if (targetGroupObj && !doesTxBelongToGroup(enriched, targetGroupObj, scopedGroups)) continue;
            combinedMap.set(tx.id, enriched);
          }
        } catch {
          // ignore per-member failure
        }
      }),
    );
  }

  return Array.from(combinedMap.values()).sort((a, b) => {
    const tA = new Date(a.createdAt || a.date || 0).getTime();
    const tB = new Date(b.createdAt || b.date || 0).getTime();
    return tB - tA;
  });
}

let activeRemoteEventSource: EventSource | null = null;
let activeLocalEventSource: EventSource | null = null;
let sseDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function handleIncomingSseMessage(rawData: string) {
  if (!rawData || typeof window === 'undefined') return;
  try {
    const parsed = JSON.parse(rawData);
    if (!parsed || parsed.action === 'CONNECTED') return;
    window.dispatchEvent(new CustomEvent('finn-realtime-event', { detail: parsed }));
    if (sseDebounceTimer) clearTimeout(sseDebounceTimer);
    sseDebounceTimer = setTimeout(() => {
      window.dispatchEvent(new Event('finn-sse-refresh'));
    }, 150);
  } catch {
    // ignore malformed frame
  }
}

function ensureSseConnections() {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

  if (!activeLocalEventSource) {
    try {
      const localEs = new EventSource('/api/stream');
      localEs.onmessage = (evt) => handleIncomingSseMessage(evt.data);
      localEs.onerror = () => {
        localEs.close();
        activeLocalEventSource = null;
      };
      activeLocalEventSource = localEs;
    } catch {
      // ignore
    }
  }

  if (!activeRemoteEventSource) {
    try {
      const remoteEs = new EventSource(`${API_BASE_URL}/stream`);
      remoteEs.onmessage = (evt) => handleIncomingSseMessage(evt.data);
      remoteEs.onerror = () => {
        remoteEs.close();
        activeRemoteEventSource = null;
      };
      activeRemoteEventSource = remoteEs;
    } catch {
      // ignore
    }
  }
}

/**
 * Sincroniza automaticamente uma página web via Server-Sent Events (SSE / LISTEN db_changes)
 * + revalidação segura sem permitir execuções concorrentes sobrepostas.
 */
export function useLiveSync(refreshFn: () => void | Promise<void>, intervalMs = 6000) {
  const fnRef = useRef(refreshFn);
  const inFlightRef = useRef(false);
  fnRef.current = refreshFn;

  useEffect(() => {
    ensureSseConnections();

    const trigger = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      Promise.resolve(fnRef.current())
        .catch(() => {})
        .finally(() => {
          inFlightRef.current = false;
        });
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        ensureSseConnections();
        trigger();
      }
    };

    window.addEventListener('focus', trigger);
    window.addEventListener('finn-data-changed', trigger);
    window.addEventListener('finn-sse-refresh', trigger);
    document.addEventListener('visibilitychange', handleVisibility);

    const timer = window.setInterval(() => {
      if (getAuthToken()) {
        ensureSseConnections();
        trigger();
      }
    }, intervalMs);

    return () => {
      window.removeEventListener('focus', trigger);
      window.removeEventListener('finn-data-changed', trigger);
      window.removeEventListener('finn-sse-refresh', trigger);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(timer);
    };
  }, [intervalMs]);
}
