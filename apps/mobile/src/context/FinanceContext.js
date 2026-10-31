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

const FinanceContext = createContext(null);

const STORAGE_KEYS = {
  TRANSACTIONS: '@finn_transactions_v4',
  ACCOUNTS: '@finn_accounts_v4',
  CARDS: '@finn_cards_v4',
  BILLS: '@finn_bills_v4',
  MEMBER: '@finn_active_member_v4',
  AI_CHAT: '@finn_ai_chat_v4',
  MEMBERS_NAMES: '@finn_members_names_v4',
  HIDE_BALANCES: '@finn_hide_balances_v4',
  IS_DEMO: '@finn_is_demo_mode_v4',
};

// Contas reais para o casal (Inicia com saldo R$ 0,00 para dados reais)
const INITIAL_ACCOUNTS = [
  { id: 'acc-1', name: 'Conta Corrente', bank: 'Nubank', balance: 0.00, owner: 'Casal', icon: 'wallet-outline', color: '#820AD1' },
];

const INITIAL_CARDS = [];
const INITIAL_BILLS = [];
const INITIAL_TRANSACTIONS = [];

// Dados de demonstração (opcional para preview caso o usuário queira testar o visual)
const DEMO_ACCOUNTS = [
  { id: 'acc-demo-1', name: 'Conta Principal', bank: 'Nubank', balance: 21530.00, owner: 'Casal', icon: 'wallet-outline', color: '#820AD1' },
  { id: 'acc-demo-2', name: 'Investimentos & Reserva', bank: 'Banco Inter', balance: 12248.15, owner: 'Casal', icon: 'trending-up-outline', color: '#FF7A00' },
];

const DEMO_CARDS = [
  { id: 'card-demo-1', name: 'Nubank Ultravioleta', bank: 'Nubank', limit: 8000, currentInvoice: 851.30, dueDay: 10, owner: 'Casal', color: '#820AD1' },
  { id: 'card-demo-2', name: 'C6 Carbon Black', bank: 'C6 Bank', limit: 12000, currentInvoice: 99.90, dueDay: 22, owner: 'Casal', color: '#242424' },
];

const DEMO_BILLS = [
  { id: 'bill-demo-1', title: 'C6 Bank', category: 'cartao', subtext: 'Fatura paga • venceu 22 out', amount: 99.90, paid: true, dueDay: 22, icon: 'card', iconColor: '#242424', isCard: true },
  { id: 'bill-demo-2', title: 'Seguro do carro', category: 'transporte', subtext: 'Paga • 12 out', amount: 210.00, paid: true, dueDay: 12, icon: 'car-outline', iconColor: '#8B5CF6', isRecurring: true },
  { id: 'bill-demo-3', title: 'Internet Fibra', category: 'moradia', subtext: 'Paga • 10 out', amount: 120.00, paid: true, dueDay: 10, icon: 'home-outline', iconColor: '#3B82F6', isRecurring: true },
  { id: 'bill-demo-4', title: 'Nubank', category: 'cartao', subtext: 'Fatura paga • venceu 10 out', amount: 851.30, paid: true, dueDay: 10, icon: 'card', iconColor: '#820AD1', isCard: true },
  { id: 'bill-demo-5', title: 'Aluguel', category: 'moradia', subtext: 'Paga • 5 out', amount: 1450.00, paid: true, dueDay: 5, icon: 'home-outline', iconColor: '#3B82F6', isRecurring: true },
];

const DEMO_TRANSACTIONS = [
  { id: 'tx-demo-1', description: 'Salário & Dividendos', amount: 5850.00, type: 'income', category: 'salario', author: 'Casal', date: '2026-10-05', accountId: 'acc-demo-1' },
  { id: 'tx-demo-2', description: 'Aluguel do Apartamento', amount: 1450.00, type: 'expense', category: 'moradia', author: 'Lucas', date: '2026-10-05', accountId: 'acc-demo-1' },
  { id: 'tx-demo-3', description: 'Fatura Nubank', amount: 851.30, type: 'expense', category: 'moradia', author: 'Veronica', date: '2026-10-10', accountId: 'acc-demo-1' },
  { id: 'tx-demo-4', description: 'Supermercado Pão de Açúcar', amount: 560.40, type: 'expense', category: 'alimentacao', author: 'Lucas', date: '2026-10-14', accountId: 'acc-demo-1' },
  { id: 'tx-demo-5', description: 'Curso & Especialização', amount: 300.00, type: 'expense', category: 'educacao', author: 'Veronica', date: '2026-10-16', accountId: 'acc-demo-1' },
  { id: 'tx-demo-6', description: 'Combustível Posto Shell', amount: 281.40, type: 'expense', category: 'transporte', author: 'Lucas', date: '2026-10-18', accountId: 'acc-demo-1' },
  { id: 'tx-demo-7', description: 'Jantar Restaurante', amount: 217.80, type: 'expense', category: 'lazer', author: 'Casal', date: '2026-10-21', accountId: 'acc-demo-1' },
  { id: 'tx-demo-8', description: 'Internet Fibra', amount: 120.00, type: 'expense', category: 'moradia', author: 'Lucas', date: '2026-10-10', accountId: 'acc-demo-1' },
  { id: 'tx-demo-9', description: 'Fatura C6 Bank', amount: 99.90, type: 'expense', category: 'outros', author: 'Veronica', date: '2026-10-22', accountId: 'acc-demo-1' },
];

