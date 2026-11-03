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
import { getBankTheme } from '../constants/BankThemeRegistry';

const FinanceContext = createContext(null);

const STORAGE_KEYS = {
  TRANSACTIONS: '@finn_transactions_v5',
  ACCOUNTS: '@finn_accounts_v5',
  CARDS: '@finn_cards_v5',
  BILLS: '@finn_bills_v5',
  COFRINHOS: '@finn_cofrinhos_v5',
  MEMBER: '@finn_active_member_v5',
  AI_CHAT: '@finn_ai_chat_v5',
  MEMBERS_NAMES: '@finn_members_names_v5',
  HIDE_BALANCES: '@finn_hide_balances_v5',
  HERO_VIEW_MODE: '@finn_hero_view_mode_v5',
  IS_DEMO: '@finn_is_demo_mode_v5',
  AI_SKIN: '@finn_ai_skin_v1',
};

// Contas reais para o casal (Inicia com saldo R$ 0,00 para dados reais)
const INITIAL_ACCOUNTS = [
  { id: 'acc-1', name: 'Conta Corrente', bank: 'Nubank', balance: 0.00, owner: 'Casal', icon: 'wallet-outline', color: '#820AD1' },
];

// Cartões reais para faturas do casal (conforme Print dos Cartões)
const INITIAL_CARDS = [
  {
    id: 'card-nu',
    name: 'Nubank',
    bank: 'Nubank',
    bankId: 'nubank',
    holderName: 'LUCAS SILVA',
    lastFourDigits: '4568',
    expiryMonth: '10',
    expiryYear: '26',
    limit: 5000.00,
    currentInvoice: 579.60,
    dueDay: 10,
    dueDateText: 'Vence em 10/11/2026',
    status: 'Em aberto',
    usedPercent: 36,
    color: '#820AD1',
    logoType: 'nu',
    owner: 'Casal',
  },
  {
    id: 'card-c6',
    name: 'C6 Bank',
    bank: 'C6 Bank',
    bankId: 'c6',
    holderName: 'LUCAS SILVA',
    lastFourDigits: '4568',
    expiryMonth: '11',
    expiryYear: '26',
    limit: 4000.00,
    currentInvoice: 21.90,
    dueDay: 22,
    dueDateText: 'Vence em 22/11/2026',
    status: 'Em aberto',
    usedPercent: 2,
    color: '#242424',
    logoType: 'c6',
    owner: 'Casal',
  },
  {
    id: 'card-itau',
    name: 'Itaú',
    bank: 'Itaú',
    bankId: 'itau',
    holderName: 'LUCAS SILVA',
    lastFourDigits: '4568',
    expiryMonth: '08',
    expiryYear: '27',
    limit: 3500.00,
    currentInvoice: 0.00,
    dueDay: 15,
    dueDateText: 'Vence em 15/11/2026',
    status: 'Em aberto',
    usedPercent: 0,
    color: '#EC7000',
    logoType: 'itau',
    owner: 'Casal',
  },
];

// Contas e faturas mensais (conforme Print da Agenda do Mês)
const INITIAL_BILLS = [
  {
    id: 'bill-c6',
    title: 'C6 Bank',
    subtext: 'Fatura paga · venceu 22 out',
    amount: 99.90,
    paid: true,
    dueDay: 22,
    category: 'cartao',
    icon: 'card',
    iconColor: '#18181B',
    type: 'fatura',
    isRecurring: false,
  },
  {
    id: 'bill-seguro',
    title: 'Seguro do carro',
    subtext: 'Pago · 12 out',
    amount: 210.00,
    paid: true,
    dueDay: 12,
    category: 'transporte',
    icon: 'car',
    iconColor: '#7C3AED',
    isRecurring: true,
  },
  {
    id: 'bill-net',
    title: 'Internet',
    subtext: 'Pago · 10 out',
    amount: 120.00,
    paid: true,
    dueDay: 10,
    category: 'moradia',
    icon: 'home',
    iconColor: '#3B82F6',
    isRecurring: true,
  },
  {
    id: 'bill-nu',
    title: 'Nubank',
    subtext: 'Fatura paga · venceu 10 out',
    amount: 851.30,
    paid: true,
    dueDay: 10,
    category: 'cartao',
    icon: 'card',
    iconColor: '#820AD1',
    type: 'fatura',
    isRecurring: false,
  },
  {
    id: 'bill-aluguel',
    title: 'Aluguel',
    subtext: 'Pago · 5 out',
    amount: 1450.00,
    paid: true,
    dueDay: 5,
    category: 'moradia',
    icon: 'home',
    iconColor: '#3B82F6',
    isRecurring: true,
  },
];
const INITIAL_TRANSACTIONS = [];

