'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Sparkles,
  FileText,
  Table2,
  BarChart3,
  Calendar,
  Disc,
  Receipt,
  ChevronRight,
  RefreshCw,
  MessageSquare,
  Paperclip,
  Mic,
  Square,
  Image as ImageIcon,
  Volume2,
  X,
  CheckCircle2,
  ArrowUpCircle,
  ArrowDownCircle,
  KeyRound,
  Trash2,
} from 'lucide-react';
import {
  OFFICIAL_CATEGORIES,
  apiFetch,
  extractCategoryFromTx,
  fetchSharedGroupTransactions,
  fetchUserGroups,
  getAuthUser,
  notifyDataChanged,
  resolveCategoryMeta,
} from '@/lib/api';
import { formatCurrencyBRL } from '@finn-ai/ui';

function decodeBundledKey(str: string): string {
  try {
    return atob(str);
  } catch {
    return '';
  }
}

const BUNDLED_GEMINI_KEY = decodeBundledKey('QVEuQWI4Uk42SU5oVE1IR2dqdUF5bktUdmxyUDN1T3pQV0NyRTJySzY5S2FvTlFZQ1B6VkE=');
const GEMINI_KEY_STORAGE = 'finn_web_gemini_key';
const AI_KEYS_STORAGE = 'finn_web_ai_keys_v1';
const AI_ACTIVE_PROVIDER_STORAGE = 'finn_web_ai_active_provider_v1';

type AiProviderId = 'gemini' | 'openai' | 'grok' | 'claude';

interface AiProviderKeys {
  gemini: string;
  openai: string;
  grok: string;
  claude: string;
}

const AI_PROVIDERS_META: Array<{
  id: AiProviderId;
  name: string;
  shortName: string;
  badge: string;
  placeholder: string;
  description: string;
  alwaysActive?: boolean;
}> = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    shortName: 'Gemini',
    badge: 'Padrão Sempre Ativa',
    placeholder: 'AIzaSy... (deixe vazio para usar a chave integrada do FINN)',
    description: 'Já vem ativa por padrão no FINN. Suporta texto, fotos, PDF, CSV e áudio.',
    alwaysActive: true,
  },
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT / GPT-4o)',
    shortName: 'ChatGPT',
    badge: 'API Adicional',
    placeholder: 'sk-proj-... (cole sua chave da OpenAI)',
    description: 'Use os modelos GPT-4o / GPT-4o-mini como IA adicional.',
  },
  {
    id: 'grok',
    name: 'xAI (Grok)',
    shortName: 'Grok',
    badge: 'API Adicional',
    placeholder: 'xai-... (cole sua chave da xAI Grok)',
    description: 'Use os modelos Grok 3 / Grok 2 da xAI como IA adicional.',
  },
  {
    id: 'claude',
    name: 'Anthropic (Claude 3.5)',
    shortName: 'Claude',
    badge: 'API Adicional',
    placeholder: 'sk-ant-... (cole sua chave da Anthropic)',
    description: 'Use o Claude 3.5 Sonnet / Haiku para análises financeiras detalhadas.',
  },
];

interface CreatedTxCard {
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  cardName?: string;
}

interface MessageItem {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
  transactions?: CreatedTxCard[];
  actionDraft?: {
    draftId: string;
    title: string;
    targetAmount: number;
    targetDate: string;
  };
  draftStatus?: 'PENDING' | 'APPROVED' | 'DISCARDED';
}

interface AttachedFileState {
  type: 'pdf' | 'csv' | 'image' | 'audio';
  name: string;
  mimeType: string;
  base64?: string;
  textContent?: string;
}

const QUICK_SETS = [
  [
    { id: 'mes', icon: Calendar, text: 'Como foi meu mês?', prompt: 'Como foi o desempenho financeiro do meu mês até agora?' },
    { id: 'gastos', icon: BarChart3, text: 'Onde mais gastei?', prompt: 'Quais foram minhas maiores despesas e categorias que mais gastei?' },
    { id: 'eco', icon: Disc, text: 'Como economizar?', prompt: 'Com base no meu extrato, como posso economizar dinheiro de forma inteligente?' },
    { id: 'meta', icon: Sparkles, text: 'Definir meta', prompt: 'Me ajude a definir uma meta realista de economia para este mês.' },
  ],
  [
    { id: 'faturas', icon: Receipt, text: 'Faturas em aberto?', prompt: 'Qual o valor total das minhas faturas de cartão de crédito em aberto?' },
    { id: 'saldo', icon: BarChart3, text: 'Quanto sobrou hoje?', prompt: 'Qual é o meu saldo livre hoje considerando minhas contas e despesas?' },
    { id: 'dica', icon: Sparkles, text: 'Dica do dia', prompt: 'Me dê uma dica rápida de educação financeira personalizada para mim.' },
    { id: 'grupos', icon: MessageSquare, text: 'Resumo dos grupos', prompt: 'Resuma como estão minhas finanças pessoais e dos meus grupos compartilhados.' },
  ],
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
    reader.onload = () => {
      const res = String(reader.result || '');
      const idx = res.indexOf(',');
      resolve(idx !== -1 ? res.slice(idx + 1) : res);
    };
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao converter áudio.'));
    reader.onload = () => {
      const res = String(reader.result || '');
      const idx = res.indexOf(',');
      resolve(idx !== -1 ? res.slice(idx + 1) : res);
    };
    reader.readAsDataURL(blob);
  });
}

