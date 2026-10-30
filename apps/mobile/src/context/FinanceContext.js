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
  const [activeMember, setActiveMember] = useState('Casal'); // 'Casal' | 'Henrique' | 'Esposa'
  const [members, setMembers] = useState({ user1: 'Henrique', user2: 'Esposa' });
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [aiChat, setAiChat] = useState([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Olá! Sou o FINN AI, o assistente financeiro de vocês dois com inteligência artificial do Google. Você pode digitar mensagens, enviar prints de comprovantes, PDFs de contas ou mandar áudio com seus gastos!',
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
      type: txData.type, // 'expense' | 'income'
      category: txData.category || 'outros',
      author: txData.author || (loggedInUser?.name || activeMember),
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
            // Remove o efeito antigo
            const oldDelta = oldTx.type === 'income' ? -oldTx.amount : oldTx.amount;
            // Aplica o novo efeito
            const newDelta = updatedTx.type === 'income' ? updatedTx.amount : -updatedTx.amount;
            return { ...acc, balance: (acc.balance || 0) + oldDelta + newDelta };
          }
          return acc;
        });
        AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated));
        return updated;
      });
    }

    // Sincroniza com Appwrite
    syncTransactionToAppwrite(updatedTx).catch(() => {});
  };

  // Remover transação (requisito explícito)
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
        text: 'Histórico zerado com sucesso! Agora você e sua esposa podem começar o planejamento limpo.',
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
  // PROCESSAMENTO DE IA MULTIMODAL (GOOGLE GEMINI)
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

    const finContext = { totalBalance, totalIncome, totalExpense, activeMember };
    let aiReplyText = '';
    let draftTx = null;

    try {
      const apiKey = await getGeminiApiKey();

      if (apiKey) {
        // Usa a API do Google Gemini
        const rawResponse = await sendTextMessageToGemini({
          message: userText,
          financialContext: finContext,
        });

        // Verifica se o Gemini retornou JSON estruturado de lançamento
        const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/) || rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            if (parsed.action === 'TRANSACTION_DETECTED' && parsed.data) {
              draftTx = await addTransaction({
                description: parsed.data.description,
                amount: parsed.data.amount,
                type: parsed.data.type || 'expense',
                category: parsed.data.category || 'outros',
                author: loggedInUser?.name || activeMember,
              });
              aiReplyText = parsed.reply || `✅ Lançado: R$ ${parsed.data.amount.toFixed(2)} em ${parsed.data.description}!`;
            } else {
              aiReplyText = parsed.reply || rawResponse;
            }
          } catch {
            aiReplyText = rawResponse;
          }
        } else {
          aiReplyText = rawResponse;
        }
      } else {
        // Fallback local caso chave ainda não tenha sido colada em Configurações
        const lower = userText.toLowerCase();
        const expenseRegex = /(?:gastei|comprei|paguei|lan[çc]ar|despesa de)\s*(?:r\$)?\s*(\d+(?:[.,]\d+)?)\s*(?:em|no|na|de|com)?\s*(.*)/i;
        const match = userText.match(expenseRegex);

        if (match) {
          const val = parseFloat(match[1].replace(',', '.'));
          const desc = match[2]?.trim() || 'Despesa rápida';

          let cat = 'alimentacao';
          if (desc.includes('uber') || desc.includes('gasolina') || desc.includes('combustivel')) cat = 'transporte';
          else if (desc.includes('farmacia') || desc.includes('remedio')) cat = 'saude';
          else if (desc.includes('luz') || desc.includes('agua') || desc.includes('internet') || desc.includes('aluguel')) cat = 'moradia';
          else if (desc.includes('cinema') || desc.includes('bar') || desc.includes('restaurante')) cat = 'lazer';

          draftTx = await addTransaction({
            description: desc.charAt(0).toUpperCase() + desc.slice(1),
            amount: val,
            type: 'expense',
            category: cat,
            author: loggedInUser?.name || activeMember,
          });

          aiReplyText = `✅ Anotado! Registrei uma despesa de R$ ${val.toFixed(2).replace('.', ',')} em "${desc}" para ${loggedInUser?.name || activeMember}.\n\n*(Dica: Conecte sua chave do Google Gemini em Configurações para respostas com IA multimodal completa!)*`;
        } else if (lower.includes('saldo') || lower.includes('quanto temos')) {
          aiReplyText = `💰 Resumo financeiro do casal:\n• Saldo total em contas: R$ ${totalBalance.toFixed(2).replace('.', ',')}\n• Receitas do mês: R$ ${totalIncome.toFixed(2).replace('.', ',')}\n• Despesas do mês: R$ ${totalExpense.toFixed(2).replace('.', ',')}\n• Sobra líquida: R$ ${(totalIncome - totalExpense).toFixed(2).replace('.', ',')}`;
        } else {
          aiReplyText = `Entendido! Você pode me dizer algo como "Gastei 50 no almoço" para eu anotar direto, enviar fotos de comprovantes ou áudio!`;
        }
      }
    } catch (err) {
      aiReplyText = `Desculpe, tive uma instabilidade: ${err.message}. Mas suas finanças continuam seguras!`;
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
      text: '📷 [Comprovante / Print anexado]',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextChat = [...aiChat, userMsg];
    setAiChat(nextChat);

    let aiReplyText = '';
    let draftTx = null;

    try {
      const apiKey = await getGeminiApiKey();
      if (!apiKey) {
        aiReplyText = 'Para analisar comprovantes e prints, por favor informe sua chave do Google Gemini na aba de Configurações.';
      } else {
        const raw = await analyzeReceiptImage({
          base64Image,
          mimeType,
          financialContext: { totalBalance, totalIncome, totalExpense, activeMember },
        });

        const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          if (parsed.action === 'TRANSACTION_DETECTED' && parsed.data) {
            draftTx = await addTransaction({
              description: parsed.data.description,
              amount: parsed.data.amount,
              type: parsed.data.type || 'expense',
              category: parsed.data.category || 'outros',
              author: loggedInUser?.name || activeMember,
            });
            aiReplyText = `🧾 Comprovante analisado pelo Google Gemini!\n• Estabelecimento: ${parsed.data.description}\n• Valor: R$ ${parsed.data.amount.toFixed(2).replace('.', ',')}\n• Categoria: ${parsed.data.category}\n\n✅ Lançamento adicionado ao extrato do casal!`;
          } else {
            aiReplyText = parsed.reply || raw;
          }
        } else {
          aiReplyText = raw;
        }
      }
    } catch (e) {
      aiReplyText = `Erro ao ler comprovante com o Gemini: ${e.message}`;
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
      text: '📄 [Documento PDF / Boleto anexado]',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextChat = [...aiChat, userMsg];
    setAiChat(nextChat);

    let aiReplyText = '';
    let draftTx = null;

    try {
      const apiKey = await getGeminiApiKey();
      if (!apiKey) {
        aiReplyText = 'Para analisar faturas em PDF, configure sua chave do Google Gemini em Configurações.';
      } else {
        const raw = await analyzeInvoicePdf({
          base64Pdf,
          financialContext: { totalBalance, totalIncome, totalExpense, activeMember },
        });

        const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          if (parsed.action === 'TRANSACTION_DETECTED' && parsed.data) {
            draftTx = await addTransaction({
              description: parsed.data.description,
              amount: parsed.data.amount,
              type: parsed.data.type || 'expense',
              category: parsed.data.category || 'moradia',
              author: loggedInUser?.name || activeMember,
            });
            aiReplyText = `📑 Boleto / Fatura lida com sucesso!\n• Cedente: ${parsed.data.description}\n• Valor: R$ ${parsed.data.amount.toFixed(2).replace('.', ',')}\n\n✅ Lançado automaticamente para controle do casal!`;
          } else {
            aiReplyText = parsed.reply || raw;
          }
        } else {
          aiReplyText = raw;
        }
      }
    } catch (e) {
      aiReplyText = `Erro ao ler PDF com o Gemini: ${e.message}`;
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
      text: '🎙️ [Mensagem de Voz Gravada]',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextChat = [...aiChat, userMsg];
    setAiChat(nextChat);

    let aiReplyText = '';
    let draftTx = null;

    try {
      const apiKey = await getGeminiApiKey();
      if (!apiKey) {
        aiReplyText = 'Para processar mensagens de voz com a IA do Google Gemini, adicione a sua chave nas Configurações.';
      } else {
        const raw = await analyzeVoiceAudio({
          base64Audio,
          mimeType,
          financialContext: { totalBalance, totalIncome, totalExpense, activeMember },
        });

        const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          const transcript = parsed.transcription ? `🗣️ *"${parsed.transcription}"*\n\n` : '';

          if (parsed.action === 'TRANSACTION_DETECTED' && parsed.data) {
            draftTx = await addTransaction({
              description: parsed.data.description,
              amount: parsed.data.amount,
              type: parsed.data.type || 'expense',
              category: parsed.data.category || 'outros',
              author: loggedInUser?.name || activeMember,
            });
            aiReplyText = `${transcript}✅ Entendi perfeitamente e registrei:\n• ${parsed.data.description}: R$ ${parsed.data.amount.toFixed(2).replace('.', ',')}`;
          } else {
            aiReplyText = `${transcript}${parsed.reply || raw}`;
          }
        } else {
          aiReplyText = raw;
        }
      }
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