// Cofrinhos / Metas Financeiras (conforme Print 1 do usuário)
const INITIAL_COFRINHOS = [
  {
    id: 'cof-1',
    title: 'Carro',
    targetAmount: 80000.00,
    currentAmount: 41000.00,
    deadline: 'Sem prazo',
    icon: 'car-sport-outline',
    emoji: '🚗',
    color: '#06B6D4',
    notes: 'Meta para compra / troca de carro do casal',
  },
];

// Categorias Oficiais idênticas ao Print 4 do usuário
export const CATEGORIES = [
  { id: 'sem_categoria', label: 'Sem categoria', icon: 'help-circle-outline', emoji: '✓', color: '#94A3B8', budget: 300.00 },
  { id: 'alimentacao', label: 'Alimentação', icon: 'restaurant-outline', emoji: '🍔', color: '#F97316', budget: 1200.00 },
  { id: 'assinaturas', label: 'Assinaturas', icon: 'repeat-outline', emoji: '🔁', color: '#8B5CF6', budget: 250.00 },
  { id: 'educacao', label: 'Educação', icon: 'school-outline', emoji: '📚', color: '#EC4899', budget: 500.00 },
  { id: 'financiamento', label: 'Financiamento', icon: 'card-outline', emoji: '💳', color: '#EAB308', budget: 1500.00 },
  { id: 'lazer', label: 'Lazer', icon: 'game-controller-outline', emoji: '🎮', color: '#10B981', budget: 400.00 },
  { id: 'moradia', label: 'Moradia', icon: 'home-outline', emoji: '🏠', color: '#3B82F6', budget: 2200.00 },
  { id: 'outros', label: 'Outros', icon: 'cube-outline', emoji: '📦', color: '#64748B', budget: 300.00 },
  { id: 'pets', label: 'Pets', icon: 'paw-outline', emoji: '🐾', color: '#F59E0B', budget: 350.00 },
  { id: 'presentes', label: 'Presentes', icon: 'gift-outline', emoji: '🎁', color: '#F43F5E', budget: 200.00 },
  { id: 'receita', label: 'Receita', icon: 'cash-outline', emoji: '💰', color: '#10B981', budget: 0 },
  { id: 'saude', label: 'Saúde', icon: 'medkit-outline', emoji: '💊', color: '#EF4444', budget: 400.00 },
  { id: 'transporte', label: 'Transporte', icon: 'car-sport-outline', emoji: '🚗', color: '#06B6D4', budget: 600.00 },
  { id: 'vestuario', label: 'Vestuário', icon: 'shirt-outline', emoji: '👕', color: '#6366F1', budget: 350.00 },
  { id: 'viagem', label: 'Viagem', icon: 'airplane-outline', emoji: '✈️', color: '#14B8A6', budget: 800.00 },
];

