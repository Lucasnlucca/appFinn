import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { playExpenseSound } from '../services/soundService';
import {
  sendTextMessageToGemini,
  analyzeReceiptImage,
  analyzeInvoicePdf,
  analyzeVoiceAudio,
  getGeminiApiKey,
} from '../services/geminiService';
import {
  getStoredSession,
  setStoredSession,
  syncTransactionToAppwrite,
} from '../services/appwriteService';
import {
  testPostgresConnection,
  syncDatabaseWithPostgres,
  createTransaction as apiCreateTransaction,
  updateTransactionApi,
  deleteTransactionApi,
  createCreditCard as apiCreateCreditCard,
  updateCreditCardApi,
  deleteCreditCardApi,
  createAccount as apiCreateAccount,
  updateAccountApi,
  deleteAccountApi,
  logoutUser,
  deleteUserAccountApi,
  clearAuthSession,
  getStoredUser,
  getStoredToken,
  saveAuthUser,
  mergeWithSavedProfile,
  savePersistentUserProfile,
  fetchCurrentHouseholdApi,
  fetchUserHouseholdsApi,
  fetchTransactions,
  fetchSharedGroupTransactionsApi,
  encodeSharedNotes,
  parseSharedNotes,
  createHouseholdApi,
  createHouseholdInvitationApi,
  acceptHouseholdInvitationApi,
  generateHouseholdInviteCodeApi,
  deleteHouseholdApi,
  leaveHouseholdApi,
  kickHouseholdMemberApi,
  fetchNotificationsApi,
  createNotificationApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  sanitizeAvatarUri,
  autoHealAuthSession,
} from '../services/apiService';
import {
  publishCloudInvite,
  resolveCloudInvite,
} from '../services/inviteRelayService';
import { signOutGoogle } from '../services/googleAuthService';
import { clearAllBiometricData } from '../services/biometricService';
import {
  initPhoneNotifications,
  sendInstantPhoneNotification,
  scheduleSmartPhoneNotifications,
  DEFAULT_NOTIFICATION_PREFERENCES,
  loadUserNotificationPreferences,
  saveUserNotificationPreferences,
  groupInsightsNotifications,
} from '../services/notificationService';
import {
  NOTIFICATION_CATEGORIES,
  NotificationTemplates,
  normalizeLegacyNotification,
  normalizeNotificationCategory,
} from '../services/notificationTemplates';
import { getBankTheme } from '../constants/BankThemeRegistry';

const FinanceContext = createContext(null);

// Dados 100% reais e limpos - Inicia vazio para cada usuário cadastrar seus dados reais
const INITIAL_ACCOUNTS = [];
const INITIAL_CARDS = [];
const INITIAL_BILLS = [];
const INITIAL_TRANSACTIONS = [];
const INITIAL_COFRINHOS = [];

// Gerador de chaves de armazenamento local isoladas por usuário (Ambiente Separado Multi-Tenant)
export const getUserStorageKey = (userId, keyName) => {
  const safeId = userId ? String(userId).trim() : 'guest';
  return `@finn_usr_${safeId}_${keyName}`;
};

export const getUserEmailStorageKey = (email, keyName) => {
  const safeEmail = email ? String(email).trim().toLowerCase() : '';
  return safeEmail ? `@finn_mail_${safeEmail}_${keyName}` : null;
};

