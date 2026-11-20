'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  Wallet,
  CreditCard,
  Users,
  User,
  Layers,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Plus,
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
} from 'recharts';
import {
  OFFICIAL_CATEGORIES,
  apiFetch,
  doesTxBelongToGroup,
  encodeSharedNotes,
  extractCategoryFromTx,
  fetchSharedGroupTransactions,
  fetchUserGroups,
  getAuthToken,
  getAuthUser,
  notifyDataChanged,
  parseSharedNotes,
  reconcileGroupsWithTransactions,
  refreshCurrentUserProfile,
  useLiveSync,
} from '@/lib/api';
import { formatCurrencyBRL } from '@finn-ai/ui';
import LoginPage from './login/page';

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

const CHART_COLORS = ['#7C3AED', '#10B981', '#F59E0B', '#EC4899', '#3B82F6', '#EF4444'];

const VIEW_TABS = [
  { id: 'PERSONAL', label: 'Pessoal', icon: User },
  { id: 'HOUSEHOLD', label: 'Grupos', icon: Users },
  { id: 'ALL', label: 'Tudo', icon: Layers },
] as const;

export default function HomePage() {
  const quickDialogRef = useRef<HTMLDialogElement>(null);
  const inFlightRef = useRef(false);
  const reqSeqRef = useRef(0);

  const [viewMode, setViewMode] = useState<'PERSONAL' | 'HOUSEHOLD' | 'ALL'>('PERSONAL');
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [userAvatar, setUserAvatar] = useState<string>('/finn-ai-avatar.png');

  // Dados brutos sincronizados sem destrutividade
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('ALL');

  const [personalReportSummary, setPersonalReportSummary] = useState<SummaryData | null>(null);
  const [personalReportCategories, setPersonalReportCategories] = useState<CategoryData[]>([]);
  const [evolution, setEvolution] = useState<EvolutionData[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingBill[]>([]);

  // Modal Atalho "+ Novo Gasto"
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickDesc, setQuickDesc] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickType, setQuickType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [quickCategory, setQuickCategory] = useState('alimentacao');
  const [quickAccountId, setQuickAccountId] = useState('');
  const [quickGroupId, setQuickGroupId] = useState('');
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  useEffect(() => {
    const dlg = quickDialogRef.current;
    if (!dlg) return;
    if (quickOpen && !dlg.open) dlg.showModal();
    else if (!quickOpen && dlg.open) dlg.close();
  }, [quickOpen]);

  const loadDashboardData = useCallback(async () => {
    const token = getAuthToken();
    const user = getAuthUser();
    setIsAuthenticated(Boolean(token));
    setUserName(user?.fullName || user?.name || '');
    setUserAvatar(user?.avatarUrl || user?.avatarUri || '/finn-ai-avatar.png');

    if (!token) {
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const mySeq = ++reqSeqRef.current;

    try {
      refreshCurrentUserProfile().then((me) => {
        if (me) {
          setUserName(me.fullName || me.name || '');
          setUserAvatar(me.avatarUrl || me.avatarUri || '/finn-ai-avatar.png');
        }
      });

      const [accountsRes, personalTxsRes, cardsRes, grpListRes, sumRes, catRes, evoRes, upRes] =
        await Promise.all([
          apiFetch<any[]>('/accounts?scope=HOUSEHOLD').catch(() => null),
          apiFetch<any[]>('/transactions?scope=PERSONAL').catch(() => null),
          apiFetch<any[]>('/credit-cards?scope=HOUSEHOLD').catch(() => null),
          fetchUserGroups(),
          apiFetch<SummaryData>('/reports/summary?scope=PERSONAL').catch(() => null),
          apiFetch<CategoryData[]>('/reports/categories?scope=PERSONAL').catch(() => null),
          apiFetch<EvolutionData[]>('/reports/evolution?scope=PERSONAL').catch(() => null),
          apiFetch<UpcomingBill[]>('/reports/upcoming?scope=PERSONAL').catch(() => null),
        ]);

      if (mySeq !== reqSeqRef.current) return;

      const sharedTxsRes = await fetchSharedGroupTransactions(
        Array.isArray(grpListRes) ? grpListRes : [],
        null,
      ).catch(() => null);

      if (mySeq !== reqSeqRef.current) return;

      if (Array.isArray(accountsRes)) {
        setAccounts(accountsRes);
        setQuickAccountId((prev) => prev || accountsRes[0]?.id || '');
      }
      if (Array.isArray(cardsRes)) {
        setCards(cardsRes);
      }

      setAllTransactions((prevTxs) => {
        const mergedMap = new Map<string, any>();
        if (!Array.isArray(personalTxsRes) && !Array.isArray(sharedTxsRes)) {
          return prevTxs;
        }
        const pList = Array.isArray(personalTxsRes) ? personalTxsRes : prevTxs.filter((t) => !t.isHouseholdShared && !parseSharedNotes(t.notes));
        const sList = Array.isArray(sharedTxsRes) ? sharedTxsRes : prevTxs.filter((t) => t.isHouseholdShared || parseSharedNotes(t.notes));

        for (const tx of [...pList, ...sList]) {
          if (tx?.id) mergedMap.set(tx.id, tx);
        }
        const sorted = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime(),
        );

        const reconciledGroups = reconcileGroupsWithTransactions(
          Array.isArray(grpListRes) ? grpListRes : [],
          sorted,
        );
        if (reconciledGroups.length > 0) {
          setGroups(reconciledGroups);
          setSelectedGroupId((prevId) => {
            if (prevId === 'ALL') return 'ALL';
            if (prevId && reconciledGroups.some((g) => String(g.id) === String(prevId))) return prevId;
            return reconciledGroups[0]?.id || 'ALL';
          });
        }

        return sorted;
      });

      if (Array.isArray(grpListRes) && grpListRes.length > 0) {
        setGroups((prevGroups) => (grpListRes.length >= prevGroups.length ? grpListRes : prevGroups));
      }

      if (sumRes) setPersonalReportSummary(sumRes);
      if (Array.isArray(catRes) && catRes.length > 0) setPersonalReportCategories(catRes);
      if (Array.isArray(evoRes) && evoRes.length > 0) setEvolution(evoRes);
      if (Array.isArray(upRes)) setUpcoming(upRes);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkAuth = () => {
      const token = getAuthToken();
      const authed = Boolean(token);
      setIsAuthenticated((prevAuthed) => {
        if (authed && !prevAuthed) {
          loadDashboardData();
        }
        return authed;
      });
      if (!authed) {
        setLoading(false);
      }
    };

    const onProfileUpdated = () => {
      const user = getAuthUser();
      if (user) {
        setUserName(user.fullName || user.name || '');
        setUserAvatar(user.avatarUrl || user.avatarUri || '/finn-ai-avatar.png');
      }
    };

    const initialToken = getAuthToken();
    if (initialToken) {
      setIsAuthenticated(true);
      loadDashboardData();
    } else {
      setIsAuthenticated(false);
      setLoading(false);
    }

    window.addEventListener('finn-auth-changed', checkAuth);
    window.addEventListener('finn-profile-updated', onProfileUpdated);
    window.addEventListener('storage', checkAuth);

    return () => {
      window.removeEventListener('finn-auth-changed', checkAuth);
      window.removeEventListener('finn-profile-updated', onProfileUpdated);
      window.removeEventListener('storage', checkAuth);
    };
  }, [loadDashboardData]);

  useLiveSync(loadDashboardData);

  // Cálculo síncrono em 0ms (sem flicker ao alternar entre Pessoal | Grupos | Tudo ou trocar de grupo)
  const { scopedTxs, settledTotal, summary, recentTransactions, categories } = useMemo(() => {
    const activeGroupObj =
      selectedGroupId && selectedGroupId !== 'ALL'
        ? groups.find((g) => String(g.id) === String(selectedGroupId) || String(g.remoteId) === String(selectedGroupId)) || null
        : null;

    let groupSettlementSum = 0;
    const filtered = allTransactions.filter((t) => {
      const meta = parseSharedNotes(t.notes);
      const isShared = Boolean(t.isHouseholdShared || meta);

      if (meta?.kind === 'settlement') {
        if (viewMode === 'HOUSEHOLD') {
          if (!activeGroupObj || doesTxBelongToGroup(t, activeGroupObj, groups)) {
            groupSettlementSum += parseFloat(t.amount) || 0;
          }
        } else if (viewMode === 'ALL') {
          groupSettlementSum += parseFloat(t.amount) || 0;
        }
        return false;
      }

      if (viewMode === 'PERSONAL') return !isShared;
      if (viewMode === 'HOUSEHOLD') {
        if (!isShared) return false;
        if (!activeGroupObj) return true;
        return doesTxBelongToGroup(t, activeGroupObj, groups);
      }
      return true;
    });

    const roundedSettled = Math.round(groupSettlementSum * 100) / 100;

    const totalAccounts = accounts.reduce(
      (acc, a) => acc + (parseFloat(a.currentBalance ?? a.balance ?? 0) || 0),
      0,
    );
    const totalCardsDebt = cards.reduce(
      (acc, c) => acc + (parseFloat(c.currentBill?.totalAmount ?? c.currentInvoice ?? 0) || 0),
      0,
    );

    const calcIncome = filtered
      .filter((t) => String(t.type).toUpperCase() === 'INCOME')
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const grossExpense = filtered
      .filter((t) => String(t.type).toUpperCase() === 'EXPENSE')
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

    const calcExpense =
      viewMode === 'HOUSEHOLD' || viewMode === 'ALL'
        ? Math.max(0, Math.round((grossExpense - roundedSettled) * 100) / 100)
        : grossExpense;

    const totalIncome =
      viewMode === 'PERSONAL' &&
      personalReportSummary &&
      typeof personalReportSummary.totalIncome === 'number' &&
      personalReportSummary.totalIncome > 0
        ? personalReportSummary.totalIncome
        : calcIncome;
    const totalExpense =
      viewMode === 'PERSONAL' &&
      personalReportSummary &&
      typeof personalReportSummary.totalExpense === 'number' &&
      personalReportSummary.totalExpense > 0
        ? personalReportSummary.totalExpense
        : calcExpense;
    const totalAccountBalance =
      viewMode === 'HOUSEHOLD'
        ? Math.round((calcIncome - calcExpense) * 100) / 100
        : personalReportSummary &&
            typeof personalReportSummary.totalAccountBalance === 'number' &&
            personalReportSummary.totalAccountBalance !== 0
          ? personalReportSummary.totalAccountBalance
          : totalAccounts;
    const openCreditCardDebt =
      viewMode === 'HOUSEHOLD'
        ? 0
        : personalReportSummary &&
            typeof personalReportSummary.openCreditCardDebt === 'number' &&
            personalReportSummary.openCreditCardDebt > 0
          ? personalReportSummary.openCreditCardDebt
          : totalCardsDebt;
    const netSavings = totalIncome - totalExpense;
    const savingsRatePct =
      totalIncome > 0 ? Math.round((netSavings / totalIncome) * 1000) / 10 : 0;

    const computedSummary: SummaryData = {
      totalAccountBalance,
      openCreditCardDebt,
      netWorth: totalAccountBalance - openCreditCardDebt,
      totalIncome,
      totalExpense,
      netSavings,
      savingsRatePct,
    };

    let computedCategories: CategoryData[] = [];
    if (viewMode === 'PERSONAL' && personalReportCategories.length > 0 && filtered.length === 0) {
      computedCategories = personalReportCategories;
    } else {
      const catMap = new Map<string, { total: number; color: string }>();
      for (const t of filtered) {
        if (String(t.type).toUpperCase() !== 'EXPENSE') continue;
        const catMeta = extractCategoryFromTx(t);
        const key = `${catMeta.emoji} ${catMeta.label}`;
        const prev = catMap.get(key) || { total: 0, color: catMeta.color };
        catMap.set(key, { total: prev.total + (parseFloat(t.amount) || 0), color: catMeta.color });
      }
      const totalCat = Array.from(catMap.values()).reduce((a, b) => a + b.total, 0) || 1;
      computedCategories = Array.from(catMap.entries()).map(([name, info], idx) => ({
        categoryId: String(idx),
        name,
        colorHex: info.color || CHART_COLORS[idx % CHART_COLORS.length],
        totalSpent: info.total,
        percentage: Math.round((info.total / totalCat) * 1000) / 10,
      }));
    }

    return {
      scopedTxs: filtered,
      settledTotal: roundedSettled,
      summary: computedSummary,
      recentTransactions: filtered.slice(0, 6),
      categories: computedCategories,
    };
  }, [
    allTransactions,
    viewMode,
    selectedGroupId,
    groups,
    accounts,
    cards,
    personalReportSummary,
    personalReportCategories,
  ]);

  const handleQuickCreateTx = async (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = parseFloat(quickAmount.replace(',', '.'));
    if (!quickDesc.trim() || !numeric || numeric <= 0) return;
    setQuickSubmitting(true);
    try {
      const user = getAuthUser();
      const chosenGroup = groups.find((g) => String(g.id) === String(quickGroupId));
      const isShared = Boolean(chosenGroup);
      const notes = isShared
        ? encodeSharedNotes({
            kind: 'expense',
            groupId: chosenGroup.id,
            groupName: chosenGroup.name,
            category: quickCategory,
            paidBy: user?.fullName || user?.name || 'Você',
            author: user?.fullName || user?.name || 'Você',
            authorId: user?.id,
            authorEmail: user?.email,
          })
        : `[CAT:${quickCategory}]`;

      await apiFetch('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          description: quickDesc.trim(),
          amount: numeric,
          type: quickType,
          date: new Date().toISOString(),
          accountId: !isShared && quickAccountId ? quickAccountId : undefined,
          isHouseholdShared: isShared,
          notes,
        }),
      });

      setQuickDesc('');
      setQuickAmount('');
      setQuickOpen(false);
      notifyDataChanged();
      loadDashboardData();
    } catch (err: any) {
      alert(err.message || 'Falha ao salvar lançamento.');
    } finally {
      setQuickSubmitting(false);
    }
  };

  const activeTabIdx = Math.max(0, VIEW_TABS.findIndex((t) => t.id === viewMode));

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (loading) {
    return (
      <main className="min-h-[100dvh] bg-white flex flex-col items-center justify-center p-6 gap-3">
        <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        <div className="text-xs font-semibold text-zinc-500">Carregando seu painel FINN...</div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-white p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Cabeçalho com Foto de Perfil Real + Atalho Novo Gasto + Seletor Pessoal | Grupos | Tudo */}
      <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-5 border-b border-[#EFEAF8]">
        <div className="flex items-center gap-3.5">
          <Link href="/profile" title="Editar meu perfil">
            <img
              src={userAvatar}
              alt="Foto de perfil"
              className="w-12 h-12 rounded-full object-cover aspect-square border-2 border-violet-300 shadow-sm shrink-0"
            />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="finn-page-title font-extrabold tracking-tight text-zinc-900">
                Olá{userName ? `, ${userName.split(' ')[0]}` : ''} 👋
              </h1>
            </div>
            <p className="text-sm text-zinc-500 mt-0.5">
              Acompanhe suas finanças, cartões e grupos em tempo real.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <button
            type="button"
            onClick={() => {
              const targetGrp =
                viewMode === 'HOUSEHOLD'
                  ? selectedGroupId !== 'ALL' && selectedGroupId
                    ? selectedGroupId
                    : groups[0]?.id || ''
                  : '';
              setQuickGroupId(targetGrp);
              setQuickOpen(true);
            }}
            className="px-4 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-violet-600/20 shrink-0"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Novo Gasto
          </button>

          {viewMode === 'HOUSEHOLD' && groups.length > 0 && (
            <select
              aria-label="Selecionar grupo ativo"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="px-3.5 py-2.5 rounded-2xl border border-violet-200 bg-white text-xs font-bold text-violet-800 shadow-sm"
            >
              <option value="ALL">Todos os grupos ({groups.length})</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.members?.length || 1} membros)
                </option>
              ))}
            </select>
          )}

          {/* Seletor deslizante Pessoal | Grupos | Tudo */}
          <div
            role="tablist"
            aria-label="Modo de visualização"
            className="relative grid grid-cols-3 w-full sm:w-[320px] p-1 bg-[#EDE7F8] rounded-[22px]"
          >
            <div
              aria-hidden="true"
              className="finn-slide-pill absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-[18px] bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] shadow-md shadow-violet-700/25"
              style={{ transform: `translateX(${activeTabIdx * 100}%)` }}
            />
            {VIEW_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = viewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setViewMode(tab.id)}
                  className={`relative z-10 flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-[18px] text-xs font-semibold transition-colors ${
                    active ? 'text-white font-bold' : 'text-zinc-700'
                  }`}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {tab.id === 'HOUSEHOLD' && groups.length > 0
                      ? `${tab.label} (${groups.length})`
                      : tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Cards Principais */}
      <section className="finn-card-container grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#3B0764] via-[#5B21B6] to-[#7C3AED] text-white rounded-[20px] p-5 shadow-lg shadow-violet-800/20">
          <div
            aria-hidden="true"
            className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-purple-300/20 pointer-events-none"
          />
          <div
            aria-hidden="true"
            className="absolute -right-2 -top-2 w-20 h-20 rounded-full bg-purple-200/15 pointer-events-none"
          />
          <div className="relative flex items-center justify-between text-violet-100 text-xs font-medium">
            <span>{viewMode === 'HOUSEHOLD' ? 'Saldo em aberto no grupo' : 'Saldo em Contas'}</span>
            <Wallet className="w-4 h-4" aria-hidden="true" />
          </div>
          <p className="relative finn-hero-value font-extrabold mt-2 tracking-tight">
            {formatCurrencyBRL(
              viewMode === 'HOUSEHOLD' ? summary.totalExpense : summary.totalAccountBalance,
            )}
          </p>
          <p className="relative text-xs text-violet-200 mt-1.5">
            {viewMode === 'HOUSEHOLD'
              ? `Abatimentos confirmados: ${formatCurrencyBRL(settledTotal)}`
              : `Patrimônio líquido: ${formatCurrencyBRL(summary.netWorth)}`}
          </p>
        </div>

        <div className="bg-white border border-[#EFEAF8] rounded-[20px] p-5 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 text-xs font-semibold">
            <span>Receitas</span>
            <ArrowDownLeft className="w-4 h-4" aria-hidden="true" />
          </div>
          <p className="text-2xl font-extrabold text-zinc-900 mt-2">
            {formatCurrencyBRL(summary.totalIncome)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Entradas confirmadas</p>
        </div>

        <div className="bg-white border border-[#EFEAF8] rounded-[20px] p-5 shadow-sm">
          <div className="flex items-center justify-between text-violet-700 text-xs font-semibold">
            <span>{viewMode === 'HOUSEHOLD' ? 'Despesas em aberto' : 'Despesas'}</span>
            <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
          </div>
          <p className="text-2xl font-extrabold text-zinc-900 mt-2">
            {formatCurrencyBRL(summary.totalExpense)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {viewMode === 'HOUSEHOLD'
              ? `Abatido: ${formatCurrencyBRL(settledTotal)}`
              : `Faturas em aberto: ${formatCurrencyBRL(summary.openCreditCardDebt)}`}
          </p>
        </div>

        <div className="bg-white border border-[#EFEAF8] rounded-[20px] p-5 shadow-sm">
          <div className="flex items-center justify-between text-violet-600 text-xs font-semibold">
            <span>Resultado</span>
            <TrendingUp className="w-4 h-4" aria-hidden="true" />
          </div>
          <p className="text-2xl font-extrabold text-zinc-900 mt-2">
            {formatCurrencyBRL(summary.netSavings)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Taxa de economia: {summary.savingsRatePct}%</p>
        </div>
      </section>

      {/* Movimentações Recentes + Categorias */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-[#EFEAF8] rounded-[20px] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-zinc-900">
              Últimas movimentações
            </h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const targetGrp =
                    viewMode === 'HOUSEHOLD'
                      ? selectedGroupId !== 'ALL' && selectedGroupId
                        ? selectedGroupId
                        : groups[0]?.id || ''
                      : '';
                  setQuickGroupId(targetGrp);
                  setQuickOpen(true);
                }}
                className="text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-xl flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Novo Gasto
              </button>
              <Link
                href={viewMode === 'HOUSEHOLD' ? '/household' : '/transactions'}
                className="text-xs font-semibold text-violet-700 hover:underline"
              >
                Ver tudo
              </Link>
            </div>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-400">
              Nenhuma movimentação encontrada para este modo ainda.
            </div>
          ) : (
            <div className="divide-y divide-[#F3F0FA]">
              {recentTransactions.map((tx) => {
                const isInc = String(tx.type).toUpperCase() === 'INCOME';
                const meta = parseSharedNotes(tx.notes);
                const cat = extractCategoryFromTx(tx);
                return (
                  <div key={tx.id} className="py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-lg shrink-0">
                        {cat.emoji}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 truncate">
                          {tx.description || 'Movimentação'}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {cat.label} • {String(tx.date || '').split('T')[0]}
                          {meta?.groupName ? ` • Grupo: ${meta.groupName}` : ''}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-bold shrink-0 ${
                        isInc ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {isInc ? '+' : '-'} {formatCurrencyBRL(parseFloat(tx.amount) || 0)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#EFEAF8] rounded-[20px] p-6 flex flex-col gap-4 shadow-sm">
          <h2 className="text-base font-bold text-zinc-900">
            Gastos por categoria
          </h2>

          {categories.length > 0 ? (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="totalSpent"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={66}
                  >
                    {categories.map((entry, idx) => (
                      <Cell key={entry.categoryId} fill={entry.colorHex || CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => formatCurrencyBRL(Number(val) || 0)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-zinc-400 py-6 text-center">
              Sem despesas registradas neste período.
            </p>
          )}

          <div className="flex flex-col gap-2 pt-2 border-t border-[#F3F0FA]">
            <Link
              href="/household"
              className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Users className="w-4 h-4" aria-hidden="true" /> Abrir Grupos ({groups.length})
            </Link>
            <Link
              href="/cards"
              className="w-full py-2.5 px-4 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <CreditCard className="w-4 h-4" aria-hidden="true" /> Ver Cartões ({cards.length || upcoming.length})
            </Link>
          </div>
        </div>
      </section>

      {evolution.length > 0 && (
        <section className="bg-white border border-[#EFEAF8] rounded-[20px] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-violet-600" aria-hidden="true" />
            <h2 className="text-base font-bold text-zinc-900">Evolução Mensal</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolution}>
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(val: any) => formatCurrencyBRL(Number(val) || 0)} />
                <Bar dataKey="receitas" fill="#10B981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="despesas" fill="#7C3AED" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Modal Rápido: "+ Novo Gasto" direto do Dashboard */}
      <dialog
        ref={quickDialogRef}
        aria-labelledby="quick-tx-title"
        closedby="any"
        onClose={() => setQuickOpen(false)}
        onClick={(e) => {
          if (e.target === quickDialogRef.current) setQuickOpen(false);
        }}
        className="finn-dialog"
      >
        <form onSubmit={handleQuickCreateTx} className="bg-white border border-[#EFEAF8] rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
          <h3 id="quick-tx-title" className="text-lg font-bold text-zinc-900">
            Lançar Novo Gasto / Receita
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setQuickType('EXPENSE')}
              className={`py-2 rounded-xl text-xs font-bold border ${
                quickType === 'EXPENSE'
                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                  : 'bg-zinc-50 text-zinc-500 border-zinc-200'
              }`}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => setQuickType('INCOME')}
              className={`py-2 rounded-xl text-xs font-bold border ${
                quickType === 'INCOME'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-zinc-50 text-zinc-500 border-zinc-200'
              }`}
            >
              Receita
            </button>
          </div>

          <input
            type="text"
            required
            autoFocus
            value={quickDesc}
            onChange={(e) => setQuickDesc(e.target.value)}
            placeholder="Descrição (ex: Almoço, Mercado)"
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm"
          />

          <input
            type="text"
            required
            value={quickAmount}
            onChange={(e) => setQuickAmount(e.target.value)}
            placeholder="Valor (ex: 45.90)"
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm"
          />

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Categoria</label>
            <select
              value={quickCategory}
              onChange={(e) => setQuickCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white"
            >
              {OFFICIAL_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </div>

          {groups.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Destino</label>
              <select
                value={quickGroupId}
                onChange={(e) => setQuickGroupId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white"
              >
                <option value="">Pessoal (Minha Conta)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    Grupo: {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!quickGroupId && accounts.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Conta / Carteira</label>
              <select
                value={quickAccountId}
                onChange={(e) => setQuickAccountId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-1">
            <button
              type="button"
              onClick={() => setQuickOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={quickSubmitting}
              className="px-5 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold"
            >
              {quickSubmitting ? 'Salvando...' : 'Salvar Lançamento'}
            </button>
          </div>
        </form>
      </dialog>
    </main>
  );
}
