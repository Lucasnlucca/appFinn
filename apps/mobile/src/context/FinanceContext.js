import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FinanceContext = createContext(null);

const STORAGE_KEYS = {
  TRANSACTIONS: '@finn_transactions_v2',
  ACCOUNTS: '@finn_accounts_v2',
  CARDS: '@finn_cards_v2',
  MEMBER: '@finn_active_member_v2',
  AI_CHAT: '@finn_ai_chat_v2',
  MEMBERS_NAMES: '@finn_members_names_v2',
};

// Dados iniciais limpos para o casal configurar suas contas reais
const INITIAL_ACCOUNTS = [
  { id: 'acc-1', name: 'Conta Principal', bank: 'Nubank / Inter', balance: 0.0, owner: 'Casal' },
  { id: 'acc-2', name: 'Reserva Financeira', bank: 'CDB / Poupança', balance: 0.0, owner: 'Casal' },
];

const INITIAL_CARDS = [
  { id: 'card-1', name: 'Cartão de Crédito', bank: 'Nubank', limit: 5000, currentInvoice: 0.0, dueDay: 10, owner: 'Casal' },
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
  const [activeMember, setActiveMember] = useState('Casal'); // 'Casal' | 'Henrique' | 'Esposa'
  const [members, setMembers] = useState({ user1: 'Henrique', user2: 'Esposa' });
  const [aiChat, setAiChat] = useState([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Olá! Sou o FINN AI, o assistente financeiro de vocês dois. Posso registrar despesas se você me disser algo como "Gastei 45 no mercado", ou tirar dúvidas sobre o orçamento familiar.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [loaded, setLoaded] = useState(false);

  // Carregar dados salvos no celular
  useEffect(() => {
    async function loadStored() {
      try {
        const [savedTrans, savedAccs, savedCards, savedMember, savedChat, savedNames] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS),
          AsyncStorage.getItem(STORAGE_KEYS.ACCOUNTS),
          AsyncStorage.getItem(STORAGE_KEYS.CARDS),
          AsyncStorage.getItem(STORAGE_KEYS.MEMBER),
          AsyncStorage.getItem(STORAGE_KEYS.AI_CHAT),
          AsyncStorage.getItem(STORAGE_KEYS.MEMBERS_NAMES),
        ]);

        if (savedTrans) setTransactions(JSON.parse(savedTrans));
        if (savedAccs) setAccounts(JSON.parse(savedAccs));
        if (savedCards) setCards(JSON.parse(savedCards));
        if (savedMember) setActiveMember(savedMember);
        if (savedChat) setAiChat(JSON.parse(savedChat));
        if (savedNames) setMembers(JSON.parse(savedNames));
      } catch (e) {
        console.warn('Erro ao carregar dados locais:', e);
      } finally {
        setLoaded(true);
      }
    }
    loadStored();
  }, []);

  // Salvar transações
  const addTransaction = async (txData) => {
    const newTx = {
      id: 'tx-' + Date.now(),
      description: txData.description,
      amount: parseFloat(txData.amount) || 0,
      type: txData.type, // 'expense' | 'income'
      category: txData.category || 'outros',
      author: txData.author || activeMember,
      date: txData.date || new Date().toISOString(),
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

    return newTx;
  };

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
      const updated = prev.map((acc) => (acc.id === accId ? { ...acc, balance: parseFloat(newBalance) || 0 } : acc));
      AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated));
      return updated;
    });
  };

  const clearAllData = async () => {
    setTransactions([]);
    setAccounts(INITIAL_ACCOUNTS);
    setCards(INITIAL_CARDS);
    setAiChat([
      {
        id: 'reset',
        sender: 'ai',
        text: 'Histórico zerado com sucesso! Agora você e sua esposa podem lançar as despesas e saldos reais.',
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

  // Enviar mensagem para a IA e processar intenção
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

    // Motor simples de IA nativa local (interpretação de linguagem natural)
    const lower = userText.toLowerCase();

    // 1. Tentar detectar comando de lançamento: ex "gastei 50 no almoço" ou "comprei 30 de padaria"
    const expenseRegex = /(?:gastei|comprei|paguei|lan[çc]ar|despesa de)\s*(?:r\$)?\s*(\d+(?:[.,]\d+)?)\s*(?:em|no|na|de|com)?\s*(.*)/i;
    const match = userText.match(expenseRegex);

    let aiReplyText = '';

    if (match) {
      const val = parseFloat(match[1].replace(',', '.'));
      const desc = match[2]?.trim() || 'Despesa rápida';
      
      let cat = 'alimentacao';
      if (desc.includes('uber') || desc.includes('gasolina') || desc.includes('combustivel')) cat = 'transporte';
      else if (desc.includes('farmacia') || desc.includes('remedio')) cat = 'saude';
      else if (desc.includes('luz') || desc.includes('agua') || desc.includes('internet') || desc.includes('aluguel')) cat = 'moradia';
      else if (desc.includes('cinema') || desc.includes('bar') || desc.includes('show')) cat = 'lazer';

      await addTransaction({
        description: desc.charAt(0).toUpperCase() + desc.slice(1),
        amount: val,
        type: 'expense',
        category: cat,
        author: activeMember === 'Casal' ? members.user1 : activeMember,
      });

      aiReplyText = `✅ Anotado! Registrei uma despesa de R$ ${val.toFixed(2).replace('.', ',')} em "${desc}" para ${activeMember === 'Casal' ? members.user1 : activeMember}.`;
    } else if (lower.includes('saldo') || lower.includes('quanto temos') || lower.includes('quanto sobrou')) {
      const totalBalance = accounts.reduce((acc, a) => acc + (a.balance || 0), 0);
      const totalIncome = transactions.filter((t) => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
      const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
      aiReplyText = `💰 Resumo financeiro do casal:\n• Saldo total em contas: R$ ${totalBalance.toFixed(2).replace('.', ',')}\n• Receitas lançadas: R$ ${totalIncome.toFixed(2).replace('.', ',')}\n• Despesas do mês: R$ ${totalExpense.toFixed(2).replace('.', ',')}\n• Saldo líquido restante: R$ ${(totalIncome - totalExpense).toFixed(2).replace('.', ',')}`;
    } else if (lower.includes('dica') || lower.includes('economizar') || lower.includes('ajuda')) {
      aiReplyText = `💡 Dica do FINN:\nO segredo do orçamento em casal é a regra dos potes:\n1. 50% para necessidades fixas (moradia, mercado);\n2. 30% para estilo de vida e lazer do casal;\n3. 20% para a reserva de emergência e metas conjuntas!`;
    } else {
      aiReplyText = `Entendi! Estou monitorando as finanças de você e da sua esposa. Você pode me dizer frases como "Gastei 35 na farmácia" para eu anotar direto, ou perguntar "Como está o saldo?".`;
    }

    const aiMsg = {
      id: 'ai-' + Date.now(),
      sender: 'ai',
      text: aiReplyText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const finalChat = [...nextChat, aiMsg];
    setAiChat(finalChat);
    await AsyncStorage.setItem(STORAGE_KEYS.AI_CHAT, JSON.stringify(finalChat));
  };

  // Cálculos consolidados filtrados pelo membro selecionado
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

  return (
    <FinanceContext.Provider
      value={{
        loaded,
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
        removeTransaction,
        updateAccountBalance,
        clearAllData,
        switchActiveMember,
        updateMembersNames,
        sendAiMessage,
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
