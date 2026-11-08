import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  createCreditCard as apiCreateCreditCard,
  createAccount as apiCreateAccount,
  logoutUser,
  deleteUserAccountApi,
  clearAuthSession,
  getStoredUser,
  getStoredToken,
  saveAuthUser,
  fetchCurrentHouseholdApi,
  createHouseholdApi,
  createHouseholdInvitationApi,
  acceptHouseholdInvitationApi,
  generateHouseholdInviteCodeApi,
  deleteHouseholdApi,
  leaveHouseholdApi,
} from '../services/apiService';
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
  const [loaded, setLoaded] = useState(false);

  // Helper para persistir dados no namespace isolado do usuário conectado (Ambiente Separado)
  const saveUserItem = async (keyName, val) => {
    const uid = loggedInUser?.id;
    if (!uid) return;
    const key = getUserStorageKey(uid, keyName);
    const str = typeof val === 'string' ? val : JSON.stringify(val);
    await AsyncStorage.setItem(key, str);
  };

  // 1. Inicialização: Verifica se já existe uma sessão de autenticação ativa salva
  useEffect(() => {
    async function initSession() {
      try {
        const storedUser = await getStoredUser();
        const storedToken = await getStoredToken();
        if (storedUser && storedToken) {
          const uName = storedUser.fullName || storedUser.name || '';
          const normalized = { ...storedUser, name: uName };
          setLoggedInUser(normalized);
          if (uName) {
            setMembers((prev) => ({ ...prev, user1: uName }));
            setActiveMember(uName);
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
        ] = await Promise.all([
          AsyncStorage.getItem(getUserStorageKey(uid, 'transactions')),
          AsyncStorage.getItem(getUserStorageKey(uid, 'accounts')),
          AsyncStorage.getItem(getUserStorageKey(uid, 'cards')),
          AsyncStorage.getItem(getUserStorageKey(uid, 'bills')),
          AsyncStorage.getItem(getUserStorageKey(uid, 'cofrinhos')),
          AsyncStorage.getItem(getUserStorageKey(uid, 'ai_chat')),
          AsyncStorage.getItem(getUserStorageKey(uid, 'members_names')),
          AsyncStorage.getItem(getUserStorageKey(uid, 'hide_balances')),
          AsyncStorage.getItem(getUserStorageKey(uid, 'hero_view_mode')),
          AsyncStorage.getItem(getUserStorageKey(uid, 'ai_skin')),
          AsyncStorage.getItem(getUserStorageKey(uid, 'shared_groups')),
          AsyncStorage.getItem(getUserStorageKey(uid, 'active_group_id')),
          AsyncStorage.getItem(getUserStorageKey(uid, 'group_invitations')),
          AsyncStorage.getItem(getUserStorageKey(uid, 'settlements')),
          AsyncStorage.getItem(getUserStorageKey(uid, 'view_mode')),
        ]);

        const parsedTrans = savedTrans ? JSON.parse(savedTrans) : [];
        let parsedAccs = savedAccs ? JSON.parse(savedAccs) : [];

        // Se o usuário tem movimentações (ex: Salário), mas ainda não possui nenhuma conta bancária cadastrada,
        // cria automaticamente uma "Conta Principal" com o saldo resultante para abrigar esse dinheiro
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
          };
          parsedAccs = [autoAcc];
          saveUserItem('accounts', parsedAccs);

          const updatedTrans = parsedTrans.map((t) =>
            t.accountId ? t : { ...t, accountId: autoAcc.id }
          );
          setTransactions(updatedTrans);
          saveUserItem('transactions', updatedTrans);
        } else {
          setTransactions(parsedTrans);
        }
        setAccounts(parsedAccs);
        setCards(savedCards ? JSON.parse(savedCards) : []);
        setBills(savedBills ? JSON.parse(savedBills) : []);
        setCofrinhos(savedCofs ? JSON.parse(savedCofs) : []);
        setAiChat(savedChat ? JSON.parse(savedChat) : getInitialChat(loggedInUser.name));
        if (savedNames) setMembers(JSON.parse(savedNames));
        if (savedHide) setHideBalances(JSON.parse(savedHide));
        if (savedHeroMode) setHeroCardMode(JSON.parse(savedHeroMode));
        if (savedSkin) setAiSkin(savedSkin);

        let parsedGroups = savedGroups ? JSON.parse(savedGroups) : [];
        if (!parsedGroups || parsedGroups.length === 0) {
          const ownerName = loggedInUser?.fullName || loggedInUser?.name || 'Você';
          const defaultGroup = {
            id: 'grp-casal-default',
            name: 'Finanças do Casal',
            type: 'Casal',
            description: 'Espaço compartilhado do casal',
            createdAt: new Date().toISOString(),
            inviteCode: generateGroupInviteCode(),
            inviteCodeExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            members: [
              { id: loggedInUser?.id || 'admin', name: ownerName, email: loggedInUser?.email || '', role: 'ADMIN' },
              { id: 'partner', name: 'Parceiro(a)', email: '', role: 'MEMBER' },
            ],
          };
          parsedGroups = [defaultGroup];
          saveUserItem('shared_groups', parsedGroups);
        }
        setSharedGroups(parsedGroups);
        const resolvedActiveId = savedActiveGrpId && parsedGroups.some((g) => g.id === savedActiveGrpId)
          ? savedActiveGrpId
          : parsedGroups[0]?.id;
        setActiveGroupIdState(resolvedActiveId);
        if (resolvedActiveId) saveUserItem('active_group_id', resolvedActiveId);

        if (savedInvs) setGroupInvitations(JSON.parse(savedInvs));
        if (savedSettles) setSettlements(JSON.parse(savedSettles));
        if (savedMode) setViewModeState(savedMode);

        // Dispara sincronização silenciosa para obter cartões/contas do PostgreSQL deste usuário
        syncWithPostgres();
      } catch (e) {
        console.warn('Erro ao carregar dados locais do usuário:', e);
      }
    }

    if (loaded) {
      loadUserData();
    }
  }, [loggedInUser?.id, loaded]);

  // Sincronização bi-direcional com PostgreSQL da VPS
  const syncWithPostgres = async () => {
    if (isSyncingPostgres || !loggedInUser?.id) return;
    setIsSyncingPostgres(true);
    try {
      const res = await syncDatabaseWithPostgres({
        localCards: cards,
        localAccounts: accounts,
        localTransactions: transactions,
      });

      if (res.success) {
        // 1. Atualizar cartões se retornados do PostgreSQL para este usuário
        if (res.remoteCards && res.remoteCards.length > 0) {
          const mappedCards = res.remoteCards.map((rc) => {
            const theme = getBankTheme(rc.name);
            const limit = parseFloat(rc.creditLimit) || 0;
            const currentBill = rc.currentBill ? parseFloat(rc.currentBill.totalAmount) || 0 : 0;
            const usedPercent = limit > 0 ? Math.round((currentBill / limit) * 100) : 0;
            return {
              id: rc.id,
              name: rc.name,
              bank: rc.name,
              bankId: theme.bankId,
              holderName: rc.holderName || loggedInUser?.name || 'TITULAR',
              lastFourDigits: rc.lastFourDigits || '••••',
              expiryMonth: rc.expiryMonth || '12',
              expiryYear: rc.expiryYear || '28',
              limit,
              currentInvoice: currentBill,
              closingDay: rc.closingDay || 3,
              dueDay: rc.dueDay || 10,
              dueDateText: `Vence dia ${rc.dueDay || 10}`,
              status: 'Em aberto',
              usedPercent,
              color: rc.colorHex || theme.gradientColors[0],
              logoType: theme.bankId,
              owner: loggedInUser?.name || 'Titular',
            };
          });
          setCards(mappedCards);
          saveUserItem('cards', mappedCards);
        }

        // 2. Atualizar contas se retornadas do PostgreSQL para este usuário
        if (res.remoteAccounts && res.remoteAccounts.length > 0) {
          const mappedAccs = res.remoteAccounts.map((ra) => ({
            id: ra.id,
            name: ra.name,
            bank: ra.name,
            balance: parseFloat(ra.currentBalance) || 0,
            owner: loggedInUser?.name || 'Titular',
            icon: 'wallet-outline',
            color: ra.colorHex || '#820AD1',
          }));
          setAccounts(mappedAccs);
          saveUserItem('accounts', mappedAccs);
        }

        // 3. Atualizar transações se retornadas do PostgreSQL para este usuário
        if (res.remoteTransactions && res.remoteTransactions.length > 0) {
          const mappedTxs = res.remoteTransactions.map((rt) => ({
            id: rt.id,
            description: rt.description,
            amount: parseFloat(rt.amount) || 0,
            type: (rt.type || 'EXPENSE').toLowerCase() === 'income' ? 'income' : 'expense',
            category: rt.category?.name || 'outros',
            author: loggedInUser?.name || 'Titular',
            date: rt.date ? rt.date.split('T')[0] : new Date().toISOString().split('T')[0],
            createdAt: rt.createdAt || new Date().toISOString(),
            accountId: rt.accountId,
            creditCardId: rt.creditCardId,
            notes: rt.notes || '',
          }));

          setTransactions(mappedTxs);
          saveUserItem('transactions', mappedTxs);
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

  // Disparo silencioso de sincronização com PostgreSQL na inicialização
  useEffect(() => {
    if (loaded) {
      syncWithPostgres();
    }
  }, [loaded]);

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
      setAccounts((prev) => {
        const updated = prev.map((a) => (a.id === fromAccountId ? { ...a, balance: (a.balance || 0) - num } : a));
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
      };
      currentAccs = [defaultAcc];
    }

    const defaultAccId = currentAccs[0].id;

    const newTxs = txDataArray.map((txData, idx) => ({
      id: txData.id || `tx-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      description: txData.description,
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
      createdAt: txData.createdAt || new Date().toISOString(),
      accountId: txData.accountId || defaultAccId,
      notes: txData.notes || '',
    }));

    // Atualiza estado de transações e armazenamento isolado
    setTransactions((prev) => {
      const nextList = [...newTxs, ...prev];
      saveUserItem('transactions', nextList);
      return nextList;
    });

    // Atualiza saldo da conta bancária para cada movimentação
    const updatedAccs = currentAccs.map((acc) => {
      let delta = 0;
      for (const tx of newTxs) {
        if (tx.accountId === acc.id) {
          delta += tx.type === 'income' ? tx.amount : -tx.amount;
        }
      }
      if (delta !== 0) {
        return { ...acc, balance: (acc.balance || 0) + delta };
      }
      return acc;
    });

    setAccounts(updatedAccs);
    saveUserItem('accounts', updatedAccs);

    for (const tx of newTxs) {
      syncTransactionToAppwrite(tx).catch(() => {});
      apiCreateTransaction(tx).catch((e) => console.log('Offline queue for Postgres tx:', e.message));
    }

    return newTxs;
  };

  // Adicionar transação individual
  const addTransaction = async (txData) => {
    const [created] = await addTransactionsBatch([txData]);
    return created;
  };

  // Editar transação
  const editTransaction = async (updatedTx) => {
    const oldTx = transactions.find((t) => t.id === updatedTx.id);
    if (!oldTx) return;

    const nextList = transactions.map((t) => (t.id === updatedTx.id ? updatedTx : t));
    setTransactions(nextList);
    await saveUserItem('transactions', nextList);

    if (oldTx.amount !== updatedTx.amount || oldTx.type !== updatedTx.type) {
      setAccounts((prev) => {
        const updated = prev.map((acc) => {
          if (acc.id === updatedTx.accountId) {
            const oldDelta = oldTx.type === 'income' ? -oldTx.amount : oldTx.amount;
            const newDelta = updatedTx.type === 'income' ? updatedTx.amount : -updatedTx.amount;
            return { ...acc, balance: (acc.balance || 0) + oldDelta + newDelta };
          }
          return acc;
        });
        saveUserItem('accounts', updated);
        return updated;
      });
    }

    syncTransactionToAppwrite(updatedTx).catch(() => {});
  };

  // Remover transação
  const removeTransaction = async (id) => {
    const target = transactions.find((t) => t.id === id);
    const nextList = transactions.filter((t) => t.id !== id);
    setTransactions(nextList);
    await saveUserItem('transactions', nextList);

    if (target) {
      setAccounts((prev) => {
        const updated = prev.map((acc) => {
          if (acc.id === target.accountId) {
            const delta = target.type === 'income' ? -target.amount : target.amount;
            return { ...acc, balance: (acc.balance || 0) + delta };
          }
          return acc;
        });
        saveUserItem('accounts', updated);
        return updated;
      });
    }
  };

  const updateAccountBalance = async (accId, newBalance) => {
    setAccounts((prev) => {
      const updated = prev.map((acc) =>
        acc.id === accId ? { ...acc, balance: parseFloat(newBalance) || 0 } : acc
      );
      saveUserItem('accounts', updated);
      return updated;
    });
  };

  // Gestão de Contas Reais
  const addAccount = async (accountData) => {
    const newAcc = {
      id: 'acc-' + Date.now(),
      name: accountData.name || 'Nova Conta',
      bank: accountData.bank || accountData.name || 'Banco',
      balance: parseFloat(accountData.balance) || 0,
      owner: accountData.owner || loggedInUser?.name || 'Titular',
      icon: accountData.icon || 'wallet-outline',
      color: accountData.color || '#0E2F5A',
    };
    const nextAccs = [...accounts, newAcc];
    setAccounts(nextAccs);
    await saveUserItem('accounts', nextAccs);
    apiCreateAccount(newAcc).catch((e) => console.log('Offline queue for Postgres acc:', e.message));
    return newAcc;
  };

  const updateAccount = async (accId, updatedData) => {
    const nextAccs = accounts.map((acc) =>
      acc.id === accId
        ? {
            ...acc,
            ...updatedData,
            balance:
              updatedData.balance !== undefined
                ? parseFloat(updatedData.balance) || 0
                : acc.balance,
          }
        : acc
    );
    setAccounts(nextAccs);
    await saveUserItem('accounts', nextAccs);
  };

  const removeAccount = async (accId) => {
    const nextAccs = accounts.filter((acc) => acc.id !== accId);
    setAccounts(nextAccs);
    await saveUserItem('accounts', nextAccs);
  };

  const addCard = async (cardData) => {
    const theme = getBankTheme(cardData.bankId || cardData.bank || cardData.name);
    const newCard = {
      id: 'card-' + Date.now(),
      name: cardData.name || theme.name,
      bank: cardData.bank || theme.name,
      bankId: theme.bankId,
      holderName: cardData.holderName || loggedInUser?.name || 'TITULAR',
      lastFourDigits: cardData.lastFourDigits ? String(cardData.lastFourDigits).slice(-4) : '',
      expiryMonth: cardData.expiryMonth || '12',
      expiryYear: cardData.expiryYear || '28',
      limit: parseFloat(cardData.limit) || 0,
      currentInvoice: parseFloat(cardData.currentInvoice) || 0,
      dueDay: parseInt(cardData.dueDay, 10) || 10,
      dueDateText: cardData.dueDateText || `Vence dia ${cardData.dueDay || 10}`,
      status: cardData.status || 'Em aberto',
      usedPercent: cardData.usedPercent !== undefined ? cardData.usedPercent : 0,
      color: theme.gradientColors[0],
      logoType: theme.bankId,
      owner: cardData.owner || loggedInUser?.name || 'Titular',
    };
    const nextCards = [...cards, newCard];
    setCards(nextCards);
    await saveUserItem('cards', nextCards);
    apiCreateCreditCard(newCard).catch((e) => console.log('Offline queue for Postgres card:', e.message));
    return newCard;
  };

  const updateCard = async (cardId, updatedData) => {
    const nextCards = cards.map((c) => {
      if (c.id !== cardId) return c;
      const theme = getBankTheme(updatedData.bankId || updatedData.bank || c.bankId || c.bank);
      return {
        ...c,
        ...updatedData,
        bankId: theme.bankId,
        color: theme.gradientColors[0],
        logoType: theme.bankId,
      };
    });
    setCards(nextCards);
    await saveUserItem('cards', nextCards);
  };

  const removeCard = async (cardId) => {
    const nextCards = cards.filter((c) => c.id !== cardId);
    setCards(nextCards);
    await saveUserItem('cards', nextCards);
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
    await logoutUser().catch(() => {});
  };

  /**
   * Excluir Conta e Dados do Usuário (Diretriz Obrigatória Google Play Store)
   */
  const deleteAccount = async () => {
    const uid = loggedInUser?.id;
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
      ]).catch(() => {});
    }

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

    await deleteUserAccountApi().catch(() => {});
    await clearAuthSession();
  };

  // Atualização em tempo real do perfil do usuário logado
  const updateUserProfile = async (updates) => {
    if (!loggedInUser) return;
    const currentName = updates.fullName || updates.name || loggedInUser.fullName || loggedInUser.name;
    const updated = {
      ...loggedInUser,
      ...updates,
      name: currentName,
      fullName: currentName,
    };
    setLoggedInUser(updated);
    setMembers((prev) => ({ ...prev, user1: currentName }));
    if (activeMember === loggedInUser.name || activeMember === 'Principal' || !activeMember) {
      setActiveMember(currentName);
    }
    // Salva em ambas as chaves de storage para sincronização imediata
    await saveAuthUser(updated);
    await AsyncStorage.setItem('@finn_auth_user', JSON.stringify(updated));
    await saveUserItem('user_profile', updated);
    return updated;
  };

  // Alternador de Modo de Visualização: 'personal' | 'shared' | 'consolidated'
  const setViewMode = async (mode) => {
    setViewModeState(mode);
    await saveUserItem('view_mode', mode);
  };

  const setActiveGroupId = async (id) => {
    setActiveGroupIdState(id);
    await saveUserItem('active_group_id', id);
  };

  // Módulo Finanças Compartilhadas: Criar Grupo
  const createSharedGroup = async ({ name, type = 'Casal', description = '' }) => {
    const ownerName = loggedInUser?.fullName || loggedInUser?.name || 'Você';
    const cleanName = (name || '').trim() || 'Novo Grupo';
    const inviteCode = generateGroupInviteCode();
    const inviteCodeExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // Válido por 30 minutos

    const newGroup = {
      id: 'grp-' + Date.now(),
      name: cleanName,
      type: type || 'Outros',
      description: (description || '').trim(),
      createdAt: new Date().toISOString(),
      creatorId: loggedInUser?.id || 'admin',
      creatorEmail: (loggedInUser?.email || '').toLowerCase().trim(),
      creatorName: ownerName,
      inviteCode,
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

    try {
      const apiRes = await createHouseholdApi(cleanName);
      if (apiRes?.id) {
        newGroup.remoteId = apiRes.id;
      }
    } catch (e) {
      console.log('Grupo criado offline/localmente:', e.message);
    }

    const nextGroups = [newGroup, ...sharedGroups.filter((g) => g.id !== newGroup.id)];
    setSharedGroups(nextGroups);
    setActiveGroupIdState(newGroup.id);
    await saveUserItem('shared_groups', nextGroups);
    await saveUserItem('active_group_id', newGroup.id);
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
    if (!targetGroupId) return null;

    const newCode = generateGroupInviteCode();
    const newExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    try {
      const targetGroup = sharedGroups.find((g) => g.id === targetGroupId);
      if (targetGroup?.remoteId) {
        await generateHouseholdInviteCodeApi(targetGroup.remoteId);
      }
    } catch (e) {
      console.log('Renovação de código local/offline:', e.message);
    }

    const updatedGroups = sharedGroups.map((g) => {
      if (g.id === targetGroupId) {
        return {
          ...g,
          inviteCode: newCode,
          inviteCodeExpiresAt: newExpiresAt,
        };
      }
      return g;
    });

    setSharedGroups(updatedGroups);
    await saveUserItem('shared_groups', updatedGroups);

    return {
      inviteCode: newCode,
      inviteCodeExpiresAt: newExpiresAt,
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

    return {
      success: true,
      message: `Você saiu do grupo '${targetGroup.name}' com sucesso. O criador foi notificado.`,
    };
  };

  // Convidar Pessoa para o Grupo Compartilhado
  const invitePersonToGroup = async ({ groupId, email, type = 'Casal', message = '' }) => {
    const code = generateGroupInviteCode();
    const targetGroupId = groupId || activeGroupId || sharedGroups[0]?.id;
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
    return inv;
  };

  // Aceitar Convite de Grupo via Código (Validação rigorosa de expiração de 30 minutos)
  const acceptGroupInvitation = async (rawCode) => {
    const code = (rawCode || '').trim().toUpperCase();
    if (!code) {
      throw new Error('Informe o código do convite.');
    }

    try {
      await acceptHouseholdInvitationApi(code);
    } catch (e) {
      console.log('Ingresso offline/local:', e.message);
    }

    // Busca se existe algum grupo cadastrado com este código
    const matchingGroup = sharedGroups.find(
      (g) => g.inviteCode && g.inviteCode.toUpperCase() === code
    );

    if (matchingGroup) {
      // Validação do prazo de 30 minutos
      if (matchingGroup.inviteCodeExpiresAt) {
        const expiresTime = new Date(matchingGroup.inviteCodeExpiresAt).getTime();
        if (Date.now() > expiresTime) {
          throw new Error('Este código de convite expirou (validade de 30 minutos). Solicite um novo código ao administrador do grupo.');
        }
      }

      // Verifica se já participa deste grupo
      const isAlreadyMember = matchingGroup.members?.some(
        (m) => m.id === loggedInUser?.id || (loggedInUser?.email && m.email === loggedInUser.email)
      );
      if (isAlreadyMember) {
        throw new Error('Você já faz parte deste grupo financeiro.');
      }

      const myMember = {
        id: loggedInUser?.id || 'm-' + Date.now(),
        name: loggedInUser?.fullName || loggedInUser?.name || 'Novo Membro',
        email: loggedInUser?.email || '',
        role: 'MEMBER',
        joinedAt: new Date().toISOString(),
      };

      const updatedGroups = sharedGroups.map((g) => {
        if (g.id === matchingGroup.id) {
          return {
            ...g,
            members: [...(g.members || []), myMember],
          };
        }
        return g;
      });

      setSharedGroups(updatedGroups);
      setActiveGroupIdState(matchingGroup.id);
      await saveUserItem('shared_groups', updatedGroups);
      await saveUserItem('active_group_id', matchingGroup.id);
      return matchingGroup;
    }

    // Caso não seja um grupo local (ex: recebido de outro usuário), cria o ingresso no grupo
    const joinedGroup = {
      id: 'grp-joined-' + Date.now(),
      name: 'Grupo Compartilhado',
      type: 'Casal',
      description: `Ingresso via código ${code}`,
      createdAt: new Date().toISOString(),
      inviteCode: code,
      inviteCodeExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      members: [
        { id: 'admin-partner', name: 'Organizador(a)', email: '', role: 'ADMIN' },
        { id: loggedInUser?.id || 'me', name: loggedInUser?.name || 'Você', email: loggedInUser?.email || '', role: 'MEMBER' },
      ],
    };

    const nextGroups = [joinedGroup, ...sharedGroups.filter((g) => g.id !== joinedGroup.id)];
    setSharedGroups(nextGroups);
    setActiveGroupIdState(joinedGroup.id);
    await saveUserItem('shared_groups', nextGroups);
    await saveUserItem('active_group_id', joinedGroup.id);
    return joinedGroup;
  };

  // Lançar Despesa Compartilhada
  const addSharedExpense = async (expData) => {
    const payer = expData.paidBy || loggedInUser?.name || 'Você';
    const splitRatio = expData.splitMethod === 'equal' ? 0.5 : parseFloat(expData.splitRatio) || 0.5;
    const targetGroupId = expData.groupId || activeGroupId || sharedGroups[0]?.id;
    const targetGroup = sharedGroups.find((g) => g.id === targetGroupId);

    const newTx = {
      id: 'tx-shared-' + Date.now(),
      description: expData.description,
      title: expData.description,
      amount: parseFloat(expData.amount) || 0,
      type: expData.type || 'expense',
      category: expData.category || 'alimentacao',
      date: expData.date || new Date().toISOString().split('T')[0],
      author: payer,
      paidBy: payer,
      isShared: true,
      groupId: targetGroupId,
      sharedGroupId: targetGroupId,
      groupName: targetGroup?.name || null,
      splitMethod: expData.splitMethod || 'equal',
      splitRatio: splitRatio,
      notes: expData.notes || '',
    };

    const nextTxs = [newTx, ...transactions];
    setTransactions(nextTxs);
    await saveUserItem('transactions', nextTxs);
    return newTx;
  };

  // Registrar Acerto de Contas
  const recordSettlement = async (settlementData) => {
    const newSettlement = {
      id: 'set-' + Date.now(),
      groupId: settlementData.groupId || activeGroupId,
      fromMember: settlementData.fromMember,
      toMember: settlementData.toMember,
      amount: parseFloat(settlementData.amount) || 0,
      notes: settlementData.notes || '',
      date: new Date().toISOString(),
      status: 'COMPLETED',
    };

    const nextSettlements = [newSettlement, ...settlements];
    setSettlements(nextSettlements);
    await saveUserItem('settlements', nextSettlements);
    return newSettlement;
  };

  // Cálculos financeiros consolidados com suporte a Contexto/Modo de Visualização:
  // 'personal' (Minhas finanças) | 'shared' (Finanças compartilhadas) | 'consolidated' (Visão consolidada)
  const currentUserName = loggedInUser?.fullName || loggedInUser?.name || members?.user1 || 'Principal';

  const filteredTransactions = transactions.filter((t) => {
    if (viewMode === 'shared') {
      const gId = t.groupId || t.sharedGroupId;
      if (!gId) {
        return !!t.isShared && (!activeGroupId || !sharedGroups.length || activeGroupId === sharedGroups[0]?.id);
      }
      return !!t.isShared && gId === activeGroupId;
    }
    if (viewMode === 'personal') {
      return !t.isShared && !t.groupId;
    }
    // 'consolidated'
    return true;
  });

  const txIncome = filteredTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalExpense = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => {
      if (viewMode === 'consolidated' && t.isShared) {
        const ratio = t.splitRatio !== undefined ? t.splitRatio : 0.5;
        return sum + ((t.amount || 0) * ratio);
      }
      return sum + (t.amount || 0);
    }, 0);

  const accountsBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  // A entrada deve ser referente ao saldo das contas quando há contas cadastradas (no modo pessoal)
  const totalIncome = viewMode === 'shared'
    ? txIncome
    : accounts.length > 0
    ? (accountsBalance > 0 ? accountsBalance : (txIncome || 0))
    : txIncome;

  // Saldo totalmente isolado: no modo compartilhado é estritamente o resultado do grupo ativo
  const totalBalance = viewMode === 'shared'
    ? (txIncome - totalExpense)
    : accounts.length > 0
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
    if (!rawText) return { cleanText: '', transactions: [] };

    const regex = /\[TRANSACTION:\s*(\{[\s\S]*?\})\]/gi;
    const matches = [...rawText.matchAll(regex)];
    const txDataToCreate = [];

    for (const match of matches) {
      try {
        const jsonStr = match[1].replace(/\r?\n/g, ' ').trim();
        const parsed = JSON.parse(jsonStr);
        if (parsed && parsed.amount) {
          txDataToCreate.push({
            description: parsed.description || 'Movimentação via IA',
            amount: parseFloat(parsed.amount) || 0,
            type: parsed.type === 'income' ? 'income' : 'expense',
            category: parsed.category || 'outros',
            author: parsed.author || defaultAuthor,
          });
        }
      } catch (err) {
        console.warn('Erro ao processar tag TRANSACTION:', err);
      }
    }

    const createdList = txDataToCreate.length > 0
      ? await addTransactionsBatch(txDataToCreate)
      : [];

    const cleanText =
      rawText.replace(/\[TRANSACTION:\s*\{[\s\S]*?\}\]/gi, '').trim() ||
      (createdList.length > 0
        ? `Prontinho! Registrei ${createdList.length === 1 ? 'o lançamento' : `os ${createdList.length} lançamentos`} no extrato.`
        : rawText);

    return {
      cleanText,
      transactions: createdList,
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
      recentTransactions: transactions.slice(0, 5),
    };

    let aiReplyText = '';
    let createdTxs = [];

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
    };

    const finalChat = [...nextChat, aiMsg];
    setAiChat(finalChat);
    await saveUserItem('ai_chat', finalChat);
    return { text: aiReplyText, transaction: createdTxs[0] || null, transactions: createdTxs };
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
    } catch (e) {
      aiReplyText = `Erro ao ler comprovante: ${e.message}`;
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

    let aiReplyText = '';
    let createdTxs = [];

    try {
      const uName = loggedInUser?.name || 'Você';
      const raw = await analyzeVoiceAudio({
        base64Audio,
        mimeType,
        financialContext: { totalBalance, totalIncome, totalExpense, userName: uName },
        aiSkinId: aiSkin,
      });

      const parsedResult = await parseAndRegisterAiTransactions(
        raw,
        uName
      );
      createdTxs = parsedResult.transactions;
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
    };

    const finalChat = [...nextChat, aiMsg];
    setAiChat(finalChat);
    await saveUserItem('ai_chat', finalChat);
    return { text: aiReplyText, transaction: createdTxs[0] || null, transactions: createdTxs };
  };

  const updateAiSkin = async (skinId) => {
    setAiSkin(skinId);
    await saveUserItem('ai_skin', skinId);
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