export const CATEGORIES = [
  { id: 'moradia', label: 'Moradia', icon: 'home-outline', color: '#3B82F6', budget: 1700.00 },
  { id: 'alimentacao', label: 'Alimentação', icon: 'restaurant-outline', color: '#F97316', budget: 608.00 },
  { id: 'educacao', label: 'Educação', icon: 'school-outline', color: '#EC4899', budget: 320.00 },
  { id: 'transporte', label: 'Transporte', icon: 'car-outline', color: '#8B5CF6', budget: 384.00 },
  { id: 'lazer', label: 'Lazer', icon: 'game-controller-outline', color: '#10B981', budget: 288.00 },
  { id: 'salario', label: 'Salário & Renda', icon: 'cash-outline', color: '#10B981', budget: 6000.00 },
  { id: 'outros', label: 'Outros', icon: 'ellipsis-horizontal-outline', color: '#64748B', budget: 200.00 },
];

export function FinanceProvider({ children }) {
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS);
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);
  const [cards, setCards] = useState(INITIAL_CARDS);
  const [bills, setBills] = useState(INITIAL_BILLS);
  const [activeMember, setActiveMember] = useState('Casal'); // 'Casal' | 'Lucas' | 'Veronica'
  const [members, setMembers] = useState({ user1: 'Lucas', user2: 'Veronica' });
  const [selectedMonth, setSelectedMonth] = useState('Out 2026');
  const [hideBalances, setHideBalances] = useState(false);
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
        const [savedTrans, savedAccs, savedCards, savedBills, savedMember, savedChat, savedNames, savedHide, savedSession] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS),
          AsyncStorage.getItem(STORAGE_KEYS.ACCOUNTS),
          AsyncStorage.getItem(STORAGE_KEYS.CARDS),
          AsyncStorage.getItem(STORAGE_KEYS.BILLS),
          AsyncStorage.getItem(STORAGE_KEYS.MEMBER),
          AsyncStorage.getItem(STORAGE_KEYS.AI_CHAT),
          AsyncStorage.getItem(STORAGE_KEYS.MEMBERS_NAMES),
          AsyncStorage.getItem(STORAGE_KEYS.HIDE_BALANCES),
          getStoredSession(),
        ]);

        if (savedTrans) setTransactions(JSON.parse(savedTrans));
        if (savedAccs) setAccounts(JSON.parse(savedAccs));
        if (savedCards) setCards(JSON.parse(savedCards));
        if (savedBills) setBills(JSON.parse(savedBills));
        if (savedMember) setActiveMember(savedMember);
        if (savedChat) setAiChat(JSON.parse(savedChat));
        if (savedNames) setMembers(JSON.parse(savedNames));
        if (savedHide) setHideBalances(JSON.parse(savedHide));
        if (savedSession) setLoggedInUser(savedSession);
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

  // Alternar status de conta paga (Paga vs Pendente)
  const toggleBillPaid = async (billId) => {
    const nextBills = bills.map((b) => (b.id === billId ? { ...b, paid: !b.paid } : b));
    setBills(nextBills);
    await AsyncStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(nextBills));
  };

  // Adicionar nova conta a pagar
  const addBill = async (billData) => {
    const newBill = {
      id: 'bill-' + Date.now(),
      title: billData.title,
      category: billData.category || 'moradia',
      subtext: `Vence ${billData.dueDay || '10'} out`,
      amount: parseFloat(billData.amount) || 0,
      paid: false,
      dueDay: billData.dueDay || 10,
      icon: billData.icon || 'receipt-outline',
      iconColor: billData.iconColor || '#3B82F6',
      isRecurring: billData.isRecurring || false,
    };
    const nextBills = [newBill, ...bills];
    setBills(nextBills);
    await AsyncStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(nextBills));
    return newBill;
  };

  // Adicionar transação
  const addTransaction = async (txData) => {
    const newTx = {
      id: txData.id || 'tx-' + Date.now(),
      description: txData.description,
      amount: parseFloat(txData.amount) || 0,
      type: txData.type || 'expense',
      category: txData.category || 'outros',
      author: txData.author || (loggedInUser?.name || activeMember === 'Casal' ? members.user1 : activeMember),
      date: txData.date || new Date().toISOString().split('T')[0],
      accountId: txData.accountId || accounts[0]?.id,
    };

    const nextList = [newTx, ...transactions];
    setTransactions(nextList);
    await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(nextList));

    // Atualiza saldo da conta
    setAccounts((prev) => {
      const updated = prev.map((acc) => {
        if (acc.id === newTx.accountId) {
          const delta = newTx.type === 'income' ? newTx.amount : -newTx.amount;
          return { ...acc, balance: (acc.balance || 0) + delta };
        }
        return acc;
      });
      AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated));
      return updated;
    });

    syncTransactionToAppwrite(newTx).catch(() => {});
    return newTx;
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
    const newCard = {
      id: 'card-' + Date.now(),
      name: cardData.name || 'Cartão de Crédito',
      bank: cardData.bank || 'Banco',
      limit: parseFloat(cardData.limit) || 0,
      currentInvoice: parseFloat(cardData.currentInvoice) || 0,
      dueDay: parseInt(cardData.dueDay, 10) || 10,
      owner: cardData.owner || 'Casal',
      color: cardData.color || '#0E2F5A',
    };
    const nextCards = [...cards, newCard];
    setCards(nextCards);
    await AsyncStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(nextCards));
    return newCard;
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
    setTransactions(DEMO_TRANSACTIONS);
    setAccounts(DEMO_ACCOUNTS);
    setCards(DEMO_CARDS);
    setBills(DEMO_BILLS);
    await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(DEMO_TRANSACTIONS));
    await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(DEMO_ACCOUNTS));
    await AsyncStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(DEMO_CARDS));
    await AsyncStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(DEMO_BILLS));
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

  // Cálculos de contas a pagar (Imagem 1)
  const totalBillsAmount = bills.reduce((sum, b) => sum + b.amount, 0);
  const paidBillsAmount = bills.filter((b) => b.paid).reduce((sum, b) => sum + b.amount, 0);
  const pendingBillsAmount = bills.filter((b) => !b.paid).reduce((sum, b) => sum + b.amount, 0);
  const allBillsPaid = pendingBillsAmount === 0 && bills.length > 0;

  // Cálculo de gastos por categoria com barra de progresso (Imagem 2)
  const categoryBreakdown = CATEGORIES.filter((c) => c.id !== 'salario').map((cat) => {
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

  // ==========================================
  // IA MULTIMODAL GEMINI
  // ==========================================
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
    let draftTx = null;

    try {
      const rawResponse = await sendTextMessageToGemini({
        message: userText,
        chatHistory: aiChat,
        financialContext: finContext,
        members,
      });

      let cleanReply = rawResponse;
      const txMatch = rawResponse.match(/\[TRANSACTION:\s*(\{[\s\S]*?\})\]/i);

      if (txMatch) {
        try {
          const parsed = JSON.parse(txMatch[1]);
          if (parsed.amount) {
            draftTx = await addTransaction({
              description: parsed.description || 'Lançamento',
              amount: parseFloat(parsed.amount) || 0,
              type: parsed.type || 'expense',
              category: parsed.category || 'outros',
              author: parsed.author || (loggedInUser?.name || activeMember === 'Casal' ? members.user1 : activeMember),
            });
          }
          cleanReply = rawResponse.replace(txMatch[0], '').trim();
        } catch (e) {
          console.warn('Erro ao ler tag da transação:', e);
        }
      }

      aiReplyText = cleanReply || rawResponse;
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
      transaction: draftTx,
    };

    const finalChat = [...nextChat, aiMsg];
    setAiChat(finalChat);
    await AsyncStorage.setItem(STORAGE_KEYS.AI_CHAT, JSON.stringify(finalChat));
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
    let draftTx = null;

    try {
      const raw = await analyzeReceiptImage({
        base64Image,
        mimeType,
        financialContext: { totalBalance, totalIncome, totalExpense, activeMember },
        members,
      });

      let cleanReply = raw;
      const txMatch = raw.match(/\[TRANSACTION:\s*(\{[\s\S]*?\})\]/i);
      if (txMatch) {
        try {
          const parsed = JSON.parse(txMatch[1]);
          if (parsed.amount) {
            draftTx = await addTransaction({
              description: parsed.description || 'Comprovante',
              amount: parseFloat(parsed.amount) || 0,
              type: parsed.type || 'expense',
              category: parsed.category || 'outros',
              author: parsed.author || (loggedInUser?.name || activeMember === 'Casal' ? members.user1 : activeMember),
            });
          }
          cleanReply = raw.replace(txMatch[0], '').trim();
        } catch (e) {
          console.warn('Erro ao ler tag do comprovante:', e);
        }
      }

      aiReplyText = cleanReply || raw;
    } catch (e) {
      aiReplyText = `Erro ao ler comprovante: ${e.message}`;
    }

    const aiMsg = {
      id: 'ai-' + Date.now(),
      sender: 'ai',
      text: aiReplyText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      transaction: draftTx,
    };

    const finalChat = [...nextChat, aiMsg];
    setAiChat(finalChat);
    await AsyncStorage.setItem(STORAGE_KEYS.AI_CHAT, JSON.stringify(finalChat));
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
    let draftTx = null;

    try {
      const raw = await analyzeInvoicePdf({
        base64Pdf,
        financialContext: { totalBalance, totalIncome, totalExpense, activeMember },
        members,
      });

      let cleanReply = raw;
      const txMatch = raw.match(/\[TRANSACTION:\s*(\{[\s\S]*?\})\]/i);
      if (txMatch) {
        try {
          const parsed = JSON.parse(txMatch[1]);
          if (parsed.amount) {
            draftTx = await addTransaction({
              description: parsed.description || 'Boleto / Fatura',
              amount: parseFloat(parsed.amount) || 0,
              type: parsed.type || 'expense',
              category: parsed.category || 'moradia',
              author: parsed.author || (loggedInUser?.name || activeMember === 'Casal' ? members.user1 : activeMember),
            });
          }
          cleanReply = raw.replace(txMatch[0], '').trim();
        } catch (e) {
          console.warn('Erro ao ler tag do boleto:', e);
        }
      }

      aiReplyText = cleanReply || raw;
    } catch (e) {
      aiReplyText = `Erro ao ler documento: ${e.message}`;
    }

    const aiMsg = {
      id: 'ai-' + Date.now(),
      sender: 'ai',
      text: aiReplyText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      transaction: draftTx,
    };

    const finalChat = [...nextChat, aiMsg];
    setAiChat(finalChat);
    await AsyncStorage.setItem(STORAGE_KEYS.AI_CHAT, JSON.stringify(finalChat));
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
    let draftTx = null;

    try {
      const raw = await analyzeVoiceAudio({
        base64Audio,
        mimeType,
        financialContext: { totalBalance, totalIncome, totalExpense, activeMember },
        members,
      });

      let cleanReply = raw;
      const txMatch = raw.match(/\[TRANSACTION:\s*(\{[\s\S]*?\})\]/i);
      if (txMatch) {
        try {
          const parsed = JSON.parse(txMatch[1]);
          if (parsed.amount) {
            draftTx = await addTransaction({
              description: parsed.description || 'Gasto por Voz',
              amount: parseFloat(parsed.amount) || 0,
              type: parsed.type || 'expense',
              category: parsed.category || 'outros',
              author: parsed.author || (loggedInUser?.name || activeMember === 'Casal' ? members.user1 : activeMember),
            });
          }
          cleanReply = raw.replace(txMatch[0], '').trim();
        } catch (e) {
          console.warn('Erro ao ler tag do áudio:', e);
        }
      }

      aiReplyText = cleanReply || raw;
    } catch (e) {
      aiReplyText = `Erro ao processar áudio: ${e.message}`;
    }

    const aiMsg = {
      id: 'ai-' + Date.now(),
      sender: 'ai',
      text: aiReplyText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      transaction: draftTx,
    };

    const finalChat = [...nextChat, aiMsg];
    setAiChat(finalChat);
    await AsyncStorage.setItem(STORAGE_KEYS.AI_CHAT, JSON.stringify(finalChat));
  };

  return (
    <FinanceContext.Provider
      value={{
        loaded,
        loggedInUser,
        setLoggedInUser,
        logout,
        transactions: filteredTransactions,
        allTransactions: transactions,
        accounts,
        cards,
        bills,
        toggleBillPaid,
        addBill,
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
        editTransaction,
        removeTransaction,
        updateAccountBalance,
        addAccount,
        updateAccount,
        removeAccount,
        addCard,
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