export function FinanceProvider({ children }) {
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS);
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);
  const [cards, setCards] = useState(INITIAL_CARDS);
  const [bills, setBills] = useState(INITIAL_BILLS);
  const [cofrinhos, setCofrinhos] = useState(INITIAL_COFRINHOS);
  const [heroCardMode, setHeroCardMode] = useState('balance'); // 'balance' (Saldo em Contas) | 'monthResult' (Resultado do Mês)
  const [activeMember, setActiveMember] = useState('Casal'); // 'Casal' | 'Lucas' | 'Veronica'
  const [members, setMembers] = useState({ user1: 'Lucas', user2: 'Veronica' });
  const [selectedMonth, setSelectedMonth] = useState('Outubro 2026');
  const [hideBalances, setHideBalances] = useState(false);
  const [aiSkin, setAiSkin] = useState('estrategista'); // 'estrategista' | 'direto' | 'poupador' | 'investidor' | 'casal'
  const [loggedInUser, setLoggedInUser] = useState({ id: 'user-lucas', name: 'Lucas', email: 'lucas@finn.local' });
  
  const [aiChat, setAiChat] = useState([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Olá! Sou o FINN AI, o consultor financeiro do casal Lucas e Veronica. Estou analisando as finanças de outubro. Podem me mandar mensagens, fotos de comprovantes ou áudio de voz com seus gastos!',
      time: '17:02',
    },
  ]);
  const [loaded, setLoaded] = useState(false);

  // Carregar dados salvos
  useEffect(() => {
    async function loadStored() {
      try {
        const [
          savedTrans,
          savedAccs,
          savedCards,
          savedBills,
          savedCofs,
          savedMember,
          savedChat,
          savedNames,
          savedHide,
          savedHeroMode,
          savedSession,
          savedSkin,
        ] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS),
          AsyncStorage.getItem(STORAGE_KEYS.ACCOUNTS),
          AsyncStorage.getItem(STORAGE_KEYS.CARDS),
          AsyncStorage.getItem(STORAGE_KEYS.BILLS),
          AsyncStorage.getItem(STORAGE_KEYS.COFRINHOS),
          AsyncStorage.getItem(STORAGE_KEYS.MEMBER),
          AsyncStorage.getItem(STORAGE_KEYS.AI_CHAT),
          AsyncStorage.getItem(STORAGE_KEYS.MEMBERS_NAMES),
          AsyncStorage.getItem(STORAGE_KEYS.HIDE_BALANCES),
          AsyncStorage.getItem(STORAGE_KEYS.HERO_VIEW_MODE),
          getStoredSession(),
          AsyncStorage.getItem(STORAGE_KEYS.AI_SKIN),
        ]);

        if (savedTrans) setTransactions(JSON.parse(savedTrans));
        if (savedAccs) setAccounts(JSON.parse(savedAccs));
        if (savedCards) {
          const parsedCards = JSON.parse(savedCards);
          setCards(parsedCards && parsedCards.length > 0 ? parsedCards : INITIAL_CARDS);
        } else {
          setCards(INITIAL_CARDS);
        }

        if (savedBills) {
          const parsedBills = JSON.parse(savedBills);
          setBills(parsedBills && parsedBills.length > 0 ? parsedBills : INITIAL_BILLS);
        } else {
          setBills(INITIAL_BILLS);
        }
        if (savedCofs) setCofrinhos(JSON.parse(savedCofs));
        if (savedMember) setActiveMember(savedMember);
        if (savedChat) setAiChat(JSON.parse(savedChat));
        if (savedNames) setMembers(JSON.parse(savedNames));
        if (savedHide) setHideBalances(JSON.parse(savedHide));
        if (savedHeroMode) setHeroCardMode(JSON.parse(savedHeroMode));
        if (savedSession) setLoggedInUser(savedSession);
        if (savedSkin) setAiSkin(savedSkin);
      } catch (e) {
        console.warn('Erro ao carregar dados locais:', e);
      } finally {
        setLoaded(true);
      }
    }
    loadStored();
  }, []);

  const toggleHideBalances = async () => {
    const nextVal = !hideBalances;
    setHideBalances(nextVal);
    await AsyncStorage.setItem(STORAGE_KEYS.HIDE_BALANCES, JSON.stringify(nextVal));
  };

  const toggleHeroCardMode = async () => {
    const nextMode = heroCardMode === 'balance' ? 'monthResult' : 'balance';
    setHeroCardMode(nextMode);
    await AsyncStorage.setItem(STORAGE_KEYS.HERO_VIEW_MODE, JSON.stringify(nextMode));
  };

  // Alternar status de conta paga (Paga vs Pendente)
  const toggleBillPaid = async (billId) => {
    const nextBills = bills.map((b) => (b.id === billId ? { ...b, paid: !b.paid } : b));
    setBills(nextBills);
    await AsyncStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(nextBills));
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
        subtext: isPaid ? `Pago · ${dueDay} out` : `Vence dia ${dueDay}`,
      };
    });
    setBills(nextBills);
    await AsyncStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(nextBills));
  };

  // Excluir conta da agenda
  const deleteBill = async (billId) => {
    const nextBills = bills.filter((b) => b.id !== billId);
    setBills(nextBills);
    await AsyncStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(nextBills));
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
    await AsyncStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(nextBills));
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
    await AsyncStorage.setItem(STORAGE_KEYS.COFRINHOS, JSON.stringify(nextList));
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
    await AsyncStorage.setItem(STORAGE_KEYS.COFRINHOS, JSON.stringify(nextCofs));

    if (fromAccountId) {
      setAccounts((prev) => {
        const updated = prev.map((a) => (a.id === fromAccountId ? { ...a, balance: (a.balance || 0) - num } : a));
        AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated));
        return updated;
      });
    }
  };

  const removeCofrinho = async (id) => {
    const nextList = cofrinhos.filter((c) => c.id !== id);
    setCofrinhos(nextList);
    await AsyncStorage.setItem(STORAGE_KEYS.COFRINHOS, JSON.stringify(nextList));
  };

  // Adicionar lote de transações de forma atômica (previne perda em chamadas simultâneas)
  const addTransactionsBatch = async (txDataArray) => {
    if (!txDataArray || txDataArray.length === 0) return [];

    const newTxs = txDataArray.map((txData, idx) => ({
      id: txData.id || `tx-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      description: txData.description,
      amount: parseFloat(txData.amount) || 0,
      type: txData.type || 'expense', // 'expense' | 'income'
      category: txData.category || 'outros',
      expenseType: txData.expenseType || (txData.type === 'expense' ? 'variable' : undefined), // 'fixed' | 'variable'
      incomeSource: txData.incomeSource || (txData.type === 'income' ? 'salary' : undefined), // 'salary' | 'freelance' | 'extra' | 'investment' | 'other'
      author: txData.author || (loggedInUser?.name || (activeMember === 'Casal' ? members.user1 : activeMember)),
      date: txData.date || new Date().toISOString().split('T')[0],
      createdAt: txData.createdAt || new Date().toISOString(),
      accountId: txData.accountId || accounts[0]?.id,
      notes: txData.notes || '',
    }));

    // Atualiza estado de transações e AsyncStorage usando functional update
    setTransactions((prev) => {
      const nextList = [...newTxs, ...prev];
      AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(nextList));
      return nextList;
    });

    // Atualiza saldo da conta bancária para cada movimentação
    setAccounts((prev) => {
      const updated = prev.map((acc) => {
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
      AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated));
      return updated;
    });

    for (const tx of newTxs) {
      syncTransactionToAppwrite(tx).catch(() => {});
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
    await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(nextList));

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
        AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated));
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
    await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(nextList));

    if (target) {
      setAccounts((prev) => {
        const updated = prev.map((acc) => {
          if (acc.id === target.accountId) {
            const delta = target.type === 'income' ? -target.amount : target.amount;
            return { ...acc, balance: (acc.balance || 0) + delta };
          }
          return acc;
        });
        AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated));
        return updated;
      });
    }
  };

  const updateAccountBalance = async (accId, newBalance) => {
    setAccounts((prev) => {
      const updated = prev.map((acc) =>
        acc.id === accId ? { ...acc, balance: parseFloat(newBalance) || 0 } : acc
      );
      AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated));
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
      owner: accountData.owner || 'Casal',
      icon: accountData.icon || 'wallet-outline',
      color: accountData.color || '#0E2F5A',
    };
    const nextAccs = [...accounts, newAcc];
    setAccounts(nextAccs);
    await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(nextAccs));
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
    await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(nextAccs));
  };

  const removeAccount = async (accId) => {
    const nextAccs = accounts.filter((acc) => acc.id !== accId);
    setAccounts(nextAccs);
    await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(nextAccs));
  };

  const addCard = async (cardData) => {
    const theme = getBankTheme(cardData.bankId || cardData.bank || cardData.name);
    const newCard = {
      id: 'card-' + Date.now(),
      name: cardData.name || theme.name,
      bank: cardData.bank || theme.name,
      bankId: theme.bankId,
      holderName: cardData.holderName || 'LUCAS SILVA',
      lastFourDigits: cardData.lastFourDigits || '4568',
      expiryMonth: cardData.expiryMonth || '10',
      expiryYear: cardData.expiryYear || '26',
      limit: parseFloat(cardData.limit) || 0,
      currentInvoice: parseFloat(cardData.currentInvoice) || 0,
      dueDay: parseInt(cardData.dueDay, 10) || 10,
      dueDateText: cardData.dueDateText || `Vence em ${cardData.dueDay || 10}/11/2026`,
      status: cardData.status || 'Em aberto',
      usedPercent: cardData.usedPercent !== undefined ? cardData.usedPercent : 0,
      color: theme.gradientColors[0],
      logoType: theme.bankId,
      owner: cardData.owner || 'Casal',
    };
    const nextCards = [...cards, newCard];
    setCards(nextCards);
    await AsyncStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(nextCards));
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
    await AsyncStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(nextCards));
  };

  const removeCard = async (cardId) => {
    const nextCards = cards.filter((c) => c.id !== cardId);
    setCards(nextCards);
    await AsyncStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(nextCards));
  };

  // Limpar e zerar todos os dados para uso real
  const clearAllData = async () => {
    setTransactions([]);
    setAccounts([
      { id: 'acc-1', name: 'Conta Principal', bank: 'Nubank', balance: 0.0, owner: 'Casal', icon: 'wallet-outline', color: '#820AD1' },
    ]);
    setCards([]);
    setBills([]);
    setAiChat([
      {
        id: 'reset',
        sender: 'ai',
        text: `Olá! Sou o FINN AI do casal ${members.user1} & ${members.user2}. Todas as informações falsas de teste foram removidas. Agora você pode cadastrar seus saldos e movimentações reais!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
    await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify([
      { id: 'acc-1', name: 'Conta Principal', bank: 'Nubank', balance: 0.0, owner: 'Casal', icon: 'wallet-outline', color: '#820AD1' },
    ]));
    await AsyncStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify([]));
    await AsyncStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify([]));
    await AsyncStorage.setItem(STORAGE_KEYS.IS_DEMO, 'false');
  };

  // Carregar dados de demonstração (se o usuário quiser ver o exemplo)
  const loadDemoData = async () => {
    setCards(INITIAL_CARDS);
    setBills(INITIAL_BILLS);
    await AsyncStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(INITIAL_CARDS));
    await AsyncStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(INITIAL_BILLS));
    await AsyncStorage.setItem(STORAGE_KEYS.IS_DEMO, 'true');
  };

  const switchActiveMember = (member) => {
    setActiveMember(member);
    AsyncStorage.setItem(STORAGE_KEYS.MEMBER, member);
  };

  const updateMembersNames = (names) => {
    setMembers(names);
    AsyncStorage.setItem(STORAGE_KEYS.MEMBERS_NAMES, JSON.stringify(names));
  };

  const logout = async () => {
    setLoggedInUser(null);
    await setStoredSession(null);
  };

  // Cálculos financeiros consolidados
  const filteredTransactions = transactions.filter((t) => {
    if (activeMember === 'Casal') return true;
    return t.author === activeMember;
  });

  const totalIncome = filteredTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const resultadoDoMes = totalIncome - totalExpense; // R$ 2.775,70
  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0); // R$ 33.778,15

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
    const budget = cat.budget || 500;
    const percentOfTotal = totalExpense > 0 ? Math.round((spent / totalExpense) * 100) : 0;
    const percentOfBudget = Math.min(Math.round((spent / budget) * 100), 100);
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

    const prompt = `Você é o FINN AI, consultor financeiro do casal ${members.user1} e ${members.user2}.
Eles têm o objetivo/cofrinho: "${cof.title}"
- Valor total da meta: R$ ${cof.targetAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Já guardaram: R$ ${cof.currentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Falta atingir: R$ ${remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Prazo estimado: ${cof.deadline || 'Sem prazo'}

Contexto financeiro atual do casal:
- Saldo total que o casal tem em contas: R$ ${totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Gastos Fixos do mês (Aluguel, contas essenciais): R$ ${totalFixedExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Gastos Variáveis do mês (Mercado, Lazer, etc): R$ ${totalVariableExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Receitas extras de Freelance / fora do serviço: R$ ${totalFreelanceIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

Analise com muito carinho e precisão:
1. Em quais categorias variáveis eles podem enxugar gastos este mês para acelerar essa meta?
2. Como a renda de freelance ou bicos extras pode ser aproveitada para este cofrinho?
3. Projeção realista: em quantos meses eles conseguem comprar/adquirir isso mantendo o padrão saudável de vida?
Responda de forma clara, motivadora e estruturada em tópicos!`;

    return await sendTextMessageToGemini({
      userMessage: prompt,
      financialContext: { totalBalance, totalIncome, totalExpense, activeMember },
      members,
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
      const rawResponse = await sendTextMessageToGemini({
        message: userText,
        chatHistory: aiChat,
        financialContext: finContext,
        members,
        aiSkinId: aiSkin,
      });

      const parsedResult = await parseAndRegisterAiTransactions(
        rawResponse,
        loggedInUser?.name || activeMember === 'Casal' ? members.user1 : activeMember
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
    await AsyncStorage.setItem(STORAGE_KEYS.AI_CHAT, JSON.stringify(finalChat));
    return { text: aiReplyText, transaction: createdTxs[0] || null, transactions: createdTxs };
  };

  const processReceiptMedia = async (base64Image, mimeType = 'image/jpeg') => {
    const userMsg = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: '📷 [Comprovante anexado]',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextChat = [...aiChat, userMsg];
    setAiChat(nextChat);

    let aiReplyText = '';
    let createdTxs = [];

    try {
      const raw = await analyzeReceiptImage({
        base64Image,
        mimeType,
        financialContext: { totalBalance, totalIncome, totalExpense, activeMember },
        members,
      });

      const parsedResult = await parseAndRegisterAiTransactions(
        raw,
        loggedInUser?.name || (activeMember === 'Casal' ? members.user1 : activeMember)
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
    await AsyncStorage.setItem(STORAGE_KEYS.AI_CHAT, JSON.stringify(finalChat));
    return { text: aiReplyText, transaction: createdTxs[0] || null, transactions: createdTxs };
  };

  const processPdfInvoice = async (base64Pdf) => {
    const userMsg = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: '📄 [Boleto / Nota anexada]',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextChat = [...aiChat, userMsg];
    setAiChat(nextChat);

    let aiReplyText = '';
    let createdTxs = [];

    try {
      const raw = await analyzeInvoicePdf({
        base64Pdf,
        financialContext: { totalBalance, totalIncome, totalExpense, activeMember },
        members,
      });

      const parsedResult = await parseAndRegisterAiTransactions(
        raw,
        loggedInUser?.name || (activeMember === 'Casal' ? members.user1 : activeMember)
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
    await AsyncStorage.setItem(STORAGE_KEYS.AI_CHAT, JSON.stringify(finalChat));
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
      const raw = await analyzeVoiceAudio({
        base64Audio,
        mimeType,
        financialContext: { totalBalance, totalIncome, totalExpense, activeMember },
        members,
        aiSkinId: aiSkin,
      });

      const parsedResult = await parseAndRegisterAiTransactions(
        raw,
        loggedInUser?.name || (activeMember === 'Casal' ? members.user1 : activeMember)
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
    await AsyncStorage.setItem(STORAGE_KEYS.AI_CHAT, JSON.stringify(finalChat));
    return { text: aiReplyText, transaction: createdTxs[0] || null, transactions: createdTxs };
  };

  const updateAiSkin = async (skinId) => {
    setAiSkin(skinId);
    await AsyncStorage.setItem(STORAGE_KEYS.AI_SKIN, skinId);
  };

  return (
    <FinanceContext.Provider
      value={{
        loaded,
        loggedInUser,
        setLoggedInUser,
        logout,
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
