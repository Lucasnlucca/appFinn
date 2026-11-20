'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Users,
  Plus,
  KeyRound,
  Copy,
  Check,
  AlertCircle,
  Receipt,
  CheckCircle2,
  Pencil,
  Trash2,
  RefreshCw,
  ShoppingCart,
} from 'lucide-react';
import {
  OFFICIAL_CATEGORIES,
  apiFetch,
  doesTxBelongToGroup,
  encodeSharedNotes,
  extractCategoryFromTx,
  fetchSharedGroupTransactions,
  fetchUserGroups,
  getAuthUser,
  notifyDataChanged,
  parseSharedNotes,
  reconcileGroupsWithTransactions,
  useLiveSync,
} from '@/lib/api';
import { formatCurrencyBRL } from '@finn-ai/ui';

interface Member {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

interface HouseholdGroup {
  id: string;
  name: string;
  currency?: string;
  inviteCode?: string;
  inviteCodeExpiresAt?: string;
  members: Member[];
}

interface SharedTx {
  id: string;
  description: string;
  amount: number;
  date: string;
  notes?: string;
  paidBy: string;
  userId?: string;
  user?: { id?: string; fullName?: string; email?: string };
  meta: Record<string, any>;
}

function NativeModal({
  open,
  onClose,
  titleId,
  children,
}: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      closedby="any"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="finn-dialog"
    >
      <div className="bg-white border border-[#EFEAF8] rounded-3xl p-6 shadow-2xl">
        {children}
      </div>
    </dialog>
  );
}

