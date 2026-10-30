'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Users,
  Target,
  CheckCircle2,
  XCircle,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { formatCurrencyBRL } from '@finn-ai/ui';

interface MessageItem {
  id: string;
  sender: 'user' | 'finn';
  content: string;
  actionDraft?: {
    draftId: string;
    actionType: string;
    title: string;
    targetAmount: number;
    targetDate: string;
    isHouseholdShared: boolean;
  };
  draftStatus?: 'PENDING' | 'APPROVED' | 'DISCARDED';
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'welcome',
      sender: 'finn',
      content:
        'Olá! Eu sou o **FINN**, seu agente financeiro familiar com inteligência artificial.\n\n' +
        'Estou pronto para analisar seus saldos reais, avaliar sua taxa de poupança, inspecionar gastos por categoria e propor planos de metas para o casal.\n\n' +
        'Como posso te ajudar hoje?',
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [scope, setScope] = useState<'PERSONAL' | 'HOUSEHOLD'>('HOUSEHOLD');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const newMessages: MessageItem[] = [
      ...messages,
      { id: userMsgId, sender: 'user', content: text },
    ];

    setMessages(newMessages);
    setInputText('');
    setLoading(true);

    try {
      const res = await apiFetch<{
        conversationId: string;
        response: string;
        actionDraft?: any;
      }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          conversationId,
          scope,
        }),
      });

      setConversationId(res.conversationId);

      setMessages([
        ...newMessages,
        {
          id: `finn-${Date.now()}`,
          sender: 'finn',
          content: res.response,
          actionDraft: res.actionDraft,
          draftStatus: res.actionDraft ? 'PENDING' : undefined,
        },
      ]);
    } catch (err: any) {
      setMessages([
        ...newMessages,
        {
          id: `error-${Date.now()}`,
          sender: 'finn',
          content: `Desculpe, ocorreu um erro ao consultar seus dados: ${err.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDraft = async (msgId: string, draftId: string) => {
    try {
      const res = await apiFetch<{ message: string }>('/ai/confirm-draft', {
        method: 'POST',
        body: JSON.stringify({ draftId }),
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                draftStatus: 'APPROVED',
                content: `${m.content}\n\n✅ **${res.message}**`,
              }
            : m,
        ),
      );
    } catch (err: any) {
      alert(`Falha ao aprovar meta: ${err.message}`);
    }
  };

  const handleDiscardDraft = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              draftStatus: 'DISCARDED',
              content: `${m.content}\n\n❌ *Proposta de meta descartada pelo usuário.*`,
            }
          : m,
      ),
    );
  };

  const quickPrompts = [
    'Quanto gastamos este mês e qual nosso saldo?',
    'Onde estamos gastando mais?',
    'Cria uma meta para juntar R$ 12.000 para viagem',
    'Qual nossa taxa de poupança atual?',
  ];

  return (
    <main className="max-w-4xl mx-auto p-4 sm:p-6 flex flex-col h-[calc(100vh-4rem)]">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base text-slate-900 dark:text-white">
                Agente FINN
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                Google Gemini
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Consultor financeiro do casal com Function Calling e Ações em 2 Etapas
            </p>
          </div>
        </div>

        {/* Scope Selector */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setScope('PERSONAL')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              scope === 'PERSONAL'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Individual
          </button>
          <button
            onClick={() => setScope('HOUSEHOLD')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              scope === 'HOUSEHOLD'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Familiar
          </button>
        </div>
      </div>

      {/* Área de Mensagens com Scroll */}
      <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-4">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-3xl p-4 sm:p-5 text-sm leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? 'bg-brand-600 text-white rounded-tr-sm shadow-md shadow-brand-500/10'
                    : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 rounded-tl-sm shadow-sm'
                }`}
              >
                {msg.content}

                {/* Card de Aprovação em 2 Etapas */}
                {msg.actionDraft && msg.draftStatus === 'PENDING' && (
                  <div className="mt-4 p-4 rounded-2xl bg-brand-50/70 dark:bg-slate-850 border border-brand-200 dark:border-brand-800 text-slate-900 dark:text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">
                        Proposta de Meta Financeira
                      </h4>
                    </div>

                    <div className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300 mb-4">
                      <p><strong>Objetivo:</strong> {msg.actionDraft.title}</p>
                      <p><strong>Valor Alvo:</strong> {formatCurrencyBRL(msg.actionDraft.targetAmount)}</p>
                      <p><strong>Prazo Desejado:</strong> {msg.actionDraft.targetDate}</p>
                      <p><strong>Visibilidade:</strong> {msg.actionDraft.isHouseholdShared ? 'Família (Casal)' : 'Individual'}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApproveDraft(msg.id, msg.actionDraft!.draftId)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Aprovar Meta</span>
                      </button>
                      <button
                        onClick={() => handleDiscardDraft(msg.id)}
                        className="py-2 px-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-all"
                      >
                        Descartar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-2 text-slate-400 text-xs italic p-2">
            <Bot className="w-4 h-4 animate-bounce text-brand-500" />
            <span>FINN está analisando seus dados bancários...</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Prompts Rápidos Sugeridos */}
      <div className="py-2 flex items-center gap-2 overflow-x-auto shrink-0 pb-3 no-scrollbar">
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            disabled={loading}
            onClick={() => handleSendMessage(prompt)}
            className="whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-850 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Caixa de Entrada de Mensagem */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Pergunte ao FINN (ex: 'Quanto gastamos com mercado?', 'Crie uma meta de viagem')..."
            className="flex-1 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-slate-900 dark:text-white shadow-sm"
          />
          <button
            type="submit"
            disabled={loading || !inputText.trim()}
            className="p-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-2xl transition-all shadow-md shadow-brand-500/20"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </main>
  );
}

