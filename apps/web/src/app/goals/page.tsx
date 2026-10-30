'use client';

import React, { useState } from 'react';
import {
  Target,
  Plus,
  TrendingUp,
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Calculator,
  ArrowRight,
  DollarSign,
  PiggyBank,
} from 'lucide-react';

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  progressPct: number;
  targetDate: string;
  category: string;
  scope: 'PERSONAL' | 'HOUSEHOLD';
  monthlyNeeded: number;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([
    {
      id: 'g-1',
      name: 'Reserva de Emergência (6 Meses)',
      targetAmount: 50000,
      currentAmount: 32500,
      progressPct: 65,
      targetDate: '2027-12-31',
      category: 'Segurança',
      scope: 'HOUSEHOLD',
      monthlyNeeded: 1250,
    },
    {
      id: 'g-2',
      name: 'Viagem de Férias em Família',
      targetAmount: 18000,
      currentAmount: 7200,
      progressPct: 40,
      targetDate: '2027-07-20',
      category: 'Lazer & Viagem',
      scope: 'HOUSEHOLD',
      monthlyNeeded: 1350,
    },
    {
      id: 'g-3',
      name: 'Entrada Troca de Carro',
      targetAmount: 30000,
      currentAmount: 12000,
      progressPct: 40,
      targetDate: '2028-06-30',
      category: 'Bens',
      scope: 'PERSONAL',
      monthlyNeeded: 900,
    },
  ]);

  // Modal states
  const [isNewGoalOpen, setIsNewGoalOpen] = useState(false);
  const [selectedGoalForContribution, setSelectedGoalForContribution] = useState<Goal | null>(null);

  // Form states
  const [newGoal, setNewGoal] = useState({
    name: '',
    targetAmount: '',
    targetDate: '',
    category: 'Geral',
    scope: 'HOUSEHOLD' as 'PERSONAL' | 'HOUSEHOLD',
  });

  const [contributionAmount, setContributionAmount] = useState('');

  // Simulator states
  const [simTarget, setSimTarget] = useState('50000');
  const [simMonthly, setSimMonthly] = useState('1500');
  const [simInitial, setSimInitial] = useState('5000');
  const [simResults, setSimResults] = useState<{
    conservative: { months: number; totalInvested: number; interestEarned: number };
    baseline: { months: number; totalInvested: number; interestEarned: number };
    optimistic: { months: number; totalInvested: number; interestEarned: number };
  } | null>(null);

  const formatBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.name || !newGoal.targetAmount) return;

    const targetVal = parseFloat(newGoal.targetAmount);
    const created: Goal = {
      id: `g-${Date.now()}`,
      name: newGoal.name,
      targetAmount: targetVal,
      currentAmount: 0,
      progressPct: 0,
      targetDate: newGoal.targetDate || '2027-12-31',
      category: newGoal.category,
      scope: newGoal.scope,
      monthlyNeeded: Math.round(targetVal / 18),
    };

    setGoals((prev) => [created, ...prev]);
    setIsNewGoalOpen(false);
    setNewGoal({ name: '', targetAmount: '', targetDate: '', category: 'Geral', scope: 'HOUSEHOLD' });
  };

  const handleAddContribution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalForContribution || !contributionAmount) return;
    const amountVal = parseFloat(contributionAmount);

    setGoals((prev) =>
      prev.map((g) => {
        if (g.id === selectedGoalForContribution.id) {
          const newCurrent = g.currentAmount + amountVal;
          const newPct = Math.min(100, Math.round((newCurrent / g.targetAmount) * 100));
          return { ...g, currentAmount: newCurrent, progressPct: newPct };
        }
        return g;
      }),
    );

    setSelectedGoalForContribution(null);
    setContributionAmount('');
  };

  const handleSimulate = () => {
    const target = parseFloat(simTarget) || 50000;
    const monthly = parseFloat(simMonthly) || 1000;
    const initial = parseFloat(simInitial) || 0;

    const calcMonths = (annualRate: number) => {
      const r = Math.pow(1 + annualRate, 1 / 12) - 1;
      let balance = initial;
      let months = 0;
      let invested = initial;
      while (balance < target && months < 360) {
        months++;
        balance = balance * (1 + r) + monthly;
        invested += monthly;
      }
      return {
        months,
        totalInvested: invested,
        interestEarned: Math.max(0, balance - invested),
      };
    };

    setSimResults({
      conservative: calcMonths(0.06), // 6% a.a.
      baseline: calcMonths(0.105),    // 10.5% a.a. (CDI aproximado)
      optimistic: calcMonths(0.14),   // 14% a.a.
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <Target className="w-6 h-6" />
            </div>
            Metas & Planejamento Familiar
          </h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1">
            Defina sonhos em conjunto ou individuais, acompanhe o progresso e simule o impacto dos juros compostos.
          </p>
        </div>

        <button
          onClick={() => setIsNewGoalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm transition-all shadow-sm hover:shadow-brand-500/25"
        >
          <Plus className="w-4 h-4" />
          Nova Meta
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">Metas em Andamento</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{goals.length} ativas</p>
          <p className="text-xs text-brand-600 mt-1">1 meta próxima de 70% de conclusão</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">Total Acumulado</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {formatBRL(goals.reduce((acc, g) => acc + g.currentAmount, 0))}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            de {formatBRL(goals.reduce((acc, g) => acc + g.targetAmount, 0))} almejados
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">Aporte Mensal Recomendado</p>
          <p className="text-2xl font-bold text-brand-600 dark:text-brand-400 mt-2">
            {formatBRL(goals.reduce((acc, g) => acc + g.monthlyNeeded, 0))}
          </p>
          <p className="text-xs text-slate-500 mt-1">para atingir todas as metas nos prazos</p>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((g) => (
          <div
            key={g.id}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between hover:border-brand-500/50 transition-all group"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {g.category}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    g.scope === 'HOUSEHOLD'
                      ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                      : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                  }`}
                >
                  {g.scope === 'HOUSEHOLD' ? 'Familiar' : 'Individual'}
                </span>
              </div>

              <h3 className="font-bold text-slate-900 dark:text-white text-lg group-hover:text-brand-600 transition-colors">
                {g.name}
              </h3>

              <div className="mt-4 flex items-baseline justify-between">
                <div>
                  <p className="text-xs text-slate-400">Guardado</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatBRL(g.currentAmount)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Alvo</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {formatBRL(g.targetAmount)}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-brand-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${g.progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500 mt-1.5 font-medium">
                  <span>{g.progressPct}% concluído</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> {g.targetDate}
                  </span>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span>Aporte sugerido:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {formatBRL(g.monthlyNeeded)}/mês
                </span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
              <button
                onClick={() => setSelectedGoalForContribution(g)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Aportar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Scenario Simulator */}
      <div className="bg-gradient-to-br from-brand-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Calculator className="w-6 h-6 text-brand-300" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Simulador de Metas e Juros Compostos</h2>
              <p className="text-sm text-brand-200">
                Descubra em quanto tempo você atinge seus objetivos com diferentes rendimentos anuais.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
            <div>
              <label className="block text-xs text-brand-200 mb-1 font-medium">Valor Alvo (R$)</label>
              <input
                type="number"
                value={simTarget}
                onChange={(e) => setSimTarget(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-brand-300/50 text-sm focus:outline-hidden focus:border-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs text-brand-200 mb-1 font-medium">Aporte Mensal (R$)</label>
              <input
                type="number"
                value={simMonthly}
                onChange={(e) => setSimMonthly(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-brand-300/50 text-sm focus:outline-hidden focus:border-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs text-brand-200 mb-1 font-medium">Saldo Inicial (R$)</label>
              <input
                type="number"
                value={simInitial}
                onChange={(e) => setSimInitial(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-brand-300/50 text-sm focus:outline-hidden focus:border-brand-400"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleSimulate}
                className="w-full py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-900 font-bold text-sm transition-all shadow-md shadow-brand-500/20 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Simular Cenários
              </button>
            </div>
          </div>

          {/* Results Comparison */}
          {simResults && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/10 animate-in fade-in duration-300">
              {/* Conservador */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Conservador (6% a.a.)
                </span>
                <p className="text-2xl font-extrabold mt-2">
                  {simResults.conservative.months} meses{' '}
                  <span className="text-xs font-normal text-brand-200">
                    ({(simResults.conservative.months / 12).toFixed(1)} anos)
                  </span>
                </p>
                <div className="mt-3 text-xs space-y-1 text-slate-300">
                  <p>Investido: {formatBRL(simResults.conservative.totalInvested)}</p>
                  <p className="text-emerald-400 font-semibold">
                    Rendimento: +{formatBRL(simResults.conservative.interestEarned)}
                  </p>
                </div>
              </div>

              {/* Moderado / Base */}
              <div className="bg-white/10 border-2 border-brand-400/80 rounded-2xl p-5 backdrop-blur-xs relative">
                <div className="absolute top-3 right-3 text-[10px] font-bold bg-brand-500 text-slate-950 px-2 py-0.5 rounded-full">
                  CDI ATUAL
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-300">
                  Moderado (10.5% a.a.)
                </span>
                <p className="text-2xl font-extrabold mt-2">
                  {simResults.baseline.months} meses{' '}
                  <span className="text-xs font-normal text-brand-200">
                    ({(simResults.baseline.months / 12).toFixed(1)} anos)
                  </span>
                </p>
                <div className="mt-3 text-xs space-y-1 text-slate-300">
                  <p>Investido: {formatBRL(simResults.baseline.totalInvested)}</p>
                  <p className="text-emerald-400 font-semibold">
                    Rendimento: +{formatBRL(simResults.baseline.interestEarned)}
                  </p>
                </div>
              </div>

              {/* Otimista */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  Otimista (14% a.a.)
                </span>
                <p className="text-2xl font-extrabold mt-2">
                  {simResults.optimistic.months} meses{' '}
                  <span className="text-xs font-normal text-brand-200">
                    ({(simResults.optimistic.months / 12).toFixed(1)} anos)
                  </span>
                </p>
                <div className="mt-3 text-xs space-y-1 text-slate-300">
                  <p>Investido: {formatBRL(simResults.optimistic.totalInvested)}</p>
                  <p className="text-emerald-400 font-semibold">
                    Rendimento: +{formatBRL(simResults.optimistic.interestEarned)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Nova Meta */}
      {isNewGoalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Criar Nova Meta</h3>
            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Objetivo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Reforma da Cozinha"
                  value={newGoal.name}
                  onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Valor Alvo (R$)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="25000"
                    value={newGoal.targetAmount}
                    onChange={(e) => setNewGoal({ ...newGoal, targetAmount: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Prazo Desejado
                  </label>
                  <input
                    type="date"
                    required
                    value={newGoal.targetDate}
                    onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Categoria
                  </label>
                  <select
                    value={newGoal.category}
                    onChange={(e) => setNewGoal({ ...newGoal, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  >
                    <option value="Segurança">Segurança</option>
                    <option value="Lazer & Viagem">Lazer & Viagem</option>
                    <option value="Bens">Bens / Imóveis</option>
                    <option value="Educação">Educação</option>
                    <option value="Geral">Geral</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Escopo
                  </label>
                  <select
                    value={newGoal.scope}
                    onChange={(e) =>
                      setNewGoal({ ...newGoal, scope: e.target.value as 'PERSONAL' | 'HOUSEHOLD' })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  >
                    <option value="HOUSEHOLD">Familiar (Conjunto)</option>
                    <option value="PERSONAL">Individual (Privado)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsNewGoalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-all"
                >
                  Salvar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Aporte */}
      {selectedGoalForContribution && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Novo Aporte em: {selectedGoalForContribution.name}
            </h3>
            <form onSubmit={handleAddContribution} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Valor do Aporte (R$)
                </label>
                <input
                  type="number"
                  required
                  placeholder="500"
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedGoalForContribution(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-all"
                >
                  Confirmar Aporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

