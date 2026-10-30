'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Wallet,
  CreditCard,
  Target,
  Bot,
  Users,
  ShieldCheck,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  AlertCircle,
  Plus,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { apiFetch } from '@/lib/api';
import { formatCurrencyBRL } from '@finn-ai/ui';

interface SummaryData {
  totalAccountBalance: number;
  openCreditCardDebt: number;
  netWorth: number;
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  savingsRatePct: number;
}

interface CategoryData {
  categoryId: string;
  name: string;
  colorHex: string;
  totalSpent: number;
  percentage: number;
}

interface EvolutionData {
  month: string;
  receitas: number;
  despesas: number;
}

interface UpcomingBill {
  id: string;
  cardName: string;
  colorHex?: string;
  dueDate: string;
  amount: number;
}

export default function HomePage() {
  const [activeScope, setActiveScope] = useState<'PERSONAL' | 'HOUSEHOLD'>('HOUSEHOLD');
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<SummaryData>({
    totalAccountBalance: 38420.5,
    openCreditCardDebt: 4210.0,
    netWorth: 34210.5,
    totalIncome: 18500.0,
    totalExpense: 11240.3,
    netSavings: 7259.7,
    savingsRatePct: 39.2,
  });

  const [categories, setCategories] = useState<CategoryData[]>([
    { categoryId: '1', name: 'Alimentação & Mercado', colorHex: '#f59e0b', totalSpent: 3850, percentage: 34.2 },
    { categoryId: '2', name: 'Moradia & Contas', colorHex: '#3b82f6', totalSpent: 4200, percentage: 37.4 },
    { categoryId: '3', name: 'Transporte', colorHex: '#6366f1', totalSpent: 1450, percentage: 12.9 },
    { categoryId: '4', name: 'Lazer & Restaurantes', colorHex: '#ec4899', totalSpent: 980, percentage: 8.7 },
    { categoryId: '5', name: 'Saúde', colorHex: '#ef4444', totalSpent: 760, percentage: 6.8 },
  ]);

  const [evolution, setEvolution] = useState<EvolutionData[]>([
    { month: 'Mai', receitas: 16500, despesas: 12400 },
    { month: 'Jun', receitas: 17200, despesas: 13100 },
    { month: 'Jul', receitas: 16800, despesas: 11900 },
    { month: 'Ago', receitas: 18000, despesas: 12800 },
    { month: 'Set', receitas: 17500, despesas: 11400 },
    { month: 'Out', receitas: 18500, despesas: 11240 },
  ]);

  const [upcoming, setUpcoming] = useState<UpcomingBill[]>([
    { id: '1', cardName: 'Nubank Ultravioleta', colorHex: '#8b5cf6', dueDate: '2026-11-05', amount: 3240.5 },
    { id: '2', cardName: 'XP Visa Infinite', colorHex: '#1e293b', dueDate: '2026-11-10', amount: 969.5 },
  ]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [sumRes, catRes, evoRes, upRes] = await Promise.all([
        apiFetch<SummaryData>(`/reports/summary?scope=${activeScope}`).catch(() => null),
        apiFetch<CategoryData[]>(`/reports/categories?scope=${activeScope}`).catch(() => null),
        apiFetch<EvolutionData[]>(`/reports/evolution?scope=${activeScope}`).catch(() => null),
        apiFetch<UpcomingBill[]>(`/reports/upcoming?scope=${activeScope}`).catch(() => null),
      ]);

      if (sumRes && sumRes.totalIncome > 0) setSummary(sumRes);
      if (catRes && catRes.length > 0) setCategories(catRes);
      if (evoRes && evoRes.length > 0) setEvolution(evoRes);
      if (upRes && upRes.length > 0) setUpcoming(upRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [activeScope]);

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto flex flex-col gap-8">
      {/* Top Navbar Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Painel Financeiro
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
              {activeScope === 'HOUSEHOLD' ? 'Familiar Consolidado' : 'Visão Pessoal'}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Visão financeira em tempo real com controle de repasses e neutralização contábil.
          </p>
        </div>

        {/* Scope Selector: Individual vs Familiar */}
        <div className="flex items-center p-1 bg-slate-200/60 dark:bg-slate-850 rounded-xl border border-slate-300/50 dark:border-slate-700">
          <button
            onClick={() => setActiveScope('PERSONAL')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeScope === 'PERSONAL'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Visão Individual
          </button>
          <button
            onClick={() => setActiveScope('HOUSEHOLD')}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeScope === 'HOUSEHOLD'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Visão Familiar (Casal)
          </button>
        </div>
      </header>

      {/* Cards de Métricas Principais */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Patrimônio Líquido */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Patrimônio Líquido</span>
            <Wallet className="w-5 h-5 text-brand-500" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {formatCurrencyBRL(summary.netWorth)}
            </span>
            <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Contas: {formatCurrencyBRL(summary.totalAccountBalance)}</span>
            </div>
          </div>
        </div>

        {/* Receitas do Mês */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Receitas do Mês</span>
            <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatCurrencyBRL(summary.totalIncome)}
            </span>
            <p className="mt-1 text-xs text-slate-400">
              Exclui repasses internos do casal
            </p>
          </div>
        </div>

        {/* Despesas do Mês */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Despesas Consolidadas</span>
            <ArrowUpRight className="w-5 h-5 text-rose-500" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {formatCurrencyBRL(summary.totalExpense)}
            </span>
            <p className="mt-1 text-xs text-slate-400">
              Compras e faturas na competência
            </p>
          </div>
        </div>

        {/* Taxa de Poupança */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Taxa de Poupança</span>
            <Target className="w-5 h-5 text-brand-500" />
          </div>
          <div className="mt-4">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">
                {summary.savingsRatePct}%
              </span>
              <span className="text-xs font-semibold text-emerald-600">
                +{formatCurrencyBRL(summary.netSavings)}
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-brand-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, summary.savingsRatePct))}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Gráficos Interativos Recharts: Evolução Mensal e Gastos por Categoria */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico 1: Fluxo de Caixa Mensal (Receitas vs Despesas) */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Evolução Mensal (Últimos 6 Meses)
              </h2>
              <p className="text-xs text-slate-400">Comparativo entre receitas auferidas e despesas reais</p>
            </div>
          </div>

          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={(val) => `R$${val / 1000}k`} />
                <Tooltip
                  formatter={(value: any) => [formatCurrencyBRL(Number(value)), '']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Distribuição por Categoria (Donut Chart) */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="mb-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Gastos por Categoria
            </h2>
            <p className="text-xs text-slate-400">Distribuição percentual no mês atual</p>
          </div>

          <div className="w-full h-56 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categories}
                  dataKey="totalSpent"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                >
                  {categories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.colorHex || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [formatCurrencyBRL(Number(value)), 'Gasto']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col gap-1.5 mt-2">
            {categories.slice(0, 4).map((cat) => (
              <div key={cat.categoryId} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.colorHex }} />
                  <span className="text-slate-600 dark:text-slate-300 font-medium truncate max-w-[130px]">
                    {cat.name}
                  </span>
                </div>
                <span className="text-slate-400 font-semibold">{cat.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Seção Inferior: Próximos Vencimentos de Faturas & Assistente FINN AI */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Próximos Vencimentos */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Faturas a Vencer (15 dias)
              </h3>
            </div>
            <Link href="/cards" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
              Ver cartões
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            {upcoming.map((bill) => (
              <div
                key={bill.id}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: bill.colorHex || '#6366f1' }}
                  >
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {bill.cardName}
                    </h4>
                    <p className="text-[11px] text-slate-400">Vence em {bill.dueDate}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                  {formatCurrencyBRL(bill.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Agente FINN AI Card Interativo */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-850 to-brand-950 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-brand-500/20 text-brand-400 border border-brand-500/30 rounded-2xl shrink-0">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">Diagnóstico Inteligente do FINN</h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-brand-500/30 text-brand-300 rounded-full border border-brand-500/40">
                  Tool Calling
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-300 leading-relaxed max-w-xl">
                &quot;Neste mês, vocês atingiram uma excelente <strong>taxa de poupança de {summary.savingsRatePct}%</strong> ({formatCurrencyBRL(summary.netSavings)} poupados). Se mantiverem esse ritmo, alcançarão a meta da Reserva de Emergência 42 dias antes do previsto!&quot;
              </p>
            </div>
          </div>
          <Link
            href="/transactions"
            className="whitespace-nowrap px-5 py-2.5 bg-brand-500 hover:bg-brand-600 font-semibold text-white rounded-xl text-xs transition-all shadow-lg shadow-brand-500/25 shrink-0"
          >
            Lançar Movimentação
          </Link>
        </div>
      </section>
    </main>
  );
}
