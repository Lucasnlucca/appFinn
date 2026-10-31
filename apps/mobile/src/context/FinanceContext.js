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
  TRANSACTIONS: '@finn_transactions_v2',
  ACCOUNTS: '@finn_accounts_v2',
  CARDS: '@finn_cards_v2',
  MEMBER: '@finn_active_member_v2',
  AI_CHAT: '@finn_ai_chat_v2',
  MEMBERS_NAMES: '@finn_members_names_v2',
};

// Contas reais para inicialização do casal
const INITIAL_ACCOUNTS = [
  { id: 'acc-1', name: 'Conta Principal (Corrente)', bank: 'Nubank', balance: 0.0, owner: 'Casal' },
  { id: 'acc-2', name: 'Reserva & Investimentos', bank: 'Banco Inter', balance: 0.0, owner: 'Casal' },
];

const INITIAL_CARDS = [
  { id: 'card-1', name: 'Cartão de Crédito', bank: 'Nubank Ultravioleta', limit: 8000, currentInvoice: 0.0, dueDay: 10, owner: 'Casal' },
  { id: 'card-2', name: 'Cartão de Compras', bank: 'XP Visa Infinite', limit: 12000, currentInvoice: 0.0, dueDay: 15, owner: 'Casal' },
];

export const CATEGORIES = [
  { id: 'alimentacao', label: 'Alimentação & Mercado', icon: 'cart-outline', color: '#F59E0B' },
  { id: 'moradia', label: 'Moradia & Contas', icon: 'home-outline', color: '#3B82F6' },
  { id: 'transporte', label: 'Transporte & Combustível', icon: 'car-outline', color: '#8B5CF6' },
  { id: 'saude', label: 'Saúde & Farmácia', icon: 'medkit-outline', color: '#10B981' },
  { id: 'lazer', label: 'Lazer & Restaurantes', icon: 'wine-outline', color: '#EC4899' },
  { id: 'salario', label: 'Salário & Renda', icon: 'cash-outline', color: '#10B981' },
  { id: 'outros', label: 'Outros / Serviços', icon: 'ellipsis-horizontal-outline', color: '#64748B' },
];

export function FinanceProvider({ children }) {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);
  const [cards, setCards] = useState(INITIAL_CARDS);
  const [activeMember, setActiveMember] = useState('Casal'); // 'Casal' | 'Lucas' | 'Veronica'
  const [members, setMembers] = useState({ user1: 'Lucas', user2: 'Veronica' });
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [aiChat, setAiChat] = useState([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Olá! Sou o FINN AI, o consultor financeiro com inteligência artificial de vocês dois. Posso tirar dúvidas sobre o orçamento familiar, sugerir como economizar ou registrar despesas quando vocês enviarem mensagens, prints de comprovantes ou áudio de voz!',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [loaded, setLoaded] = useState(false);

  // Carregar dados salvos no celular e sessão
  useEffect(() => {
    async function loadStored() {
      try {
        const [savedTrans, savedAccs, savedCards, savedMember, savedChat, savedNames, savedSession] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS),
          AsyncStorage.getItem(STORAGE_KEYS.ACCOUNTS),
          AsyncStorage.getItem(STORAGE_KEYS.CARDS),
          AsyncStorage.getItem(STORAGE_KEYS.MEMBER),
          AsyncStorage.getItem(STORAGE_KEYS.AI_CHAT),
          AsyncStorage.getItem(STORAGE_KEYS.MEMBERS_NAMES),
          getStoredSession(),
        ]);

        if (savedTrans) setTransactions(JSON.parse(savedTrans));
        if (savedAccs) setAccounts(JSON.parse(savedAccs));
        if (savedCards) setCards(JSON.parse(savedCards));
        if (savedMember) setActiveMember(savedMember);
        if (savedChat) setAiChat(JSON.parse(savedChat));
        if (savedNames) setMembers(JSON.parse(savedNames));
        if (savedSession) setLoggedInUser(savedSession);
      } catch (e) {
        console.warn('Erro ao carregar dados locais:', e);
      } finally {
        setLoaded(true);
      }
    }
    loadStored();
  }, []);

  // Adicionar transação
  const addTransaction = async (txData) => {
    const newTx = {
      id: txData.id || 'tx-' + Date.now(),
      description: txData.description,
      amount: parseFloat(txData.amount) || 0,
      type: txData.type || 'expense', // 'expense' | 'income'
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

    // Sincroniza em segundo plano com a VPS Appwrite
    syncTransactionToAppwrite(newTx).catch(() => {});

    return newTx;
  };

  // Editar transação existente
  const editTransaction = async (updatedTx) => {
    const oldTx = transactions.find((t) => t.id === updatedTx.id);
    if (!oldTx) return;

    const nextList = transactions.map((t) => (t.id === updatedTx.id ? updatedTx : t));
    setTransactions(nextList);
    await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(nextList));

    // Recalcular saldo da conta se o valor ou tipo mudou
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

  // Ajustar saldo real da conta diretamente
  const updateAccountBalance = async (accId, newBalance) => {
    setAccounts((prev) => {
      const updated = prev.map((acc) =>
        acc.id === accId ? { ...acc, balance: parseFloat(newBalance) || 0 } : acc
      );
      AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated));
      return updated;
    });
  };

  // Resetar histórico
  const clearAllData = async () => {
    setTransactions([]);
    setAccounts(INITIAL_ACCOUNTS);
    setCards(INITIAL_CARDS);
    setAiChat([
      {
        id: 'reset',
        sender: 'ai',
        text: 'Histórico zerado com sucesso! Agora você e seu cônjuge podem começar o planejamento limpo.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    await AsyncStorage.clear();
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

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  // ==========================================
  // PROCESSAMENTO DE IA CONVERSACIONAL (GOOGLE GEMINI)
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

      // Extrai tag de transação estruturada gerada naturalmente pela IA
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
          'A sua chave de API anterior foi desativada pelo Google por ter sido identificada publicamente no repositório.\n\n' +
          '**Como reativar o FINN em 1 minuto:**\n' +
          '1. Acesse **aistudio.google.com/app/apikey** e gere uma nova chave gratuita.\n' +
          '2. Cole ela na aba **Configurações > Chave Gemini** no app.\n\n' +
          'Assim que colar, o FINN voltará a conversar naturalmente e analisar seus comprovantes!';
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

  // Processar Print ou Comprovante de Pagamento
  const processReceiptMedia = async (base64Image, mimeType = 'image/jpeg') => {
    const userMsg = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: '📷 [Comprovante / Print enviado]',
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
      if (e.message?.includes('CHAVE_REVOGADA')) {
        aiReplyText = '⚠️ Chave da API revogada pelo Google. Por favor, gere uma nova em aistudio.google.com e cole em Configurações.';
      } else {
        aiReplyText = `Erro ao ler comprovante com o Gemini: ${e.message}`;
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

  // Processar PDF de Nota ou Fatura
  const processPdfInvoice = async (base64Pdf) => {
    const userMsg = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: '📄 [Boleto / Nota Fiscal anexada]',
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

  // Processar Áudio de Voz
  const processAudioMessage = async (base64Audio, mimeType = 'audio/m4a') => {
    const userMsg = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: '🎙️ [Áudio de Voz Enviado]',
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
        activeMember,
        members,
        aiChat,
        totalBalance,
        totalIncome,
        totalExpense,
        addTransaction,
        editTransaction,
        removeTransaction,
        updateAccountBalance,
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
