'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ArrowLeftRight,
  Plus,
  CheckCircle2,
  AlertCircle,
  Building2,
  Pencil,
  Trash2,
  Users,
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
import { formatCurrencyBRL, formatDateBR } from '@finn-ai/ui';

interface TransactionItem {
  id: string;
  description: string;
  amount: string | number;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  status: string;
  date: string;
  notes?: string;
  isHouseholdShared: boolean;
  category?: { name: string; colorHex?: string };
  account?: { name: string; colorHex?: string };
  user?: { fullName: string };
}

interface AccountItem {
  id: string;
  name: string;
}

interface GroupItem {
  id: string;
  name: string;
}

export default function TransactionsPage() {
  const modalRef = useRef<HTMLDialogElement>(null);

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<'PERSONAL' | 'GROUP'>('PERSONAL');
  const [filterGroupId, setFilterGroupId] = useState<string>('ALL');
  const [filterCategoryId, setFilterCategoryId] = useState<string>('ALL');

  const [showModal, setShowModal] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [accountId, setAccountId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('alimentacao');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isGroupShared, setIsGroupShared] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const dlg = modalRef.current;
    if (!dlg) return;
    if (showModal && !dlg.open) dlg.showModal();
    else if (!showModal && dlg.open) dlg.close();
  }, [showModal]);

  const loadData = useCallback(async () => {
    try {
      const [grpList, accData, personalTxs] = await Promise.all([
        fetchUserGroups(),
        apiFetch<AccountItem[]>('/accounts?scope=HOUSEHOLD').catch(() => null),
        apiFetch<TransactionItem[]>('/transactions?scope=PERSONAL').catch(() => null),
      ]);

      const sharedTxs = await fetchSharedGroupTransactions(grpList, null).catch(() => null);

      if (Array.isArray(accData)) {
        setAccounts(accData);
        setAccountId((prev) => prev || accData[0]?.id || '');
      }

      setTransactions((prevTxs) => {
        if (!Array.isArray(personalTxs) && !Array.isArray(sharedTxs)) return prevTxs;
        const mergedMap = new Map<string, TransactionItem>();
        const pList = Array.isArray(personalTxs) ? personalTxs : prevTxs.filter((t) => !t.isHouseholdShared && !parseSharedNotes(t.notes));
        const sList = Array.isArray(sharedTxs) ? sharedTxs : prevTxs.filter((t) => t.isHouseholdShared || parseSharedNotes(t.notes));

        for (const tx of [...pList, ...sList]) {
          if (tx?.id) mergedMap.set(tx.id, tx);
        }
        const sorted = Array.from(mergedMap.values()).sort(
          (a: any, b: any) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime(),
        );

        const reconciled = reconcileGroupsWithTransactions(grpList, sorted);
        if (reconciled.length > 0) {
          setGroups(reconciled);
          setTargetGroupId((prev) => prev || reconciled[0]?.id || '');
        }
        return sorted;
      });
    } catch (err: any) {
      console.warn('Erro ao carregar transações:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useLiveSync(loadData);

  const filteredTransactions = useMemo(() => {
    const activeGroupObj =
      filterGroupId !== 'ALL'
        ? groups.find((g) => String(g.id) === String(filterGroupId)) || { id: filterGroupId }
        : null;

    return transactions.filter((tx) => {
      const meta = parseSharedNotes(tx.notes);
      if (meta?.kind === 'settlement') return false;
      const isShared = Boolean(tx.isHouseholdShared || meta);

      if (scope === 'PERSONAL' && isShared) return false;
      if (scope === 'GROUP' && !isShared) return false;

      const cat = extractCategoryFromTx(tx);
      if (filterCategoryId !== 'ALL' && cat.id !== filterCategoryId) return false;

      if (scope === 'GROUP' && activeGroupObj) {
        return doesTxBelongToGroup(tx, activeGroupObj, groups);
      }
      return true;
    });
  }, [transactions, filterCategoryId, filterGroupId, scope, groups]);

  const openCreateModal = () => {
    setEditingTxId(null);
    setDescription('');
    setAmount('');
    setType('EXPENSE');
    setSelectedCategoryId('alimentacao');
    setDate(new Date().toISOString().split('T')[0]);
    const inGroup = scope === 'GROUP' && groups.length > 0;
    setIsGroupShared(inGroup);
    setTargetGroupId(filterGroupId !== 'ALL' ? filterGroupId : groups[0]?.id || '');
    setShowModal(true);
  };

  const openEditModal = (tx: TransactionItem) => {
    const meta = parseSharedNotes(tx.notes);
    const cat = extractCategoryFromTx(tx);
    setEditingTxId(tx.id);
    setDescription(tx.description || '');
    setAmount(String(tx.amount || ''));
    setType(tx.type === 'INCOME' ? 'INCOME' : 'EXPENSE');
    setSelectedCategoryId(cat.id);
    setDate(String(tx.date || new Date().toISOString()).split('T')[0]);
    const inGroup = Boolean(tx.isHouseholdShared || meta);
    setIsGroupShared(inGroup);
    setTargetGroupId(meta?.groupId || groups[0]?.id || '');
    setShowModal(true);
  };

  const handleDelete = async (txId: string) => {
    setStatusMessage(null);
    try {
      await apiFetch(`/transactions/${encodeURIComponent(txId)}`, { method: 'DELETE' });
      setStatusMessage({ type: 'success', text: 'Movimentação excluída com sucesso!' });
      notifyDataChanged();
      loadData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = parseFloat(amount.replace(',', '.'));
    if (!description.trim() || !numeric || numeric <= 0) return;

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const user = getAuthUser();
      const chosenGroup = isGroupShared
        ? groups.find((g) => String(g.id) === String(targetGroupId)) || groups[0]
        : null;

      const notes = chosenGroup
        ? encodeSharedNotes({
            kind: 'expense',
            groupId: chosenGroup.id,
            groupName: chosenGroup.name,
            category: selectedCategoryId,
            paidBy: user?.fullName || user?.name || 'Você',
            author: user?.fullName || user?.name || 'Você',
            authorId: user?.id,
            authorEmail: user?.email,
          })
        : `[CAT:${selectedCategoryId}]`;

      const payload = {
        description: description.trim(),
        amount: numeric,
        type,
        date: new Date(date).toISOString(),
        accountId: !chosenGroup && accountId ? accountId : undefined,
        isHouseholdShared: Boolean(chosenGroup),
        notes,
      };

      if (editingTxId) {
        await apiFetch(`/transactions/${encodeURIComponent(editingTxId)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setStatusMessage({ type: 'success', text: 'Movimentação atualizada com sucesso!' });
      } else {
        await apiFetch('/transactions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setStatusMessage({ type: 'success', text: 'Movimentação registrada com sucesso!' });
      }

      setShowModal(false);
      setEditingTxId(null);
      setDescription('');
      setAmount('');
      notifyDataChanged();
      loadData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-white max-w-6xl mx-auto p-4 sm:p-6 lg:p-10 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-[#EFEAF8]">
        <div>
          <h1 className="finn-page-title font-extrabold tracking-tight text-zinc-900 flex items-center gap-2.5">
            <ArrowLeftRight className="w-6 h-6 text-violet-600" aria-hidden="true" />
            Extrato &amp; Transações
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Categorias com ícones fiéis ao app, filtro por grupo e edição em tempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center p-1 bg-[#EDE7F8] rounded-xl">
            <button
              type="button"
              onClick={() => setScope('PERSONAL')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                scope === 'PERSONAL' ? 'bg-violet-600 text-white shadow-sm' : 'text-zinc-600'
              }`}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => setScope('GROUP')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                scope === 'GROUP' ? 'bg-violet-600 text-white shadow-sm' : 'text-zinc-600'
              }`}
            >
              Grupo
            </button>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Novo Lançamento</span>
          </button>
        </div>
      </div>

      {/* Filtros de Grupo e Categoria */}
      <div className="flex flex-wrap items-center gap-3">
        {scope === 'GROUP' && groups.length > 0 && (
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-600" aria-hidden="true" />
            <select
              aria-label="Filtrar por grupo"
              value={filterGroupId}
              onChange={(e) => setFilterGroupId(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-violet-200 bg-white text-xs font-bold text-zinc-800"
            >
              <option value="ALL">Todos os grupos ({groups.length})</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <select
          aria-label="Filtrar por categoria"
          value={filterCategoryId}
          onChange={(e) => setFilterCategoryId(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-[#E2DAF5] bg-white text-xs font-semibold text-zinc-700"
        >
          <option value="ALL">Todas as categorias</option>
          {OFFICIAL_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.label}
            </option>
          ))}
        </select>
      </div>

      {statusMessage && (
        <div
          role="status"
          className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Lista de Movimentações */}
      <div className="bg-white border border-[#EFEAF8] rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            Carregando movimentações financeiras...
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto mb-3">
              <ArrowLeftRight className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-zinc-900">Nenhuma movimentação encontrada</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto mb-5">
              Lance uma receita ou despesa ou ajuste os filtros selecionados.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-semibold"
            >
              Criar Lançamento
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#F3F0FA]">
            {filteredTransactions.map((tx) => {
              const isIncome = tx.type === 'INCOME';
              const cat = extractCategoryFromTx(tx);
              const meta = parseSharedNotes(tx.notes);

              return (
                <div
                  key={tx.id}
                  className="p-4 sm:p-5 flex items-center justify-between gap-3 hover:bg-[#FAF8FF] transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 border"
                      style={{
                        backgroundColor: `${cat.color}18`,
                        borderColor: `${cat.color}35`,
                      }}
                    >
                      {cat.emoji}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-zinc-900 truncate">
                        {tx.description}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-zinc-500">
                        <span>{formatDateBR(tx.date)}</span>
                        <span>• {cat.label}</span>
                        {tx.account && (
                          <span className="flex items-center gap-1">
                            • <Building2 className="w-3 h-3" aria-hidden="true" />
                            {tx.account.name}
                          </span>
                        )}
                        {(tx.isHouseholdShared || meta?.groupName) && (
                          <span className="px-2 py-0.5 bg-violet-50 text-violet-700 border border-violet-200 text-[11px] rounded-full font-semibold">
                            Grupo{meta?.groupName ? `: ${meta.groupName}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <p
                      className={`text-base font-bold ${
                        isIncome ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {formatCurrencyBRL(Math.abs(Number(tx.amount)))}
                    </p>
                    <button
                      type="button"
                      onClick={() => openEditModal(tx)}
                      aria-label={`Editar ${tx.description}`}
                      className="p-2 rounded-lg text-zinc-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                    >
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(tx.id)}
                      aria-label={`Excluir ${tx.description}`}
                      className="p-2 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Nativo Novo / Editar Lançamento */}
      <dialog
        ref={modalRef}
        aria-labelledby="tx-modal-title"
        closedby="any"
        onClose={() => setShowModal(false)}
        onClick={(e) => {
          if (e.target === modalRef.current) setShowModal(false);
        }}
        className="finn-dialog"
      >
        <form onSubmit={handleSave} className="bg-white border border-[#EFEAF8] rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
          <h2 id="tx-modal-title" className="text-lg font-bold text-zinc-900">
            {editingTxId ? 'Editar Lançamento Financeiro' : 'Novo Lançamento Financeiro'}
          </h2>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType('EXPENSE')}
              className={`py-2 rounded-xl text-xs font-bold border ${
                type === 'EXPENSE'
                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                  : 'bg-zinc-50 text-zinc-500 border-zinc-200'
              }`}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => setType('INCOME')}
              className={`py-2 rounded-xl text-xs font-bold border ${
                type === 'INCOME'
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
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição"
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm"
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Valor (ex: 50.00)"
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Categoria</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
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
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isGroupShared}
                onChange={(e) => setIsGroupShared(e.target.checked)}
                className="accent-violet-600 w-4 h-4"
              />
              Compartilhar em Grupo
            </label>
          )}

          {isGroupShared && groups.length > 0 ? (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Selecionar Grupo</label>
              <select
                value={targetGroupId}
                onChange={(e) => setTargetGroupId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            accounts.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Conta / Carteira</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )
          )}

          <div className="flex justify-end gap-2 mt-1">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold"
            >
              {submitting ? 'Salvando...' : editingTxId ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        </form>
      </dialog>
    </main>
  );
}