export default function HouseholdPage() {
  const [groups, setGroups] = useState<HouseholdGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [rawTransactions, setRawTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newGroupName, setNewGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingTx, setEditingTx] = useState<SharedTx | null>(null);
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('alimentacao');
  const [expPaidBy, setExpPaidBy] = useState('');

  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleFrom, setSettleFrom] = useState('');
  const [settleTo, setSettleTo] = useState('');

  const [copiedCode, setCopiedCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [manualInviteCodes, setManualInviteCodes] = useState<Record<string, string>>({});

  const currentUser = getAuthUser();

  const loadData = useCallback(async () => {
    try {
      const [groupList, personalTxs] = await Promise.all([
        fetchUserGroups(),
        apiFetch<any[]>('/transactions?scope=PERSONAL').catch(() => []),
      ]);
      const sharedTxs = await fetchSharedGroupTransactions(groupList, null);

      const mergedMap = new Map<string, any>();
      for (const tx of [...(personalTxs || []), ...(sharedTxs || [])]) {
        if (!tx?.id) continue;
        if (tx.isHouseholdShared || parseSharedNotes(tx.notes)) {
          mergedMap.set(tx.id, tx);
        }
      }
      const allShared = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime(),
      );

      const reconciled = reconcileGroupsWithTransactions(groupList, allShared);
      if (reconciled.length > 0) {
        setGroups(reconciled);
        setSelectedGroupId((prev) => {
          if (prev && reconciled.some((g) => String(g.id) === String(prev))) return prev;
          return reconciled[0]?.id || '';
        });
      }
      setRawTransactions(allShared);
    } catch (err: any) {
      console.warn('Erro ao carregar grupos:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useLiveSync(loadData);

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) || groups[0] || null,
    [groups, selectedGroupId],
  );

  const isOwner = useMemo(() => {
    if (!activeGroup || !currentUser) return false;
    const me = activeGroup.members?.find(
      (m) => m.id === currentUser.id || m.email?.toLowerCase() === currentUser.email?.toLowerCase(),
    );
    return me?.role === 'OWNER';
  }, [activeGroup, currentUser]);

  const { expenses, settlements, grossSpent, settledTotal, openBalance, debtsCalculation } = useMemo(() => {
    if (!activeGroup) {
      return {
        expenses: [],
        settlements: [],
        grossSpent: 0,
        settledTotal: 0,
        openBalance: 0,
        debtsCalculation: { member1: 'Participante', member2: 'Participante', netOwed: 0, pairwiseDebts: [] as Array<{ from: string; to: string; amount: number }> },
      };
    }

    const exps: SharedTx[] = [];
    const settles: SharedTx[] = [];
    const groupMembers = activeGroup.members || [];

    for (const tx of rawTransactions) {
      if (!doesTxBelongToGroup(tx, activeGroup, groups)) continue;
      const meta = parseSharedNotes(tx.notes) || {};

      const paidBy = meta.paidBy || meta.author || tx.user?.fullName || groupMembers[0]?.fullName || 'Participante';

      const mapped: SharedTx = {
        id: tx.id,
        description: tx.description || 'Despesa compartilhada',
        amount: parseFloat(tx.amount) || 0,
        date: String(tx.date || tx.createdAt || '').split('T')[0],
        notes: tx.notes,
        paidBy,
        userId: tx.userId,
        user: tx.user,
        meta,
      };

      if (meta.kind === 'settlement') {
        settles.push(mapped);
      } else {
        exps.push(mapped);
      }
    }

    const gross = Math.round(exps.reduce((s, e) => s + e.amount, 0) * 100) / 100;
    const settled = Math.round(settles.reduce((s, a) => s + a.amount, 0) * 100) / 100;
    const open = Math.max(0, Math.round((gross - settled) * 100) / 100);

    // Mesma lógica fiel de cálculo de quem deve para quem do aplicativo móvel
    const balances: Record<string, number> = {};
    groupMembers.forEach((m) => {
      balances[m.fullName || m.email] = 0;
    });

    exps.forEach((tx) => {
      const payer = tx.paidBy || groupMembers[0]?.fullName || 'Participante';
      const totalAmt = tx.amount || 0;
      if (balances[payer] === undefined) balances[payer] = 0;

      if (tx.meta?.splitDetails?.members && Array.isArray(tx.meta.splitDetails.members)) {
        balances[payer] += totalAmt;
        tx.meta.splitDetails.members.forEach((sm: any) => {
          if (balances[sm.name] === undefined) balances[sm.name] = 0;
          balances[sm.name] -= sm.totalToPay || 0;
        });
      } else {
        const count = groupMembers.length || 1;
        const share = totalAmt / count;
        balances[payer] += totalAmt;
        groupMembers.forEach((m) => {
          const key = m.fullName || m.email;
          balances[key] = (balances[key] || 0) - share;
        });
      }
    });

    settles.forEach((s) => {
      const fromM = s.meta?.fromMember;
      const toM = s.meta?.toMember;
      if (fromM && balances[fromM] !== undefined) balances[fromM] += s.amount || 0;
      if (toM && balances[toM] !== undefined) balances[toM] -= s.amount || 0;
    });

    const member1 = groupMembers[0]?.fullName || 'Participante';
    const member2 = groupMembers[1]?.fullName || 'Participante';
    const netOwed = Math.round((((balances[member1] || 0) - (balances[member2] || 0)) / 2) * 100) / 100;

    const creditors: Array<{ name: string; amount: number }> = [];
    const debtors: Array<{ name: string; amount: number }> = [];
    Object.entries(balances).forEach(([name, bal]) => {
      const rounded = Math.round(bal * 100) / 100;
      if (rounded > 0.01) creditors.push({ name, amount: rounded });
      else if (rounded < -0.01) debtors.push({ name, amount: Math.abs(rounded) });
    });

    const pairwiseDebts: Array<{ from: string; to: string; amount: number }> = [];
    let cIdx = 0;
    let dIdx = 0;
    const credCopy = creditors.map((c) => ({ ...c }));
    const debtCopy = debtors.map((d) => ({ ...d }));

    while (cIdx < credCopy.length && dIdx < debtCopy.length) {
      const settleAmt = Math.min(credCopy[cIdx].amount, debtCopy[dIdx].amount);
      if (settleAmt > 0.01) {
        pairwiseDebts.push({
          from: debtCopy[dIdx].name,
          to: credCopy[cIdx].name,
          amount: Math.round(settleAmt * 100) / 100,
        });
      }
      credCopy[cIdx].amount -= settleAmt;
      debtCopy[dIdx].amount -= settleAmt;
      if (credCopy[cIdx].amount < 0.01) cIdx++;
      if (debtCopy[dIdx].amount < 0.01) dIdx++;
    }

    return {
      expenses: exps,
      settlements: settles,
      grossSpent: gross,
      settledTotal: settled,
      openBalance: open,
      debtsCalculation: { member1, member2, netOwed, pairwiseDebts },
    };
  }, [rawTransactions, activeGroup, groups.length]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const created = await apiFetch<HouseholdGroup>('/households', {
        method: 'POST',
        body: JSON.stringify({ name: newGroupName.trim(), currency: 'BRL' }),
      });
      setNewGroupName('');
      setShowCreateGroup(false);
      if (created?.id) setSelectedGroupId(created.id);
      setFeedback({ type: 'success', text: 'Grupo criado e sincronizado com o aplicativo!' });
      notifyDataChanged();
      loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const code = joinCode.trim().toUpperCase();
      await apiFetch(`/households/invitations/accept?token=${encodeURIComponent(code)}`, {
        method: 'POST',
        body: JSON.stringify({ token: code, code }),
      });
      setJoinCode('');
      setShowJoinGroup(false);
      setFeedback({ type: 'success', text: 'Você entrou no grupo com sucesso!' });
      notifyDataChanged();
      loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateInviteCode = async () => {
    if (!activeGroup) return;
    setFeedback(null);
    try {
      const res = await apiFetch<{ code: string }>('/households/invite-code', {
        method: 'POST',
        body: JSON.stringify({ householdId: activeGroup.id }),
      });
      if (res?.code) {
        setManualInviteCodes((prev) => ({
          ...prev,
          [activeGroup.id]: res.code,
        }));
      }
      setFeedback({ type: 'success', text: `Código gerado: ${res.code} (válido por 30 min)` });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !expDesc.trim() || !expAmount) return;
    const numericAmount = parseFloat(expAmount.replace(',', '.'));
    if (!numericAmount || numericAmount <= 0) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      const myName = expPaidBy || currentUser?.fullName || currentUser?.name || 'Você';
      const notes = encodeSharedNotes({
        kind: 'expense',
        groupId: activeGroup.id,
        groupName: activeGroup.name,
        category: expCategory,
        paidBy: myName,
        author: editingTx?.meta?.author || myName,
        authorId: currentUser?.id,
        authorEmail: currentUser?.email,
      });

      if (editingTx) {
        await apiFetch(`/transactions/${encodeURIComponent(editingTx.id)}`, {
          method: 'PUT',
          body: JSON.stringify({
            description: expDesc.trim(),
            amount: numericAmount,
            type: 'EXPENSE',
            notes,
          }),
        });
        setFeedback({ type: 'success', text: 'Despesa atualizada! O aplicativo também será atualizado.' });
      } else {
        await apiFetch('/transactions', {
          method: 'POST',
          body: JSON.stringify({
            description: expDesc.trim(),
            amount: numericAmount,
            type: 'EXPENSE',
            date: new Date().toISOString(),
            isHouseholdShared: true,
            notes,
          }),
        });
        setFeedback({ type: 'success', text: 'Despesa compartilhada lançada!' });
      }

      setShowExpenseModal(false);
      setEditingTx(null);
      setExpDesc('');
      setExpAmount('');
      notifyDataChanged();
      loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTx = async (txId: string) => {
    setFeedback(null);
    try {
      await apiFetch(`/transactions/${encodeURIComponent(txId)}`, { method: 'DELETE' });
      setFeedback({ type: 'success', text: 'Lançamento removido!' });
      notifyDataChanged();
      loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleRecordSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup) return;
    const numericAmount = parseFloat(settleAmount.replace(',', '.'));
    if (!numericAmount || numericAmount <= 0) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      const fromName = settleFrom || activeGroup.members?.[1]?.fullName || 'Participante';
      const toName = settleTo || activeGroup.members?.[0]?.fullName || 'Participante';

      await apiFetch('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          description: `Acerto: ${fromName} pagou ${toName}`,
          amount: numericAmount,
          type: 'EXPENSE',
          date: new Date().toISOString(),
          isHouseholdShared: true,
          notes: encodeSharedNotes({
            kind: 'settlement',
            groupId: activeGroup.id,
            groupName: activeGroup.name,
            fromMember: fromName,
            toMember: toName,
            author: currentUser?.fullName || currentUser?.name || fromName,
            authorId: currentUser?.id,
            authorEmail: currentUser?.email,
          }),
        }),
      });

      setShowSettleModal(false);
      setSettleAmount('');
      setFeedback({ type: 'success', text: 'Abatimento confirmado e sincronizado!' });
      notifyDataChanged();
      loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-10 text-center text-zinc-500">
        Carregando grupos compartilhados...
      </div>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-white max-w-6xl mx-auto p-4 sm:p-6 lg:p-10 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#EFEAF8]">
        <div>
          <h1 className="finn-page-title font-extrabold tracking-tight text-zinc-900 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-violet-600" aria-hidden="true" />
            Grupos Compartilhados
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Valores, divisões e abatimentos fiéis ao aplicativo FINN.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {groups.length > 0 && (
            <select
              aria-label="Selecionar grupo financeiro"
              value={activeGroup?.id || ''}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-violet-200 bg-white text-sm font-bold text-zinc-800"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.members?.length || 1} participantes)
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setShowJoinGroup(true)}
            className="px-3.5 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold border border-violet-200 flex items-center gap-1.5"
          >
            <KeyRound className="w-3.5 h-3.5" aria-hidden="true" /> Entrar com código
          </button>

          <button
            type="button"
            onClick={() => setShowCreateGroup(true)}
            className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Novo grupo
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{feedback.text}</span>
        </div>
      )}

      {!activeGroup ? (
        <div className="bg-white border border-[#EFEAF8] rounded-3xl p-10 text-center max-w-xl mx-auto shadow-sm">
          <Users className="w-10 h-10 text-violet-600 mx-auto mb-3" aria-hidden="true" />
          <h2 className="text-lg font-bold text-zinc-900">
            Nenhum grupo encontrado nesta conta
          </h2>
          <p className="text-sm text-zinc-500 mt-1 mb-6">
            Crie um novo grupo ou use o código de convite gerado no aplicativo para compartilhar despesas.
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowCreateGroup(true)}
              className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold"
            >
              Criar grupo
            </button>
            <button
              type="button"
              onClick={() => setShowJoinGroup(true)}
              className="px-5 py-2.5 rounded-xl bg-violet-50 text-violet-700 text-sm font-semibold border border-violet-200"
            >
              Entrar com código
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="flex flex-col gap-4">
            {/* Hero Saldo em Aberto */}
            <div className="relative overflow-hidden rounded-[22px] p-6 bg-gradient-to-br from-[#3B0764] via-[#5B21B6] to-[#7C3AED] text-white shadow-lg shadow-violet-800/20">
              <div
                aria-hidden="true"
                className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-purple-300/20 pointer-events-none"
              />
              <div
                aria-hidden="true"
                className="absolute -right-2 -top-2 w-24 h-24 rounded-full bg-purple-200/15 pointer-events-none"
              />
              <p className="relative text-xs text-violet-200 font-medium">Saldo em aberto</p>
              <p className="relative finn-hero-value font-extrabold mt-1 mb-5 tracking-tight">
                {formatCurrencyBRL(openBalance)}
              </p>

              <div className="relative grid grid-cols-2 gap-3 pt-4 border-t border-white/20">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-violet-200" aria-hidden="true" />
                  <div>
                    <p className="text-[11px] text-violet-200">Gastos</p>
                    <p className="text-sm font-bold">{formatCurrencyBRL(grossSpent)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-violet-200" aria-hidden="true" />
                  <div>
                    <p className="text-[11px] text-violet-200">Abatimentos</p>
                    <p className="text-sm font-bold">{formatCurrencyBRL(settledTotal)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Divisão por participante */}
            <div className="bg-white border border-[#EFEAF8] rounded-[20px] p-5 shadow-sm">
              <h2 className="text-sm font-bold text-zinc-900 mb-3">
                Divisão por participante ({activeGroup.members?.length || 1})
              </h2>
              <div className="flex flex-col gap-3">
                {(activeGroup.members || []).map((m) => {
                  const share = openBalance / (activeGroup.members?.length || 1);
                  const initials = (m.fullName || 'P')
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join('')
                    .toUpperCase();
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                        <span className="text-sm text-zinc-800 truncate">
                          {m.fullName || m.email}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-zinc-900 shrink-0">
                        {formatCurrencyBRL(share)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Card Acerto pendente fiel ao App */}
            <div className="bg-white border border-[#EFEAF8] rounded-[20px] p-5 shadow-sm">
              <h2 className="text-sm font-bold text-zinc-900 mb-2">
                {openBalance > 0 ? 'Acerto pendente' : 'Tudo acertado! 🎉'}
              </h2>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-zinc-600">
                  {openBalance > 0
                    ? debtsCalculation.pairwiseDebts.length > 0
                      ? `${debtsCalculation.pairwiseDebts[0].from.split(' ')[0]} deve a ${debtsCalculation.pairwiseDebts[0].to.split(' ')[0]}`
                      : debtsCalculation.netOwed > 0
                        ? `${debtsCalculation.member2.split(' ')[0]} deve a ${debtsCalculation.member1.split(' ')[0]}`
                        : debtsCalculation.netOwed < 0
                          ? `${debtsCalculation.member1.split(' ')[0]} deve a ${debtsCalculation.member2.split(' ')[0]}`
                          : 'Saldo em aberto no grupo'
                    : 'Nenhuma pendência no momento.'}
                </p>
                {openBalance > 0 && (
                  <span className="text-base font-extrabold text-zinc-900 shrink-0">
                    {formatCurrencyBRL(openBalance)}
                  </span>
                )}
              </div>

              {openBalance > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const firstDebt = debtsCalculation.pairwiseDebts[0];
                    setSettleAmount(String(openBalance));
                    setSettleFrom(firstDebt?.from || activeGroup.members?.[1]?.fullName || activeGroup.members?.[0]?.fullName || '');
                    setSettleTo(firstDebt?.to || activeGroup.members?.[0]?.fullName || '');
                    setShowSettleModal(true);
                  }}
                  className="mt-3 px-4 py-2 rounded-xl border border-violet-600 text-violet-700 hover:bg-violet-50 text-xs font-bold transition-colors"
                >
                  Abater valor
                </button>
              )}
            </div>

            {/* Código de convite (aparece somente quando clicar em gerar) */}
            <div className="bg-white border border-[#EFEAF8] rounded-[20px] p-5 shadow-sm">
              <h2 className="text-sm font-bold text-zinc-900 mb-2">
                Código de convite
              </h2>
              {manualInviteCodes[activeGroup.id] ? (
                <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-xl px-3.5 py-2.5 mb-3">
                  <span className="font-mono font-extrabold text-lg tracking-widest text-violet-700">
                    {manualInviteCodes[activeGroup.id]}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(manualInviteCodes[activeGroup.id] || '');
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="text-xs font-semibold text-violet-700 flex items-center gap-1"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                    {copiedCode ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 mb-3">
                  Clique no botão abaixo para gerar um código de convite quando precisar.
                </p>
              )}

              {isOwner ? (
                <button
                  type="button"
                  onClick={handleGenerateInviteCode}
                  className="w-full py-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />{' '}
                  {manualInviteCodes[activeGroup.id] ? 'Gerar novo código de convite' : 'Gerar código de convite'}
                </button>
              ) : (
                <p className="text-[11px] text-zinc-400">
                  Apenas o dono do grupo pode gerar um código de convite.
                </p>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-lg font-extrabold text-zinc-900">
                Despesas do grupo <span className="text-zinc-400 font-semibold">({expenses.length})</span>
              </h2>
              <button
                type="button"
                onClick={() => {
                  setEditingTx(null);
                  setExpDesc('');
                  setExpAmount('');
                  setExpCategory('alimentacao');
                  setExpPaidBy(currentUser?.fullName || currentUser?.name || activeGroup.members?.[0]?.fullName || 'Você');
                  setShowExpenseModal(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" aria-hidden="true" /> Lançar despesa compartilhada
              </button>
            </div>

            <div className="bg-white border border-[#EFEAF8] rounded-[20px] divide-y divide-[#F3F0FA] shadow-sm">
              {expenses.length === 0 ? (
                <p className="p-8 text-center text-sm text-zinc-400">
                  Nenhuma despesa compartilhada lançada neste grupo ainda.
                </p>
              ) : (
                expenses.map((tx) => {
                  const cat = extractCategoryFromTx(tx);
                  return (
                  <div key={tx.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-lg shrink-0">
                        {cat.emoji}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-zinc-900 truncate">
                          {tx.description}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {cat.label} • Pago por {tx.paidBy} • {tx.date}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-rose-600">
                        {formatCurrencyBRL(tx.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTx(tx);
                          setExpDesc(tx.description);
                          setExpAmount(String(tx.amount));
                          setExpCategory(tx.meta?.category || 'alimentacao');
                          setExpPaidBy(tx.paidBy || '');
                          setShowExpenseModal(true);
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-violet-600 hover:bg-violet-50"
                        aria-label={`Editar despesa ${tx.description}`}
                      >
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTx(tx.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                        aria-label={`Excluir despesa ${tx.description}`}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            {settlements.length > 0 && (
              <div>
                <h3 className="text-base font-bold text-zinc-900 mb-3">
                  Abatimentos registrados ({settlements.length})
                </h3>
                <div className="bg-white border border-[#EFEAF8] rounded-[20px] divide-y divide-[#F3F0FA] shadow-sm">
                  {settlements.map((s) => (
                    <div key={s.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">
                          {s.meta?.fromMember || 'Participante'} abateu para{' '}
                          {s.meta?.toMember || 'Participante'}
                        </p>
                        <p className="text-xs text-zinc-500">{s.date} • Confirmado</p>
                      </div>
                      <span className="text-sm font-bold text-emerald-600">
                        -{formatCurrencyBRL(s.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <NativeModal open={showCreateGroup} onClose={() => setShowCreateGroup(false)} titleId="dialog-create-group">
        <form onSubmit={handleCreateGroup} className="flex flex-col gap-4">
          <h3 id="dialog-create-group" className="text-lg font-bold text-zinc-900">
            Criar Novo Grupo
          </h3>
          <input
            type="text"
            required
            autoFocus
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Nome do grupo (ex: Casa, Viagem)"
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowCreateGroup(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold"
            >
              {submitting ? 'Criando...' : 'Criar'}
            </button>
          </div>
        </form>
      </NativeModal>

      <NativeModal open={showJoinGroup} onClose={() => setShowJoinGroup(false)} titleId="dialog-join-group">
        <form onSubmit={handleJoinGroup} className="flex flex-col gap-4">
          <h3 id="dialog-join-group" className="text-lg font-bold text-zinc-900">
            Entrar em Grupo com Código
          </h3>
          <input
            type="text"
            required
            autoFocus
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Digite o código (ex: 4VRMYU)"
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono uppercase tracking-widest"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowJoinGroup(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold"
            >
              {submitting ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
      </NativeModal>

      <NativeModal open={showExpenseModal} onClose={() => setShowExpenseModal(false)} titleId="dialog-expense">
        <form onSubmit={handleSaveExpense} className="flex flex-col gap-4">
          <h3 id="dialog-expense" className="text-lg font-bold text-zinc-900">
            {editingTx ? 'Editar Despesa Compartilhada' : 'Nova Despesa Compartilhada'}
          </h3>
          <input
            type="text"
            required
            autoFocus
            value={expDesc}
            onChange={(e) => setExpDesc(e.target.value)}
            placeholder="Descrição (ex: Mercado)"
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm"
          />
          <input
            type="text"
            required
            value={expAmount}
            onChange={(e) => setExpAmount(e.target.value)}
            placeholder="Valor (ex: 100.00)"
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm"
          />
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Categoria</label>
            <select
              value={expCategory}
              onChange={(e) => setExpCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white"
            >
              {OFFICIAL_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </div>
          {activeGroup?.members && activeGroup.members.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Quem pagou?</label>
              <select
                value={expPaidBy}
                onChange={(e) => setExpPaidBy(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white"
              >
                {activeGroup.members.map((m) => {
                  const n = m.fullName || m.email;
                  return (
                    <option key={m.id} value={n}>
                      {n}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowExpenseModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold"
            >
              {submitting ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </NativeModal>

      <NativeModal open={showSettleModal} onClose={() => setShowSettleModal(false)} titleId="dialog-settle">
        <form onSubmit={handleRecordSettlement} className="flex flex-col gap-4">
          <h3 id="dialog-settle" className="text-lg font-bold text-zinc-900">
            Registrar Abatimento
          </h3>
          <input
            type="text"
            required
            value={settleFrom}
            onChange={(e) => setSettleFrom(e.target.value)}
            placeholder="Quem pagou"
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm"
          />
          <input
            type="text"
            required
            value={settleTo}
            onChange={(e) => setSettleTo(e.target.value)}
            placeholder="Para quem"
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm"
          />
          <input
            type="text"
            required
            autoFocus
            value={settleAmount}
            onChange={(e) => setSettleAmount(e.target.value)}
            placeholder="Valor abatido (ex: 30.00)"
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowSettleModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold"
            >
              {submitting ? 'Confirmando...' : 'Confirmar Abatimento'}
            </button>
          </div>
        </form>
      </NativeModal>
    </main>
  );
}
