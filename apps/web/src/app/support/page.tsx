'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Headset,
  Bug,
  Send,
  Image as ImageIcon,
  X,
  CheckCircle2,
  Clock,
  HelpCircle,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch, getAuthUser } from '@/lib/api';

interface AttachedPrint {
  id: string;
  name: string;
  dataUrl: string;
}

interface SupportTicketItem {
  protocol: string;
  kind: 'support' | 'bug';
  subject: string;
  category: string;
  message: string;
  email: string;
  printsCount: number;
  status: 'Recebido' | 'Em análise';
  createdAt: string;
}

const SUPPORT_HISTORY_KEY = 'finn_web_support_tickets_v1';

const SUPPORT_CATEGORIES = [
  { id: 'duvida', label: 'Dúvida sobre funcionalidades' },
  { id: 'conta', label: 'Minha Conta / Login / Senha' },
  { id: 'grupos', label: 'Grupos Compartilhados' },
  { id: 'cartoes', label: 'Cartões e Contas Bancárias' },
  { id: 'ia', label: 'Agente FINN (IA)' },
  { id: 'financeiro', label: 'Assinatura / Pagamentos' },
  { id: 'bug', label: 'Relato de Bug / Erro Técnico' },
  { id: 'outros', label: 'Outros assuntos' },
];

