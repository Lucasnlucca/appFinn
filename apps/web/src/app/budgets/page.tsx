'use client';

import React, { useState } from 'react';
import {
  PiggyBank,
  Plus,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Info,
  DollarSign,
  ShieldAlert,
} from 'lucide-react';

interface CategoryBudget {
  categoryId: string;
  categoryName: string;
  limitAmount: number;
  spentAmount: number;
  status: 'NORMAL' | 'WARNING' | 'EXCEEDED';
  spentPct: number;
  remainingAmount: number;
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<CategoryBudget[]>([
    {
      categoryId: 'cat-1',
      categoryName: 'Alimentação & Supermercado',
      limitAmount: 2500,
      spentAmount: 1950,
      status: 'NORMAL',
      spentPct: 78,
      remainingAmount: 550,
    },
    {
      categoryId: 'cat-2',
      categoryName: 'Restaurantes & Delivery',
      limitAmount: 1200,
      spentAmount: 1100,
      status: 'WARNING',
      spentPct: 91,
      remainingAmount: 100,
    },
    {
      categoryId: 'cat-3',
      categoryName: 'Transporte & Combustível',
      limitAmount: 900,
      spentAmount: 980,
      status: 'EXCEEDED',
      spentPct: 108,
      remainingAmount: -80,
    },
    {
      categoryId: 'cat-4',
      categoryName: 'Lazer & Entretenimento',
      limitAmount: 800,
      spentAmount: 420,
      status: 'NORMAL',
      spentPct: 52,
      remainingAmount: 380,
    },
    {
      categoryId: 'cat-5',
      categoryName: 'Farmácia & Saúde',
      limitAmount: 600,
      spentAmount: 230,
      status: 'NORMAL',
      spentPct: 38,
      remainingAmount: 370,
    },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBudget, setNewBudget] = useState({
    categoryName: '',
    limitAmount: '',
  });

  const formatBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBudget.categoryName || !newBudget.limitAmount) return;

    const limit = parseFloat(newBudget.limitAmount);
    const existingIndex = budgets.findIndex(
      (b) => b.categoryName.toLowerCase() === newBudget.categoryName.toLowerCase(),
    );

    if (existingIndex >= 0) {
      setBudgets((prev) =>
        prev.map((b, idx) => {
          if (idx === existingIndex) {
            const spentPct = Math.round((b.spentAmount / limit) * 100);
            const status = spentPct >= 100 ? 'EXCEEDED' : spentPct >= 80 ? 'WARNING' : 'NORMAL';
            return {
              ...b,
              limitAmount: limit,
              spentPct,
              status,
              remainingAmount: limit - b.spentAmount,
            };
          }
          return b;
        }),
      );
    } else {
      setBudgets((prev) => [
        ...prev,
        {
          categoryId: `cat-${Date.now()}`,
          categoryName: newBudget.categoryName,
          limitAmount: limit,
          spentAmount: 0,
          status: 'NORMAL',
          spentPct: 0,
          remainingAmount: limit,
        },
      ]);
    }

    setIsModalOpen(false);
    setNewBudget({ categoryName: '', limitAmount: '' });
  };

  const totalLimit = budgets.reduce((acc, b) => acc + b.limitAmount, 0);
  const totalSpent = budgets.reduce((acc, b) => acc + b.spentAmount, 0);
  const totalPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;
  const exceededCount = budgets.filter((b) => b.status === 'EXCEEDED').length;
  const warningCount = budgets.filter((b) => b.status === 'WARNING').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <PiggyBank className="w-6 h-6" />
            </div>
            Orçamentos Mensais
          </h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1">
            Defina limites por categoria para evitar surpresas no fim do mês e manter a saúde financeira do casal.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm transition-all shadow-sm hover:shadow-brand-500/25"
        >
          <Plus className="w-4 h-4" />
          Definir Limite
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">Orçamento Consolidado</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {formatBRL(totalSpent)} <span className="text-sm text-slate-400 font-normal">/ {formatBRL(totalLimit)}</span>
          </p>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
            <div
              className={`h-full rounded-full ${
                totalPct >= 100 ? 'bg-rose-500' : totalPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, totalPct)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">{totalPct}% do teto mensal comprometido</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">Saldo Restante para Gastar</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {formatBRL(Math.max(0, totalLimit - totalSpent))}
          </p>
          <p className="text-xs text-slate-500 mt-1">disponível até a virada do ciclo</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">Status dos Tetos</p>
          <div className="flex items-center gap-3 mt-2">
            {exceededCount > 0 ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                <ShieldAlert className="w-3.5 h-3.5" /> {exceededCount} estourado
              </span>
            ) : null}
            {warningCount > 0 ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5" /> {warningCount} em alerta
              </span>
            ) : null}
            {exceededCount === 0 && warningCount === 0 && (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" /> Todos sob controle
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2">Categorias monitoradas ativamente</p>
        </div>
      </div>

      {/* Budget List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-bold text-slate-900 dark:text-white">Acompanhamento por Categoria</h2>
          <span className="text-xs text-slate-500">Mês de Referência: Outubro / 2026</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {budgets.map((b) => {
            const isExceeded = b.status === 'EXCEEDED';
            const isWarning = b.status === 'WARNING';

            return (
              <div key={b.categoryId} className="p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-900 dark:text-white text-base">
                      {b.categoryName}
                    </span>
                    {isExceeded && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Estourado (+{formatBRL(Math.abs(b.remainingAmount))})
                      </span>
                    )}
                    {isWarning && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                        Atenção ({b.spentPct}%)
                      </span>
                    )}
                    {!isExceeded && !isWarning && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        Normal ({b.spentPct}%)
                      </span>
                    )}
                  </div>

                  <div className="text-sm font-medium">
                    <span className="font-bold text-slate-900 dark:text-white">{formatBRL(b.spentAmount)}</span>
                    <span className="text-slate-400"> de {formatBRL(b.limitAmount)}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mt-3">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isExceeded
                        ? 'bg-rose-500'
                        : isWarning
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, b.spentPct)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-xs text-slate-500 mt-2">
                  <span>
                    {isExceeded
                      ? `Excedeu o teto por ${formatBRL(Math.abs(b.remainingAmount))}`
                      : `Resta gastar ${formatBRL(b.remainingAmount)}`}
                  </span>
                  <span className="font-medium">{b.spentPct}% consumido</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Definir Limite */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Definir Teto de Gastos</h3>
            <form onSubmit={handleSaveBudget} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Categoria
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Alimentação & Supermercado"
                  value={newBudget.categoryName}
                  onChange={(e) => setNewBudget({ ...newBudget, categoryName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Limite Mensal (R$)
                </label>
                <input
                  type="number"
                  required
                  placeholder="1500"
                  value={newBudget.limitAmount}
                  onChange={(e) => setNewBudget({ ...newBudget, limitAmount: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-all"
                >
                  Salvar Limite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

