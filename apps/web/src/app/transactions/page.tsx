'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeftRight,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  CheckCircle2,
  AlertCircle,
  Tag,
  Building2,
  Calendar,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { formatCurrencyBRL, formatDateBR } from '@finn-ai/ui';

interface TransactionItem {
  id: string;
  description: string;
  amount: string | number;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  status: string;
  date: string;
  isHouseholdShared: boolean;
  category?: { name: string; colorHex?: string };
  account?: { name: string; colorHex?: string };
  user?: { fullName: string };
}

interface CategoryItem {
  id: string;
  name: string;
}

interface AccountItem {
  id: string;
  name: string;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<'PERSONAL' | 'HOUSEHOLD'>('HOUSEHOLD');

  // Modal de lançamento
  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isHouseholdShared, setIsHouseholdShared] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [txData, catData, accData] = await Promise.all([
        apiFetch<TransactionItem[]>(`/transactions?scope=${scope}`),
        apiFetch<CategoryItem[]>('/categories'),
        apiFetch<AccountItem[]>('/accounts?scope=HOUSEHOLD'),
      ]);

      setTransactions(txData || []);
      setCategories(catData || []);
      setAccounts(accData || []);
      if (accData && accData.length > 0 && !accountId) {
        setAccountId(accData[0].id);
      }
    } catch (err: any) {
      console.warn('Erro ao carregar transações:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [scope]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMessage(null);

    try {
      await apiFetch('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          description,
          amount: parseFloat(amount),
          type,
          date: new Date(date).toISOString(),
          accountId: accountId || undefined,
          categoryId: categoryId || undefined,
          isHouseholdShared,
        }),
      });

      setStatusMessage({ type: 'success', text: 'Movimentação registrada com sucesso!' });
      setShowModal(false);
      setDescription('');
      setAmount('');
      loadData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-10 flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Extrato & Movimentações
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Conciliação Ativa
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Histórico completo de receitas, despesas e transferências com precisão contábil.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle Escopo */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setScope('PERSONAL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                scope === 'PERSONAL'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              Individual
            </button>
            <button
              onClick={() => setScope('HOUSEHOLD')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                scope === 'HOUSEHOLD'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              Familiar
            </button>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Lançamento</span>
          </button>
        </div>
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

      {/* Lista de Movimentações */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Carregando movimentações financeiras...
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Nenhuma movimentação encontrada
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto mb-5">
              Lance sua primeira receita ou despesa manual para ver o extrato atualizado em tempo real.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold"
            >
              Criar Lançamento Agora
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {transactions.map((tx) => {
              const isIncome = tx.type === 'INCOME';
              const isTransfer = tx.type === 'TRANSFER';

              return (
                <div
                  key={tx.id}
                  className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                        isIncome
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600'
                          : isTransfer
                          ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-600'
                          : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600'
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownLeft className="w-5 h-5" />
                      ) : isTransfer ? (
                        <ArrowLeftRight className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {tx.description}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                        <span>{formatDateBR(tx.date)}</span>
                        {tx.account && (
                          <span className="flex items-center gap-1">
                            • <Building2 className="w-3 h-3" />
                            {tx.account.name}
                          </span>
                        )}
                        {tx.category && (
                          <span className="flex items-center gap-1">
                            • <Tag className="w-3 h-3" />
                            {tx.category.name}
                          </span>
                        )}
                        {tx.isHouseholdShared && (
                          <span className="px-1.5 py-0.2 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 text-[10px] rounded font-medium">
                            Familiar
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className={`text-base font-bold ${
                        isIncome
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : isTransfer
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {isIncome ? '+' : isTransfer ? '' : '-'}
                      {formatCurrencyBRL(Math.abs(Number(tx.amount)))}
                    </p>
                    <span className="text-[11px] text-slate-400 uppercase font-medium">
                      {tx.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Novo Lançamento */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Novo Lançamento Financeiro
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Registre uma receita ou despesa manual
            </p>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              {/* Seletor Tipo: Despesa vs Receita */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-850 rounded-xl">
                <button
                  type="button"
                  onClick={() => setType('EXPENSE')}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                    type === 'EXPENSE'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Despesa
                </button>
                <button
                  type="button"
                  onClick={() => setType('INCOME')}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                    type === 'INCOME'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Receita
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Mercado Pão de Açúcar, Salário, Internet"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Conta
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    <option value="">Nenhuma / Avulso</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Categoria
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    <option value="">Selecione categoria</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="shared"
                  checked={isHouseholdShared}
                  onChange={(e) => setIsHouseholdShared(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded border-slate-300"
                />
                <label htmlFor="shared" className="text-xs text-slate-700 dark:text-slate-300">
                  Compartilhar no demonstrativo da família
                </label>
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
                  {submitting ? 'Salvando...' : 'Confirmar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