// Gerador de código único de 6 caracteres alfanuméricos para convite de grupo
export const generateGroupInviteCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const getInitialChat = (userName) => [
  {
    id: 'welcome',
    sender: 'ai',
    text: `Olá${userName ? `, ${userName}` : ''}! Sou o FINN AI, seu assistente financeiro inteligente. Seu ambiente está 100% pronto para você registrar suas contas, cartões e despesas reais. Pode me mandar mensagens, fotos de comprovantes ou áudios com seus gastos!`,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
];

// Categorias Oficiais (Orçamento inicial zerado - o usuário define suas próprias metas reais)
export const CATEGORIES = [
  { id: 'sem_categoria', label: 'Sem categoria', icon: 'help-circle-outline', emoji: '✓', color: '#94A3B8', budget: 0.00 },
  { id: 'alimentacao', label: 'Alimentação', icon: 'restaurant-outline', emoji: '🍔', color: '#F97316', budget: 0.00 },
  { id: 'assinaturas', label: 'Assinaturas', icon: 'repeat-outline', emoji: '🔁', color: '#8B5CF6', budget: 0.00 },
  { id: 'educacao', label: 'Educação', icon: 'school-outline', emoji: '📚', color: '#EC4899', budget: 0.00 },
  { id: 'financiamento', label: 'Financiamento', icon: 'card-outline', emoji: '💳', color: '#EAB308', budget: 0.00 },
  { id: 'lazer', label: 'Lazer', icon: 'game-controller-outline', emoji: '🎮', color: '#10B981', budget: 0.00 },
  { id: 'moradia', label: 'Moradia', icon: 'home-outline', emoji: '🏠', color: '#3B82F6', budget: 0.00 },
  { id: 'outros', label: 'Outros', icon: 'cube-outline', emoji: '📦', color: '#64748B', budget: 0.00 },
  { id: 'pets', label: 'Pets', icon: 'paw-outline', emoji: '🐾', color: '#F59E0B', budget: 0.00 },
  { id: 'presentes', label: 'Presentes', icon: 'gift-outline', emoji: '🎁', color: '#F43F5E', budget: 0.00 },
  { id: 'receita', label: 'Receita', icon: 'cash-outline', emoji: '💰', color: '#10B981', budget: 0.00 },
  { id: 'saude', label: 'Saúde', icon: 'medkit-outline', emoji: '💊', color: '#EF4444', budget: 0.00 },
  { id: 'transporte', label: 'Transporte', icon: 'car-sport-outline', emoji: '🚗', color: '#06B6D4', budget: 0.00 },
  { id: 'vestuario', label: 'Vestuário', icon: 'shirt-outline', emoji: '👕', color: '#6366F1', budget: 0.00 },
  { id: 'viagem', label: 'Viagem', icon: 'airplane-outline', emoji: '✈️', color: '#14B8A6', budget: 0.00 },
];

export function FinanceProvider({ children }) {
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS);
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);
  const [cards, setCards] = useState(INITIAL_CARDS);
  const [bills, setBills] = useState(INITIAL_BILLS);
  const [cofrinhos, setCofrinhos] = useState(INITIAL_COFRINHOS);
  const [heroCardMode, setHeroCardMode] = useState('balance'); // 'balance' (Saldo em Contas) | 'monthResult' (Resultado do Mês)
  const [activeMember, setActiveMember] = useState('Principal');
  const [members, setMembers] = useState({ user1: 'Principal', user2: 'Parceiro(a)' });
  const [selectedMonth, setSelectedMonth] = useState('Novembro 2026');
  const [hideBalances, setHideBalances] = useState(false);
  const [aiSkin, setAiSkin] = useState('estrategista'); // 'estrategista' | 'direto' | 'poupador' | 'investidor' | 'casal'
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [postgresStatus, setPostgresStatus] = useState({
    isOnline: false,
    latencyMs: null,
    lastSync: null,
    error: null,
  });
  const [isSyncingPostgres, setIsSyncingPostgres] = useState(false);
  const [aiChat, setAiChat] = useState([]);
  const [viewMode, setViewModeState] = useState('personal'); // 'personal' | 'shared' | 'consolidated'
  const [sharedGroups, setSharedGroups] = useState([]);
  const [activeGroupId, setActiveGroupIdState] = useState(null);
  const [groupInvitations, setGroupInvitations] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [activityNotifications, setActivityNotifications] = useState([]);
  const [readNotificationIds, setReadNotificationIds] = useState([]);
  const [clearedNotificationIds, setClearedNotificationIds] = useState([]);
  const [notificationPreferences, setNotificationPreferences] = useState(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [liveGroupBanner, setLiveGroupBanner] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [isRefreshingHome, setIsRefreshingHome] = useState(false);
  const [isRefreshingGroup, setIsRefreshingGroup] = useState(false);
  const [homeRefreshError, setHomeRefreshError] = useState(null);
  const [groupRefreshError, setGroupRefreshError] = useState(null);

  const sharedGroupsRef = useRef([]);
  const activeGroupIdRef = useRef(null);
  const loggedInUserRef = useRef(null);
  const transactionsRef = useRef([]);
  const accountsRef = useRef([]);
  const cardsRef = useRef([]);
  const settlementsRef = useRef([]);
  const seenSharedTxIdsRef = useRef(new Set());
  const seenSharedTxInitializedRef = useRef(false);
  const inFlightHomeRefreshRef = useRef({ userId: null, promise: null });
  const inFlightGroupRefreshMapRef = useRef(new Map());
  const groupRefreshSeqRef = useRef(new Map());

  useEffect(() => {
    sharedGroupsRef.current = sharedGroups;
  }, [sharedGroups]);

  useEffect(() => {
    activeGroupIdRef.current = activeGroupId;
  }, [activeGroupId]);

  useEffect(() => {
    loggedInUserRef.current = loggedInUser;
  }, [loggedInUser]);

  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  useEffect(() => {
    accountsRef.current = accounts;
  }, [accounts]);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    settlementsRef.current = settlements;
  }, [settlements]);

  const dismissLiveGroupBanner = useCallback(() => setLiveGroupBanner(null), []);
  const clearHomeRefreshError = useCallback(() => setHomeRefreshError(null), []);
  const clearGroupRefreshError = useCallback(() => setGroupRefreshError(null), []);

  // Helper para persistir dados no namespace isolado do usuário conectado (por ID e por E-mail)
  const saveUserItem = useCallback(async (keyName, val) => {
    const activeUser = loggedInUserRef.current || loggedInUser;
    const uid = activeUser?.id || 'guest';
    const email = activeUser?.email || '';
    const key = getUserStorageKey(uid, keyName);
    const emailKey = getUserEmailStorageKey(email, keyName);
    const str = typeof val === 'string' ? val : JSON.stringify(val);
    await AsyncStorage.setItem(key, str);
    if (emailKey) {
      await AsyncStorage.setItem(emailKey, str);
    }
  }, []);

  const getUserItem = async (keyName) => {
    const uid = loggedInUser?.id || 'guest';
    const email = loggedInUser?.email || '';
    const key = getUserStorageKey(uid, keyName);
    let raw = await AsyncStorage.getItem(key);
    if ((!raw || raw === '[]' || raw === 'null') && email) {
      const emailKey = getUserEmailStorageKey(email, keyName);
      if (emailKey) {
        const emailRaw = await AsyncStorage.getItem(emailKey);
        if (emailRaw && emailRaw !== '[]' && emailRaw !== 'null') {
          raw = emailRaw;
        }
      }
    }
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  };

  const readUserRawWithEmailFallback = async (uid, email, keyName) => {
    const primary = await AsyncStorage.getItem(getUserStorageKey(uid, keyName));
    if (primary && primary !== '[]' && primary !== 'null') {
      return primary;
    }
    const emailKey = getUserEmailStorageKey(email, keyName);
    if (emailKey) {
      const fallback = await AsyncStorage.getItem(emailKey);
      if (fallback && fallback !== '[]' && fallback !== 'null') {
        await AsyncStorage.setItem(getUserStorageKey(uid, keyName), fallback);
        return fallback;
      }
    }
    return primary;
  };

  // 1. Inicialização: Verifica se já existe uma sessão de autenticação ativa salva
  useEffect(() => {
    async function initSession() {
      try {
        const [storedUser, storedToken, bioEnabled] = await Promise.all([
          getStoredUser(),
          getStoredToken(),
          AsyncStorage.getItem('@finn_biometric_enabled_v2'),
        ]);

        if (storedUser && storedToken) {
          const uName = storedUser.fullName || storedUser.name || '';
          const normalized = { ...storedUser, name: uName };

          // Se a biometria (digital) estiver habilitada pelo cliente, ao entrar no app
          // exibe a tela de login solicitando a digital de cara!
          if (bioEnabled === 'true') {
            await AsyncStorage.setItem('@finn_biometric_user_v2', JSON.stringify(normalized));
            await AsyncStorage.setItem('@finn_biometric_token_v2', storedToken);
            setLoggedInUser(null);
          } else {
            setLoggedInUser(normalized);
            if (uName) {
              setMembers((prev) => ({ ...prev, user1: uName }));
              setActiveMember(uName);
            }
            autoHealAuthSession().catch(() => {});
          }
        } else {
          setLoggedInUser(null);
        }
      } catch (e) {
        console.warn('Erro ao carregar sessão inicial:', e);
        setLoggedInUser(null);
      } finally {
        setLoaded(true);
      }
    }
    initSession();
  }, []);

  // 2. Carrega os dados isolados do usuário quando o loggedInUser for alterado
  useEffect(() => {
    async function loadUserData() {
      if (!loggedInUser?.id) {
        // Sessão deslogada: garante ambiente 100% limpo em memória
        setTransactions([]);
        setAccounts([]);
        setCards([]);
        setBills([]);
        setCofrinhos([]);
        setAiChat([]);
        return;
      }

      const uid = loggedInUser.id;
      const uEmail = loggedInUser.email || '';
      try {
        const [
          savedTrans,
          savedAccs,
          savedCards,
          savedBills,
          savedCofs,
          savedChat,
          savedNames,
          savedHide,
          savedHeroMode,
          savedSkin,
          savedGroups,
          savedActiveGrpId,
          savedInvs,
          savedSettles,
          savedMode,
          savedActNotifs,
          savedReadNotifs,
          savedClearedNotifs,
          savedUserProfile,
        ] = await Promise.all([
          readUserRawWithEmailFallback(uid, uEmail, 'transactions'),
          readUserRawWithEmailFallback(uid, uEmail, 'accounts'),
          readUserRawWithEmailFallback(uid, uEmail, 'cards'),
          readUserRawWithEmailFallback(uid, uEmail, 'bills'),
          readUserRawWithEmailFallback(uid, uEmail, 'cofrinhos'),
          readUserRawWithEmailFallback(uid, uEmail, 'ai_chat'),
          readUserRawWithEmailFallback(uid, uEmail, 'members_names'),
          readUserRawWithEmailFallback(uid, uEmail, 'hide_balances'),
          readUserRawWithEmailFallback(uid, uEmail, 'hero_view_mode'),
          readUserRawWithEmailFallback(uid, uEmail, 'ai_skin'),
          readUserRawWithEmailFallback(uid, uEmail, 'shared_groups'),
          readUserRawWithEmailFallback(uid, uEmail, 'active_group_id'),
          readUserRawWithEmailFallback(uid, uEmail, 'group_invitations'),
          readUserRawWithEmailFallback(uid, uEmail, 'settlements'),
          readUserRawWithEmailFallback(uid, uEmail, 'view_mode'),
          readUserRawWithEmailFallback(uid, uEmail, 'activity_notifications'),
          readUserRawWithEmailFallback(uid, uEmail, 'read_notifications'),
          readUserRawWithEmailFallback(uid, uEmail, 'cleared_notifications'),
          readUserRawWithEmailFallback(uid, uEmail, 'user_profile'),
        ]);

        // Restaura Nome, Sobrenome e Foto de Perfil salvos pelo cliente para que nunca sejam perdidos
        const parsedLocalProfile = savedUserProfile ? JSON.parse(savedUserProfile) : null;
        const mergedProfile = await mergeWithSavedProfile({
          ...loggedInUser,
          ...(parsedLocalProfile || {}),
        });
        if (
          mergedProfile &&
          (mergedProfile.fullName !== loggedInUser.fullName ||
            mergedProfile.firstName !== loggedInUser.firstName ||
            mergedProfile.lastName !== loggedInUser.lastName ||
            mergedProfile.avatarUri !== loggedInUser.avatarUri)
        ) {
          setLoggedInUser(mergedProfile);
        }

        const rawParsedTrans = savedTrans ? JSON.parse(savedTrans) : [];
        const parsedTrans = Array.isArray(rawParsedTrans)
          ? rawParsedTrans.map((t) => ({
              ...t,
              title: t.title || t.description || 'Movimentação',
              description: t.description || t.title || 'Movimentação',
            }))
          : [];
        let parsedAccs = savedAccs ? JSON.parse(savedAccs) : [];
        const parsedCards = savedCards ? JSON.parse(savedCards) : [];

        // Se o usuário tem movimentações (ex: Salário), mas ainda não possui nenhuma conta bancária cadastrada,
        // cria automaticamente uma "Conta Principal" com o saldo resultante para abrigar esse dinheiro
        let finalTrans = parsedTrans;
        if (parsedAccs.length === 0 && parsedTrans.length > 0) {
          const initialBalance = parsedTrans.reduce(
            (sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount),
            0
          );
          const autoAcc = {
            id: 'acc-' + Date.now(),
            name: 'Conta Principal',
            bank: 'Conta Principal',
            balance: initialBalance,
            owner: loggedInUser.name || 'Titular',
            icon: 'wallet-outline',
            color: '#0E2F5A',
            updatedAt: new Date().toISOString(),
          };
          parsedAccs = [autoAcc];
          await saveUserItem('accounts', parsedAccs);

          finalTrans = parsedTrans.map((t) =>
            t.accountId ? t : { ...t, accountId: autoAcc.id }
          );
          setTransactions(finalTrans);
          await saveUserItem('transactions', finalTrans);
        } else {
          setTransactions(finalTrans);
        }
        setAccounts(parsedAccs);
        setCards(parsedCards);
        setBills(savedBills ? JSON.parse(savedBills) : []);
        setCofrinhos(savedCofs ? JSON.parse(savedCofs) : []);
        setAiChat(savedChat ? JSON.parse(savedChat) : getInitialChat(loggedInUser.name));
        if (savedNames) setMembers(JSON.parse(savedNames));
        if (savedHide) setHideBalances(JSON.parse(savedHide));
        if (savedHeroMode) setHeroCardMode(JSON.parse(savedHeroMode));
        if (savedSkin) setAiSkin(savedSkin);

        let parsedGroups = savedGroups ? JSON.parse(savedGroups) : [];
        if (Array.isArray(parsedGroups)) {
          // Remove qualquer grupo pré-montado padrão que possa ter sido salvo em versões anteriores
          const cleanedGroups = parsedGroups.filter(
            (g) =>
              g &&
              g.id !== 'grp-casal-default' &&
              g.id !== 'default-casal' &&
              g.description !== 'Espaço compartilhado do casal' &&
              g.description !== 'Grupo conectado ao PostgreSQL' &&
              !(
                Array.isArray(g.members) &&
                g.members.some((m) => m.id === 'partner' || m.name === 'Parceiro(a)')
              )
          );
          if (cleanedGroups.length !== parsedGroups.length) {
            parsedGroups = cleanedGroups;
            await saveUserItem('shared_groups', parsedGroups);
          }
        } else {
          parsedGroups = [];
        }
        sharedGroupsRef.current = parsedGroups;
        setSharedGroups(parsedGroups);
        const matchedSavedGroup = savedActiveGrpId
          ? parsedGroups.find(
              (g) => g.id === savedActiveGrpId || g.remoteId === savedActiveGrpId
            )
          : null;
        const resolvedActiveId =
          matchedSavedGroup?.id || parsedGroups[0]?.id || null;
        activeGroupIdRef.current = resolvedActiveId;
        setActiveGroupIdState(resolvedActiveId);
        await saveUserItem('active_group_id', resolvedActiveId);

        if (savedInvs) setGroupInvitations(JSON.parse(savedInvs));
        const parsedSettles = savedSettles ? JSON.parse(savedSettles) : [];
        if (savedSettles) setSettlements(parsedSettles);
        if (savedMode) setViewModeState(savedMode);
        const parsedClearedNotifs = savedClearedNotifs ? JSON.parse(savedClearedNotifs) : [];
        const clearedSetOnLoad = new Set(Array.isArray(parsedClearedNotifs) ? parsedClearedNotifs : []);
        setClearedNotificationIds(Array.isArray(parsedClearedNotifs) ? parsedClearedNotifs : []);
        setActivityNotifications(
          (savedActNotifs ? JSON.parse(savedActNotifs) : []).filter(
            (n) => n && !clearedSetOnLoad.has(n.id) && !clearedSetOnLoad.has(n.dedupeKey)
          )
        );
        setReadNotificationIds(savedReadNotifs ? JSON.parse(savedReadNotifs) : []);
        const loadedPrefs = await loadUserNotificationPreferences(uid);
        setNotificationPreferences(loadedPrefs);

        // Inicializa o controle de IDs de despesas compartilhadas já vistas para não re-notificar histórico antigo
        try {
          const savedSeenRaw = await readUserRawWithEmailFallback(uid, uEmail, 'seen_shared_tx_ids');
          const savedSeenArr = savedSeenRaw ? JSON.parse(savedSeenRaw) : [];
          const initialSeen = new Set(Array.isArray(savedSeenArr) ? savedSeenArr : []);
          for (const t of finalTrans) {
            if (t?.id) initialSeen.add(String(t.id));
            if (t?.remoteId) initialSeen.add(String(t.remoteId));
          }
          for (const s of Array.isArray(parsedSettles) ? parsedSettles : []) {
            if (s?.id) initialSeen.add(String(s.id));
            if (s?.remoteId) initialSeen.add(String(s.remoteId));
          }
          seenSharedTxIdsRef.current = initialSeen;
          seenSharedTxInitializedRef.current = savedSeenRaw !== null && savedSeenRaw !== undefined;
        } catch {}

        // Busca notificações salvas no PostgreSQL e reconcilia com o histórico local
        fetchNotificationsApi(50)
          .then((remoteNotifs) => {
            if (Array.isArray(remoteNotifs) && remoteNotifs.length > 0) {
              setActivityNotifications((prev) => {
                const byKey = new Map();
                for (const item of [...remoteNotifs, ...(prev || [])]) {
                  if (!item) continue;
                  if (clearedSetOnLoad.has(item.id) || clearedSetOnLoad.has(item.dedupeKey)) {
                    continue;
                  }
                  const k = item.dedupeKey || item.id;
                  if (k && !byKey.has(k)) byKey.set(k, item);
                }
                const merged = Array.from(byKey.values()).slice(0, 40);
                saveUserItem('activity_notifications', merged);
                return merged;
              });

              const remoteReadIds = remoteNotifs.filter((r) => r.read || r.isRead).map((r) => r.id);
              if (remoteReadIds.length > 0) {
                setReadNotificationIds((prev) => {
                  const next = Array.from(new Set([...(prev || []), ...remoteReadIds]));
                  saveUserItem('read_notifications', next);
                  return next;
                });
              }
            }
          })
          .catch(() => {});

        // Dispara sincronização bi-direcional passando exatamente os dados carregados do banco local
        await syncWithPostgres({
          overrideAccounts: parsedAccs,
          overrideCards: parsedCards,
          overrideTransactions: finalTrans,
        });
      } catch (e) {
        console.warn('Erro ao carregar dados locais do usuário:', e);
      }
    }

    if (loaded) {
      loadUserData();
    }
  }, [loggedInUser?.id, loaded]);

  // Sincronização bi-direcional não-destrutiva com PostgreSQL da VPS
  const syncWithPostgres = async (overrides = {}) => {
    const reqUserId = loggedInUserRef.current?.id || loggedInUser?.id;
    if (!reqUserId) {
      return { success: false, error: 'Sessão não autenticada' };
    }
    if (isSyncingPostgres && !overrides.force) {
      return { success: true, reused: true };
    }
    setIsSyncingPostgres(true);
    try {
      const currentLocalCards = Array.isArray(overrides.overrideCards)
        ? overrides.overrideCards
        : cardsRef.current;
      const currentLocalAccounts = Array.isArray(overrides.overrideAccounts)
        ? overrides.overrideAccounts
        : accountsRef.current;
      const currentLocalTransactions = Array.isArray(overrides.overrideTransactions)
        ? overrides.overrideTransactions
        : transactionsRef.current;

      const norm = (s) => String(s || '').trim().toLowerCase();

      const res = await syncDatabaseWithPostgres({
        localCards: currentLocalCards,
        localAccounts: currentLocalAccounts,
        localTransactions: currentLocalTransactions,
      });

      // Isolamento por usuário: se o usuário trocou de conta durante a requisição, descarta
      if (String(loggedInUserRef.current?.id || '') !== String(reqUserId)) {
        return { success: false, cancelled: true };
      }

      if (res.success) {
        // 1. Mesclar cartões remotos e locais preservando edições do cliente (limite, vencimento, fatura)
        if (res.remoteCards && res.remoteCards.length > 0) {
          const mappedCards = res.remoteCards.map((rc) => {
            const localMatch = currentLocalCards.find(
              (lc) =>
                lc.id === rc.id ||
                lc.remoteId === rc.id ||
                norm(lc.name || lc.bank) === norm(rc.name)
            );
            const theme = getBankTheme(localMatch?.bankId || localMatch?.bank || rc.name);
            const remoteLimit = parseFloat(rc.creditLimit) || 0;
            const localLimit = localMatch?.limit !== undefined ? parseFloat(localMatch.limit) : null;
            const limit =
              localMatch?.updatedAt && localLimit !== null
                ? localLimit
                : remoteLimit > 0
                ? remoteLimit
                : localLimit || 0;

            const remoteBill = rc.currentBill ? parseFloat(rc.currentBill.totalAmount) || 0 : 0;
            const localBill = localMatch?.currentInvoice ? parseFloat(localMatch.currentInvoice) || 0 : 0;
            const currentBill = Math.max(remoteBill, localBill);
            const dueDay = localMatch?.updatedAt && localMatch?.dueDay ? localMatch.dueDay : rc.dueDay || localMatch?.dueDay || 10;
            const closingDay =
              localMatch?.updatedAt && localMatch?.closingDay
                ? localMatch.closingDay
                : rc.closingDay || localMatch?.closingDay || 3;
            const usedPercent = limit > 0 ? Math.min(100, Math.round((currentBill / limit) * 100)) : 0;

            return {
              ...(localMatch || {}),
              id: rc.id,
              remoteId: rc.id,
              name: localMatch?.name || rc.name,
              bank: localMatch?.bank || rc.name,
              bankId: theme.bankId,
              holderName: localMatch?.holderName || rc.holderName || loggedInUserRef.current?.fullName || loggedInUserRef.current?.name || 'TITULAR',
              lastFourDigits: localMatch?.lastFourDigits || rc.lastFourDigits || '••••',
              expiryMonth: localMatch?.expiryMonth || rc.expiryMonth || '12',
              expiryYear: localMatch?.expiryYear || rc.expiryYear || '28',
              limit,
              currentInvoice: currentBill,
              closingDay,
              dueDay,
              dueDateText: `Vence dia ${dueDay}`,
              status: localMatch?.status || 'Em aberto',
              usedPercent,
              color: localMatch?.color || rc.colorHex || theme.gradientColors[0],
              logoType: theme.bankId,
              owner: localMatch?.owner || loggedInUserRef.current?.name || 'Titular',
            };
          });

          // Mantém cartões locais que ainda não subiram
          const unsyncedCards = currentLocalCards.filter(
            (lc) =>
              !mappedCards.some(
                (mc) => mc.id === lc.id || norm(mc.name || mc.bank) === norm(lc.name || lc.bank)
              )
          );
          const finalCards = [...mappedCards, ...unsyncedCards];
          cardsRef.current = finalCards;
          setCards(finalCards);
          await saveUserItem('cards', finalCards);
        }

        // 2. Mesclar transações remotas e locais usando os valores confirmados pelo servidor
        if (res.remoteTransactions && res.remoteTransactions.length > 0) {
          const latestLocalTxs = transactionsRef.current || currentLocalTransactions;
          const mappedRemoteTxs = res.remoteTransactions
            .filter((rt) => {
              const meta = parseSharedNotes(rt?.notes);
              return meta?.kind !== 'settlement';
            })
            .map((rt) => {
              const meta = parseSharedNotes(rt.notes);
              const rtTitle = rt.description || rt.title || 'Movimentação';
              const rtAmt = parseFloat(rt.amount) || 0;
              const rtDate = rt.date ? rt.date.split('T')[0] : new Date().toISOString().split('T')[0];
              const localMatch = latestLocalTxs.find((lt) => {
                if (lt.id === rt.id || lt.remoteId === rt.id) return true;
                if (meta?.groupId) {
                  const ltGrp = lt.groupId || lt.sharedGroupId;
                  if (ltGrp && String(ltGrp) !== String(meta.groupId)) return false;
                }
                return (
                  norm(lt.title || lt.description) === norm(rtTitle) &&
                  Math.abs((parseFloat(lt.amount) || 0) - rtAmt) < 0.01 &&
                  String(lt.date || '').split('T')[0] === rtDate
                );
              });
              const isSharedTx =
                !!localMatch?.isShared ||
                !!rt.isHouseholdShared ||
                !!meta;
              const resolvedGrpId =
                meta?.groupId ||
                localMatch?.groupId ||
                localMatch?.sharedGroupId ||
                null;

              return {
                ...(localMatch || {}),
                id: rt.id,
                remoteId: rt.id,
                title: rtTitle || localMatch?.title || 'Movimentação',
                description: rtTitle || localMatch?.description || 'Movimentação',
                amount: rtAmt,
                type: (rt.type || 'EXPENSE').toLowerCase() === 'income' ? 'income' : 'expense',
                category: meta?.category || rt.category?.name || localMatch?.category || (isSharedTx ? 'alimentacao' : 'outros'),
                author: meta?.author || meta?.paidBy || localMatch?.author || rt.user?.fullName || loggedInUserRef.current?.name || 'Titular',
                paidBy: meta?.paidBy || meta?.author || localMatch?.paidBy || rt.user?.fullName || loggedInUserRef.current?.name || 'Titular',
                isShared: isSharedTx,
                groupId: resolvedGrpId,
                sharedGroupId: resolvedGrpId,
                groupName: meta?.groupName || localMatch?.groupName || null,
                splitMethod: meta?.splitMethod || localMatch?.splitMethod || 'equal',
                splitRatio: meta?.splitRatio ?? localMatch?.splitRatio ?? 0.5,
                splitDetails: meta?.splitDetails || localMatch?.splitDetails || null,
                date: rtDate,
                createdAt: rt.createdAt || localMatch?.createdAt || new Date().toISOString(),
                accountId: rt.accountId || localMatch?.accountId,
                creditCardId: rt.creditCardId || localMatch?.creditCardId,
                notes: meta?.userNotes !== undefined ? meta.userNotes : (rt.notes || localMatch?.notes || ''),
              };
            });

          // Mantém transações locais (ex: de grupos ou recém-criadas) que não estão na lista remota pessoal
          const localOnlyTxs = latestLocalTxs.filter(
            (lt) =>
              !mappedRemoteTxs.some(
                (mt) =>
                  mt.id === lt.id ||
                  mt.id === lt.remoteId ||
                  (!lt.isShared &&
                    norm(mt.title || mt.description) === norm(lt.title || lt.description) &&
                    Math.abs((parseFloat(mt.amount) || 0) - (parseFloat(lt.amount) || 0)) < 0.01 &&
                    String(mt.date || '').split('T')[0] === String(lt.date || '').split('T')[0])
              )
          );

          const finalTxs = [...mappedRemoteTxs, ...localOnlyTxs];
          transactionsRef.current = finalTxs;
          setTransactions(finalTxs);
          await saveUserItem('transactions', finalTxs);
        }

        // 3. Mesclar contas bancárias preservando o saldo real do cliente (nunca zerar R$ 4.000,00 para R$ 0,00!)
        if (res.remoteAccounts && res.remoteAccounts.length > 0) {
          const mappedAccs = res.remoteAccounts.map((ra) => {
            const localMatch = currentLocalAccounts.find(
              (la) =>
                la.id === ra.id ||
                la.remoteId === ra.id ||
                norm(la.name || la.bank) === norm(ra.name)
            );
            const remoteBal = parseFloat(ra.currentBalance) || 0;
            const localBal =
              localMatch?.balance !== undefined && localMatch?.balance !== null
                ? parseFloat(localMatch.balance)
                : null;

            // Se o saldo local foi definido (ex: R$ 4.000,00) e o remoto veio 0, preserva o local!
            let resolvedBalance = remoteBal;
            if (localBal !== null && !Number.isNaN(localBal)) {
              const localUpdated = localMatch?.updatedAt ? new Date(localMatch.updatedAt).getTime() : 0;
              const remoteUpdated = ra.updatedAt ? new Date(ra.updatedAt).getTime() : 0;
              if (localUpdated >= remoteUpdated || (localBal !== 0 && remoteBal === 0)) {
                resolvedBalance = localBal;
              }
            }

            return {
              ...(localMatch || {}),
              id: ra.id,
              remoteId: ra.id,
              name: localMatch?.name || ra.name,
              bank: localMatch?.bank || ra.name,
              balance: resolvedBalance,
              owner: localMatch?.owner || loggedInUserRef.current?.name || 'Titular',
              icon: localMatch?.icon || 'wallet-outline',
              color: localMatch?.color || ra.colorHex || '#820AD1',
              updatedAt: localMatch?.updatedAt || ra.updatedAt || new Date().toISOString(),
            };
          });

          const unsyncedAccs = currentLocalAccounts.filter(
            (la) =>
              !mappedAccs.some(
                (ma) => ma.id === la.id || norm(ma.name || ma.bank) === norm(la.name || la.bank)
              )
          );
          const finalAccs = [...mappedAccs, ...unsyncedAccs];
          accountsRef.current = finalAccs;
          setAccounts(finalAccs);
          await saveUserItem('accounts', finalAccs);
        }

        setPostgresStatus({
          isOnline: true,
          latencyMs: res.latencyMs,
          lastSync: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          error: null,
        });
        return res;
      } else {
        setPostgresStatus((prev) => ({
          ...prev,
          isOnline: false,
          error: res.reason || 'Erro na sincronização',
        }));
        return res;
      }
    } catch (err) {
      setPostgresStatus((prev) => ({
        ...prev,
        isOnline: false,
        error: err.message,
      }));
      return { success: false, error: err.message };
    } finally {
      setIsSyncingPostgres(false);
    }
  };

  // Helper para disparar notificações de Finanças em Grupo (In-App + Barra do Celular)
  const pushGroupNotification = ({
    title,
    message,
    icon = 'people-outline',
    groupId = null,
    groupName = 'Compartilhado',
    bypassRules = true,
  }) => {
    const newNotif = NotificationTemplates.sharedGroupActivity({
      groupId,
      groupName,
      title,
      message,
      icon,
    });

    setActivityNotifications((prev) => {
      const next = [newNotif, ...prev].slice(0, 35);
      saveUserItem('activity_notifications', next);
      return next;
    });

    sendInstantPhoneNotification({
      notification: newNotif,
      userId: loggedInUserRef.current?.id || loggedInUser?.id || 'guest',
      preferences: notificationPreferences,
      data: { type: 'shared_group', groupId, groupName, screen: 'SharedFinances' },
      delaySeconds: 0,
      bypassRules,
    }).catch(() => {});
  };

  const loadedRef = useRef(false);
  useEffect(() => {
    loadedRef.current = loaded;
  }, [loaded]);

  const syncWithPostgresRef = useRef(null);
  syncWithPostgresRef.current = syncWithPostgres;

  const pushGroupNotificationRef = useRef(null);
  pushGroupNotificationRef.current = pushGroupNotification;

  /**
   * Atualiza os dados de grupos financeiros (membros, gastos compartilhados, abatimentos e saldo em aberto)
   * consultando a API fresca. Reutiliza consulta em andamento se dois gatilhos pedirem os mesmos dados
   * ao mesmo tempo e isola respostas por usuário e grupo (evita condição de corrida ao trocar de grupo A -> B).
   */
  const refreshGroupData = useCallback(async (targetGroupId = null, options = {}) => {
    const { silent = false } = options || {};
    const reqUserId = loggedInUserRef.current?.id;
    if (!reqUserId) {
      return { success: false, error: 'Sessão não autenticada' };
    }

    const groupScopeKey = targetGroupId ? String(targetGroupId) : 'ALL';
    const dedupeKey = `${reqUserId}:${groupScopeKey}`;

    const existingInFlight = inFlightGroupRefreshMapRef.current.get(dedupeKey);
    if (existingInFlight) {
      return existingInFlight;
    }

    const nextSeq = (groupRefreshSeqRef.current.get(dedupeKey) || 0) + 1;
    groupRefreshSeqRef.current.set(dedupeKey, nextSeq);

    if (!silent) {
      setIsRefreshingGroup(true);
    }

    const persistSeenIds = () => {
      try {
        const arr = Array.from(seenSharedTxIdsRef.current).slice(-300);
        saveUserItem('seen_shared_tx_ids', arr);
      } catch {}
    };

    const refreshPromise = (async () => {
      try {
        await Promise.resolve();
        let householdsFetchSucceeded = false;
        let lastNetworkError = null;
        let householdsList = [];

        try {
          const myGroups = await fetchUserHouseholdsApi();
          householdsFetchSucceeded = true;
          if (Array.isArray(myGroups) && myGroups.length > 0) {
            householdsList = myGroups;
          }
        } catch (err) {
          lastNetworkError = err;
        }

        if (householdsList.length === 0) {
          try {
            const single = await fetchCurrentHouseholdApi();
            householdsFetchSucceeded = true;
            if (single?.id) householdsList.push(single);
          } catch (err) {
            if (!lastNetworkError) lastNetworkError = err;
          }
        }

        // Verifica isolamento de usuário e se uma requisição mais recente para a mesma chave já iniciou
        if (String(loggedInUserRef.current?.id || '') !== String(reqUserId)) {
          return { success: false, cancelled: true };
        }

        let mergedGroupsSnapshot = [...(sharedGroupsRef.current || [])];

        if (householdsList.length > 0) {
          let listChanged = false;
          const updatedList = [...mergedGroupsSnapshot];

          for (const hh of householdsList) {
            if (!hh?.id) continue;
            const ownerMember =
              (hh.members || []).find((m) => m.role === 'OWNER') || hh.members?.[0];
            const mappedMembers = (hh.members || []).map((m) => ({
              id: m.id,
              name: m.fullName || m.name || (m.role === 'OWNER' ? 'Organizador(a)' : 'Membro'),
              email: m.email || '',
              avatarUrl: sanitizeAvatarUri(m.avatarUrl || null),
              role: m.role || 'MEMBER',
              isCreator: m.role === 'OWNER',
            }));

            const existingIdx = updatedList.findIndex(
              (g) => g.remoteId === hh.id || g.id === hh.id
            );

            if (existingIdx === -1) {
              const newGrp = {
                id: hh.id,
                remoteId: hh.id,
                name: hh.name || 'Grupo Compartilhado',
                type: 'Casal',
                description: 'Sincronizado do PostgreSQL',
                createdAt: new Date().toISOString(),
                creatorId: ownerMember?.id || 'owner',
                creatorName: ownerMember?.fullName || ownerMember?.name || 'Organizador(a)',
                members: mappedMembers,
              };
              updatedList.push(newGrp);
              listChanged = true;
            } else {
              const existing = updatedList[existingIdx];
              const existingCount = existing.members?.length || 0;
              const newCount = mappedMembers.length;
              const membersChanged =
                existingCount !== newCount ||
                JSON.stringify(existing.members) !== JSON.stringify(mappedMembers);
              const nameChanged = existing.name !== hh.name;

              if (membersChanged || nameChanged) {
                listChanged = true;
                const grpTitle = hh.name || existing.name || 'Grupo';

                if (newCount > existingCount) {
                  const existingIds = new Set(
                    (existing.members || []).map((m) => m.id || m.email)
                  );
                  const joinedMember = mappedMembers.find(
                    (m) => !existingIds.has(m.id || m.email)
                  );
                  const joinedName = joinedMember?.name || 'Um novo participante';
                  pushGroupNotification({
                    title: `🎉 ${joinedName} entrou no grupo ${grpTitle}!`,
                    message: `${joinedName} aceitou o convite e entrou no grupo "${grpTitle}". Agora vocês podem dividir despesas!`,
                    icon: 'person-add',
                    color: '#10B981',
                    groupId: existing.id,
                    groupName: grpTitle,
                  });
                } else if (newCount < existingCount) {
                  pushGroupNotification({
                    title: `👋 Participante saiu de ${grpTitle}`,
                    message: `Houve uma atualização nos membros do grupo "${grpTitle}" (${newCount} participante${newCount > 1 ? 's' : ''}).`,
                    icon: 'person-remove',
                    color: '#F59E0B',
                    groupId: existing.id,
                    groupName: grpTitle,
                  });
                }

                updatedList[existingIdx] = {
                  ...existing,
                  name: hh.name || existing.name,
                  creatorId: ownerMember?.id || existing.creatorId,
                  creatorName: ownerMember?.fullName || existing.creatorName,
                  members: mappedMembers,
                };
              }
            }
          }

          mergedGroupsSnapshot = updatedList;

          if (listChanged && String(loggedInUserRef.current?.id || '') === String(reqUserId)) {
            sharedGroupsRef.current = updatedList;
            setSharedGroups(updatedList);
            await saveUserItem('shared_groups', updatedList);
          }

          const currentActiveId = activeGroupIdRef.current;
          const activeStillExists =
            currentActiveId &&
            updatedList.some(
              (g) =>
                String(g.id) === String(currentActiveId) ||
                String(g.remoteId) === String(currentActiveId)
            );
          if (
            loadedRef.current &&
            (!currentActiveId || !activeStillExists) &&
            updatedList.length > 0 &&
            String(loggedInUserRef.current?.id || '') === String(reqUserId)
          ) {
            const firstId = updatedList[0].id;
            activeGroupIdRef.current = firstId;
            setActiveGroupIdState(firstId);
            await saveUserItem('active_group_id', firstId);
          }
        }

        const groupsToQuery =
          mergedGroupsSnapshot.length > 0 ? mergedGroupsSnapshot : householdsList;

        let remoteSharedTxs = [];
        let txFetchSucceeded = false;

        if (groupsToQuery.length > 0) {
          try {
            remoteSharedTxs = await fetchSharedGroupTransactionsApi(groupsToQuery, {
              targetGroupId,
            });
            txFetchSucceeded = true;
          } catch (txErr) {
            lastNetworkError = txErr;
          }
        } else if (householdsFetchSucceeded) {
          txFetchSucceeded = true;
        }

        // Se a rede falhou (ex.: sem internet), preserva os dados anteriores e retorna erro amigável
        if (!txFetchSucceeded && !householdsFetchSucceeded) {
          const msg = 'Não foi possível atualizar. Tente novamente.';
          if (!silent) setGroupRefreshError(msg);
          return { success: false, error: msg };
        }
        if (!txFetchSucceeded && groupsToQuery.length > 0) {
          const msg = 'Não foi possível atualizar. Tente novamente.';
          if (!silent) setGroupRefreshError(msg);
          return { success: false, error: msg };
        }

        // Verifica novamente se o usuário mudou ou se uma resposta mais recente já aplicou para este escopo
        if (String(loggedInUserRef.current?.id || '') !== String(reqUserId)) {
          return { success: false, cancelled: true };
        }
        if (groupRefreshSeqRef.current.get(dedupeKey) !== nextSeq) {
          return { success: true, superseded: true };
        }

        // Construir conjunto de IDs de grupos permitidos para o usuário atual
        const allowedGroupIds = new Set();
        for (const g of groupsToQuery) {
          if (g?.id) allowedGroupIds.add(String(g.id));
          if (g?.remoteId) allowedGroupIds.add(String(g.remoteId));
        }

        const targetGroupObj = targetGroupId
          ? groupsToQuery.find(
              (g) =>
                String(g.id) === String(targetGroupId) ||
                String(g.remoteId) === String(targetGroupId)
            )
          : null;
        const targetGroupValidIds = targetGroupId
          ? new Set(
              [targetGroupId, targetGroupObj?.id, targetGroupObj?.remoteId]
                .filter(Boolean)
                .map(String)
            )
          : null;

        if (Array.isArray(remoteSharedTxs) && remoteSharedTxs.length > 0) {
          const myId = loggedInUserRef.current?.id
            ? String(loggedInUserRef.current.id).trim()
            : '';
          const myEmail = String(loggedInUserRef.current?.email || '')
            .trim()
            .toLowerCase();
          const myNameNorm = String(
            loggedInUserRef.current?.fullName || loggedInUserRef.current?.name || ''
          )
            .trim()
            .toLowerCase();
          const norm = (s) => String(s || '').trim().toLowerCase();

          const newlyArrivedNotifications = [];
          const newSettlementItems = [];

          setTransactions((prev) => {
            let txsChanged = false;
            const nextTxs = [...prev];

            // Percorre do mais antigo para o mais recente para manter ordem cronológica no topo
            const orderedRemote = [...remoteSharedTxs].reverse();

            for (const rt of orderedRemote) {
              if (!rt?.id) continue;
              const meta = parseSharedNotes(rt.notes);
              const rtTitle = rt.description || rt.title || 'Despesa compartilhada';
              const rtAmt = parseFloat(rt.amount) || 0;
              const rtDate = rt.date
                ? rt.date.split('T')[0]
                : new Date().toISOString().split('T')[0];

              const rtUserId = String(rt.userId || rt.user?.id || meta?.authorId || '').trim();
              const rtEmail = String(rt.user?.email || meta?.authorEmail || '')
                .trim()
                .toLowerCase();
              const rawMetaGroupId = meta?.groupId || rt._fallbackGroupId || null;
              const rawMetaGroupName = meta?.groupName || rt._fallbackGroupName || null;

              // Rejeita lançamentos de grupos aos quais o usuário não tem acesso
              if (rawMetaGroupId && !allowedGroupIds.has(String(rawMetaGroupId))) {
                continue;
              }

              // Identifica exatamente a qual grupo pertence esta despesa (sem usar activeGroupIdRef na chegada para evitar misturar grupos A e B)
              const matchedGroup =
                groupsToQuery.find(
                  (g) =>
                    (rawMetaGroupId &&
                      (String(g.id) === String(rawMetaGroupId) ||
                        String(g.remoteId) === String(rawMetaGroupId))) ||
                    (rawMetaGroupName &&
                      g.name &&
                      norm(g.name) === norm(rawMetaGroupName))
                ) ||
                (!rawMetaGroupId && groupsToQuery.length === 1
                  ? groupsToQuery.find((g) =>
                      (g.members || []).some(
                        (m) =>
                          (rtUserId && m.id && String(m.id) === rtUserId) ||
                          (rtEmail && m.email && norm(m.email) === rtEmail)
                      )
                    )
                  : null) ||
                null;

              if (!matchedGroup && rawMetaGroupId && !allowedGroupIds.has(String(rawMetaGroupId))) {
                continue;
              }

              const resolvedGroupId =
                matchedGroup?.id ||
                rawMetaGroupId ||
                (groupsToQuery.length === 1 ? groupsToQuery[0]?.id : null);

              if (!resolvedGroupId) continue;

              // Se esta consulta foi pedida especificamente para o grupo A (targetGroupId), ignora qualquer item que não seja do grupo A
              if (
                targetGroupValidIds &&
                !targetGroupValidIds.has(String(resolvedGroupId)) &&
                (!rawMetaGroupId || !targetGroupValidIds.has(String(rawMetaGroupId)))
              ) {
                continue;
              }

              const resolvedGroupName =
                matchedGroup?.name || rawMetaGroupName || 'Grupo Compartilhado';

              const memberInGroup = (matchedGroup?.members || []).find(
                (m) =>
                  (rtUserId && m.id && String(m.id) === rtUserId) ||
                  (rtEmail && m.email && norm(m.email) === rtEmail)
              );

              const isFromMe =
                (myId && rtUserId && myId === rtUserId) ||
                (myEmail && rtEmail && myEmail === rtEmail) ||
                (!rtUserId &&
                  !rtEmail &&
                  myNameNorm &&
                  norm(meta?.author || rt.user?.fullName) === myNameNorm);

              const rawAuthor =
                meta?.paidBy ||
                meta?.author ||
                rt.user?.fullName ||
                memberInGroup?.name ||
                'Participante';
              const authorName =
                rawAuthor === 'Você' && !isFromMe
                  ? rt.user?.fullName || memberInGroup?.name || 'Participante'
                  : rawAuthor;

              // Se for um acerto de contas / abatimento sincronizado via banco
              if (meta?.kind === 'settlement') {
                newSettlementItems.push({
                  id: rt.id,
                  remoteId: rt.id,
                  groupId: resolvedGroupId,
                  groupName: resolvedGroupName,
                  fromMember: meta.fromMember || authorName,
                  toMember: meta.toMember || 'Participante',
                  amount: rtAmt,
                  notes: meta.userNotes || '',
                  date: rt.createdAt || rt.date || new Date().toISOString(),
                  status: 'COMPLETED',
                  isFromMe,
                  createdAt: rt.createdAt,
                });
                continue;
              }

              // Verifica se a despesa já existe localmente (por ID remoto ou vínculo local)
              const existingIdx = nextTxs.findIndex(
                (lt) =>
                  lt.id === rt.id ||
                  lt.remoteId === rt.id ||
                  (isFromMe &&
                    lt.isShared &&
                    !lt.remoteId &&
                    String(lt.id).startsWith('tx-shared-') &&
                    norm(lt.title || lt.description) === norm(rtTitle) &&
                    Math.abs((parseFloat(lt.amount) || 0) - rtAmt) < 0.01 &&
                    String(lt.date || '').split('T')[0] === rtDate)
              );

              if (existingIdx !== -1) {
                const existingTx = nextTxs[existingIdx];
                const nextCategory =
                  meta?.category || rt.category?.name || existingTx.category || 'alimentacao';
                const nextSplitMethod =
                  meta?.splitMethod || existingTx.splitMethod || 'equal';
                const nextSplitRatio =
                  meta?.splitRatio ?? existingTx.splitRatio ?? 0.5;
                const nextSplitDetails =
                  meta?.splitDetails || existingTx.splitDetails || null;
                const nextUserNotes =
                  meta?.userNotes !== undefined ? meta.userNotes : existingTx.notes || '';

                if (
                  existingTx.remoteId !== rt.id ||
                  existingTx.groupId !== resolvedGroupId ||
                  existingTx.paidBy !== authorName ||
                  Math.abs((parseFloat(existingTx.amount) || 0) - rtAmt) > 0.005 ||
                  existingTx.title !== rtTitle ||
                  existingTx.description !== rtTitle ||
                  existingTx.date !== rtDate ||
                  existingTx.category !== nextCategory ||
                  existingTx.splitMethod !== nextSplitMethod ||
                  existingTx.splitRatio !== nextSplitRatio ||
                  JSON.stringify(existingTx.splitDetails || null) !==
                    JSON.stringify(nextSplitDetails || null) ||
                  existingTx.notes !== nextUserNotes
                ) {
                  nextTxs[existingIdx] = {
                    ...existingTx,
                    id: rt.id,
                    remoteId: rt.id,
                    title: rtTitle,
                    description: rtTitle,
                    amount: rtAmt,
                    date: rtDate,
                    category: nextCategory,
                    groupId: resolvedGroupId,
                    sharedGroupId: resolvedGroupId,
                    groupName: resolvedGroupName,
                    author: authorName,
                    paidBy: authorName,
                    splitMethod: nextSplitMethod,
                    splitRatio: nextSplitRatio,
                    splitDetails: nextSplitDetails,
                    notes: nextUserNotes,
                  };
                  txsChanged = true;
                }
                seenSharedTxIdsRef.current.add(String(rt.id));
              } else {
                const mappedShared = {
                  id: rt.id,
                  remoteId: rt.id,
                  title: rtTitle,
                  description: rtTitle,
                  amount: rtAmt,
                  type:
                    (rt.type || 'EXPENSE').toLowerCase() === 'income' ? 'income' : 'expense',
                  category: meta?.category || rt.category?.name || 'alimentacao',
                  author: authorName,
                  paidBy: authorName,
                  isShared: true,
                  groupId: resolvedGroupId,
                  sharedGroupId: resolvedGroupId,
                  groupName: resolvedGroupName,
                  splitMethod: meta?.splitMethod || 'equal',
                  splitRatio: meta?.splitRatio !== undefined ? meta.splitRatio : 0.5,
                  splitDetails: meta?.splitDetails || null,
                  notes: meta?.userNotes || '',
                  date: rtDate,
                  createdAt: rt.createdAt || new Date().toISOString(),
                };
                nextTxs.unshift(mappedShared);
                txsChanged = true;

                const alreadySeen = seenSharedTxIdsRef.current.has(String(rt.id));
                seenSharedTxIdsRef.current.add(String(rt.id));

                const txAgeMs = rt.createdAt
                  ? Math.abs(Date.now() - new Date(rt.createdAt).getTime())
                  : 0;
                const isRecentTx = txAgeMs < 60 * 60 * 1000;

                if (
                  !isFromMe &&
                  !alreadySeen &&
                  (seenSharedTxInitializedRef.current || isRecentTx)
                ) {
                  newlyArrivedNotifications.push({
                    id: rt.id,
                    kind: meta?.splitDetails ? 'split' : 'expense',
                    author: authorName,
                    amount: rtAmt,
                    description: rtTitle,
                    groupId: resolvedGroupId,
                    groupName: resolvedGroupName,
                  });
                }
              }
            }

            if (txsChanged) {
              transactionsRef.current = nextTxs;
              saveUserItem('transactions', nextTxs);
              return nextTxs;
            }
            return prev;
          });

          // Sincroniza abatimentos / acertos de contas remotos sem duplicar no histórico
          if (newSettlementItems.length > 0) {
            setSettlements((prevSettles) => {
              let settlesChanged = false;
              const nextSettles = [...prevSettles];
              for (const item of newSettlementItems) {
                const existingIdx = nextSettles.findIndex(
                  (s) => s.id === item.id || s.remoteId === item.id
                );
                if (existingIdx === -1) {
                  nextSettles.unshift(item);
                  settlesChanged = true;
                } else {
                  const existingSettle = nextSettles[existingIdx];
                  if (
                    Math.abs((parseFloat(existingSettle.amount) || 0) - item.amount) > 0.005 ||
                    existingSettle.groupId !== item.groupId ||
                    existingSettle.fromMember !== item.fromMember ||
                    existingSettle.toMember !== item.toMember ||
                    existingSettle.notes !== item.notes
                  ) {
                    nextSettles[existingIdx] = {
                      ...existingSettle,
                      ...item,
                      id: item.id,
                      remoteId: item.id,
                    };
                    settlesChanged = true;
                  }
                }
                const alreadySeen = seenSharedTxIdsRef.current.has(String(item.id));
                seenSharedTxIdsRef.current.add(String(item.id));
                const settleAgeMs = item.createdAt
                  ? Math.abs(Date.now() - new Date(item.createdAt).getTime())
                  : 0;
                if (
                  !item.isFromMe &&
                  !alreadySeen &&
                  (seenSharedTxInitializedRef.current || settleAgeMs < 60 * 60 * 1000)
                ) {
                  newlyArrivedNotifications.push({
                    id: item.id,
                    kind: 'settlement',
                    author: item.fromMember,
                    toMember: item.toMember,
                    amount: item.amount,
                    description: `Acerto para ${item.toMember}`,
                    groupId: item.groupId,
                    groupName: item.groupName,
                  });
                }
              }
              if (settlesChanged) {
                settlementsRef.current = nextSettles;
                saveUserItem('settlements', nextSettles);
                return nextSettles;
              }
              return prevSettles;
            });
          }

          if (!seenSharedTxInitializedRef.current) {
            seenSharedTxInitializedRef.current = true;
          }
          persistSeenIds();

          for (const notifItem of newlyArrivedNotifications) {
            const fmtAmt = Number(notifItem.amount || 0).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });

            playExpenseSound();

            if (notifItem.kind === 'settlement') {
              const title = `🤝 ${notifItem.author} acertou R$ ${fmtAmt} em ${notifItem.groupName}`;
              const message = `${notifItem.author} pagou R$ ${fmtAmt} para ${notifItem.toMember} no grupo "${notifItem.groupName}".`;
              pushGroupNotificationRef.current?.({
                title,
                message,
                icon: 'swap-horizontal',
                groupId: notifItem.groupId,
                groupName: notifItem.groupName,
                bypassRules: true,
              });
              setLiveGroupBanner({
                id: notifItem.id,
                title,
                message,
                author: notifItem.author,
                amount: fmtAmt,
                description: notifItem.description,
                groupId: notifItem.groupId,
                groupName: notifItem.groupName,
                timestamp: Date.now(),
              });
            } else {
              const title = `💸 ${notifItem.author} adicionou R$ ${fmtAmt} em ${notifItem.groupName}`;
              const message = `${notifItem.author} adicionou "${notifItem.description}" no valor de R$ ${fmtAmt} no grupo "${notifItem.groupName}".`;
              pushGroupNotificationRef.current?.({
                title,
                message,
                icon: 'cash-outline',
                groupId: notifItem.groupId,
                groupName: notifItem.groupName,
                bypassRules: true,
              });
              setLiveGroupBanner({
                id: notifItem.id,
                title,
                message,
                author: notifItem.author,
                amount: fmtAmt,
                description: notifItem.description,
                groupId: notifItem.groupId,
                groupName: notifItem.groupName,
                timestamp: Date.now(),
              });
            }
          }
        }

        setGroupRefreshError(null);
        return {
          success: true,
          groupId: targetGroupId || activeGroupIdRef.current || null,
          syncedAt: new Date().toISOString(),
        };
      } catch (err) {
        const msg = 'Não foi possível atualizar. Tente novamente.';
        if (!silent) setGroupRefreshError(msg);
        return { success: false, error: msg, rawError: err?.message };
      } finally {
        inFlightGroupRefreshMapRef.current.delete(dedupeKey);
        if (!silent) {
          setIsRefreshingGroup(false);
        }
      }
    })();

    inFlightGroupRefreshMapRef.current.set(dedupeKey, refreshPromise);
    return refreshPromise;
  }, [saveUserItem]);

  /**
   * Atualiza os dados do menu inicial (totais, contas, cartões, lançamentos recentes e resumo compartilhado)
   * consultando o servidor. Reaproveita consulta em andamento se dois gatilhos dispararem juntos.
   */
  const refreshHomeData = useCallback(async (options = {}) => {
    const { silent = false } = options || {};
    const reqUserId = loggedInUserRef.current?.id;
    if (!reqUserId) {
      return { success: false, error: 'Sessão não autenticada' };
    }

    if (
      inFlightHomeRefreshRef.current.promise &&
      String(inFlightHomeRefreshRef.current.userId) === String(reqUserId)
    ) {
      return inFlightHomeRefreshRef.current.promise;
    }

    if (!silent) {
      setIsRefreshingHome(true);
    }

    const promise = (async () => {
      try {
        await Promise.resolve();
        const [personalRes, groupRes] = await Promise.all([
          syncWithPostgresRef.current({
            force: true,
            overrideCards: cardsRef.current,
            overrideAccounts: accountsRef.current,
            overrideTransactions: transactionsRef.current,
          }),
          refreshGroupData(null, { ...options, silent: true }),
        ]);

        if (String(loggedInUserRef.current?.id || '') !== String(reqUserId)) {
          return { success: false, cancelled: true };
        }

        if (!personalRes?.success && !groupRes?.success) {
          const msg = 'Não foi possível atualizar. Tente novamente.';
          if (!silent) setHomeRefreshError(msg);
          return { success: false, error: msg };
        }
        if (!personalRes?.success) {
          const msg = 'Não foi possível atualizar. Tente novamente.';
          if (!silent) setHomeRefreshError(msg);
          return { success: false, error: msg };
        }

        setHomeRefreshError(null);
        return {
          success: true,
          syncedAt: new Date().toISOString(),
        };
      } catch (err) {
        const msg = 'Não foi possível atualizar. Tente novamente.';
        if (!silent) setHomeRefreshError(msg);
        return { success: false, error: msg, rawError: err?.message };
      } finally {
        if (String(inFlightHomeRefreshRef.current.userId) === String(reqUserId)) {
          inFlightHomeRefreshRef.current = { userId: null, promise: null };
        }
        if (!silent) {
          setIsRefreshingHome(false);
        }
      }
    })();

    inFlightHomeRefreshRef.current = { userId: reqUserId, promise };
    return promise;
  }, [refreshGroupData]);

  // Carrega dados de grupos uma única vez ao iniciar sessão (sem polling periódico)
  useEffect(() => {
    if (!loaded || !loggedInUser?.id) return;
    refreshGroupData(null, { source: 'init', silent: true }).catch(() => {});
  }, [loaded, loggedInUser?.id, refreshGroupData]);

  const toggleHideBalances = async () => {
    const nextVal = !hideBalances;
    setHideBalances(nextVal);
    await saveUserItem('hide_balances', nextVal);
  };

  const toggleHeroCardMode = async () => {
    const nextMode = heroCardMode === 'balance' ? 'monthResult' : 'balance';
    setHeroCardMode(nextMode);
    await saveUserItem('hero_view_mode', nextMode);
  };

  // Alternar status de conta paga (Paga vs Pendente)
  const toggleBillPaid = async (billId) => {
    const nextBills = bills.map((b) => (b.id === billId ? { ...b, paid: !b.paid } : b));
    setBills(nextBills);
    await saveUserItem('bills', nextBills);
  };

  // Atualizar dados de conta existente (edição de valores mensais, vencimento, etc.)
  const updateBill = async (billId, updatedData) => {
    const nextBills = bills.map((b) => {
      if (b.id !== billId) return b;
      const dueDay = updatedData.dueDay !== undefined ? parseInt(updatedData.dueDay, 10) : b.dueDay;
      const isPaid = updatedData.paid !== undefined ? !!updatedData.paid : b.paid;
      const parsedAmount =
        updatedData.amount !== undefined
          ? typeof updatedData.amount === 'number'
            ? updatedData.amount
            : parseFloat(String(updatedData.amount).replace(',', '.')) || 0
          : b.amount;

      return {
        ...b,
        ...updatedData,
        amount: parsedAmount,
        dueDay: dueDay,
        subtext: isPaid ? `Pago · dia ${dueDay}` : `Vence dia ${dueDay}`,
      };
    });
    setBills(nextBills);
    await saveUserItem('bills', nextBills);
  };

  // Excluir conta da agenda
  const deleteBill = async (billId) => {
    const nextBills = bills.filter((b) => b.id !== billId);
    setBills(nextBills);
    await saveUserItem('bills', nextBills);
  };

  // Adicionar nova conta a pagar (Gasto Fixo - Print 3)
  const addBill = async (billData) => {
    const newBill = {
      id: 'bill-' + Date.now(),
      title: billData.title,
      category: billData.category || 'moradia',
      subtext: `Vence dia ${billData.dueDay || '10'}`,
      amount: parseFloat(billData.amount) || 0,
      paid: !!billData.paid,
      dueDay: parseInt(billData.dueDay, 10) || 10,
      icon: billData.icon || 'receipt-outline',
      iconColor: billData.iconColor || '#3B82F6',
      isRecurring: billData.isRecurring !== undefined ? billData.isRecurring : true,
      notes: billData.notes || '',
      accountId: billData.accountId || accounts[0]?.id,
    };
    const nextBills = [newBill, ...bills];
    setBills(nextBills);
    await saveUserItem('bills', nextBills);
    return newBill;
  };

  // Cofrinhos / Metas (Print 1)
  const addCofrinho = async (cofData) => {
    const target = parseFloat(cofData.targetAmount) || 0;
    const current = parseFloat(cofData.currentAmount) || 0;
    const newCof = {
      id: 'cof-' + Date.now(),
      title: cofData.title || 'Nova Meta',
      targetAmount: target,
      currentAmount: current,
      deadline: cofData.deadline || 'Sem prazo',
      icon: cofData.icon || 'car-sport-outline',
      emoji: cofData.emoji || '🚗',
      color: cofData.color || '#06B6D4',
      notes: cofData.notes || '',
    };
    const nextList = [newCof, ...cofrinhos];
    setCofrinhos(nextList);
    await saveUserItem('cofrinhos', nextList);
    return newCof;
  };

  const depositCofrinho = async (cofrinhoId, amount, fromAccountId) => {
    const num = parseFloat(amount) || 0;
    if (num <= 0) return;

    const nextCofs = cofrinhos.map((c) => {
      if (c.id === cofrinhoId) {
        return { ...c, currentAmount: (c.currentAmount || 0) + num };
      }
      return c;
    });
    setCofrinhos(nextCofs);
    await saveUserItem('cofrinhos', nextCofs);

    if (fromAccountId) {
      const nowIso = new Date().toISOString();
      setAccounts((prev) => {
        const updated = prev.map((a) => {
          if (a.id === fromAccountId) {
            const nextBal = (a.balance || 0) - num;
            updateAccountApi(a.remoteId || a.id, { name: a.name, balance: nextBal, color: a.color }).catch(() => {});
            return { ...a, balance: nextBal, updatedAt: nowIso };
          }
          return a;
        });
        saveUserItem('accounts', updated);
        return updated;
      });
    }
  };

  const removeCofrinho = async (id) => {
    const nextList = cofrinhos.filter((c) => c.id !== id);
    setCofrinhos(nextList);
    await saveUserItem('cofrinhos', nextList);
  };

  // Adicionar lote de transações de forma atômica (previne perda em chamadas simultâneas)
  const addTransactionsBatch = async (txDataArray) => {
    if (!txDataArray || txDataArray.length === 0) return [];

    const nowIso = new Date().toISOString();
    let currentAccs = [...accounts];
    // Se o usuário ainda não tiver nenhuma conta bancária cadastrada, cria automaticamente a "Conta Principal"
    if (currentAccs.length === 0) {
      const defaultAcc = {
        id: 'acc-' + Date.now(),
        name: 'Conta Principal',
        bank: 'Conta Principal',
        balance: 0,
        owner: loggedInUser?.name || 'Titular',
        icon: 'wallet-outline',
        color: '#0E2F5A',
        updatedAt: nowIso,
      };
      currentAccs = [defaultAcc];
    }

    const defaultAccId = currentAccs[0].id;

    const newTxs = txDataArray.map((txData, idx) => {
      const resolvedTitle = txData.title || txData.description || 'Movimentação';
      const resolvedCardId = txData.cardId || txData.creditCardId || null;
      const isCredit = txData.paymentMethod === 'credit_card' || !!resolvedCardId;
      return {
        id: txData.id || `tx-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        title: resolvedTitle,
        description: txData.description || resolvedTitle,
        amount: parseFloat(txData.amount) || 0,
        type: txData.type || 'expense', // 'expense' | 'income'
        category: txData.category || 'outros',
        expenseType: txData.expenseType || (txData.type === 'expense' ? 'variable' : undefined),
        incomeSource: txData.incomeSource || (txData.type === 'income' ? 'salary' : undefined),
        author: txData.author || (loggedInUser?.name || 'Você'),
        isShared: !!txData.isShared || !!txData.groupId,
        groupId: txData.groupId || null,
        groupName: txData.groupName || null,
        date: txData.date || new Date().toISOString().split('T')[0],
        createdAt: txData.createdAt || nowIso,
        accountId: isCredit ? null : (txData.accountId || defaultAccId),
        creditCardId: resolvedCardId,
        cardId: resolvedCardId,
        cardName: txData.cardName || null,
        paymentMethod: isCredit ? 'credit_card' : (txData.paymentMethod || 'account'),
        notes: txData.notes || '',
      };
    });

    // Atualiza estado de transações e armazenamento isolado
    setTransactions((prev) => {
      const nextList = [...newTxs, ...prev];
      saveUserItem('transactions', nextList);
      return nextList;
    });

    // Se houver transações em cartão de crédito, atualiza o limite utilizado e a fatura atual dos cartões
    const creditTxs = newTxs.filter(
      (t) => (t.paymentMethod === 'credit_card' || t.creditCardId || t.cardId) && t.type === 'expense'
    );
    if (creditTxs.length > 0) {
      setCards((prevCards) => {
        let changed = false;
        const nextCards = prevCards.map((c) => {
          const matchingTxs = creditTxs.filter(
            (t) =>
              t.cardId === c.id ||
              t.creditCardId === c.id ||
              t.cardId === c.remoteId ||
              t.creditCardId === c.remoteId ||
              (t.cardName &&
                (String(c.name || '').toLowerCase().includes(String(t.cardName).toLowerCase()) ||
                  String(c.bank || '').toLowerCase().includes(String(t.cardName).toLowerCase()))) ||
              (!t.cardId && prevCards.length === 1)
          );
          if (matchingTxs.length === 0) return c;

          changed = true;
          const totalAdded = matchingTxs.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
          const currentInv = parseFloat(c.currentInvoice) || 0;
          const nextInvoice = Math.round((currentInv + totalAdded) * 100) / 100;
          const currentUsed = parseFloat(c.usedLimit) || currentInv;
          const nextUsed = Math.round((currentUsed + totalAdded) * 100) / 100;
          const limit = parseFloat(c.limit || c.creditLimit) || 1000;
          const nextPercent = Math.min(Math.round((nextInvoice / (limit || 1)) * 100), 100);
          const nextAvail = Math.max(limit - nextInvoice, 0);

          const updatedCard = {
            ...c,
            currentInvoice: nextInvoice,
            usedLimit: nextUsed,
            usedPercent: nextPercent,
            availableLimit: nextAvail,
            updatedAt: nowIso,
          };

          const remoteId = c.remoteId || c.id;
          if (remoteId && !String(remoteId).startsWith('card-')) {
            updateCreditCardApi(remoteId, updatedCard).catch(() => {});
          }

          return updatedCard;
        });

        if (changed) {
          saveUserItem('cards', nextCards);
          return nextCards;
        }
        return prevCards;
      });
    }

    // Atualiza saldo da conta bancária (apenas para movimentações de conta/débito, não cartão de crédito)
    const updatedAccs = currentAccs.map((acc) => {
      let delta = 0;
      for (const tx of newTxs) {
        if (!tx.isShared && !tx.groupId && tx.accountId === acc.id && tx.paymentMethod !== 'credit_card' && !tx.cardId && !tx.creditCardId) {
          delta += tx.type === 'income' ? tx.amount : -tx.amount;
        }
      }
      if (delta !== 0) {
        const nextBalance = (acc.balance || 0) + delta;
        const targetAccId = acc.remoteId || acc.id;
        if (targetAccId && !String(targetAccId).startsWith('acc-')) {
          updateAccountApi(targetAccId, {
            name: acc.name,
            balance: nextBalance,
            color: acc.color,
          }).catch(() => {});
        }
        return { ...acc, balance: nextBalance, updatedAt: nowIso };
      }
      return acc;
    });

    setAccounts(updatedAccs);
    await saveUserItem('accounts', updatedAccs);

    for (const tx of newTxs) {
      syncTransactionToAppwrite(tx).catch(() => {});
      // Envia para o PostgreSQL sem re-incrementar a conta caso já tenhamos atualizado o saldo acima
      apiCreateTransaction({ ...tx, accountId: undefined })
        .then((remoteTx) => {
          if (remoteTx?.id) {
            setTransactions((prev) => {
              const linked = prev.map((item) =>
                item.id === tx.id ? { ...item, id: remoteTx.id, remoteId: remoteTx.id } : item
              );
              saveUserItem('transactions', linked);
              return linked;
            });
          }
        })
        .catch((e) => console.log('Offline queue for Postgres tx:', e.message));
    }

    // Dispara notificação inteligente sobre a movimentação do dinheiro (In-App + Celular)
    if (newTxs.length > 0) {
      const firstTx = newTxs[0];
      const newNotif = NotificationTemplates.transactionRecorded({
        txId: firstTx.id,
        type: firstTx.type,
        amount: firstTx.amount,
        category: firstTx.category,
        description: firstTx.description || firstTx.title,
        createdAt: firstTx.createdAt,
      });

      const batchNotifs = [newNotif];

      // Verifica se o gasto está muito acima da média histórica da categoria (gasto fora do padrão)
      if (firstTx.type === 'expense' && firstTx.amount > 0) {
        const sameCatExpenses = (transactions || []).filter(
          (t) =>
            t.type === 'expense' &&
            String(t.category || '').toLowerCase() === String(firstTx.category || '').toLowerCase()
        );
        if (sameCatExpenses.length >= 2) {
          const avg =
            sameCatExpenses.reduce((s, t) => s + (Number(t.amount) || 0), 0) /
            sameCatExpenses.length;
          if (avg > 0 && firstTx.amount >= avg * 1.8) {
            batchNotifs.unshift(
              NotificationTemplates.unusualExpenseAlert({
                txId: firstTx.id,
                amount: firstTx.amount,
                category: firstTx.category,
                averageAmount: avg,
              })
            );
          }
        }
      }

      setActivityNotifications((prev) => {
        const next = [...batchNotifs, ...prev].slice(0, 30);
        saveUserItem('activity_notifications', next);
        return next;
      });

      sendInstantPhoneNotification({
        notification: newNotif,
        userId: loggedInUser?.id || 'guest',
        preferences: notificationPreferences,
        data: { type: 'transaction_movement', txId: firstTx.id },
      }).catch(() => {});
    }

    return newTxs;
  };

  // Adicionar transação individual
  const addTransaction = async (txData) => {
    const [created] = await addTransactionsBatch([txData]);
    return created;
  };

  // Editar transação (aguarda confirmação da API e aproveita valores confirmados pelo servidor)
  const editTransaction = async (updatedTx) => {
    const oldTx = transactions.find((t) => t.id === updatedTx.id);
    if (!oldTx) return null;

    const nextTitle =
      updatedTx.title || updatedTx.description || oldTx.title || oldTx.description || 'Movimentação';
    const nextDescription =
      updatedTx.description || updatedTx.title || oldTx.description || oldTx.title || 'Movimentação';
    const nextAmount =
      updatedTx.amount !== undefined
        ? Math.abs(parseFloat(updatedTx.amount)) || 0
        : parseFloat(oldTx.amount) || 0;
    const nextDate = updatedTx.date || oldTx.date || new Date().toISOString().split('T')[0];
    const isSharedTx = Boolean(oldTx.isShared || oldTx.groupId || oldTx.sharedGroupId);

    let encodedNotesForApi = updatedTx.notes !== undefined ? updatedTx.notes : oldTx.notes || '';
    if (isSharedTx) {
      const gId = oldTx.sharedGroupId || oldTx.groupId;
      const grp = sharedGroups.find((g) => g.id === gId || g.remoteId === gId);
      encodedNotesForApi = encodeSharedNotes(
        {
          kind: 'expense',
          groupId: grp?.remoteId || gId,
          groupName: grp?.name || oldTx.groupName || 'Grupo Compartilhado',
          paidBy: updatedTx.paidBy || oldTx.paidBy || oldTx.author || 'Participante',
          author: updatedTx.author || oldTx.author || oldTx.paidBy || 'Participante',
          authorId: loggedInUser?.id || null,
          authorEmail: (loggedInUser?.email || '').trim().toLowerCase() || null,
          category: updatedTx.category || oldTx.category || 'alimentacao',
          splitMethod: updatedTx.splitMethod || oldTx.splitMethod || 'equal',
          splitRatio:
            updatedTx.splitRatio !== undefined
              ? updatedTx.splitRatio
              : oldTx.splitRatio !== undefined
                ? oldTx.splitRatio
                : 0.5,
          splitDetails:
            updatedTx.splitDetails !== undefined ? updatedTx.splitDetails : oldTx.splitDetails || null,
        },
        updatedTx.notes !== undefined ? updatedTx.notes : oldTx.notes || ''
      );
    }

    const remoteTxId = oldTx.remoteId || oldTx.id;
    let confirmedRemote = null;

    if (remoteTxId && !String(remoteTxId).startsWith('tx-')) {
      confirmedRemote = await updateTransactionApi(remoteTxId, {
        ...oldTx,
        ...updatedTx,
        title: nextTitle,
        description: nextDescription,
        amount: nextAmount,
        date: nextDate,
        notes: encodedNotesForApi,
      });
    }

    const confirmedAmount =
      confirmedRemote?.amount !== undefined
        ? Math.abs(parseFloat(confirmedRemote.amount)) || nextAmount
        : nextAmount;
    const confirmedTitle = confirmedRemote?.description || nextTitle;
    const confirmedDate = confirmedRemote?.date
      ? String(confirmedRemote.date).split('T')[0]
      : String(nextDate).split('T')[0];

    const normalizedTx = {
      ...oldTx,
      ...updatedTx,
      id: confirmedRemote?.id || oldTx.id,
      remoteId: confirmedRemote?.id || oldTx.remoteId || oldTx.id,
      title: confirmedTitle,
      description: confirmedTitle,
      amount: confirmedAmount,
      date: confirmedDate,
      updatedAt: new Date().toISOString(),
    };

    const nextList = transactionsRef.current.map((t) =>
      t.id === updatedTx.id || t.id === oldTx.id ? normalizedTx : t
    );
    transactionsRef.current = nextList;
    setTransactions(nextList);
    await saveUserItem('transactions', nextList);

    if (oldTx.amount !== normalizedTx.amount || oldTx.type !== normalizedTx.type) {
      const nowIso = new Date().toISOString();
      setAccounts((prev) => {
        const updated = prev.map((acc) => {
          if (acc.id === normalizedTx.accountId) {
            const oldDelta = oldTx.type === 'income' ? -oldTx.amount : oldTx.amount;
            const newDelta = normalizedTx.type === 'income' ? normalizedTx.amount : -normalizedTx.amount;
            const nextBalance = (acc.balance || 0) + oldDelta + newDelta;
            updateAccountApi(acc.remoteId || acc.id, {
              name: acc.name,
              balance: nextBalance,
              color: acc.color,
            }).catch(() => {});
            return { ...acc, balance: nextBalance, updatedAt: nowIso };
          }
          return acc;
        });
        accountsRef.current = updated;
        saveUserItem('accounts', updated);
        return updated;
      });

      const fmtOld = Number(oldTx.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const fmtNew = Number(normalizedTx.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (normalizedTx.isShared || normalizedTx.groupId || normalizedTx.sharedGroupId) {
        const gId = normalizedTx.groupId || normalizedTx.sharedGroupId;
        const grp = sharedGroups.find((g) => g.id === gId || g.remoteId === gId);
        const grpName = grp?.name || normalizedTx.groupName || 'Grupo Compartilhado';
        pushGroupNotification({
          title: `🔄 Valor alterado no grupo ${grpName}`,
          message: `O lançamento '${normalizedTx.title || normalizedTx.description}' mudou de R$ ${fmtOld} para R$ ${fmtNew}. O saldo e a divisão do grupo foram atualizados!`,
          icon: 'sync-outline',
          color: '#7C3AED',
          groupId: gId,
        });
      }
    }

    syncTransactionToAppwrite(normalizedTx).catch(() => {});
    return normalizedTx;
  };

  // Remover transação
  const removeTransaction = async (id) => {
    const target = transactions.find((t) => t.id === id);
    const nextList = transactions.filter((t) => t.id !== id);
    setTransactions(nextList);
    await saveUserItem('transactions', nextList);

    if (target) {
      const nowIso = new Date().toISOString();
      setAccounts((prev) => {
        const updated = prev.map((acc) => {
          if (acc.id === target.accountId) {
            const delta = target.type === 'income' ? -target.amount : target.amount;
            const nextBalance = (acc.balance || 0) + delta;
            updateAccountApi(acc.remoteId || acc.id, {
              name: acc.name,
              balance: nextBalance,
              color: acc.color,
            }).catch(() => {});
            return { ...acc, balance: nextBalance, updatedAt: nowIso };
          }
          return acc;
        });
        saveUserItem('accounts', updated);
        return updated;
      });

      deleteTransactionApi(target.remoteId || target.id).catch(() => {});

      if (target.isShared || target.groupId || target.sharedGroupId) {
        const gId = target.groupId || target.sharedGroupId;
        const grp = sharedGroups.find((g) => g.id === gId);
        const grpName = grp?.name || target.groupName || 'Grupo Compartilhado';
        const fmtVal = Number(target.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        pushGroupNotification({
          title: `🗑️ Valor do grupo atualizado: ${grpName}`,
          message: `O item '${target.title || target.description}' (R$ ${fmtVal}) foi removido e o total do grupo '${grpName}' foi recalculado.`,
          icon: 'trash-outline',
          color: '#EF4444',
          groupId: gId,
        });
      }
    }
  };

  const updateAccountBalance = async (accId, newBalance) => {
    const parsedBal =
      typeof newBalance === 'string'
        ? parseFloat(newBalance.replace(/\./g, '').replace(',', '.')) ||
          parseFloat(newBalance.replace(',', '.')) ||
          0
        : parseFloat(newBalance) || 0;
    const nowIso = new Date().toISOString();
    let targetAccount = null;

    setAccounts((prev) => {
      const updated = prev.map((acc) => {
        if (acc.id === accId) {
          targetAccount = { ...acc, balance: parsedBal, updatedAt: nowIso };
          return targetAccount;
        }
        return acc;
      });
      saveUserItem('accounts', updated);
      return updated;
    });

    const remoteAccId = targetAccount?.remoteId || accId;
    if (remoteAccId && !String(remoteAccId).startsWith('acc-')) {
      updateAccountApi(remoteAccId, {
        name: targetAccount?.name,
        balance: parsedBal,
        color: targetAccount?.color,
      }).catch((e) => console.log('Offline queue for Postgres balance update:', e.message));
    } else if (targetAccount) {
      apiCreateAccount(targetAccount)
        .then((created) => {
          if (created?.id) {
            setAccounts((prev) => {
              const linked = prev.map((a) =>
                a.id === accId ? { ...a, id: created.id, remoteId: created.id } : a
              );
              saveUserItem('accounts', linked);
              return linked;
            });
          }
        })
        .catch(() => {});
    }
  };

  // Gestão de Contas Reais
  const addAccount = async (accountData) => {
    const nowIso = new Date().toISOString();
    const localTempId = 'acc-' + Date.now();
    const newAcc = {
      id: localTempId,
      name: accountData.name || 'Nova Conta',
      bank: accountData.bank || accountData.name || 'Banco',
      balance: parseFloat(accountData.balance) || 0,
      owner: accountData.owner || loggedInUser?.name || 'Titular',
      icon: accountData.icon || 'wallet-outline',
      color: accountData.color || '#0E2F5A',
      updatedAt: nowIso,
    };
    const nextAccs = [...accounts, newAcc];
    setAccounts(nextAccs);
    await saveUserItem('accounts', nextAccs);

    apiCreateAccount(newAcc)
      .then((created) => {
        if (created?.id) {
          setAccounts((prev) => {
            const linked = prev.map((a) =>
              a.id === localTempId ? { ...a, id: created.id, remoteId: created.id } : a
            );
            saveUserItem('accounts', linked);
            return linked;
          });
        }
      })
      .catch((e) => console.log('Offline queue for Postgres acc:', e.message));
    return newAcc;
  };

  const updateAccount = async (accId, updatedData) => {
    const nowIso = new Date().toISOString();
    let updatedTarget = null;
    const nextAccs = accounts.map((acc) => {
      if (acc.id !== accId) return acc;
      updatedTarget = {
        ...acc,
        ...updatedData,
        balance:
          updatedData.balance !== undefined
            ? parseFloat(updatedData.balance) || 0
            : acc.balance,
        updatedAt: nowIso,
      };
      return updatedTarget;
    });
    setAccounts(nextAccs);
    await saveUserItem('accounts', nextAccs);

    if (updatedTarget) {
      updateAccountApi(updatedTarget.remoteId || accId, updatedTarget).catch(() => {});
    }
  };

  const removeAccount = async (accId) => {
    const target = accounts.find((acc) => acc.id === accId);
    const nextAccs = accounts.filter((acc) => acc.id !== accId);
    setAccounts(nextAccs);
    await saveUserItem('accounts', nextAccs);
    if (target) {
      deleteAccountApi(target.remoteId || accId).catch(() => {});
    }
  };

  const addCard = async (cardData) => {
    const nowIso = new Date().toISOString();
    const localTempId = 'card-' + Date.now();
    const theme = getBankTheme(cardData.bankId || cardData.bank || cardData.name);
    const newCard = {
      id: localTempId,
      name: cardData.name || theme.name,
      bank: cardData.bank || theme.name,
      bankId: theme.bankId,
      holderName: cardData.holderName || loggedInUser?.name || 'TITULAR',
      lastFourDigits: cardData.lastFourDigits ? String(cardData.lastFourDigits).slice(-4) : '',
      expiryMonth: cardData.expiryMonth || '12',
      expiryYear: cardData.expiryYear || '28',
      limit: parseFloat(cardData.limit) || 0,
      currentInvoice: parseFloat(cardData.currentInvoice) || 0,
      closingDay: parseInt(cardData.closingDay, 10) || 3,
      dueDay: parseInt(cardData.dueDay, 10) || 10,
      dueDateText: cardData.dueDateText || `Vence dia ${cardData.dueDay || 10}`,
      status: cardData.status || 'Em aberto',
      usedPercent: cardData.usedPercent !== undefined ? cardData.usedPercent : 0,
      color: theme.gradientColors[0],
      logoType: theme.bankId,
      owner: cardData.owner || loggedInUser?.name || 'Titular',
      updatedAt: nowIso,
    };
    const nextCards = [...cards, newCard];
    setCards(nextCards);
    await saveUserItem('cards', nextCards);

    apiCreateCreditCard(newCard)
      .then((created) => {
        if (created?.id) {
          setCards((prev) => {
            const linked = prev.map((c) =>
              c.id === localTempId ? { ...c, id: created.id, remoteId: created.id } : c
            );
            saveUserItem('cards', linked);
            return linked;
          });
        }
      })
      .catch((e) => console.log('Offline queue for Postgres card:', e.message));
    return newCard;
  };

  const updateCard = async (cardId, updatedData) => {
    const nowIso = new Date().toISOString();
    let updatedTarget = null;
    const nextCards = cards.map((c) => {
      if (c.id !== cardId) return c;
      const theme = getBankTheme(updatedData.bankId || updatedData.bank || c.bankId || c.bank);
      updatedTarget = {
        ...c,
        ...updatedData,
        bankId: theme.bankId,
        color: theme.gradientColors[0],
        logoType: theme.bankId,
        updatedAt: nowIso,
      };
      return updatedTarget;
    });
    setCards(nextCards);
    await saveUserItem('cards', nextCards);

    if (updatedTarget) {
      const remoteCardId = updatedTarget.remoteId || cardId;
      if (remoteCardId && !String(remoteCardId).startsWith('card-')) {
        updateCreditCardApi(remoteCardId, updatedTarget).catch((e) =>
          console.log('Offline queue for Postgres card update:', e.message)
        );
      } else {
        apiCreateCreditCard(updatedTarget)
          .then((created) => {
            if (created?.id) {
              setCards((prev) => {
                const linked = prev.map((c) =>
                  c.id === cardId ? { ...c, id: created.id, remoteId: created.id } : c
                );
                saveUserItem('cards', linked);
                return linked;
              });
            }
          })
          .catch(() => {});
      }
    }
  };

  const removeCard = async (cardId) => {
    const target = cards.find((c) => c.id === cardId);
    const nextCards = cards.filter((c) => c.id !== cardId);
    setCards(nextCards);
    await saveUserItem('cards', nextCards);
    if (target) {
      deleteCreditCardApi(target.remoteId || cardId).catch(() => {});
    }
  };

  // Limpar e zerar todos os dados para uso 100% real no ambiente isolado do usuário
  const clearAllData = async () => {
    setTransactions([]);
    setAccounts([]);
    setCards([]);
    setBills([]);
    setCofrinhos([]);
    setAiChat(getInitialChat(loggedInUser?.name));

    if (loggedInUser?.id) {
      const uid = loggedInUser.id;
      await Promise.all([
        AsyncStorage.removeItem(getUserStorageKey(uid, 'transactions')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'accounts')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'cards')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'bills')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'cofrinhos')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'ai_chat')),
      ]);
    }
  };

  // Carregar dados de demonstração (desativado para manter 100% dados reais)
  const loadDemoData = async () => {
    return false;
  };

  const switchActiveMember = (member) => {
    setActiveMember(member);
    saveUserItem('active_member', member);
  };

  const updateMembersNames = (names) => {
    setMembers(names);
    saveUserItem('members_names', names);
  };

  const logout = async () => {
    setTransactions([]);
    setAccounts([]);
    setCards([]);
    setBills([]);
    setCofrinhos([]);
    setAiChat([]);
    setSharedGroups([]);
    setActiveGroupIdState(null);
    setGroupInvitations([]);
    setSettlements([]);
    setViewModeState('personal');
    setLoggedInUser(null);
    await clearAuthSession();
    await signOutGoogle().catch(() => {});
    await logoutUser().catch(() => {});
  };

  /**
   * Excluir Conta e Dados do Usuário (Diretriz Obrigatória Google Play Store + LGPD)
   */
  const deleteAccount = async () => {
    const uid = loggedInUser?.id;
    const cleanEmail = loggedInUser?.email ? String(loggedInUser.email).trim().toLowerCase() : null;

    // 1. Primeiro exclui fielmente do PostgreSQL no servidor (lança erro se falhar)
    await deleteUserAccountApi({ id: uid, email: cleanEmail });

    // 2. Remove integralmente todas as chaves locais do usuário no aparelho (por ID e por e-mail)
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = (allKeys || []).filter((k) => {
        const lower = k.toLowerCase();
        if (uid && lower.includes(String(uid).toLowerCase())) return true;
        if (cleanEmail && lower.includes(cleanEmail)) return true;
        if (k.startsWith('@finn_usr_') || k.startsWith('@finn_mail_') || k.startsWith('finn_user_')) return true;
        return false;
      });
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch {
      // Fallback explícito
    }

    if (uid) {
      await Promise.all([
        AsyncStorage.removeItem(getUserStorageKey(uid, 'transactions')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'accounts')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'cards')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'bills')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'cofrinhos')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'ai_chat')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'shared_groups')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'active_group_id')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'group_invitations')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'settlements')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'view_mode')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'hide_balances')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'hero_view_mode')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'activity_notifications')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'read_notifications')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'owner_notifications')),
        AsyncStorage.removeItem(getUserStorageKey(uid, 'user_profile')),
      ]).catch(() => {});
    }

    if (cleanEmail) {
      await Promise.all([
        AsyncStorage.removeItem(getUserEmailStorageKey(cleanEmail, 'transactions')),
        AsyncStorage.removeItem(getUserEmailStorageKey(cleanEmail, 'accounts')),
        AsyncStorage.removeItem(getUserEmailStorageKey(cleanEmail, 'cards')),
        AsyncStorage.removeItem(getUserEmailStorageKey(cleanEmail, 'bills')),
        AsyncStorage.removeItem(getUserEmailStorageKey(cleanEmail, 'cofrinhos')),
        AsyncStorage.removeItem(getUserEmailStorageKey(cleanEmail, 'ai_chat')),
        AsyncStorage.removeItem(getUserEmailStorageKey(cleanEmail, 'shared_groups')),
        AsyncStorage.removeItem(getUserEmailStorageKey(cleanEmail, 'user_profile')),
      ]).catch(() => {});
    }

    await clearAllBiometricData().catch(() => {});
    await clearAuthSession().catch(() => {});
    await signOutGoogle().catch(() => {});

    setTransactions([]);
    setAccounts([]);
    setCards([]);
    setBills([]);
    setCofrinhos([]);
    setAiChat([]);
    setSharedGroups([]);
    setActiveGroupIdState(null);
    setGroupInvitations([]);
    setSettlements([]);
    setViewModeState('personal');
    setLoggedInUser(null);
  };

  // Atualização em tempo real do perfil do usuário logado (Nome, Sobrenome e Foto persistidos no banco)
  const updateUserProfile = async (updates) => {
    if (!loggedInUser) return;
    const rawFirst =
      updates.firstName !== undefined
        ? updates.firstName.trim()
        : (loggedInUser.firstName || (loggedInUser.fullName || loggedInUser.name || '').split(' ')[0] || '').trim();
    const rawLast =
      updates.lastName !== undefined
        ? updates.lastName.trim()
        : (
            loggedInUser.lastName !== undefined
              ? loggedInUser.lastName
              : (loggedInUser.fullName || loggedInUser.name || '').split(' ').slice(1).join(' ')
          ).trim();

    const composedFull =
      updates.fullName?.trim() ||
      [rawFirst, rawLast].filter(Boolean).join(' ') ||
      updates.name?.trim() ||
      loggedInUser.fullName ||
      loggedInUser.name ||
      '';

    const nextAvatar =
      updates.avatarUri !== undefined ? updates.avatarUri : loggedInUser.avatarUri || null;

    const updated = {
      ...loggedInUser,
      ...updates,
      firstName: rawFirst,
      lastName: rawLast,
      name: composedFull,
      fullName: composedFull,
      avatarUri: nextAvatar,
      avatarUrl: nextAvatar,
    };

    setLoggedInUser(updated);
    setMembers((prev) => ({ ...prev, user1: composedFull }));
    if (activeMember === loggedInUser.name || activeMember === 'Principal' || !activeMember) {
      setActiveMember(composedFull);
    }

    // Salva permanentemente no banco PostgreSQL, registro por e-mail/ID e storage local
    const persisted = await savePersistentUserProfile(updated);
    await saveUserItem('user_profile', persisted || updated);
    return persisted || updated;
  };

  // Alternador de Modo de Visualização: 'personal' | 'shared' | 'consolidated'
  const setViewMode = async (mode) => {
    setViewModeState(mode);
    await saveUserItem('view_mode', mode);
  };

  const setActiveGroupId = useCallback(async (id) => {
    activeGroupIdRef.current = id;
    setActiveGroupIdState(id);
    await saveUserItem('active_group_id', id);
  }, [saveUserItem]);

  // Módulo Finanças Compartilhadas: Criar Grupo
  const createSharedGroup = async ({ name, type = 'Casal', description = '' }) => {
    const ownerName = loggedInUser?.fullName || loggedInUser?.name || 'Você';
    const cleanName = (name || '').trim() || 'Novo Grupo';
    let initialCode = generateGroupInviteCode();
    let inviteCodeExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // Válido por 30 minutos

    let remoteHouseholdId = null;
    let invitationToken = null;

    // 1. Cria o Household e Convite Oficial no PostgreSQL
    try {
      const apiRes = await createHouseholdApi(cleanName);
      if (apiRes?.id) {
        remoteHouseholdId = apiRes.id;
        // Prioriza 100% o código gerado e persistido diretamente no PostgreSQL
        if (apiRes.inviteCode) {
          initialCode = apiRes.inviteCode;
          if (apiRes.inviteCodeExpiresAt) inviteCodeExpiresAt = apiRes.inviteCodeExpiresAt;
          invitationToken = apiRes.inviteCode;
        } else {
          try {
            // Registra código oficial de 30 minutos diretamente no PostgreSQL
            const codeRes = await generateHouseholdInviteCodeApi(remoteHouseholdId, initialCode);
            if (codeRes?.code) {
              initialCode = codeRes.code;
              if (codeRes.expiresAt) inviteCodeExpiresAt = codeRes.expiresAt;
              invitationToken = codeRes.code;
            }
          } catch (invErr) {
            console.log('Código inicial PostgreSQL:', invErr.message);
          }
        }
      } else {
        throw new Error('Servidor não retornou o identificador do grupo.');
      }
    } catch (e) {
      console.error('Falha ao criar grupo no servidor:', e);
      throw new Error(
        e.message?.includes('Sessão não autenticada')
          ? 'Sua sessão expirou. Saia e entre novamente no app para criar grupos compartilhados.'
          : `Não foi possível registrar o grupo no servidor (${e.message}). Verifique sua conexão e tente novamente.`
      );
    }

    // 2. Registra convite na nuvem e no registro local do dispositivo (sem sobrescrever o código!)
    let finalCode = initialCode;
    try {
      const cloudRes = await publishCloudInvite({
        invitationToken,
        householdId: remoteHouseholdId,
        name: cleanName,
        type: type || 'Casal',
        creator: { id: loggedInUser?.id || 'admin', name: ownerName, email: loggedInUser?.email || '' },
        expiresAt: inviteCodeExpiresAt,
        fallbackCode: initialCode,
      });
      if (cloudRes?.code) {
        finalCode = cloudRes.code;
      }
    } catch (cloudErr) {
      console.warn('Aviso: falha ao publicar código na nuvem:', cloudErr.message);
    }

    const newGroup = {
      id: remoteHouseholdId || 'grp-' + Date.now(),
      remoteId: remoteHouseholdId,
      name: cleanName,
      type: type || 'Casal',
      description: (description || '').trim(),
      createdAt: new Date().toISOString(),
      creatorId: loggedInUser?.id || 'admin',
      creatorEmail: (loggedInUser?.email || '').toLowerCase().trim(),
      creatorName: ownerName,
      inviteCode: finalCode,
      inviteCodeExpiresAt,
      members: [
        {
          id: loggedInUser?.id || 'admin',
          name: ownerName,
          email: loggedInUser?.email || '',
          role: 'OWNER',
          isCreator: true,
        },
      ],
    };

    const nextGroups = [
      newGroup,
      ...sharedGroups.filter((g) => g.id !== newGroup.id && (!newGroup.remoteId || g.remoteId !== newGroup.remoteId)),
    ];
    setSharedGroups(nextGroups);
    setActiveGroupIdState(newGroup.id);
    setViewModeState('shared');
    await saveUserItem('shared_groups', nextGroups);
    await saveUserItem('active_group_id', newGroup.id);
    await saveUserItem('view_mode', 'shared');

    pushGroupNotification({
      title: `👥 Novo grupo criado: ${newGroup.name}`,
      message: `O grupo '${newGroup.name}' (${newGroup.type}) está ativo! Envie o código de convite ${newGroup.inviteCode} (válido por 30 min) para quem vai dividir as finanças com você.`,
      icon: 'people',
      color: '#7C3AED',
      groupId: newGroup.id,
    });

    return newGroup;
  };

  // Verifica se o usuário autenticado é o criador/dono do grupo
  const isGroupCreator = (group) => {
    if (!group || !loggedInUser) return false;
    const myId = loggedInUser.id ? String(loggedInUser.id) : null;
    const myEmail = loggedInUser.email ? loggedInUser.email.toLowerCase().trim() : null;

    if (group.creatorId && myId && String(group.creatorId) === myId) return true;
    if (group.creatorEmail && myEmail && group.creatorEmail.toLowerCase().trim() === myEmail) return true;

    // Busca nos membros se possui role 'OWNER' ou isCreator
    const myMember = (group.members || []).find((m) => {
      const matchId = myId && m.id && String(m.id) === myId;
      const matchEmail = myEmail && m.email && m.email.toLowerCase().trim() === myEmail;
      return matchId || matchEmail;
    });

    if (myMember?.isCreator || myMember?.role === 'OWNER') return true;

    // Fallback: se o grupo não tem creatorId explícito e o primeiro membro é o usuário logado
    if (!group.creatorId && group.members && group.members.length > 0) {
      const first = group.members[0];
      if ((myId && first.id === myId) || (myEmail && first.email === myEmail)) return true;
    }

    return false;
  };

  // Gerar NOVO código de convite único para o grupo (válido por 30 minutos)
  const generateNewGroupInviteCode = async (groupId) => {
    const targetGroupId = groupId || activeGroupId || sharedGroups[0]?.id;
    if (!targetGroupId) throw new Error('Selecione um grupo para gerar o código.');

    const targetGroup = sharedGroups.find((g) => g.id === targetGroupId);
    if (!targetGroup) throw new Error('Grupo não encontrado.');

    let targetHhId = targetGroup.remoteId || (targetGroup.id && !targetGroup.id.startsWith('grp-') ? targetGroup.id : null);
    let baseCode = null;
    let newExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    let invitationToken = null;

    // Se o grupo ainda não tem id remoto no PostgreSQL, sincroniza no backend agora
    if (!targetHhId) {
      try {
        const createdHh = await createHouseholdApi(targetGroup.name || 'Finanças Compartilhadas');
        if (createdHh?.id) {
          targetHhId = createdHh.id;
          targetGroup.remoteId = createdHh.id;
          if (createdHh.inviteCode) {
            baseCode = createdHh.inviteCode;
            if (createdHh.inviteCodeExpiresAt) newExpiresAt = createdHh.inviteCodeExpiresAt;
            invitationToken = createdHh.inviteCode;
          }
        } else {
          throw new Error('Servidor não retornou o identificador do grupo.');
        }
      } catch (createErr) {
        console.error('Falha ao registrar grupo no PostgreSQL:', createErr);
        throw new Error(
          createErr.message?.includes('Sessão não autenticada')
            ? 'Sua sessão expirou. Saia e entre novamente no app para sincronizar o grupo.'
            : `Falha ao conectar com o servidor para registrar o grupo (${createErr.message}). Tente novamente.`
        );
      }
    }

    if (targetHhId && !invitationToken) {
      try {
        const codeRes = await generateHouseholdInviteCodeApi(targetHhId);
        if (codeRes?.code) {
          baseCode = codeRes.code;
          if (codeRes.expiresAt) newExpiresAt = codeRes.expiresAt;
          invitationToken = codeRes.code;
        } else {
          throw new Error('Servidor não retornou o novo código.');
        }
      } catch (e) {
        // Auto-recuperação: caso o householdId antigo não exista mais no banco, recria no servidor agora
        try {
          const recreatedHh = await createHouseholdApi(targetGroup.name || 'Finanças Compartilhadas');
          if (recreatedHh?.id) {
            targetHhId = recreatedHh.id;
            targetGroup.remoteId = recreatedHh.id;
            if (recreatedHh.inviteCode) {
              baseCode = recreatedHh.inviteCode;
              if (recreatedHh.inviteCodeExpiresAt) newExpiresAt = recreatedHh.inviteCodeExpiresAt;
              invitationToken = recreatedHh.inviteCode;
            }
          }
        } catch (fallbackErr) {
          console.error('Renovação de convite backend:', fallbackErr);
          throw new Error(
            `Não foi possível gerar novo código no servidor (${fallbackErr.message || e.message}). Tente novamente.`
          );
        }
      }
    }

    if (!baseCode) {
      throw new Error('Não foi possível obter o código oficial do servidor.');
    }

    let finalCode = baseCode;
    try {
      const cloudRes = await publishCloudInvite({
        invitationToken,
        householdId: targetHhId,
        name: targetGroup.name,
        type: targetGroup.type,
        creator: { id: targetGroup.creatorId, name: targetGroup.creatorName },
        expiresAt: newExpiresAt,
        fallbackCode: baseCode,
      });
      if (cloudRes?.code) finalCode = cloudRes.code;
    } catch (e) {
      console.warn('Erro ao publicar renovação na nuvem:', e.message);
    }

    let updatedTargetGroup = null;
    const updatedGroups = sharedGroups.map((g) => {
      if (g.id === targetGroupId) {
        updatedTargetGroup = {
          ...g,
          id: targetHhId || g.id,
          remoteId: targetHhId || g.remoteId,
          inviteCode: finalCode,
          inviteCodeExpiresAt: newExpiresAt,
        };
        return updatedTargetGroup;
      }
      return g;
    });

    setSharedGroups(updatedGroups);
    if (activeGroupId === targetGroupId && targetHhId && targetHhId !== targetGroupId) {
      setActiveGroupIdState(targetHhId);
      await saveUserItem('active_group_id', targetHhId);
    }
    await saveUserItem('shared_groups', updatedGroups);

    pushGroupNotification({
      title: `🔑 Novo código de convite: ${finalCode}`,
      message: `Um novo código de convite (${finalCode}) válido por 30 minutos foi gerado para o grupo '${targetGroup.name}'.`,
      icon: 'key-outline',
      color: '#0EA5E9',
      groupId: targetHhId || targetGroup.id,
    });

    return {
      inviteCode: finalCode,
      expiresAt: newExpiresAt,
      expiresInMinutes: 30,
    };
  };

  // Excluir Grupo Compartilhado (Apenas o Criador/Dono tem permissão)
  const deleteSharedGroup = async (groupId) => {
    const targetGroup = sharedGroups.find((g) => g.id === groupId);
    if (!targetGroup) return;

    if (!isGroupCreator(targetGroup)) {
      throw new Error('Apenas quem criou o grupo tem permissão para excluí-lo.');
    }

    try {
      if (targetGroup.remoteId) {
        await deleteHouseholdApi(targetGroup.remoteId);
      }
    } catch (e) {
      console.log('Exclusão remota offline:', e.message);
    }

    const updated = sharedGroups.filter((g) => g.id !== groupId);
    setSharedGroups(updated);
    await saveUserItem('shared_groups', updated);

    if (activeGroupId === groupId) {
      const nextId = updated[0]?.id || null;
      setActiveGroupIdState(nextId);
      await saveUserItem('active_group_id', nextId);
    }

    pushGroupNotification({
      title: `🗑️ Grupo encerrado: ${targetGroup.name}`,
      message: `O grupo compartilhado '${targetGroup.name}' foi excluído permanentemente.`,
      icon: 'trash-outline',
      color: '#EF4444',
      groupId: null,
    });

    return { success: true };
  };

  // Sair do Grupo Compartilhado (Participantes saem e o criador é notificado)
  const leaveSharedGroup = async (groupId) => {
    const targetGroup = sharedGroups.find((g) => g.id === groupId);
    if (!targetGroup) return;

    if (isGroupCreator(targetGroup)) {
      throw new Error(
        'O criador do grupo não pode sair. Se deseja encerrar o grupo, você deve excluí-lo.',
      );
    }

    const myName = loggedInUser?.fullName || loggedInUser?.name || 'Um participante';
    const myId = loggedInUser?.id ? String(loggedInUser.id) : null;
    const myEmail = loggedInUser?.email ? loggedInUser.email.toLowerCase().trim() : null;

    // 1. Notifica via API backend se houver vínculo remoto
    try {
      if (targetGroup.remoteId) {
        await leaveHouseholdApi(targetGroup.remoteId);
      }
    } catch (e) {
      console.log('Saída de grupo remota offline:', e.message);
    }

    // 2. Registra notificação persistida para o criador do grupo
    const exitNotification = {
      id: 'notif-' + Date.now(),
      groupId: targetGroup.id,
      groupName: targetGroup.name,
      title: 'Membro saiu do grupo',
      message: `${myName} saiu do grupo '${targetGroup.name}'.`,
      date: new Date().toISOString(),
      read: false,
    };

    const existingNotifs = (await getUserItem('owner_notifications')) || [];
    await saveUserItem('owner_notifications', [exitNotification, ...existingNotifs]);

    // 3. Remove o usuário da lista de membros e remove o grupo das finanças deste usuário
    const updated = sharedGroups.filter((g) => g.id !== groupId);
    setSharedGroups(updated);
    await saveUserItem('shared_groups', updated);

    if (activeGroupId === groupId) {
      const nextId = updated[0]?.id || null;
      setActiveGroupIdState(nextId);
      await saveUserItem('active_group_id', nextId);
    }

    pushGroupNotification({
      title: `👋 Você saiu do grupo ${targetGroup.name}`,
      message: `Sua saída do grupo '${targetGroup.name}' foi concluída e o criador foi notificado.`,
      icon: 'exit-outline',
      color: '#F59E0B',
      groupId: null,
    });

    return {
      success: true,
      message: `Você saiu do grupo '${targetGroup.name}' com sucesso. O criador foi notificado.`,
    };
  };

  // Expulsar Membro do Grupo Compartilhado (Apenas o Criador/Dono tem permissão)
  const kickMemberFromGroup = async (groupId, targetMemberIdOrEmail) => {
    const targetGroupId = groupId || activeGroupId || sharedGroups[0]?.id;
    const targetGroup = sharedGroups.find((g) => g.id === targetGroupId);
    if (!targetGroup) {
      throw new Error('Grupo não encontrado.');
    }

    if (!isGroupCreator(targetGroup)) {
      throw new Error('Apenas o criador do grupo tem permissão para expulsar participantes.');
    }

    // Identifica o membro que será expulso
    const targetMember = (targetGroup.members || []).find((m) => {
      const matchId = m.id && String(m.id) === String(targetMemberIdOrEmail);
      const matchEmail = m.email && targetMemberIdOrEmail && m.email.toLowerCase().trim() === String(targetMemberIdOrEmail).toLowerCase().trim();
      const matchName = m.name && String(m.name) === String(targetMemberIdOrEmail);
      return matchId || matchEmail || matchName;
    });

    if (!targetMember) {
      throw new Error('Participante não encontrado no grupo.');
    }

    // Não permite expulsar o criador / dono ou o próprio usuário logado
    if (
      targetMember.isCreator ||
      targetMember.role === 'OWNER' ||
      (targetGroup.creatorId && String(targetMember.id) === String(targetGroup.creatorId))
    ) {
      throw new Error('O criador/dono do grupo não pode ser expulso.');
    }

    const myId = loggedInUser?.id ? String(loggedInUser.id) : null;
    const myEmail = loggedInUser?.email ? loggedInUser.email.toLowerCase().trim() : null;
    if (
      (myId && String(targetMember.id) === myId) ||
      (myEmail && targetMember.email && targetMember.email.toLowerCase().trim() === myEmail)
    ) {
      throw new Error('Você não pode expulsar a si mesmo do grupo.');
    }

    // 1. Tenta expulsar via API backend se houver vínculo remoto
    try {
      if (targetGroup.remoteId && targetMember.id) {
        await kickHouseholdMemberApi(targetGroup.remoteId, targetMember.id);
      }
    } catch (e) {
      console.log('Expulsão de membro via API offline:', e.message);
    }

    // 2. Remove o membro da lista de membros do grupo local
    const updatedMembers = (targetGroup.members || []).filter((m) => {
      if (targetMember.id && m.id && String(m.id) === String(targetMember.id)) return false;
      if (targetMember.email && m.email && m.email.toLowerCase().trim() === targetMember.email.toLowerCase().trim()) return false;
      if (!targetMember.id && !targetMember.email && m.name === targetMember.name) return false;
      return true;
    });

    const updatedGroups = sharedGroups.map((g) => {
      if (g.id === targetGroupId) {
        return {
          ...g,
          members: updatedMembers,
        };
      }
      return g;
    });

    setSharedGroups(updatedGroups);
    await saveUserItem('shared_groups', updatedGroups);

    // 3. Atualiza também no registro global de convites do dispositivo se presente
    if (targetGroup.inviteCode) {
      try {
        const regRaw = await AsyncStorage.getItem('@finn_shared_invites_registry');
        const reg = regRaw ? JSON.parse(regRaw) : {};
        const codeKey = targetGroup.inviteCode.toUpperCase();
        if (reg[codeKey]) {
          reg[codeKey] = {
            ...reg[codeKey],
            members: updatedMembers,
          };
          await AsyncStorage.setItem('@finn_shared_invites_registry', JSON.stringify(reg));
        }
      } catch (err) {
        console.warn('Erro ao atualizar registro global após expulsão:', err);
      }
    }

    pushGroupNotification({
      title: `🚫 Participante removido de ${targetGroup.name}`,
      message: `${targetMember.name || 'Participante'} foi removido do grupo '${targetGroup.name}'.`,
      icon: 'person-remove-outline',
      color: '#EF4444',
      groupId: targetGroupId,
    });

    return {
      success: true,
      memberName: targetMember.name || 'Participante',
      message: `${targetMember.name || 'Participante'} foi expulso do grupo com sucesso.`,
    };
  };

  // Convidar Pessoa para o Grupo Compartilhado
  const invitePersonToGroup = async ({ groupId, email, type = 'Casal', message = '' }) => {
    const code = generateGroupInviteCode();
    const targetGroupId = groupId || activeGroupId || sharedGroups[0]?.id;
    const targetGroup = sharedGroups.find((g) => g.id === targetGroupId);
    const inv = {
      id: 'inv-' + Date.now(),
      groupId: targetGroupId,
      email: email.trim().toLowerCase(),
      type,
      message,
      token: code,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      status: 'PENDING',
    };

    try {
      const apiRes = await createHouseholdInvitationApi(email);
      if (apiRes?.token) {
        inv.token = apiRes.token;
      }
    } catch (e) {
      console.log('Convite gerado localmente:', e.message);
    }

    const nextInvitations = [inv, ...groupInvitations];
    setGroupInvitations(nextInvitations);
    await saveUserItem('group_invitations', nextInvitations);

    pushGroupNotification({
      title: `📩 Convite enviado para ${email.trim()}`,
      message: `Convite gerado para o grupo '${targetGroup?.name || 'Compartilhado'}'. Código de acesso: ${inv.token} (válido por 30 min).`,
      icon: 'mail-unread-outline',
      color: '#7C3AED',
      groupId: targetGroupId,
    });

    return inv;
  };

  // Aceitar Convite de Grupo via Código (Validação de 30 min e Conexão em Livetime)
  const acceptGroupInvitation = async (rawCode) => {
    const cleanedInput = (rawCode || '').trim();
    if (!cleanedInput) {
      throw new Error('Informe o código do convite.');
    }

    const codeToTry = cleanedInput.toUpperCase();
    let apiAcceptResult = null;

    // 1. Tenta aceitar DIRETAMENTE via API oficial (PostgreSQL) com o código de 30 min ou token
    try {
      apiAcceptResult = await acceptHouseholdInvitationApi(codeToTry);
    } catch (apiErr) {
      const errMsg = apiErr.message || '';
      if (
        errMsg.includes('expirou') ||
        errMsg.includes('substituído') ||
        errMsg.includes('cancelado') ||
        errMsg.includes('já faz parte')
      ) {
        throw new Error(errMsg);
      }
    }

    // 2. Se a API já aceitou diretamente, monta o grupo com os dados oficiais retornados
    if (apiAcceptResult?.household) {
      const hh = apiAcceptResult.household;
      const ownerMember = (hh.members || []).find((m) => m.role === 'OWNER') || hh.members?.[0];
      const joinedGroup = {
        id: hh.id,
        remoteId: hh.id,
        name: hh.name || 'Finanças Compartilhadas',
        type: 'Casal',
        description: `Conectado ao grupo via código ${codeToTry}`,
        createdAt: new Date().toISOString(),
        inviteCode: codeToTry,
        inviteCodeExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        creatorId: ownerMember?.id || 'owner',
        creatorName: ownerMember?.name || ownerMember?.fullName || 'Organizador(a)',
        members: (hh.members || []).map((m) => ({
          id: m.id,
          name: m.name || m.fullName || (m.role === 'OWNER' ? 'Organizador(a)' : 'Membro'),
          email: m.email || '',
          avatarUrl: sanitizeAvatarUri(m.avatarUrl || null),
          role: m.role || 'MEMBER',
          isCreator: m.role === 'OWNER',
        })),
      };

      const nextGroups = [
        joinedGroup,
        ...sharedGroups.filter((g) => g.id !== joinedGroup.id && (!joinedGroup.remoteId || g.remoteId !== joinedGroup.remoteId)),
      ];
      setSharedGroups(nextGroups);
      setActiveGroupIdState(joinedGroup.id);
      setViewModeState('shared');
      await saveUserItem('shared_groups', nextGroups);
      await saveUserItem('active_group_id', joinedGroup.id);
      await saveUserItem('view_mode', 'shared');

      pushGroupNotification({
        title: `🎉 Convite aceito: ${joinedGroup.name}`,
        message: `Você entrou no grupo '${joinedGroup.name}'! Agora você será avisado sempre que o valor do grupo for alterado ou uma conta for dividida.`,
        icon: 'checkmark-circle',
        color: '#10B981',
        groupId: joinedGroup.id,
      });

      return joinedGroup;
    }

    // 3. Fallback: Resolve o código via Cloud Relay (ou formato de token de 64 hex)
    const resolved = await resolveCloudInvite(cleanedInput);
    let tokenToAccept = resolved.token || codeToTry;

    if (tokenToAccept && !apiAcceptResult) {
      try {
        const res2 = await acceptHouseholdInvitationApi(tokenToAccept);
        if (res2?.household) {
          apiAcceptResult = res2;
        }
      } catch (apiErr2) {
        if (apiErr2.message && apiErr2.message.includes('expirou')) {
          throw new Error('Este código de convite expirou (validade de 30 minutos). Solicite um novo código ao criador do grupo.');
        }
      }
    }

    // 4. Busca o núcleo familiar oficial atualizado no PostgreSQL
    let joinedGroup = null;
    try {
      const currentHh = await fetchCurrentHouseholdApi();
      if (currentHh && currentHh.id && (currentHh.id === resolved.householdId || apiAcceptResult)) {
        const ownerMember = (currentHh.members || []).find((m) => m.role === 'OWNER') || currentHh.members?.[0];
        joinedGroup = {
          id: currentHh.id,
          remoteId: currentHh.id,
          name: currentHh.name || resolved.groupName || 'Finanças Compartilhadas',
          type: resolved.type || 'Casal',
          description: `Conectado ao grupo via código ${resolved.code || codeToTry}`,
          createdAt: new Date().toISOString(),
          inviteCode: resolved.code || codeToTry,
          inviteCodeExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          creatorId: ownerMember?.id || resolved.creator?.id || 'owner',
          creatorName: ownerMember?.fullName || resolved.creator?.name || 'Organizador(a)',
          members: (currentHh.members || []).map((m) => ({
            id: m.id,
            name: m.fullName || m.name || (m.role === 'OWNER' ? 'Organizador(a)' : 'Membro'),
            email: m.email || '',
            avatarUrl: sanitizeAvatarUri(m.avatarUrl || null),
            role: m.role || 'MEMBER',
            isCreator: m.role === 'OWNER',
          })),
        };
      }
    } catch (hhErr) {
      console.warn('Aviso: busca de household após aceite:', hhErr.message);
    }

    // 5. Se não veio do backend, usa os dados resolvidos do cloud relay
    if (!joinedGroup && (resolved.groupName || resolved.householdId)) {
      const myMember = {
        id: loggedInUser?.id || 'usr-' + Date.now(),
        name: loggedInUser?.fullName || loggedInUser?.name || 'Você',
        email: loggedInUser?.email || '',
        role: 'MEMBER',
        joinedAt: new Date().toISOString(),
      };

      const creatorMember = resolved.creator ? {
        id: resolved.creator.id || 'creator',
        name: resolved.creator.name || 'Criador(a)',
        email: resolved.creator.email || '',
        role: 'OWNER',
        isCreator: true,
      } : {
        id: 'admin',
        name: 'Criador(a)',
        role: 'OWNER',
        isCreator: true,
      };

      joinedGroup = {
        id: resolved.householdId || 'grp-joined-' + Date.now(),
        remoteId: resolved.householdId || null,
        name: resolved.groupName || 'Grupo Compartilhado',
        type: resolved.type || 'Casal',
        description: `Ingresso via código ${resolved.code || codeToTry}`,
        createdAt: new Date().toISOString(),
        inviteCode: resolved.code || codeToTry,
        inviteCodeExpiresAt: resolved.expiresAt || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        creatorId: creatorMember.id,
        creatorName: creatorMember.name,
        members: [creatorMember, myMember],
      };
    }

    // 6. Se não encontrou nem conectou
    if (!joinedGroup) {
      if (resolved.notFound) {
        throw new Error('Código de convite não encontrado ou inválido. Verifique os caracteres e tente novamente.');
      }
      throw new Error('Não foi possível conectar ao grupo com este código.');
    }

    // 7. Atualiza o estado da aplicação e seleciona o grupo e modo imediatamente
    const nextGroups = [
      joinedGroup,
      ...sharedGroups.filter((g) => g.id !== joinedGroup.id && (!joinedGroup.remoteId || g.remoteId !== joinedGroup.remoteId)),
    ];
    setSharedGroups(nextGroups);
    setActiveGroupIdState(joinedGroup.id);
    setViewModeState('shared');

    await saveUserItem('shared_groups', nextGroups);
    await saveUserItem('active_group_id', joinedGroup.id);
    await saveUserItem('view_mode', 'shared');

    pushGroupNotification({
      title: `🎉 Convite aceito: ${joinedGroup.name}`,
      message: `Você entrou no grupo '${joinedGroup.name}'! Agora você será avisado sempre que o valor do grupo for alterado ou uma conta for dividida.`,
      icon: 'checkmark-circle',
      color: '#10B981',
      groupId: joinedGroup.id,
    });

    return joinedGroup;
  };

  // Lançar Despesa Compartilhada (aguarda confirmação da API e aproveita a resposta confirmada pelo servidor)
  const addSharedExpense = async (expData) => {
    const myRealName = loggedInUser?.fullName || loggedInUser?.name || 'Você';
    const rawPayer = expData.paidBy || myRealName;
    const payer = rawPayer === 'Você' ? myRealName : rawPayer;
    const splitRatio = expData.splitMethod === 'equal' ? 0.5 : parseFloat(expData.splitRatio) || 0.5;
    const targetGroupId = expData.groupId || activeGroupId || sharedGroups[0]?.id;
    const targetGroup =
      sharedGroups.find((g) => g.id === targetGroupId || g.remoteId === targetGroupId) ||
      sharedGroups[0];
    const remoteGroupId = targetGroup?.remoteId || targetGroup?.id || targetGroupId;
    const grpTitle = targetGroup?.name || 'Grupo Compartilhado';
    const parsedAmount = parseFloat(expData.amount) || 0;
    const requestedDate = expData.date || new Date().toISOString().split('T')[0];

    const encodedNotes = encodeSharedNotes(
      {
        kind: 'expense',
        groupId: remoteGroupId,
        groupName: grpTitle,
        paidBy: payer,
        author: payer,
        authorId: loggedInUser?.id || null,
        authorEmail: (loggedInUser?.email || '').trim().toLowerCase() || null,
        category: expData.category || 'alimentacao',
        splitMethod: expData.splitMethod || 'equal',
        splitRatio,
        splitDetails: expData.splitDetails || null,
      },
      expData.notes || ''
    );

    // Aguarda confirmação do servidor antes de concluir a criação
    const createdRemote = await apiCreateTransaction({
      description: expData.description,
      title: expData.description,
      amount: parsedAmount,
      type: 'EXPENSE',
      date: requestedDate,
      isHouseholdShared: true,
      notes: encodedNotes,
    });

    if (!createdRemote || !createdRemote.id) {
      throw new Error('Não foi possível confirmar o gasto no servidor. Tente novamente.');
    }

    const confirmedId = String(createdRemote.id);
    const confirmedAmount =
      createdRemote.amount !== undefined
        ? Math.abs(parseFloat(createdRemote.amount)) || parsedAmount
        : parsedAmount;
    const confirmedDesc = createdRemote.description || expData.description;
    const confirmedDate = createdRemote.date
      ? String(createdRemote.date).split('T')[0]
      : requestedDate;

    seenSharedTxIdsRef.current.add(confirmedId);
    saveUserItem(
      'seen_shared_tx_ids',
      Array.from(seenSharedTxIdsRef.current).slice(-300)
    ).catch(() => {});

    const newTx = {
      id: confirmedId,
      remoteId: confirmedId,
      description: confirmedDesc,
      title: confirmedDesc,
      amount: confirmedAmount,
      type: expData.type || 'expense',
      category: expData.category || 'alimentacao',
      date: confirmedDate,
      createdAt: createdRemote.createdAt || new Date().toISOString(),
      author: payer,
      paidBy: payer,
      isShared: true,
      groupId: targetGroup?.id || targetGroupId,
      sharedGroupId: remoteGroupId,
      groupName: grpTitle,
      splitMethod: expData.splitMethod || 'equal',
      splitRatio: splitRatio,
      splitDetails: expData.splitDetails || null,
      notes: expData.notes || '',
    };

    setTransactions((prev) => {
      const filtered = prev.filter((t) => t.id !== confirmedId && t.remoteId !== confirmedId);
      const nextTxs = [newTx, ...filtered];
      transactionsRef.current = nextTxs;
      saveUserItem('transactions', nextTxs);
      return nextTxs;
    });

    const fmtAmt = Number(newTx.amount || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const isBillSplit = !!expData.splitDetails;

    pushGroupNotification({
      title: isBillSplit
        ? `🧾 Nova divisão no grupo ${grpTitle}: R$ ${fmtAmt}`
        : `💸 Despesa registrada em ${grpTitle}: R$ ${fmtAmt}`,
      message: isBillSplit
        ? `${payer} dividiu a conta "${newTx.description}" (R$ ${fmtAmt}) entre ${expData.splitDetails?.members?.length || 2} participantes no grupo "${grpTitle}".`
        : `${payer} adicionou "${newTx.description}" de R$ ${fmtAmt} no grupo "${grpTitle}". Todos os membros do grupo foram sincronizados!`,
      icon: isBillSplit ? 'pie-chart' : 'cash-outline',
      color: '#7C3AED',
      groupId: targetGroup?.id || targetGroupId,
      groupName: grpTitle,
    });

    return newTx;
  };

  // Registrar Acerto de Contas / Abatimento (aguarda confirmação da API e aproveita a resposta confirmada)
  const recordSettlement = async (settlementData) => {
    const myRealName = loggedInUser?.fullName || loggedInUser?.name || 'Você';
    const rawFrom = settlementData.fromMember || myRealName;
    const fromMember = rawFrom === 'Você' ? myRealName : rawFrom;
    const toMember = settlementData.toMember || 'Participante';
    const targetGroupId = settlementData.groupId || activeGroupId || sharedGroups[0]?.id;
    const targetGrp =
      sharedGroups.find((g) => g.id === targetGroupId || g.remoteId === targetGroupId) ||
      sharedGroups[0];
    const remoteGroupId = targetGrp?.remoteId || targetGrp?.id || targetGroupId;
    const grpTitle = targetGrp?.name || 'Grupo Compartilhado';
    const parsedAmount = parseFloat(settlementData.amount) || 0;
    const requestedDate = new Date().toISOString();

    const encodedSettlementNotes = encodeSharedNotes(
      {
        kind: 'settlement',
        groupId: remoteGroupId,
        groupName: grpTitle,
        paidBy: fromMember,
        author: fromMember,
        authorId: loggedInUser?.id || null,
        authorEmail: (loggedInUser?.email || '').trim().toLowerCase() || null,
        fromMember,
        toMember,
      },
      settlementData.notes || ''
    );

    // Aguarda confirmação da API antes de registrar o abatimento como concluído
    const createdRemote = await apiCreateTransaction({
      description: `Acerto: ${fromMember} pagou ${toMember}`,
      title: `Acerto: ${fromMember} pagou ${toMember}`,
      amount: parsedAmount,
      type: 'EXPENSE',
      date: requestedDate,
      isHouseholdShared: true,
      notes: encodedSettlementNotes,
    });

    if (!createdRemote || !createdRemote.id) {
      throw new Error('Não foi possível confirmar o abatimento no servidor. Tente novamente.');
    }

    const confirmedId = String(createdRemote.id);
    const confirmedAmount =
      createdRemote.amount !== undefined
        ? Math.abs(parseFloat(createdRemote.amount)) || parsedAmount
        : parsedAmount;

    seenSharedTxIdsRef.current.add(confirmedId);
    saveUserItem(
      'seen_shared_tx_ids',
      Array.from(seenSharedTxIdsRef.current).slice(-300)
    ).catch(() => {});

    const newSettlement = {
      id: confirmedId,
      remoteId: confirmedId,
      groupId: targetGrp?.id || targetGroupId,
      sharedGroupId: remoteGroupId,
      groupName: grpTitle,
      fromMember,
      toMember,
      amount: confirmedAmount,
      notes: settlementData.notes || '',
      date: createdRemote.createdAt || createdRemote.date || requestedDate,
      createdAt: createdRemote.createdAt || requestedDate,
      status: 'COMPLETED',
    };

    setSettlements((prev) => {
      const filtered = prev.filter((s) => s.id !== confirmedId && s.remoteId !== confirmedId);
      const nextSettlements = [newSettlement, ...filtered];
      settlementsRef.current = nextSettlements;
      saveUserItem('settlements', nextSettlements);
      return nextSettlements;
    });

    const fmtSettle = Number(newSettlement.amount || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    pushGroupNotification({
      title: `🤝 Acerto de contas em ${grpTitle}: R$ ${fmtSettle}`,
      message: `${fromMember} pagou R$ ${fmtSettle} para ${toMember} no grupo "${grpTitle}". O saldo do grupo foi atualizado!`,
      icon: 'swap-horizontal',
      color: '#10B981',
      groupId: newSettlement.groupId,
      groupName: grpTitle,
    });

    return newSettlement;
  };

  // Cálculos financeiros consolidados com suporte a Contexto/Modo de Visualização:
  // 'personal' (Minhas finanças) | 'shared' (Finanças compartilhadas) | 'consolidated' (Visão consolidada)
  const currentUserName = loggedInUser?.fullName || loggedInUser?.name || members?.user1 || 'Principal';

  const effectiveActiveGroupId = activeGroupId || sharedGroups[0]?.id || null;
  const activeGroupObj = sharedGroups.find(
    (g) => g.id === effectiveActiveGroupId || g.remoteId === effectiveActiveGroupId
  );
  const activeGroupValidIds = new Set(
    [effectiveActiveGroupId, activeGroupObj?.id, activeGroupObj?.remoteId]
      .filter(Boolean)
      .map(String)
  );

  const filteredTransactions = transactions.filter((t) => {
    if (viewMode === 'shared') {
      if (!t.isShared && !t.groupId && !t.sharedGroupId) return false;
      if (!effectiveActiveGroupId) return true;
      const gId = t.groupId || t.sharedGroupId;
      if (!gId) {
        return !activeGroupId || !sharedGroups.length || effectiveActiveGroupId === sharedGroups[0]?.id;
      }
      if (activeGroupValidIds.has(String(t.groupId)) || activeGroupValidIds.has(String(t.sharedGroupId))) {
        return true;
      }
      if (
        t.groupName &&
        activeGroupObj?.name &&
        t.groupName.trim().toLowerCase() === activeGroupObj.name.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    }
    if (viewMode === 'personal') {
      return !t.isShared && !t.groupId;
    }
    // 'consolidated'
    return true;
  });

  // Abatimentos (settlements) confirmados para o grupo ativo
  const activeGroupSettlements = settlements.filter((s) => {
    if (!effectiveActiveGroupId) return true;
    const sGrpId = s.groupId || s.sharedGroupId;
    if (!sGrpId) return sharedGroups.length <= 1;
    if (activeGroupValidIds.has(String(s.groupId)) || activeGroupValidIds.has(String(s.sharedGroupId))) {
      return true;
    }
    if (
      s.groupName &&
      activeGroupObj?.name &&
      s.groupName.trim().toLowerCase() === activeGroupObj.name.trim().toLowerCase()
    ) {
      return true;
    }
    return false;
  });

  const activeGroupSettledTotal = Math.round(
    activeGroupSettlements.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0) * 100
  ) / 100;

  const totalSharedGrossExpense = Math.round(
    transactions
      .filter((t) => {
        if (t.type !== 'expense') return false;
        if (!t.isShared && !t.groupId && !t.sharedGroupId) return false;
        if (!effectiveActiveGroupId) return true;
        const gId = t.groupId || t.sharedGroupId;
        if (!gId) return sharedGroups.length <= 1;
        if (activeGroupValidIds.has(String(t.groupId)) || activeGroupValidIds.has(String(t.sharedGroupId))) {
          return true;
        }
        return (
          Boolean(t.groupName && activeGroupObj?.name) &&
          t.groupName.trim().toLowerCase() === activeGroupObj.name.trim().toLowerCase()
        );
      })
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0) * 100
  ) / 100;

  // Saldo em aberto do grupo ativo (Total de gastos compartilhados - Total de abatimentos confirmados)
  const openGroupBalance = Math.max(
    0,
    Math.round((totalSharedGrossExpense - activeGroupSettledTotal) * 100) / 100
  );

  const txIncome = filteredTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const rawTotalExpense = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => {
      if (viewMode === 'consolidated' && t.isShared) {
        const ratio = t.splitRatio !== undefined ? t.splitRatio : 0.5;
        return sum + ((t.amount || 0) * ratio);
      }
      return sum + (t.amount || 0);
    }, 0);

  const totalExpense =
    viewMode === 'shared'
      ? Math.max(0, Math.round((rawTotalExpense - activeGroupSettledTotal) * 100) / 100)
      : viewMode === 'consolidated'
        ? Math.max(0, Math.round((rawTotalExpense - activeGroupSettledTotal * 0.5) * 100) / 100)
        : rawTotalExpense;

  const accountsBalance = accounts.reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0);

  // A entrada reflete a soma das entradas registradas ou o valor total depositado nas contas (saldo atual + saídas já descontadas)
  const totalIncome = viewMode === 'shared'
    ? txIncome
    : accounts.length > 0
    ? (txIncome > 0
        ? Math.max(txIncome, accountsBalance > 0 ? accountsBalance + totalExpense : 0)
        : (accountsBalance > 0 ? accountsBalance + totalExpense : 0))
    : txIncome;

  // Saldo totalmente isolado: se houver saldo nas contas usa accountsBalance, senão usa (totalIncome - totalExpense)
  const totalBalance = viewMode === 'shared'
    ? (txIncome - totalExpense)
    : accounts.length > 0 && accountsBalance !== 0
    ? accountsBalance
    : (totalIncome - totalExpense);

  const resultadoDoMes = accounts.length > 0 && viewMode !== 'shared' ? totalBalance : (totalIncome - totalExpense);

  // Cálculos de gastos fixos vs variáveis
  const fixedExpensesList = filteredTransactions.filter((t) => t.type === 'expense' && t.expenseType === 'fixed');
  const variableExpensesList = filteredTransactions.filter((t) => t.type === 'expense' && t.expenseType !== 'fixed');

  const totalFixedExpenses = fixedExpensesList.reduce((sum, t) => sum + t.amount, 0) + bills.reduce((sum, b) => sum + b.amount, 0);
  const totalVariableExpenses = variableExpensesList.reduce((sum, t) => sum + t.amount, 0);

  // Cálculos de receitas (Salário vs Freelance)
  const salaryIncomesList = filteredTransactions.filter((t) => t.type === 'income' && (t.incomeSource === 'salary' || !t.incomeSource));
  const freelanceIncomesList = filteredTransactions.filter((t) => t.type === 'income' && (t.incomeSource === 'freelance' || t.incomeSource === 'extra'));
  
  const totalSalaryIncome = salaryIncomesList.reduce((sum, t) => sum + t.amount, 0);
  const totalFreelanceIncome = freelanceIncomesList.reduce((sum, t) => sum + t.amount, 0);
  const totalOtherIncome = filteredTransactions
    .filter((t) => t.type === 'income' && t.incomeSource !== 'salary' && t.incomeSource !== 'freelance' && t.incomeSource !== 'extra')
    .reduce((sum, t) => sum + t.amount, 0);

  // Cálculos de contas a pagar (Imagem 1)
  const totalBillsAmount = bills.reduce((sum, b) => sum + b.amount, 0);
  const paidBillsAmount = bills.filter((b) => b.paid).reduce((sum, b) => sum + b.amount, 0);
  const pendingBillsAmount = bills.filter((b) => !b.paid).reduce((sum, b) => sum + b.amount, 0);
  const allBillsPaid = pendingBillsAmount === 0 && bills.length > 0;

  // Cálculo de gastos por categoria com barra de progresso (Imagem 2)
  const categoryBreakdown = CATEGORIES.filter((c) => c.id !== 'receita').map((cat) => {
    const spent = filteredTransactions
      .filter((t) => t.type === 'expense' && t.category === cat.id)
      .reduce((sum, t) => sum + t.amount, 0);
    const budget = cat.budget || 0;
    const percentOfTotal = totalExpense > 0 ? Math.round((spent / totalExpense) * 100) : 0;
    const percentOfBudget = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0;
    return {
      ...cat,
      spent,
      budget,
      percentOfTotal,
      percentOfBudget,
    };
  }).filter((c) => c.spent > 0);

  // Economizado % (ex: 47%)
  const economizadoPercent = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0;

  // IA: Consultoria de onde economizar para atingir a meta do Cofrinho
  const askAiAboutCofrinho = async (cofrinhoId) => {
    const cof = cofrinhos.find((c) => c.id === cofrinhoId);
    if (!cof) return 'Cofrinho não encontrado.';
    const remaining = Math.max(cof.targetAmount - cof.currentAmount, 0);
    const uName = loggedInUser?.name || 'Você';

    const prompt = `Você é o FINN AI, consultor financeiro pessoal inteligente de ${uName}.
${uName} tem o objetivo/cofrinho: "${cof.title}"
- Valor total da meta: R$ ${cof.targetAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Já guardou: R$ ${cof.currentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Falta atingir: R$ ${remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Prazo estimado: ${cof.deadline || 'Sem prazo'}

Contexto financeiro atual de ${uName}:
- Saldo total em contas: R$ ${totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Gastos Fixos do mês (Aluguel, contas essenciais): R$ ${totalFixedExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Gastos Variáveis do mês (Mercado, Lazer, etc): R$ ${totalVariableExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Receitas extras de Freelance: R$ ${totalFreelanceIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

Analise com muito carinho e precisão:
1. Em quais categorias variáveis ${uName} pode enxugar gastos este mês para acelerar essa meta?
2. Como a renda de freelance ou renda extra pode ser aproveitada para este cofrinho?
3. Projeção realista: em quantos meses consegue alcançar isso mantendo um padrão financeiro saudável?
Responda de forma clara, motivadora e estruturada em tópicos!`;

    return await sendTextMessageToGemini({
      message: prompt,
      financialContext: { totalBalance, totalIncome, totalExpense, userName: uName },
    });
  };

  // ==========================================
  // IA MULTIMODAL GEMINI
  // ==========================================
  const parseAndRegisterAiTransactions = async (rawText, defaultAuthor) => {
    if (!rawText) return { cleanText: '', transactions: [], interactiveAction: null };

    let interactiveAction = null;

    // 1. Detecta [ASK_PAYMENT_METHOD: {...}]
    const askPaymentMatch = rawText.match(/\[ASK_PAYMENT_METHOD:\s*(\{[\s\S]*?\})\]/i);
    if (askPaymentMatch) {
      try {
        const jsonStr = askPaymentMatch[1].replace(/\r?\n/g, ' ').trim();
        interactiveAction = {
          type: 'ASK_PAYMENT_METHOD',
          data: JSON.parse(jsonStr),
        };
      } catch {}
    }

    // 2. Detecta [ASK_CARD: {...}]
    const askCardMatch = rawText.match(/\[ASK_CARD:\s*(\{[\s\S]*?\})\]/i);
    if (askCardMatch) {
      try {
        const jsonStr = askCardMatch[1].replace(/\r?\n/g, ' ').trim();
        interactiveAction = {
          type: 'ASK_CARD',
          data: JSON.parse(jsonStr),
        };
      } catch {}
    }

    const regex = /\[TRANSACTION:\s*(\{[\s\S]*?\})\]/gi;
    const matches = [...rawText.matchAll(regex)];
    const txDataToCreate = [];

    for (const match of matches) {
      try {
        const jsonStr = match[1].replace(/\r?\n/g, ' ').trim();
        const parsed = JSON.parse(jsonStr);
        if (parsed && parsed.amount) {
          let resolvedCardId = parsed.cardId || null;
          let resolvedCardName = parsed.cardName || null;

          if (parsed.paymentMethod === 'credit_card' || parsed.paymentType === 'credit') {
            if (!resolvedCardId && cards.length === 1) {
              resolvedCardId = cards[0].id;
              resolvedCardName = cards[0].name || cards[0].bank;
            } else if (!resolvedCardId && parsed.cardName && cards.length > 1) {
              const q = String(parsed.cardName).toLowerCase().trim();
              const found = cards.find(
                (c) =>
                  String(c.name || '').toLowerCase().includes(q) ||
                  String(c.bank || '').toLowerCase().includes(q)
              );
              if (found) {
                resolvedCardId = found.id;
                resolvedCardName = found.name || found.bank;
              }
            }
          }

          txDataToCreate.push({
            description: parsed.description || 'Movimentação via IA',
            amount: parseFloat(parsed.amount) || 0,
            type: parsed.type === 'income' ? 'income' : 'expense',
            category: parsed.category || 'outros',
            author: parsed.author || defaultAuthor,
            paymentMethod: parsed.paymentMethod || (resolvedCardId ? 'credit_card' : 'account'),
            cardId: resolvedCardId,
            creditCardId: resolvedCardId,
            cardName: resolvedCardName,
          });
        }
      } catch (err) {
        console.warn('Erro ao processar tag TRANSACTION:', err);
      }
    }

    const createdList = txDataToCreate.length > 0
      ? await addTransactionsBatch(txDataToCreate)
      : [];

    const cleanText = rawText
      .replace(/\[TRANSACTION:\s*\{[\s\S]*?\}\]/gi, '')
      .replace(/\[ASK_PAYMENT_METHOD:\s*\{[\s\S]*?\}\]/gi, '')
      .replace(/\[ASK_CARD:\s*\{[\s\S]*?\}\]/gi, '')
      .trim();

    return {
      cleanText: cleanText || (createdList.length > 0
        ? `Prontinho! Registrei ${createdList.length === 1 ? 'o lançamento' : `os ${createdList.length} lançamentos`} no extrato.`
        : rawText),
      transactions: createdList,
      interactiveAction,
    };
  };

  const sendAiMessage = async (userText) => {
    if (!userText.trim()) return;

    const userMsg = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextChat = [...aiChat, userMsg];
    setAiChat(nextChat);

    const finContext = {
      totalBalance,
      totalIncome,
      totalExpense,
      activeMember,
      accounts,
      cards: (cards || []).map((c) => ({
        id: c.id,
        remoteId: c.remoteId,
        name: c.name || c.bank || 'Cartão',
        bank: c.bank || c.name || 'Cartão',
        currentInvoice: parseFloat(c.currentInvoice) || 0,
        limit: parseFloat(c.limit || c.creditLimit) || 0,
      })),
      recentTransactions: transactions.slice(0, 5),
    };

    let aiReplyText = '';
    let createdTxs = [];
    let interactiveAction = null;

    try {
      const uName = loggedInUser?.name || 'Você';
      const rawResponse = await sendTextMessageToGemini({
        message: userText,
        chatHistory: aiChat,
        financialContext: { ...finContext, userName: uName },
        aiSkinId: aiSkin,
      });

      const parsedResult = await parseAndRegisterAiTransactions(
        rawResponse,
        uName
      );
      createdTxs = parsedResult.transactions;
      interactiveAction = parsedResult.interactiveAction || null;
      aiReplyText = parsedResult.cleanText || rawResponse;
    } catch (err) {
      if (err.message?.includes('CHAVE_REVOGADA')) {
        aiReplyText =
          '⚠️ **Chave da API Revogada pelo Google**\n\n' +
          'A sua chave anterior foi desativada pelo Google por detecção de segurança pública.\n\n' +
          'Para reativar em 1 minuto:\n' +
          '1. Acesse **aistudio.google.com/app/apikey** e gere uma chave gratuita.\n' +
          '2. Cole na aba **Configurações > Chave Gemini** no app.\n\n' +
          'Assim que colar, o FINN voltará a conversar naturalmente e ler comprovantes!';
      } else {
        aiReplyText = `Ops! Não consegui conectar com o Google Gemini (${err.message}). Por favor, confira sua chave em Configurações.`;
      }
    }

    const aiMsg = {
      id: 'ai-' + Date.now(),
      sender: 'ai',
      text: aiReplyText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      transaction: createdTxs[0] || null,
      transactions: createdTxs,
      interactiveAction,
    };

    const finalChat = [...nextChat, aiMsg];
    setAiChat(finalChat);
    await saveUserItem('ai_chat', finalChat);
    return { text: aiReplyText, transaction: createdTxs[0] || null, transactions: createdTxs, interactiveAction };
  };

  const processReceiptMedia = async (base64Image, mimeType = 'image/jpeg', userNotes = '') => {
    const userMsg = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: userNotes ? `📷 [Comprovante]: ${userNotes}` : '📷 [Comprovante anexado]',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextChat = [...aiChat, userMsg];
    setAiChat(nextChat);

    let aiReplyText = '';
    let createdTxs = [];

    try {
      const uName = loggedInUser?.name || 'Você';
      const raw = await analyzeReceiptImage({
        base64Image,
        mimeType,
        userNotes,
        financialContext: { totalBalance, totalIncome, totalExpense, userName: uName },
      });

      const parsedResult = await parseAndRegisterAiTransactions(
        raw,
        uName
      );
      createdTxs = parsedResult.transactions;
      aiReplyText = parsedResult.cleanText || raw;
      if (createdTxs.length > 0) {
        const receiptNotif = NotificationTemplates.receiptProcessed({
          txId: createdTxs[0].id,
          amount: createdTxs[0].amount,
          category: createdTxs[0].category,
          merchant: createdTxs[0].description || createdTxs[0].title,
        });
        setActivityNotifications((prev) => {
          const next = [receiptNotif, ...prev].slice(0, 30);
          saveUserItem('activity_notifications', next);
          return next;
        });
      }
    } catch (e) {
      aiReplyText = `Erro ao ler comprovante: ${e.message}`;
      const failNotif = NotificationTemplates.receiptFailed();
      setActivityNotifications((prev) => {
        const next = [failNotif, ...prev].slice(0, 30);
        saveUserItem('activity_notifications', next);
        return next;
      });
    }

    const aiMsg = {
      id: 'ai-' + Date.now(),
      sender: 'ai',
      text: aiReplyText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      transaction: createdTxs[0] || null,
      transactions: createdTxs,
    };

    const finalChat = [...nextChat, aiMsg];
    setAiChat(finalChat);
    await saveUserItem('ai_chat', finalChat);
    return { text: aiReplyText, transaction: createdTxs[0] || null, transactions: createdTxs };
  };

  const processPdfInvoice = async (base64Pdf, userNotes = '') => {
    const userMsg = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: userNotes ? `📄 [Documento/Fatura]: ${userNotes}` : '📄 [Boleto / Nota anexada]',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextChat = [...aiChat, userMsg];
    setAiChat(nextChat);

    let aiReplyText = '';
    let createdTxs = [];

    try {
      const uName = loggedInUser?.name || 'Você';
      const raw = await analyzeInvoicePdf({
        base64Pdf,
        userNotes,
        financialContext: { totalBalance, totalIncome, totalExpense, userName: uName },
      });

      const parsedResult = await parseAndRegisterAiTransactions(
        raw,
        uName
      );
      createdTxs = parsedResult.transactions;
      aiReplyText = parsedResult.cleanText || raw;
    } catch (e) {
      aiReplyText = `Erro ao ler documento: ${e.message}`;
    }

    const aiMsg = {
      id: 'ai-' + Date.now(),
      sender: 'ai',
      text: aiReplyText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      transaction: createdTxs[0] || null,
      transactions: createdTxs,
    };

    const finalChat = [...nextChat, aiMsg];
    setAiChat(finalChat);
    await saveUserItem('ai_chat', finalChat);
    return { text: aiReplyText, transaction: createdTxs[0] || null, transactions: createdTxs };
  };

  const processAudioMessage = async (base64Audio, mimeType = 'audio/m4a') => {
    const userMsg = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: '🎙️ [Áudio de Voz]',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextChat = [...aiChat, userMsg];
    setAiChat(nextChat);

    const finContext = {
      totalBalance,
      totalIncome,
      totalExpense,
      activeMember,
      accounts,
      cards: (cards || []).map((c) => ({
        id: c.id,
        remoteId: c.remoteId,
        name: c.name || c.bank || 'Cartão',
        bank: c.bank || c.name || 'Cartão',
        currentInvoice: parseFloat(c.currentInvoice) || 0,
        limit: parseFloat(c.limit || c.creditLimit) || 0,
      })),
      recentTransactions: transactions.slice(0, 5),
    };

    let aiReplyText = '';
    let createdTxs = [];
    let interactiveAction = null;

    try {
      const uName = loggedInUser?.name || 'Você';
      const raw = await analyzeVoiceAudio({
        base64Audio,
        mimeType,
        financialContext: { ...finContext, userName: uName },
        aiSkinId: aiSkin,
      });

      const parsedResult = await parseAndRegisterAiTransactions(
        raw,
        uName
      );
      createdTxs = parsedResult.transactions;
      interactiveAction = parsedResult.interactiveAction || null;
      aiReplyText = parsedResult.cleanText || raw;
    } catch (e) {
      aiReplyText = `Erro ao processar áudio: ${e.message}`;
    }

    const aiMsg = {
      id: 'ai-' + Date.now(),
      sender: 'ai',
      text: aiReplyText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      transaction: createdTxs[0] || null,
      transactions: createdTxs,
      interactiveAction,
    };

    const finalChat = [...nextChat, aiMsg];
    setAiChat(finalChat);
    await saveUserItem('ai_chat', finalChat);
    return { text: aiReplyText, transaction: createdTxs[0] || null, transactions: createdTxs, interactiveAction };
  };

  const updateAiSkin = async (skinId) => {
    setAiSkin(skinId);
    await saveUserItem('ai_skin', skinId);
  };

  const updateNotificationPreferences = async (nextPrefs) => {
    const uid = loggedInUser?.id || 'guest';
    const saved = await saveUserNotificationPreferences(uid, nextPrefs);
    setNotificationPreferences(saved);
    return saved;
  };

  const todayIsoKey = new Date().toISOString().slice(0, 10);
  const hasRecordedToday = (transactions || []).some(
    (t) => String(t.date || t.createdAt || '').slice(0, 10) === todayIsoKey
  );

  // Agenda notificações inteligentes nativas no celular sempre que os saldos ou preferências mudarem
  useEffect(() => {
    if (!loaded || !loggedInUser?.id) return;
    initPhoneNotifications().then(() => {
      scheduleSmartPhoneNotifications({
        userId: loggedInUser.id,
        userName: loggedInUser?.name,
        totalIncome,
        totalExpense,
        totalBalance,
        pendingBillsAmount,
        hasRecordedToday,
        preferences: notificationPreferences,
      });
    });
  }, [
    loaded,
    loggedInUser?.id,
    totalIncome,
    totalExpense,
    totalBalance,
    pendingBillsAmount,
    hasRecordedToday,
    notificationPreferences,
  ]);

  // Central de Notificações Inteligentes (In-App + Celular) via NotificationTemplates
  const smartSystemNotifications = [];

  // 1. Insight da FINN IA em destaque (Hero Card)
  const savedPct = economizadoPercent > 0 ? economizadoPercent : 100;
  const freeBal = totalBalance > 0 ? totalBalance : resultadoDoMes;
  smartSystemNotifications.push(
    NotificationTemplates.aiSavingsOpportunity({
      id: `smart-economy-status-${selectedMonth}`,
      savedPercent: savedPct,
      freeBalance: freeBal,
      month: selectedMonth,
      time: 'Agora',
    })
  );

  // 1.5. Caso exista despesa no mês e ainda não haja notificação transacional salva em activityNotifications
  const hasExpenseActivityNotif = (activityNotifications || []).some(
    (n) =>
      n.type === 'transaction_expense' ||
      n.category === 'expense' ||
      String(n.title || '').includes('Gasto')
  );
  if (!hasExpenseActivityNotif && totalExpense > 0) {
    const latestExpTx = (transactions || []).find((t) => t.type === 'expense');
    const expVal = latestExpTx ? latestExpTx.amount : totalExpense;
    const expCat = latestExpTx?.category || 'alimentacao';
    smartSystemNotifications.push(
      NotificationTemplates.transactionRecorded({
        id: `smart-latest-expense-${selectedMonth}-${expVal}`,
        txId: latestExpTx?.id || `exp-${selectedMonth}`,
        type: 'expense',
        amount: expVal,
        category: expCat,
        description: latestExpTx?.description || latestExpTx?.title,
        createdAt: latestExpTx?.createdAt,
        time: '02:53',
      })
    );
  }

  // 2. Alertas de controle de limite de categoria (80% e 100%)
  (categoryBreakdown || []).forEach((cat) => {
    if (cat.budget > 0 && cat.percentOfBudget >= 80) {
      smartSystemNotifications.push(
        NotificationTemplates.categoryBudgetAlert({
          category: cat.id || cat.label,
          percentage: cat.percentOfBudget,
          spent: cat.spent,
          limit: cat.budget,
          month: selectedMonth,
        })
      );
    }
  });

  // 3. Alerta de saldo negativo ou projeção negativa
  const projectedEndOfMonth = totalBalance - pendingBillsAmount;
  if (totalBalance < 0 || (pendingBillsAmount > 0 && projectedEndOfMonth < 0)) {
    smartSystemNotifications.push(
      NotificationTemplates.lowBalanceOrNegativeProjectionAlert({
        currentBalance: totalBalance,
        projectedBalance: projectedEndOfMonth,
        month: selectedMonth,
      })
    );
  }

  // 4. Metas dos Cofrinhos atingidas (100%) ou quase atingidas (>= 80%)
  (cofrinhos || []).forEach((cof) => {
    const target = Number(cof.targetAmount) || 0;
    const current = Number(cof.currentAmount) || 0;
    if (target > 0) {
      const pct = Math.round((current / target) * 100);
      if (pct >= 80) {
        smartSystemNotifications.push(
          NotificationTemplates.aiGoalProgress({
            goalId: cof.id,
            goalTitle: cof.title,
            currentAmount: current,
            targetAmount: target,
            percent: pct,
          })
        );
      }
    }
  });

  // 5. Contas a vencer (3 dias antes e no dia)
  if (pendingBillsAmount > 0) {
    const todayDay = new Date().getDate();
    const urgentBills = (bills || []).filter((b) => !b.paid);
    let addedSpecificBill = false;
    urgentBills.forEach((b) => {
      const dueDay = Number(b.dueDay || b.day) || 0;
      if (dueDay > 0) {
        const diff = dueDay - todayDay;
        if (diff === 0 || (diff > 0 && diff <= 3)) {
          addedSpecificBill = true;
          smartSystemNotifications.push(
            NotificationTemplates.billDueAlert({
              billId: b.id,
              billTitle: b.title || b.name,
              amount: b.amount,
              daysUntilDue: diff,
            })
          );
        }
      }
    });
    if (!addedSpecificBill) {
      smartSystemNotifications.push(
        NotificationTemplates.billDueAlert({
          id: `smart-bills-${selectedMonth}`,
          billTitle: 'Contas do mês',
          amount: pendingBillsAmount,
          daysUntilDue: 3,
          time: 'Este mês',
        })
      );
    }
  }

  // 6. Convites ativos nas Finanças Compartilhadas
  const pendingInvites = (groupInvitations || []).filter((inv) => inv.status === 'PENDING');
  if (pendingInvites.length > 0) {
    smartSystemNotifications.push(
      NotificationTemplates.sharedGroupInvite({
        id: `smart-group-invites-${pendingInvites.length}`,
        invitedEmail: pendingInvites[0].email,
        inviteCode: pendingInvites[0].token,
        pendingCount: pendingInvites.length,
      })
    );
  }

  // 7. Lembrete diário para registrar despesas (só se não registrou nada hoje)
  if (!hasRecordedToday) {
    smartSystemNotifications.push(NotificationTemplates.dailyRegisterReminder());
  }

  // 8. Lembrete de reengajamento caso esteja entre 3 e 7+ dias sem lançar
  if ((transactions || []).length > 0 && !hasRecordedToday) {
    const latestDateStr = transactions[0]?.date || transactions[0]?.createdAt;
    if (latestDateStr) {
      const diffMs = Date.now() - new Date(latestDateStr).getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays >= 3 && diffDays <= 14) {
        smartSystemNotifications.push(
          NotificationTemplates.reengagementReminder({
            daysInactive: diffDays,
          })
        );
      }
    }
  }

  // 9. Sistema: App atualizado
  smartSystemNotifications.push(NotificationTemplates.systemAppUpdated());

  const normalizedActivityNotifs = (activityNotifications || []).map((n) =>
    normalizeLegacyNotification(n)
  );

  const heroAiNotifs = smartSystemNotifications.filter((n) => n.isHeroAi);
  const otherSmartNotifs = smartSystemNotifications.filter((n) => !n.isHeroAi);

  // Deduplica por dedupeKey ou id, oculta notificações limpas pelo usuário e respeita preferências
  const rawCombined = [...heroAiNotifs, ...normalizedActivityNotifs, ...otherSmartNotifs];
  const seenKeys = new Set();
  const clearedSet = new Set(clearedNotificationIds || []);
  const deduplicatedList = [];

  for (const item of rawCombined) {
    if (!item) continue;
    if (clearedSet.has(item.id) || (item.dedupeKey && clearedSet.has(item.dedupeKey))) {
      continue;
    }
    const catKey = normalizeNotificationCategory(item.category);
    if (notificationPreferences?.categories?.[catKey] === false) {
      continue;
    }
    const key = item.dedupeKey || item.id;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduplicatedList.push({
      ...item,
      read: readNotificationIds.includes(item.id),
    });
  }

  const notifications = groupInsightsNotifications(deduplicatedList).filter(
    (n) => n && !clearedSet.has(n.id) && (!n.dedupeKey || !clearedSet.has(n.dedupeKey))
  );

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  const markNotificationAsRead = async (notifId) => {
    if (!notifId || readNotificationIds.includes(notifId)) return;
    const next = [...readNotificationIds, notifId];
    setReadNotificationIds(next);
    await saveUserItem('read_notifications', next);
    markNotificationReadApi(notifId).catch(() => {});
  };

  const markAllNotificationsAsRead = async () => {
    const allIds = notifications.map((n) => n.id);
    setReadNotificationIds(allIds);
    await saveUserItem('read_notifications', allIds);
    markAllNotificationsReadApi(allIds).catch(() => {});
  };

  const removeNotification = async (notifId) => {
    if (!notifId) return;
    const targetItem =
      notifications.find((n) => n.id === notifId) ||
      deduplicatedList.find((n) => n.id === notifId) ||
      (activityNotifications || []).find((n) => n.id === notifId);

    const keysToClear = [notifId, targetItem?.id, targetItem?.dedupeKey].filter(Boolean);
    const nextCleared = Array.from(new Set([...(clearedNotificationIds || []), ...keysToClear]));
    setClearedNotificationIds(nextCleared);
    await saveUserItem('cleared_notifications', nextCleared);

    setActivityNotifications((prev) => {
      const filtered = (prev || []).filter(
        (n) => n && n.id !== notifId && (!targetItem?.dedupeKey || n.dedupeKey !== targetItem.dedupeKey)
      );
      saveUserItem('activity_notifications', filtered);
      return filtered;
    });

    markNotificationReadApi(notifId).catch(() => {});
  };

  const clearAllNotifications = async () => {
    const allKeys = [];
    for (const n of [...notifications, ...deduplicatedList, ...(activityNotifications || [])]) {
      if (!n) continue;
      if (n.id) allKeys.push(n.id);
      if (n.dedupeKey) allKeys.push(n.dedupeKey);
    }

    const nextCleared = Array.from(
      new Set([...(clearedNotificationIds || []), ...allKeys])
    ).slice(-500);
    setClearedNotificationIds(nextCleared);
    setActivityNotifications([]);
    setLiveGroupBanner(null);

    await Promise.all([
      saveUserItem('cleared_notifications', nextCleared),
      saveUserItem('activity_notifications', []),
    ]).catch(() => {});

    const allIds = notifications.map((n) => n.id).filter(Boolean);
    if (allIds.length > 0) {
      markAllNotificationsReadApi(allIds).catch(() => {});
    }
  };

  const sendTestSmartNotification = async () => {
    const testInApp = NotificationTemplates.aiSavingsOpportunity({
      id: 'notif-smart-' + Date.now(),
      savedPercent: savedPct,
      freeBalance: Math.max(0, totalBalance),
      month: selectedMonth,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    const sent = await sendInstantPhoneNotification({
      notification: testInApp,
      userId: loggedInUser?.id || 'guest',
      preferences: notificationPreferences,
      data: { type: 'manual_smart_test' },
    });

    setActivityNotifications((prev) => {
      const next = [testInApp, ...prev].slice(0, 25);
      saveUserItem('activity_notifications', next);
      return next;
    });

    return sent;
  };

  return (
    <FinanceContext.Provider
      value={{
        loaded,
        loggedInUser,
        setLoggedInUser,
        logout,
        deleteAccount,
        aiSkin,
        setAiSkin: updateAiSkin,
        notifications,
        unreadNotificationsCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        removeNotification,
        clearAllNotifications,
        sendTestSmartNotification,
        notificationPreferences,
        updateNotificationPreferences,
        liveGroupBanner,
        dismissLiveGroupBanner,
        transactions: filteredTransactions,
        allTransactions: transactions,
        accounts,
        cards,
        bills,
        cofrinhos,
        addCofrinho,
        depositCofrinho,
        removeCofrinho,
        askAiAboutCofrinho,
        heroCardMode,
        toggleHeroCardMode,
        totalFixedExpenses,
        totalVariableExpenses,
        fixedExpensesList,
        variableExpensesList,
        totalSalaryIncome,
        totalFreelanceIncome,
        totalOtherIncome,
        toggleBillPaid,
        addBill,
        updateBill,
        deleteBill,
        totalBillsAmount,
        paidBillsAmount,
        pendingBillsAmount,
        allBillsPaid,
        categoryBreakdown,
        economizadoPercent,
        resultadoDoMes,
        activeMember,
        members,
        aiChat,
        totalBalance,
        totalIncome,
        totalExpense,
        selectedMonth,
        setSelectedMonth,
        hideBalances,
        toggleHideBalances,
        addTransaction,
        addTransactionsBatch,
        editTransaction,
        removeTransaction,
        updateAccountBalance,
        addAccount,
        updateAccount,
        removeAccount,
        addCard,
        updateCard,
        removeCard,
        loadDemoData,
        clearAllData,
        switchActiveMember,
        updateMembersNames,
        sendAiMessage,
        processReceiptMedia,
        processPdfInvoice,
        processAudioMessage,
        postgresStatus,
        isSyncingPostgres,
        syncWithPostgres,
        refreshHomeData,
        refreshGroupData,
        isRefreshingHome,
        isRefreshingGroup,
        homeRefreshError,
        groupRefreshError,
        clearHomeRefreshError,
        clearGroupRefreshError,
        openGroupBalance,
        totalSharedGrossExpense,
        activeGroupSettledTotal,
        activeGroupSettlements,
        testPostgresConnection,
        updateUserProfile,
        viewMode,
        setViewMode,
        sharedGroups,
        activeGroupId,
        setActiveGroupId,
        groupInvitations,
        settlements,
        createSharedGroup,
        generateNewGroupInviteCode,
        deleteSharedGroup,
        leaveSharedGroup,
        kickMemberFromGroup,
        isGroupCreator,
        invitePersonToGroup,
        acceptGroupInvitation,
        addSharedExpense,
        recordSettlement,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance deve ser usado dentro de FinanceProvider');
  return ctx;
}
