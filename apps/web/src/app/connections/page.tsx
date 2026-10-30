'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Clock,
  KeyRound,
  Info,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface BankConnectionItem {
  id: string;
  institutionName: string;
  provider: string;
  status: string;
  lastSyncAt?: string;
  consentExpiresAt?: string;
  accounts: Array<{
    id: string;
    name: string;
    currentBalance: number;
  }>;
  history: Array<{
    id: string;
    status: string;
    transactionsSynced: number;
    createdAt: string;
  }>;
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<BankConnectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [institutionName, setInstitutionName] = useState('');
  const [externalItemId, setExternalItemId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<BankConnectionItem[]>('/banking/connections');
      setConnections(data || []);
    } catch (err: any) {
      console.warn('Erro ao carregar conexões:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnections();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMessage(null);

    try {
      await apiFetch('/banking/connections', {
        method: 'POST',
        body: JSON.stringify({
          institutionName,
          externalItemId,
        }),
      });

      setStatusMessage({
        type: 'success',
        text: `Conexão com ${institutionName} registrada com sucesso! A primeira sincronização foi iniciada.`,
      });
      setShowModal(false);
      setInstitutionName('');
      setExternalItemId('');
      loadConnections();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSync = async (connectionId: string) => {
    setSyncingId(connectionId);
    setStatusMessage(null);

    try {
      const res = await apiFetch<{ transactionsSynced: number }>(`/banking/connections/${connectionId}/sync`, {
        method: 'POST',
      });
      setStatusMessage({
        type: 'success',
        text: `Sincronização concluída! ${res.transactionsSynced} transações foram atualizadas.`,
      });
      loadConnections();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setSyncingId(null);
    }
  };

  const handleDisconnect = async (connectionId: string, name: string) => {
    if (!confirm(`Deseja realmente desvincular a conexão com o banco ${name}?`)) return;

    try {
      await apiFetch(`/banking/connections/${connectionId}`, {
        method: 'DELETE',
      });
      setStatusMessage({ type: 'success', text: `Conexão com ${name} removida com sucesso.` });
      loadConnections();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-10 flex flex-col gap-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Conexões Bancárias & Open Finance
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Meu Pluggy Pessoal
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Importação automática segura com janela de atualização de ~24h e limite de até 5 instituições.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          disabled={connections.length >= 5}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-brand-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Conectar Banco ({connections.length}/5)</span>
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Informativo de Operação Oficial */}
      <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
          <strong>Como funciona a sincronização no Meu Pluggy Pessoal:</strong> Os bancos conveniados atualizam saldos e transações aproximadamente a cada <strong>24 horas</strong>. O FINN AI executa sincronizações incrementais sem apagar dados anteriores e com deduplicação via hash idempotente.
        </div>
      </div>

      {/* Lista de Conexões */}
      {loading ? (
        <div className="p-10 text-center text-sm text-slate-500">
          Carregando conexões bancárias...
        </div>
      ) : connections.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Nenhuma instituição financeira conectada
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto mb-5">
            Conecte suas contas do Nubank, Itaú, Inter ou Bradesco para sincronizar saldos e transações automaticamente.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold"
          >
            Conectar Primeira Instituição
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-bold">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      conn.status === 'SUCCESS' || conn.status === 'IDLE'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : conn.status === 'RUNNING'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    {conn.status === 'RUNNING' ? 'Sincronizando' : 'Ativa'}
                  </span>
                </div>

                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {conn.institutionName}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Provedor: {conn.provider}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-1.5 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Última sincronização: {conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString('pt-BR') : 'Pendente'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    Consentimento válido até {conn.consentExpiresAt ? new Date(conn.consentExpiresAt).toLocaleDateString('pt-BR') : '1 ano'}
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => handleDisconnect(conn.id, conn.institutionName)}
                  className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Desconectar
                </button>
                <button
                  onClick={() => handleSync(conn.id)}
                  disabled={syncingId === conn.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingId === conn.id ? 'animate-spin' : ''}`} />
                  <span>{syncingId === conn.id ? 'Sincronizando...' : 'Sincronizar'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Conectar Banco (Meu Pluggy) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Conectar Instituição Bancária
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Integração oficial via Meu Pluggy (Modalidade Pessoal Gratuita)
            </p>

            {/* Passo a Passo Ilustrado */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 mb-6 flex flex-col gap-2.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center text-[10px] shrink-0">1</span>
                <span>Acesse o portal oficial do <strong>Meu Pluggy</strong> (<a href="https://meu.pluggy.ai" target="_blank" rel="noreferrer" className="text-brand-600 underline inline-flex items-center gap-0.5">meu.pluggy.ai <ExternalLink className="w-2.5 h-2.5" /></a>).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center text-[10px] shrink-0">2</span>
                <span>Conecte sua conta bancária (Itaú, Nubank, etc.) no Meu Pluggy.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center text-[10px] shrink-0">3</span>
                <span>Copie o <strong>Item ID</strong> gerado e cole no campo abaixo.</span>
              </div>
            </div>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome da Instituição Financeira
                </label>
                <input
                  type="text"
                  required
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="Ex: Nubank, Itaú Unibanco, Banco Inter"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Item ID do Meu Pluggy
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={externalItemId}
                    onChange={(e) => setExternalItemId(e.target.value)}
                    placeholder="Ex: 8f9b1c2d-3e4f-5a6b-7c8d-9e0f1a2b3c4d"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-brand-500/20"
                >
                  {submitting ? 'Conectando...' : 'Conectar e Sincronizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