export default function SupportPage() {
  const user = getAuthUser();
  const [activeTab, setActiveTab] = useState<'support' | 'bug'>('support');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('duvida');
  const [message, setMessage] = useState('');
  const [prints, setPrints] = useState<AttachedPrint[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successTicket, setSuccessTicket] = useState<SupportTicketItem | null>(null);
  const [ticketsHistory, setTicketsHistory] = useState<SupportTicketItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.fullName || user.name || '');
      setEmail(user.email || '');
    }
    try {
      const saved = window.localStorage.getItem(SUPPORT_HISTORY_KEY);
      if (saved) {
        setTicketsHistory(JSON.parse(saved));
      }
    } catch {}

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('type') === 'bug') {
        setActiveTab('bug');
        setCategory('bug');
      }
    }
  }, [user?.id]);

  const handleSelectPrints = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    files.slice(0, 5 - prints.length).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        if (!result) return;
        setPrints((prev) =>
          [
            ...prev,
            {
              id: `prt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: file.name,
              dataUrl: result,
            },
          ].slice(0, 5),
        );
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePrint = (id: string) => {
    setPrints((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && prints.length === 0) return;

    setSubmitting(true);
    setSuccessTicket(null);

    const prefix = activeTab === 'bug' ? 'BUG' : 'SUP';
    const protocol = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    const ticket: SupportTicketItem = {
      protocol,
      kind: activeTab,
      subject:
        subject.trim() ||
        (activeTab === 'bug' ? 'Relato de Bug na Plataforma' : 'Solicitação de Suporte'),
      category: activeTab === 'bug' ? 'bug' : category,
      message: message.trim(),
      email: email.trim() || user?.email || '',
      printsCount: prints.length,
      status: 'Recebido',
      createdAt: new Date().toISOString(),
    };

    try {
      await apiFetch('/notifications', {
        method: 'POST',
        body: JSON.stringify({
          id: `support-${Date.now()}`,
          title:
            activeTab === 'bug'
              ? `🐞 Bug Reportado (${protocol})`
              : `🎧 Chamado de Suporte (${protocol}): ${ticket.subject}`,
          body: ticket.message || `Enviado com ${prints.length} anexo(s).`,
          type: 'BUG_REPORT',
          category: 'sistema',
          priority: 'high',
          dedupeKey: `bug_report_${protocol}`,
          read: true,
          sendPush: false,
          meta: {
            kind: 'bug_report',
            ticketKind: activeTab,
            protocol,
            userName: name.trim() || user?.fullName || 'Cliente',
            userEmail: ticket.email,
            subject: ticket.subject,
            supportCategory: ticket.category,
            screenshotsCount: prints.length,
            screenshots: prints.map((p) => ({
              name: p.name,
              dataUrl: p.dataUrl.slice(0, 120000),
            })),
          },
        }),
      }).catch(() => {});

      const nextHistory = [ticket, ...ticketsHistory].slice(0, 25);
      setTicketsHistory(nextHistory);
      try {
        window.localStorage.setItem(SUPPORT_HISTORY_KEY, JSON.stringify(nextHistory));
      } catch {}

      setSuccessTicket(ticket);
      setSubject('');
      setMessage('');
      setPrints([]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-white max-w-5xl mx-auto p-4 sm:p-8 flex flex-col gap-6">
      {/* Cabeçalho da Central de Suporte */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#EFEAF8]">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
            <Headset className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="finn-page-title font-extrabold text-zinc-900">
              Central de Suporte &amp; Atendimento
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Preencha o formulário abaixo para falar com nossa equipe ou reportar um problema técnico.
            </p>
          </div>
        </div>

        {/* Alternador: Suporte vs Reportar Bug */}
        <div className="inline-flex bg-[#F6F3FF] p-1 rounded-2xl border border-[#E9E3FA] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('support');
              if (category === 'bug') setCategory('duvida');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'support'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-zinc-600 hover:text-violet-700'
            }`}
          >
            <Headset className="w-3.5 h-3.5" aria-hidden="true" />
            Atendimento / Suporte
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('bug');
              setCategory('bug');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'bug'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-zinc-600 hover:text-violet-700'
            }`}
          >
            <Bug className="w-3.5 h-3.5" aria-hidden="true" />
            Reportar um Bug
          </button>
        </div>
      </header>

      {successTicket && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-emerald-900">
                Solicitação enviada com sucesso! Protocolo #{successTicket.protocol}
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Nossa equipe recebeu sua mensagem
                {successTicket.printsCount > 0
                  ? ` e ${successTicket.printsCount} print(s) anexado(s)`
                  : ''}
                . Responderemos no e-mail <strong>{successTicket.email}</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuccessTicket(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Principal: Formulário de Preenchimento */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 bg-white border border-[#EFEAF8] rounded-3xl p-6 shadow-sm flex flex-col gap-4"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-[#F3F0FA]">
            {activeTab === 'bug' ? (
              <Bug className="w-4 h-4 text-violet-700" aria-hidden="true" />
            ) : (
              <MessageSquare className="w-4 h-4 text-violet-700" aria-hidden="true" />
            )}
            <h2 className="text-sm font-extrabold text-zinc-900">
              {activeTab === 'bug'
                ? 'Achou algum bug? Descreva e envie prints'
                : 'Formulário de Solicitação de Suporte'}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sup-name" className="block text-xs font-bold text-zinc-700 mb-1.5">
                Seu nome
              </label>
              <input
                id="sup-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Como podemos te chamar?"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8FF] border border-[#E2DAF5] text-sm text-zinc-900 focus:outline-none focus:border-violet-600"
              />
            </div>

            <div>
              <label htmlFor="sup-email" className="block text-xs font-bold text-zinc-700 mb-1.5">
                E-mail para retorno
              </label>
              <input
                id="sup-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8FF] border border-[#E2DAF5] text-sm text-zinc-900 focus:outline-none focus:border-violet-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sup-category" className="block text-xs font-bold text-zinc-700 mb-1.5">
                Categoria do atendimento
              </label>
              <select
                id="sup-category"
                value={activeTab === 'bug' ? 'bug' : category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8FF] border border-[#E2DAF5] text-sm text-zinc-900 focus:outline-none focus:border-violet-600"
              >
                {SUPPORT_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sup-subject" className="block text-xs font-bold text-zinc-700 mb-1.5">
                Assunto
              </label>
              <input
                id="sup-subject"
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={
                  activeTab === 'bug'
                    ? 'Ex: Erro ao salvar cartão / Tela piscando'
                    : 'Resumo da sua dúvida ou solicitação'
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8FF] border border-[#E2DAF5] text-sm text-zinc-900 focus:outline-none focus:border-violet-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="sup-message" className="block text-xs font-bold text-zinc-700 mb-1.5">
              {activeTab === 'bug'
                ? 'Descrição do bug encontrado'
                : 'Descreva como podemos ajudar você'}
            </label>
            <textarea
              id="sup-message"
              rows={5}
              required={prints.length === 0}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                activeTab === 'bug'
                  ? 'Conte o que aconteceu, em qual tela você estava e o que esperava que acontecesse...'
                  : 'Escreva os detalhes da sua solicitação para nossa equipe de suporte...'
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8FF] border border-[#E2DAF5] text-sm text-zinc-900 focus:outline-none focus:border-violet-600 resize-y"
            />
          </div>

          {/* Anexo de Prints / Imagens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-zinc-700">
                Prints / Capturas de tela ({prints.length}/5)
              </span>
              {prints.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-bold text-violet-700 hover:text-violet-800 flex items-center gap-1"
                >
                  <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  + Anexar print
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleSelectPrints}
              className="hidden"
            />

            {prints.length > 0 ? (
              <div className="flex items-center gap-3 flex-wrap">
                {prints.map((p) => (
                  <div
                    key={p.id}
                    className="relative w-24 h-24 rounded-2xl overflow-hidden border border-violet-200 bg-zinc-50 group"
                  >
                    <img src={p.dataUrl} alt={p.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePrint(p.id)}
                      title="Remover print"
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shadow"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-5 px-4 rounded-2xl border-2 border-dashed border-violet-200 bg-[#FAF8FF] hover:bg-violet-50/50 transition-colors flex flex-col items-center justify-center gap-1.5 text-center"
              >
                <ImageIcon className="w-6 h-6 text-violet-600" aria-hidden="true" />
                <span className="text-xs font-bold text-violet-800">
                  Clique para anexar prints ou capturas de tela (opcional)
                </span>
                <span className="text-[11px] text-zinc-500">
                  Suporta PNG, JPG ou WEBP (até 5 imagens)
                </span>
              </button>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting || (!message.trim() && prints.length === 0)}
              className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-violet-600/20 transition-colors"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>
                {submitting
                  ? 'Enviando...'
                  : activeTab === 'bug'
                    ? 'Enviar Relato de Bug'
                    : 'Enviar Solicitação de Suporte'}
              </span>
            </button>
          </div>
        </form>

        {/* Coluna Lateral: Informações & Histórico de Protocolos */}
        <div className="flex flex-col gap-4">
          <div className="bg-[#FAF8FF] border border-[#EFEAF8] rounded-3xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-violet-700">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
              <h3 className="text-sm font-extrabold text-zinc-900">Atendimento Prioritário</h3>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Todos os chamados abertos por aqui recebem um número de protocolo único e são sincronizados diretamente com nossa equipe técnica.
            </p>
            <div className="pt-2 border-t border-[#E9E3FA] flex flex-col gap-1.5 text-xs text-zinc-600">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-violet-600" aria-hidden="true" />
                <span>Tempo médio de resposta: até 24h úteis</span>
              </div>
              <div className="flex items-center gap-2">
                <HelpCircle className="w-3.5 h-3.5 text-violet-600" aria-hidden="true" />
                <span>Anexe prints para agilizar a análise</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#EFEAF8] rounded-3xl p-5 flex flex-col gap-3">
            <h3 className="text-sm font-extrabold text-zinc-900">
              Meus Chamados Recentes ({ticketsHistory.length})
            </h3>
            {ticketsHistory.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4 text-center">
                Nenhum chamado ou bug reportado ainda.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-80 overflow-y-auto pr-1">
                {ticketsHistory.map((item) => (
                  <div
                    key={item.protocol}
                    className="p-3 rounded-2xl bg-[#FAF8FF] border border-[#EFEAF8] flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono font-extrabold text-violet-700">
                        #{item.protocol}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-zinc-900 truncate">{item.subject}</p>
                    <p className="text-[11px] text-zinc-500 line-clamp-2">{item.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
