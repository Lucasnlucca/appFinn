'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  UserPlus,
  Mail,
  Copy,
  Check,
  AlertCircle,
  Lock,
  Eye,
  Settings,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Member {
  id: string;
  fullName: string;
  email: string;
  role: string;
  joinedAt: string;
}

interface HouseholdData {
  id: string;
  name: string;
  currency: string;
  currentUserRole: string;
  members: Member[];
  pendingInvitations: Array<{
    id: string;
    email: string;
    role: string;
    expiresAt: string;
  }>;
}

export default function HouseholdPage() {
  const [household, setHousehold] = useState<HouseholdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [householdName, setHouseholdName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadHousehold = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<HouseholdData | null>('/households/current');
      setHousehold(data);
    } catch (err: any) {
      console.warn('Falha ao carregar família:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHousehold();
  }, []);

  const handleCreateHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);
    try {
      await apiFetch('/households', {
        method: 'POST',
        body: JSON.stringify({ name: householdName }),
      });
      setFeedbackMsg({ type: 'success', text: 'Núcleo familiar criado com sucesso!' });
      loadHousehold();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);
    try {
      const res = await apiFetch<{ invitationLink: string }>('/households/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail }),
      });
      const fullUrl = `${window.location.origin}${res.invitationLink}`;
      setInvitationLink(fullUrl);
      setInviteEmail('');
      setFeedbackMsg({ type: 'success', text: 'Convite gerado! Compartilhe o link com seu cônjuge.' });
      loadHousehold();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    }
  };

  const copyToClipboard = () => {
    if (invitationLink) {
      navigator.clipboard.writeText(invitationLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-10 text-center text-slate-500">
        Carregando informações do núcleo familiar...
      </div>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-10 flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Núcleo Familiar & Governança
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Privacidade Ativa
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gerenciamento do casal, convites seguros e controle granular de compartilhamento financeiro.
          </p>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-2 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* CASO 1: Usuário ainda não tem Household criado */}
      {!household ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-xl mx-auto text-center shadow-lg shadow-slate-200/40 dark:shadow-none">
          <div className="w-14 h-14 rounded-2xl bg-brand-100 dark:bg-brand-950/60 text-brand-600 flex items-center justify-center mx-auto mb-4 border border-brand-200 dark:border-brand-800">
            <Users className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Criar seu Núcleo Familiar
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto mb-6">
            O Núcleo Familiar permite que você e seu cônjuge planejem o futuro juntos, sem abrir mão do controle e da privacidade das suas contas individuais.
          </p>

          <form onSubmit={handleCreateHousehold} className="flex flex-col gap-3 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nome do Núcleo Familiar
              </label>
              <input
                type="text"
                required
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="Ex: Família Silva, Nosso Lar"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
            <button
              type="submit"
              className="w-full mt-2 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-brand-500/20"
            >
              Criar Família & Começar
            </button>
          </form>
        </div>
      ) : (
        /* CASO 2: Usuário já possui Household ativo */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna da Esquerda: Membros e Convite */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Card Família */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                    Núcleo Familiar Ativo
                  </span>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {household.name}
                  </h2>
                </div>
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700">
                  Moeda: {household.currency}
                </span>
              </div>

              {/* Lista de Membros */}
              <div className="mt-4 flex flex-col gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Membros Cadastrados ({household.members.length})
                </h3>
                {household.members.map((member) => (
                  <div
                    key={member.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 font-bold flex items-center justify-center border border-brand-500/20 text-sm">
                        {member.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {member.fullName}
                        </p>
                        <p className="text-xs text-slate-500">{member.email}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        member.role === 'OWNER'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                      }`}
                    >
                      {member.role === 'OWNER' ? 'Administrador(a)' : 'Cônjuge / Membro'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card Convidar Cônjuge */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <UserPlus className="w-5 h-5 text-brand-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Convidar Cônjuge
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Envie um convite protegido por criptografia para o e-mail da sua esposa/marido. O convite é válido por 7 dias.
              </p>

              <form onSubmit={handleSendInvite} className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email.do.conjuge@exemplo.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-sm transition-all whitespace-nowrap"
                >
                  Gerar Convite
                </button>
              </form>

              {invitationLink && (
                <div className="mt-4 p-4 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800">
                  <p className="text-xs font-semibold text-brand-900 dark:text-brand-300 mb-1.5">
                    Link Seguro de Cadastro Gerado:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={invitationLink}
                      className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 rounded-lg border border-brand-200 dark:border-brand-800 text-slate-700 dark:text-slate-300 select-all"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Coluna da Direita: Regras de Privacidade e Compartilhamento */}
          <div className="flex flex-col gap-6">
            <div className="p-6 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-xl flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-400" />
                <h3 className="font-bold text-sm">Privacidade por Design</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                No FINN AI, pertencer à mesma família <strong>não</strong> concede acesso irrestrito automático às contas do cônjuge.
              </p>

              <div className="flex flex-col gap-3 pt-2 border-t border-slate-800">
                <div className="flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-white">1. Individual / Privado</h4>
                    <p className="text-[11px] text-slate-400">
                      Suas contas correntes e cartões permanecem 100% invisíveis para o outro membro.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Eye className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-white">2. Visualização Autorizada</h4>
                    <p className="text-[11px] text-slate-400">
                      O cônjuge pode ver saldos e transações para compor o orçamento familiar, sem poder editar.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Settings className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-white">3. Gestão Compartilhada</h4>
                    <p className="text-[11px] text-slate-400">
                      Contas conjuntas onde ambos lançam, categorizam e conciliam despesas da casa.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