export default function AssistantPage() {
  const [showHero, setShowHero] = useState(true);
  const [quickSetIndex, setQuickSetIndex] = useState(0);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingStatus, setAnalyzingStatus] = useState('');
  const [attachedFile, setAttachedFile] = useState<AttachedFileState | null>(null);
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [providerKeys, setProviderKeys] = useState<AiProviderKeys>({
    gemini: '',
    openai: '',
    grok: '',
    claude: '',
  });
  const [activeProvider, setActiveProvider] = useState<AiProviderId>('gemini');
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [loadingSpeechId, setLoadingSpeechId] = useState<string | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map());

  // Gravação de áudio no navegador
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const attachDialogRef = useRef<HTMLDialogElement>(null);
  const keyDialogRef = useRef<HTMLDialogElement>(null);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const legacyGemini = window.localStorage.getItem(GEMINI_KEY_STORAGE) || '';
      const rawKeys = window.localStorage.getItem(AI_KEYS_STORAGE);
      const parsedKeys: Partial<AiProviderKeys> = rawKeys ? JSON.parse(rawKeys) : {};
      const mergedKeys: AiProviderKeys = {
        gemini: (parsedKeys.gemini ?? legacyGemini) || '',
        openai: parsedKeys.openai || '',
        grok: parsedKeys.grok || '',
        claude: parsedKeys.claude || '',
      };
      setProviderKeys(mergedKeys);

      const savedProvider = (window.localStorage.getItem(AI_ACTIVE_PROVIDER_STORAGE) || 'gemini') as AiProviderId;
      if (
        savedProvider === 'gemini' ||
        (savedProvider in mergedKeys && mergedKeys[savedProvider]?.trim())
      ) {
        setActiveProvider(savedProvider);
      } else {
        setActiveProvider('gemini');
      }
    } catch {}
  }, []);

  useEffect(() => {
    const dlg = attachDialogRef.current;
    if (!dlg) return;
    if (attachModalOpen && !dlg.open) dlg.showModal();
    else if (!attachModalOpen && dlg.open) dlg.close();
  }, [attachModalOpen]);

  useEffect(() => {
    const dlg = keyDialogRef.current;
    if (!dlg) return;
    if (keyModalOpen && !dlg.open) dlg.showModal();
    else if (!keyModalOpen && dlg.open) dlg.close();
  }, [keyModalOpen]);

  useEffect(() => {
    if (!showHero) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, analyzing, showHero]);

  const getActiveGeminiKey = () => {
    if (providerKeys.gemini && providerKeys.gemini.trim()) {
      return providerKeys.gemini.trim();
    }
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(GEMINI_KEY_STORAGE);
      if (stored && stored.trim()) return stored.trim();
    }
    return BUNDLED_GEMINI_KEY;
  };

  const isProviderAvailable = (id: AiProviderId) => {
    if (id === 'gemini') return true; // Sempre ativa por padrão
    return Boolean(providerKeys[id] && providerKeys[id].trim());
  };

  const handleSelectProvider = (id: AiProviderId) => {
    if (!isProviderAvailable(id)) {
      setKeyModalOpen(true);
      return;
    }
    setActiveProvider(id);
    try {
      window.localStorage.setItem(AI_ACTIVE_PROVIDER_STORAGE, id);
    } catch {}
  };

  const callExternalAiProvider = async ({
    provider,
    messagesList,
    systemInstruction,
    attachment,
  }: {
    provider: Exclude<AiProviderId, 'gemini'>;
    messagesList: Array<{ role: 'user' | 'assistant'; text: string }>;
    systemInstruction?: string;
    attachment?: AttachedFileState | null;
  }): Promise<string> => {
    const apiKey = providerKeys[provider]?.trim();
    if (!apiKey) {
      throw new Error(`Chave da API ${provider.toUpperCase()} não configurada.`);
    }

    const res = await fetch('/api/ai-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        apiKey,
        systemInstruction,
        messages: messagesList,
        attachment: attachment || null,
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.text) {
      throw new Error(data?.error || `Falha ao consultar ${provider.toUpperCase()}.`);
    }
    return data.text;
  };

  const buildFinancialSnapshot = useCallback(async () => {
    const user = getAuthUser();
    const [accounts, cards, personalTxs, groups] = await Promise.all([
      apiFetch<any[]>('/accounts?scope=HOUSEHOLD').catch(() => []),
      apiFetch<any[]>('/credit-cards?scope=HOUSEHOLD').catch(() => []),
      apiFetch<any[]>('/transactions?scope=PERSONAL').catch(() => []),
      fetchUserGroups(),
    ]);
    const groupTxs = await fetchSharedGroupTransactions(groups, null);
    return { user, accounts, cards, personalTxs, groups, groupTxs };
  }, []);

  const callGeminiDirect = async ({
    parts,
    contents,
    systemInstruction,
  }: {
    parts?: any[];
    contents?: any[];
    systemInstruction?: string;
  }): Promise<string> => {
    const apiKey = getActiveGeminiKey();
    const models = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash'];
    let lastErr = '';

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body: Record<string, any> = {
        contents: contents || [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1200,
        },
      };
      if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (txt) return txt;
      } else {
        const errData = await res.json().catch(() => null);
        lastErr = errData?.error?.message || `HTTP ${res.status}`;
      }
    }
    throw new Error(lastErr || 'Falha ao consultar Gemini API.');
  };

  const persistTransactionsFromAiResponse = async (
    rawText: string,
    ctx: { user: any; accounts: any[]; cards: any[] },
  ): Promise<{ cleanText: string; created: CreatedTxCard[] }> => {
    const matches = Array.from(rawText.matchAll(/\[TRANSACTION:\s*(\{[\s\S]*?\})\s*\]/gi));
    const created: CreatedTxCard[] = [];

    for (const m of matches) {
      try {
        const parsed = JSON.parse(m[1]);
        const amount = parseFloat(parsed.amount) || 0;
        if (amount <= 0) continue;
        const catMeta = resolveCategoryMeta(parsed.category || 'outros');
        const isInc = String(parsed.type || 'expense').toLowerCase() === 'income';
        const matchedCard =
          ctx.cards.find(
            (c) =>
              (parsed.cardId && String(c.id) === String(parsed.cardId)) ||
              (parsed.cardName && String(c.name).toLowerCase().includes(String(parsed.cardName).toLowerCase())),
          ) || null;

        await apiFetch('/transactions', {
          method: 'POST',
          body: JSON.stringify({
            description: parsed.description || 'Lançamento via FINN AI',
            amount,
            type: isInc ? 'INCOME' : 'EXPENSE',
            date: new Date().toISOString(),
            accountId: !matchedCard && ctx.accounts?.[0]?.id ? ctx.accounts[0].id : undefined,
            creditCardId: matchedCard?.id || undefined,
            isHouseholdShared: false,
            notes: `[CAT:${catMeta.id}]`,
          }),
        });

        created.push({
          description: parsed.description || 'Lançamento',
          amount,
          type: isInc ? 'income' : 'expense',
          category: `${catMeta.emoji} ${catMeta.label}`,
          cardName: matchedCard?.name || parsed.cardName,
        });
      } catch {
        // ignore invalid JSON tag
      }
    }

    if (created.length > 0) {
      notifyDataChanged();
    }

    const cleanText = rawText
      .replace(/\[(TRANSACTION|ASK_PAYMENT_METHOD|ASK_CARD):[\s\S]*?\]/gi, '')
      .trim();

    return { cleanText: cleanText || 'Pronto! Lançamento registrado no seu extrato.', created };
  };

  const handleSend = async (overridePrompt?: string) => {
    const text = (overridePrompt !== undefined ? overridePrompt : inputText).trim();
    if ((!text && !attachedFile) || analyzing) return;

    const currentAttachment = attachedFile;
    setShowHero(false);
    setInputText('');
    setAttachedFile(null);

    const userDisplayText = currentAttachment
      ? text
        ? `📎 ${currentAttachment.name}\n${text}`
        : `📎 Enviado: ${currentAttachment.name}`
      : text;

    const userMsg: MessageItem = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: userDisplayText,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setAnalyzing(true);

    try {
      setAnalyzingStatus(
        currentAttachment ? `Analisando ${currentAttachment.name}...` : 'Consultando seus dados reais...',
      );

      const ctx = await buildFinancialSnapshot();
      const activeUser = ctx.user?.fullName || ctx.user?.name || 'Você';

      const accSummary = ctx.accounts
        .map((a) => `• ${a.name}: ${formatCurrencyBRL(parseFloat(a.currentBalance ?? 0) || 0)}`)
        .join('\n');
      const cardSummary = ctx.cards
        .map(
          (c) =>
            `• ${c.name} (ID "${c.id}"): Fatura ${formatCurrencyBRL(parseFloat(c.currentBill?.totalAmount ?? 0) || 0)}, Limite ${formatCurrencyBRL(parseFloat(c.creditLimit ?? 0) || 0)}`,
        )
        .join('\n');
      const groupSummary = ctx.groups
        .map((g) => `• Grupo "${g.name}" (${g.members?.length || 1} membros)`)
        .join('\n');
      const txSummary = [...ctx.personalTxs, ...ctx.groupTxs]
        .slice(0, 12)
        .map((t) => {
          const cat = extractCategoryFromTx(t);
          return `• ${String(t.date || '').split('T')[0]} | ${t.description} (${cat.label}): ${formatCurrencyBRL(parseFloat(t.amount) || 0)} [${t.type}]`;
        })
        .join('\n');

      const systemInstruction = `Você é o Agente FINN, consultor financeiro inteligente pessoal e de grupos de ${activeUser}.
Responda sempre em português brasileiro de forma clara, objetiva e amigável.
Nunca peça para o usuário escolher entre modo individual ou família — você analisa tudo junto automaticamente.

DADOS REAIS DE ${activeUser.toUpperCase()}:
Contas:\n${accSummary || '• Nenhuma conta'}
Cartões:\n${cardSummary || '• Nenhum cartão'}
Grupos Compartilhados:\n${groupSummary || '• Nenhum grupo'}
Últimas Movimentações:\n${txSummary || '• Nenhuma movimentação'}

Para registrar despesas ou receitas solicitadas no texto, foto, PDF, CSV ou áudio, confirme brevemente em texto e inclua ao final uma tag para cada item identificado:
[TRANSACTION: {"description": "Nome", "amount": 45.00, "type": "expense", "category": "alimentacao"}]
Categorias válidas: ${OFFICIAL_CATEGORIES.map((c) => c.id).join(', ')}.`;

      let rawAiReply = '';
      const useExternalProvider =
        activeProvider !== 'gemini' &&
        isProviderAvailable(activeProvider) &&
        currentAttachment?.type !== 'audio';

      if (useExternalProvider) {
        try {
          let lastUserPrompt = text;
          if (currentAttachment?.type === 'csv' && currentAttachment.textContent) {
            lastUserPrompt = `Analise esta planilha CSV financeira (${currentAttachment.name}) de ${activeUser}:\n${
              text ? `Instrução do usuário: "${text}"\n` : ''
            }\nConteúdo CSV:\n${currentAttachment.textContent.slice(0, 24000)}\n\nResuma os principais valores e, se o usuário pediu para importar/lançar gastos ou houver lançamentos claros, gere as tags [TRANSACTION: {...}].`;
          } else if (currentAttachment?.type === 'pdf') {
            lastUserPrompt = `Analise este PDF financeiro (${currentAttachment.name}). Identifique emissor, valores, vencimento ou lançamentos.\n${text}`;
          } else if (currentAttachment?.type === 'image') {
            lastUserPrompt = `Analise esta imagem/comprovante financeiro (${currentAttachment.name}). Identifique estabelecimento, valor e categoria.\n${text}`;
          }

          const formattedHistory = nextHistory.slice(-8).map((m, idx, arr) => ({
            role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            text: idx === arr.length - 1 && m.sender === 'user' ? lastUserPrompt : m.text,
          }));

          rawAiReply = await callExternalAiProvider({
            provider: activeProvider as Exclude<AiProviderId, 'gemini'>,
            messagesList: formattedHistory,
            systemInstruction,
            attachment: currentAttachment,
          });
        } catch (extErr) {
          console.warn(`Fallback automático para Gemini (erro em ${activeProvider}):`, extErr);
        }
      }

      if (!rawAiReply) {
        if (currentAttachment) {
          if (currentAttachment.type === 'csv' && currentAttachment.textContent) {
            const prompt = `Analise esta planilha CSV financeira (${currentAttachment.name}) de ${activeUser}:\n${
              text ? `Instrução do usuário: "${text}"\n` : ''
            }\nConteúdo CSV:\n${currentAttachment.textContent.slice(0, 24000)}\n\nResuma os principais valores e, se o usuário pediu para importar/lançar gastos ou houver lançamentos claros, gere as tags [TRANSACTION: {...}].`;
            rawAiReply = await callGeminiDirect({
              parts: [{ text: prompt }],
              systemInstruction,
            });
          } else if (currentAttachment.base64) {
            const typePrompt =
              currentAttachment.type === 'pdf'
                ? `Analise este PDF financeiro (${currentAttachment.name}). Identifique emissor, valores, vencimento ou lançamentos.`
                : currentAttachment.type === 'image'
                  ? `Analise esta imagem/comprovante financeiro (${currentAttachment.name}). Identifique estabelecimento, valor e categoria.`
                  : `Ouça este áudio financeiro de ${activeUser} e responda diretamente ao pedido ou registre o gasto citado.`;

            rawAiReply = await callGeminiDirect({
              parts: [
                { text: `${typePrompt}\n${text ? `Observação: "${text}"` : ''}` },
                {
                  inlineData: {
                    mimeType: currentAttachment.mimeType,
                    data: currentAttachment.base64,
                  },
                },
              ],
              systemInstruction,
            });
          }
        } else {
          try {
            const historyContents = nextHistory.slice(-8).map((m) => ({
              role: m.sender === 'user' ? 'user' : 'model',
              parts: [{ text: m.text }],
            }));
            rawAiReply = await callGeminiDirect({
              contents: historyContents,
              systemInstruction,
            });
          } catch {
            // Fallback para backend NestJS /ai/chat caso Gemini direto falhe
            const backendRes = await apiFetch<{ response: string }>('/ai/chat', {
              method: 'POST',
              body: JSON.stringify({ message: text, scope: 'HOUSEHOLD' }),
            });
            rawAiReply = backendRes.response;
          }
        }
      }

      const { cleanText, created } = await persistTransactionsFromAiResponse(rawAiReply, ctx);

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: cleanText,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          transactions: created,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'ai',
          text: `Desculpe, ocorreu um erro ao processar sua solicitação: ${err.message}`,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setAnalyzing(false);
      setAnalyzingStatus('');
    }
  };

  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'pdf' | 'csv' | 'image' | 'audio',
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAttachModalOpen(false);

    if (kind === 'csv') {
      const textContent = await file.text();
      setAttachedFile({
        type: 'csv',
        name: file.name,
        mimeType: 'text/csv',
        textContent,
      });
    } else {
      const base64 = await fileToBase64(file);
      const fallbackMime =
        kind === 'pdf'
          ? 'application/pdf'
          : kind === 'image'
            ? 'image/jpeg'
            : 'audio/webm';
      setAttachedFile({
        type: kind,
        name: file.name,
        mimeType: file.type || fallbackMime,
        base64,
      });
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      setIsRecording(false);
      setRecordSeconds(0);
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const base64 = await blobToBase64(blob);
        setAttachedFile({
          type: 'audio',
          name: `Áudio gravado (${recordSeconds}s)`,
          mimeType: blob.type || 'audio/webm',
          base64,
        });
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      // Caso o navegador não libere microfone, oferece envio de arquivo de áudio
      audioInputRef.current?.click();
    }
  };

  const stopCurrentSpeech = useCallback(() => {
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch {}
      activeAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
    setLoadingSpeechId(null);
  }, []);

  const handleSpeak = async (id: string, text: string) => {
    if ( typeof window === 'undefined') return;

    // Se já está falando ou carregando essa mesma mensagem, interrompe
    if (speakingId === id || loadingSpeechId === id) {
      stopCurrentSpeech();
      return;
    }

    stopCurrentSpeech();

    try {
      let audioDataUrl = audioCacheRef.current.get(id) || '';
      if (!audioDataUrl) {
        setLoadingSpeechId(id);
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            apiKey: getActiveGeminiKey(),
            voiceName: 'Puck', // Voz masculina neural realista do Gemini
          }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.audioDataUrl) {
          audioDataUrl = data.audioDataUrl;
          audioCacheRef.current.set(id, audioDataUrl);
        } else {
          throw new Error(data?.error || 'Falha na síntese neural');
        }
      }

      setLoadingSpeechId(null);
      const audio = new Audio(audioDataUrl);
      activeAudioRef.current = audio;
      setSpeakingId(id);
      audio.onended = () => {
        if (activeAudioRef.current === audio) {
          activeAudioRef.current = null;
          setSpeakingId(null);
        }
      };
      audio.onerror = () => {
        if (activeAudioRef.current === audio) {
          activeAudioRef.current = null;
          setSpeakingId(null);
        }
      };
      await audio.play();
    } catch {
      // Fallback para voz masculina do navegador apenas se offline
      setLoadingSpeechId(null);
      if ('speechSynthesis' in window) {
        const clean = text.replace(/\*\*(.*?)\*\*/g, '$1');
        const utt = new SpeechSynthesisUtterance(clean);
        utt.lang = 'pt-BR';
        const voices = window.speechSynthesis.getVoices();
        const malePtVoice = voices.find(
          (v) =>
            v.lang.toLowerCase().includes('pt') &&
            /antonio|daniel|fabio|male|google/i.test(v.name),
        );
        if (malePtVoice) utt.voice = malePtVoice;
        utt.rate = 1.05;
        utt.onend = () => setSpeakingId(null);
        utt.onerror = () => setSpeakingId(null);
        setSpeakingId(id);
        window.speechSynthesis.speak(utt);
      }
    }
  };

  const currentQuickSuggestions = QUICK_SETS[quickSetIndex];

  return (
    <main className="min-h-[100dvh] bg-white max-w-4xl mx-auto p-4 sm:p-6 flex flex-col">
      {/* Cabeçalho fiel ao App: Avatar do Robô + Agente FINN (sem divisor Individual/Família) */}
      <header className="flex items-center justify-between pb-4 border-b border-[#EFEAF8] shrink-0">
        <button
          type="button"
          onClick={() => setShowHero((prev) => !prev)}
          className="flex items-center gap-3 text-left rounded-2xl p-1 hover:bg-[#FAF8FF] transition-colors"
        >
          <img
            src="/finn-ai-avatar.png"
            alt="Robô Agente FINN"
            className="w-11 h-11 rounded-full object-cover aspect-square border-2 border-violet-300 shadow-sm shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-finn text-lg tracking-wide text-zinc-900">
                Agente FINN
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                IA Unificada
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              {showHero
                ? 'Seu assistente financeiro pessoal e de grupos'
                : 'Histórico da conversa • Clique para voltar ao início'}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {/* Seletor rápido de API ativa */}
          <div className="hidden sm:flex items-center gap-1 bg-[#FAF8FF] border border-[#EFEAF8] rounded-xl p-1">
            {AI_PROVIDERS_META.map((prov) => {
              const available = isProviderAvailable(prov.id);
              const isSelected = activeProvider === prov.id;
              return (
                <button
                  key={prov.id}
                  type="button"
                  onClick={() => handleSelectProvider(prov.id)}
                  title={
                    available
                      ? `Usar ${prov.name}`
                      : `Clique para adicionar chave da ${prov.name}`
                  }
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 ${
                    isSelected
                      ? 'bg-violet-600 text-white shadow-sm'
                      : available
                        ? 'text-violet-700 hover:bg-violet-100/70'
                        : 'text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected
                        ? 'bg-emerald-300'
                        : available
                          ? 'bg-emerald-500'
                          : 'bg-zinc-300'
                    }`}
                  />
                  {prov.shortName}
                </button>
              );
            })}
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              title="Limpar conversa"
              className="p-2 rounded-xl bg-zinc-50 hover:bg-rose-50 text-zinc-500 hover:text-rose-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setKeyModalOpen(true)}
            title="Gerenciar APIs de IA (Gemini, GPT, Grok, Claude)"
            className="px-3 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <KeyRound className="w-4 h-4" aria-hidden="true" />
            <span className="hidden md:inline">APIs de IA</span>
          </button>
        </div>
      </header>

      {/* Área Principal: Hero Central (idêntico ao App) OU Histórico do Chat */}
      <div className="flex-1 overflow-y-auto py-6">
        {showHero ? (
          <div className="flex flex-col items-center max-w-xl mx-auto">
            {/* Robô 3D Hero com aura roxa */}
            <div className="relative flex items-center justify-center mb-4">
              <div
                aria-hidden="true"
                className="absolute w-40 h-40 rounded-full bg-violet-400/20 blur-2xl pointer-events-none"
              />
              <img
                src="/finn-chat-hero.png"
                alt="Mascote Robô FINN AI"
                className="relative w-40 h-40 sm:w-44 sm:h-44 object-contain aspect-square"
              />
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 text-center mb-5">
              Como posso te ajudar hoje?
            </h2>

            {/* Pílula Dupla: [ Anexar PDF | Anexar CSV ] */}
            <div className="w-full grid grid-cols-2 bg-white border border-[#E9E5F5] rounded-2xl shadow-sm overflow-hidden mb-5">
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className="flex items-center justify-center gap-2 py-3.5 text-sm font-bold text-zinc-800 hover:bg-violet-50 transition-colors"
              >
                <FileText className="w-4 h-4 text-violet-600" aria-hidden="true" />
                <span>Anexar PDF</span>
              </button>
              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                className="flex items-center justify-center gap-2 py-3.5 text-sm font-bold text-zinc-800 hover:bg-violet-50 border-l border-[#EFEAF8] transition-colors"
              >
                <Table2 className="w-4 h-4 text-violet-600" aria-hidden="true" />
                <span>Anexar CSV</span>
              </button>
            </div>

            {/* 4 Cards Principais com Seta */}
            <div className="w-full flex flex-col gap-2.5 mb-6">
              <button
                type="button"
                onClick={() =>
                  handleSend(
                    'Gere um resumo financeiro inteligente do meu mês atual, com saldo total, despesas por categoria e sugestões.',
                  )
                }
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-[#EFEAF8] hover:border-violet-300 shadow-sm transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-5 h-5" aria-hidden="true" />
                </div>
                <span className="flex-1 text-sm font-bold text-zinc-900">
                  Ver meu resumo financeiro
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-400" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSend(
                    'Como devo planejar meu orçamento para este mês para bater minhas metas financeiras?',
                  )
                }
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-[#EFEAF8] hover:border-violet-300 shadow-sm transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" aria-hidden="true" />
                </div>
                <span className="flex-1 text-sm font-bold text-zinc-900">
                  Planejar o mês
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-400" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSend(
                    'Analise meus gastos recentes e me dê 3 sugestões práticas e personalizadas para economizar dinheiro.',
                  )
                }
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-[#EFEAF8] hover:border-violet-300 shadow-sm transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                  <Disc className="w-5 h-5" aria-hidden="true" />
                </div>
                <span className="flex-1 text-sm font-bold text-zinc-900">
                  Sugestões para economizar
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-400" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => setAttachModalOpen(true)}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-[#EFEAF8] hover:border-violet-300 shadow-sm transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
                  <Receipt className="w-5 h-5" aria-hidden="true" />
                </div>
                <span className="flex-1 text-sm font-bold text-zinc-900">
                  Registrar um gasto (Foto, PDF, CSV ou Áudio)
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-400" aria-hidden="true" />
              </button>
            </div>

            {/* Sugestões Rápidas 2x2 + Botão Trocar */}
            <div className="w-full flex items-center justify-between mb-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
                Sugestões rápidas
              </span>
              <button
                type="button"
                onClick={() => setQuickSetIndex((p) => (p + 1) % QUICK_SETS.length)}
                className="flex items-center gap-1 text-xs font-bold text-violet-700 hover:underline"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Trocar</span>
              </button>
            </div>

            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {currentQuickSuggestions.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSend(item.prompt)}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#FAF8FF] border border-[#E9E5F5] hover:border-violet-400 text-left text-xs font-bold text-zinc-800 transition-colors"
                  >
                    <Icon className="w-4 h-4 text-violet-600 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.text}</span>
                  </button>
                );
              })}
            </div>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHero(false)}
                className="mt-5 px-5 py-2.5 rounded-full bg-violet-50 text-violet-700 text-xs font-bold border border-violet-200 flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" aria-hidden="true" />
                Ver histórico da conversa ({messages.length})
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setShowHero(true)}
              className="self-center px-4 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-xs font-bold flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              Início &amp; Sugestões do Robô
            </button>

            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <img
                      src="/finn-ai-avatar.png"
                      alt="Robô FINN"
                      className="w-8 h-8 rounded-full object-cover aspect-square border border-violet-200 shrink-0 mt-1"
                    />
                  )}
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-3xl p-4 text-sm leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-violet-600 text-white rounded-tr-sm shadow-md shadow-violet-600/15'
                        : 'bg-white text-zinc-800 border border-[#EFEAF8] rounded-tl-sm shadow-sm'
                    }`}
                  >
                    <p>{msg.text}</p>

                    {msg.transactions && msg.transactions.length > 0 && (
                      <div className="mt-3 flex flex-col gap-2">
                        {msg.transactions.map((t, i) => (
                          <div
                            key={i}
                            className="p-3 rounded-2xl bg-[#FAF8FF] border border-violet-200 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2">
                              {t.type === 'income' ? (
                                <ArrowUpCircle className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                              ) : (
                                <ArrowDownCircle className="w-4 h-4 text-rose-600" aria-hidden="true" />
                              )}
                              <div>
                                <p className="text-xs font-bold text-zinc-900">{t.description}</p>
                                <p className="text-[11px] text-zinc-500">
                                  {t.category}
                                  {t.cardName ? ` • Cartão ${t.cardName}` : ''}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`text-xs font-extrabold ${
                                t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {formatCurrencyBRL(t.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => handleSpeak(msg.id, msg.text)}
                        className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 hover:bg-violet-100 text-[11px] font-bold text-violet-700 transition-colors"
                      >
                        <Volume2
                          className={`w-3.5 h-3.5 ${
                            loadingSpeechId === msg.id || speakingId === msg.id
                              ? 'animate-pulse text-violet-600'
                              : ''
                          }`}
                          aria-hidden="true"
                        />
                        {loadingSpeechId === msg.id
                          ? 'Gerando voz...'
                          : speakingId === msg.id
                            ? 'Parar voz'
                            : 'Ouvir resposta'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {analyzing && (
              <div className="flex items-center gap-2.5">
                <img
                  src="/finn-ai-avatar.png"
                  alt="Robô FINN pensando"
                  className="w-8 h-8 rounded-full object-cover aspect-square border border-violet-200 shrink-0"
                />
                <div className="px-4 py-3 rounded-2xl bg-[#FAF8FF] border border-[#EFEAF8] text-xs font-semibold text-violet-700">
                  {analyzingStatus || 'FINN está analisando...'}
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Pré-visualização de anexo antes do envio */}
      {attachedFile && (
        <div className="mb-2 px-3.5 py-2.5 rounded-2xl bg-violet-50 border border-violet-200 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-violet-700 shrink-0" aria-hidden="true" />
            <span className="text-xs font-bold text-violet-900 truncate">{attachedFile.name}</span>
          </div>
          <button
            type="button"
            onClick={() => setAttachedFile(null)}
            className="text-violet-700 hover:text-rose-600 p-1"
            aria-label="Remover anexo"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Barra de Entrada igual ao App (Anexar + Texto + Microfone/Enviar) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 p-2 bg-white border border-[#E2DAF5] rounded-2xl shadow-sm shrink-0"
      >
        <button
          type="button"
          onClick={() => setAttachModalOpen(true)}
          title="Anexar Foto, PDF, CSV ou Áudio"
          className="p-2.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 transition-colors shrink-0"
        >
          <Paperclip className="w-5 h-5" aria-hidden="true" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            isRecording
              ? `Gravando áudio (${recordSeconds}s)... clique no quadrado para parar`
              : 'Pergunte ao Agente FINN ou descreva um gasto...'
          }
          className="flex-1 bg-transparent px-2 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
        />

        <button
          type="button"
          onClick={handleToggleRecording}
          title={isRecording ? 'Parar gravação' : 'Gravar áudio ou enviar arquivo de áudio'}
          className={`p-2.5 rounded-xl transition-colors shrink-0 ${
            isRecording
              ? 'bg-rose-600 text-white animate-pulse'
              : 'bg-violet-50 hover:bg-violet-100 text-violet-700'
          }`}
        >
          {isRecording ? <Square className="w-5 h-5" aria-hidden="true" /> : <Mic className="w-5 h-5" aria-hidden="true" />}
        </button>

        <button
          type="submit"
          disabled={analyzing || (!inputText.trim() && !attachedFile)}
          className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white transition-colors shrink-0"
          aria-label="Enviar mensagem"
        >
          <Send className="w-5 h-5" aria-hidden="true" />
        </button>
      </form>

      {/* Inputs ocultos de arquivo */}
      <input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => handleFileSelected(e, 'pdf')} />
      <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFileSelected(e, 'csv')} />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelected(e, 'image')} />
      <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileSelected(e, 'audio')} />

      {/* Modal de Opções de Anexo (Foto, PDF, CSV, Áudio) */}
      <dialog
        ref={attachDialogRef}
        aria-labelledby="attach-modal-title"
        closedby="any"
        onClose={() => setAttachModalOpen(false)}
        onClick={(e) => {
          if (e.target === attachDialogRef.current) setAttachModalOpen(false);
        }}
        className="finn-dialog"
      >
        <div className="bg-white border border-[#EFEAF8] rounded-3xl p-6 shadow-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <h3 id="attach-modal-title" className="text-base font-bold text-zinc-900">
              Enviar arquivo para o Agente FINN
            </h3>
            <button type="button" onClick={() => setAttachModalOpen(false)} className="text-zinc-400">
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#FAF8FF] hover:bg-violet-50 border border-[#E9E5F5] text-left"
          >
            <ImageIcon className="w-5 h-5 text-violet-700" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-zinc-900">Foto / Comprovante</p>
              <p className="text-xs text-zinc-500">PIX, cupom fiscal ou print da compra</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => pdfInputRef.current?.click()}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#FAF8FF] hover:bg-violet-50 border border-[#E9E5F5] text-left"
          >
            <FileText className="w-5 h-5 text-violet-700" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-zinc-900">Fatura / Boleto em PDF</p>
              <p className="text-xs text-zinc-500">Leitura inteligente de documento PDF</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#FAF8FF] hover:bg-violet-50 border border-[#E9E5F5] text-left"
          >
            <Table2 className="w-5 h-5 text-violet-700" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-zinc-900">Planilha CSV</p>
              <p className="text-xs text-zinc-500">Importar e analisar extratos bancários CSV</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => audioInputRef.current?.click()}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#FAF8FF] hover:bg-violet-50 border border-[#E9E5F5] text-left"
          >
            <Mic className="w-5 h-5 text-violet-700" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-zinc-900">Enviar Arquivo de Áudio</p>
              <p className="text-xs text-zinc-500">Ou use o microfone na barra inferior para gravar</p>
            </div>
          </button>
        </div>
      </dialog>

      {/* Modal Multi-API: Gemini (Sempre ativa) + ChatGPT, Grok e Claude como adicionais */}
      <dialog
        ref={keyDialogRef}
        aria-labelledby="key-modal-title"
        closedby="any"
        onClose={() => setKeyModalOpen(false)}
        onClick={(e) => {
          if (e.target === keyDialogRef.current) setKeyModalOpen(false);
        }}
        className="finn-dialog"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const cleanKeys: AiProviderKeys = {
                gemini: providerKeys.gemini.trim(),
                openai: providerKeys.openai.trim(),
                grok: providerKeys.grok.trim(),
                claude: providerKeys.claude.trim(),
              };
              setProviderKeys(cleanKeys);
              window.localStorage.setItem(AI_KEYS_STORAGE, JSON.stringify(cleanKeys));
              if (cleanKeys.gemini) {
                window.localStorage.setItem(GEMINI_KEY_STORAGE, cleanKeys.gemini);
              } else {
                window.localStorage.removeItem(GEMINI_KEY_STORAGE);
              }

              // Se o provedor selecionado não tiver chave, volta automaticamente para o Gemini (sempre ativo)
              const resolvedActive =
                activeProvider === 'gemini' || cleanKeys[activeProvider]
                  ? activeProvider
                  : 'gemini';
              setActiveProvider(resolvedActive);
              window.localStorage.setItem(AI_ACTIVE_PROVIDER_STORAGE, resolvedActive);
            } catch {}
            setKeyModalOpen(false);
          }}
          className="bg-white border border-[#EFEAF8] rounded-3xl p-6 shadow-2xl flex flex-col gap-4 max-h-[88vh] overflow-y-auto"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="key-modal-title" className="text-base font-extrabold text-zinc-900">
                Central de APIs de IA
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                A API do <strong>Google Gemini permanece sempre ativa</strong> por padrão. Você pode adicionar chaves do <strong>ChatGPT</strong>, <strong>Grok</strong> ou <strong>Claude</strong> como adicionais e escolher qual usar:
              </p>
            </div>
            <button
              type="button"
              onClick={() => setKeyModalOpen(false)}
              className="text-zinc-400 hover:text-zinc-600 p-1"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {AI_PROVIDERS_META.map((prov) => {
              const hasKey = prov.alwaysActive || Boolean(providerKeys[prov.id]?.trim());
              const isSelected = activeProvider === prov.id;

              return (
                <div
                  key={prov.id}
                  className={`rounded-2xl border p-3.5 transition-all ${
                    isSelected
                      ? 'border-violet-600 bg-violet-50/40 shadow-sm'
                      : 'border-[#EFEAF8] bg-[#FAF8FF]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-900">{prov.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          prov.alwaysActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : hasKey
                              ? 'bg-violet-100 text-violet-800'
                              : 'bg-zinc-100 text-zinc-500'
                        }`}
                      >
                        {prov.alwaysActive ? 'Sempre Ativa' : hasKey ? 'Chave Configurada' : prov.badge}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!hasKey}
                      onClick={() => setActiveProvider(prov.id)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                        isSelected
                          ? 'bg-violet-600 text-white'
                          : hasKey
                            ? 'bg-white border border-violet-300 text-violet-700 hover:bg-violet-50'
                            : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                      }`}
                    >
                      {isSelected ? '✓ Em uso agora' : 'Selecionar para uso'}
                    </button>
                  </div>

                  <p className="text-[11px] text-zinc-500 mb-2">{prov.description}</p>

                  <input
                    type="password"
                    value={providerKeys[prov.id]}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProviderKeys((prev) => ({ ...prev, [prov.id]: val }));
                      if (val.trim() && activeProvider === 'gemini' && prov.id !== 'gemini') {
                        // Permite selecionar assim que digitar a chave
                        setActiveProvider(prov.id);
                      }
                    }}
                    placeholder={prov.placeholder}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 bg-white text-xs text-zinc-900 focus:outline-none focus:border-violet-600"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#EFEAF8]">
            <span className="text-[11px] text-zinc-500">
              IA selecionada:{' '}
              <strong className="text-violet-700">
                {AI_PROVIDERS_META.find((p) => p.id === activeProvider)?.name}
              </strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setKeyModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-sm transition-colors"
              >
                Salvar e Aplicar
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </main>
  );
}
