'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Wallet,
  Plus,
  Building2,
  Coins,
  TrendingUp,
  ShieldCheck,
  Users,
  AlertCircle,
  CheckCircle2,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { apiFetch, notifyDataChanged, useLiveSync } from '@/lib/api';
import { formatCurrencyBRL } from '@finn-ai/ui';
import BankLogo, { ALL_BANKS, getBankInfo, BankInfo } from '@/components/BankLogo';
import BankListSelector from '@/components/BankListSelector';

interface FinancialAccount {
  id: string;
  name: string;
  type: string;
  currency: string;
  currentBalance: string | number;
  calculatedBalance: string | number;
  colorHex?: string;
  isShared: boolean;
  user?: {
    id: string;
    fullName: string;
  };
}

export default function AccountsPage() {
  const modalRef = useRef<HTMLDialogElement>(null);

  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAcc, setEditingAcc] = useState<FinancialAccount | null>(null);
  const [selectedBankId, setSelectedBankId] = useState('nubank');
  const [name, setName] = useState('');
  const [type, setType] = useState('CHECKING');
  const [balanceInput, setBalanceInput] = useState('0.00');
  const [colorHex, setColorHex] = useState('#8A05BE');
  const [isShared, setIsShared] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const dlg = modalRef.current;
    if (!dlg) return;
    if (showModal && !dlg.open) dlg.showModal();
    else if (!showModal && dlg.open) dlg.close();
  }, [showModal]);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await apiFetch<FinancialAccount[]>('/accounts?scope=HOUSEHOLD');
      setAccounts(data || []);
    } catch (err: any) {
      console.warn('Erro ao carregar contas:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useLiveSync(loadAccounts);

  const openCreateModal = () => {
    setEditingAcc(null);
    setSelectedBankId('nubank');
    setName('Nubank');
    setType('CHECKING');
    setBalanceInput('0.00');
    setColorHex('#8A05BE');
    setIsShared(false);
    setShowModal(true);
  };

  const openEditModal = (acc: FinancialAccount) => {
    setEditingAcc(acc);
    const bank = getBankInfo(acc.name);
    setSelectedBankId(bank.id);
    setName(acc.name || '');
    setType(acc.type || 'CHECKING');
    setBalanceInput(String(parseFloat(String(acc.currentBalance ?? 0)) || 0));
    setColorHex(acc.colorHex || bank.gradient[0]);
    setIsShared(Boolean(acc.isShared));
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMessage(null);
    const numBal = parseFloat(balanceInput.replace(',', '.')) || 0;
    const finalName = name.trim() || 'Conta';

    try {
      if (editingAcc) {
        await apiFetch(`/accounts/${encodeURIComponent(editingAcc.id)}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: finalName,
            currentBalance: numBal,
            colorHex,
            isShared,
          }),
        });
        setStatusMessage({ type: 'success', text: 'Conta atualizada com sucesso!' });
      } else {
        await apiFetch('/accounts', {
          method: 'POST',
          body: JSON.stringify({
            name: finalName,
            type,
            initialBalance: numBal,
            colorHex,
            isShared,
          }),
        });
        setStatusMessage({ type: 'success', text: 'Conta cadastrada com sucesso!' });
      }

      setShowModal(false);
      setEditingAcc(null);
      notifyDataChanged();
      loadAccounts();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (acc: FinancialAccount) => {
    setStatusMessage(null);
    try {
      await apiFetch(`/accounts/${encodeURIComponent(acc.id)}`, { method: 'DELETE' });
      setStatusMessage({ type: 'success', text: `Conta "${acc.name}" removida com sucesso!` });
      notifyDataChanged();
      loadAccounts();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const renderAccountLogo = (acc: FinancialAccount) => {
    const bank = getBankInfo(acc.name);
    if (bank.id !== 'other') {
      return <BankLogo bank={bank.id} size={42} />;
    }

    let Icon = Wallet;
    if (acc.type === 'INVESTMENT') Icon = TrendingUp;
    else if (acc.type === 'CASH') Icon = Coins;
    else if (acc.type === 'CHECKING') Icon = Building2;

    return (
      <div
        className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm"
        style={{ backgroundColor: acc.colorHex || '#7C3AED' }}
      >
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>
    );
  };

  const totalBalance = accounts.reduce(
    (sum, a) => sum + (parseFloat(String(a.currentBalance ?? 0)) || 0),
    0
  );

  return (
    <main className="min-h-[100dvh] bg-white max-w-6xl mx-auto p-4 sm:p-6 lg:p-10 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-[#EFEAF8]">
        <div>
          <h1 className="finn-page-title font-extrabold tracking-tight text-zinc-900 flex items-center gap-2.5">
            <Wallet className="w-6 h-6 text-violet-600" aria-hidden="true" />
            Contas e Carteira
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Mesmas contas e saldos bancários compartilhados do app FINN.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Nova Conta</span>
        </button>
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

      {/* Card de Patrimônio Total */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-700 text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-violet-200">
            Saldo Total em Contas
          </span>
          <p className="text-3xl font-black mt-1 tracking-tight">
            {formatCurrencyBRL(totalBalance)}
          </p>
          <p className="text-xs text-violet-200 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            Controle centralizado de todas as suas contas financeiras
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-sm border border-white/15">
          <span className="text-xs font-medium text-violet-100">Contas Ativas:</span>
          <span className="text-sm font-extrabold text-white">{accounts.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-zinc-500">
          Carregando contas cadastradas...
        </div>
      ) : accounts.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white border border-[#EFEAF8] shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto mb-3">
            <Wallet className="w-6 h-6" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-zinc-900">Nenhuma conta cadastrada ainda</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto mb-5">
            Cadastre sua conta corrente (Nubank, Itaú, Inter, etc.), investimentos ou carteira física para acompanhar seus saldos em tempo real.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-semibold"
          >
            Cadastrar Primeira Conta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="p-6 rounded-3xl bg-white border border-[#EFEAF8] shadow-sm flex flex-col justify-between relative overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 right-0 h-1.5"
                style={{ backgroundColor: acc.colorHex || '#7C3AED' }}
              />
              <div>
                <div className="flex items-center justify-between mb-3">
                  {renderAccountLogo(acc)}

                  <div className="flex items-center gap-1">
                    {acc.isShared && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full mr-1">
                        <Users className="w-3 h-3" aria-hidden="true" />
                        Grupo
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditModal(acc)}
                      aria-label={`Editar conta ${acc.name}`}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                    >
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(acc)}
                      aria-label={`Excluir conta ${acc.name}`}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <h3 className="font-bold text-base text-zinc-900">{acc.name}</h3>
                <span className="text-[11px] uppercase tracking-wider text-zinc-400">
                  {acc.type === 'CHECKING'
                    ? 'Conta Corrente'
                    : acc.type === 'SAVINGS'
                    ? 'Poupança'
                    : acc.type === 'INVESTMENT'
                    ? 'Investimentos'
                    : 'Dinheiro / Carteira'}
                </span>
              </div>

              <div className="mt-6 pt-4 border-t border-[#F3F0FA] flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-zinc-400">
                    Saldo Disponível
                  </span>
                  <p className="text-xl font-extrabold text-zinc-900">
                    {formatCurrencyBRL(parseFloat(String(acc.currentBalance ?? 0)) || 0)}
                  </p>
                </div>
                {acc.user?.fullName && (
                  <span className="text-[11px] text-zinc-400">
                    Titular: {acc.user.fullName.split(' ')[0]}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal / Diálogo de Criação e Edição de Conta */}
      <dialog
        ref={modalRef}
        aria-labelledby="acc-modal-title"
        closedby="any"
        onClose={() => setShowModal(false)}
        onClick={(e) => {
          if (e.target === modalRef.current) setShowModal(false);
        }}
        className="finn-dialog"
      >
        <form
          onSubmit={handleSave}
          className="bg-white border border-[#EFEAF8] rounded-3xl p-6 shadow-2xl flex flex-col gap-4 max-w-lg w-full max-h-[92vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-2 border-b border-[#F3F0FA]">
            <h2 id="acc-modal-title" className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-violet-600" />
              {editingAcc ? 'Editar Conta / Carteira' : 'Nova Conta Financeira'}
            </h2>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Seleção do Banco Oficial em Lista igual ao App */}
          <BankListSelector
            selectedBankId={selectedBankId}
            customName={name}
            onSelectBank={(bank, displayName) => {
              setSelectedBankId(bank.id);
              setName(displayName || bank.name);
              setColorHex(bank.gradient[0]);
            }}
            onChangeCustomName={(newName) => {
              setName(newName);
              const info = getBankInfo(newName);
              if (info.id !== 'other') {
                setSelectedBankId(info.id);
                setColorHex(info.gradient[0]);
              }
            }}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Tipo de Conta
              </label>
              <select
                value={type}
                disabled={Boolean(editingAcc)}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#FAF8FF] border border-[#E2DAF5] rounded-xl text-xs text-zinc-800 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600"
              >
                <option value="CHECKING">Conta Corrente</option>
                <option value="SAVINGS">Poupança</option>
                <option value="INVESTMENT">Investimento</option>
                <option value="CASH">Dinheiro / Carteira</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                {editingAcc ? 'Saldo Atual (R$)' : 'Saldo Inicial (R$)'}
              </label>
              <input
                type="text"
                required
                value={balanceInput}
                onChange={(e) => setBalanceInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#FAF8FF] border border-[#E2DAF5] rounded-xl text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Cor</label>
              <input
                type="color"
                value={colorHex}
                onChange={(e) => setColorHex(e.target.value)}
                className="w-12 h-9 rounded-xl cursor-pointer border-0 bg-transparent"
              />
            </div>
            <label className="flex items-center gap-2 pt-4 text-xs font-semibold text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="w-4 h-4 accent-violet-600"
              />
              Visível em Grupo Compartilhado
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-[#F3F0FA]">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-700 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              {submitting ? 'Salvando...' : editingAcc ? 'Atualizar Conta' : 'Salvar Conta'}
            </button>
          </div>
        </form>
      </dialog>
    </main>
  );
}
