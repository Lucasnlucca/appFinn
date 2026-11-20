'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  CreditCard as CardIcon,
  Plus,
  AlertCircle,
  CheckCircle2,
  Pencil,
  Trash2,
  Wifi,
  Sparkles,
  X,
} from 'lucide-react';
import { apiFetch, notifyDataChanged, useLiveSync } from '@/lib/api';
import { formatCurrencyBRL } from '@finn-ai/ui';
import BankLogo, { ALL_BANKS, getBankInfo, BankInfo } from '@/components/BankLogo';
import BankListSelector from '@/components/BankListSelector';

interface CreditCardItem {
  id: string;
  name: string;
  creditLimit: string | number;
  availableLimit: string | number;
  closingDay: number;
  dueDay: number;
  colorHex?: string;
  lastFourDigits?: string;
  currentBill?: {
    id: string;
    totalAmount: string | number;
    status: string;
  } | null;
}

export default function CardsPage() {
  const modalRef = useRef<HTMLDialogElement>(null);

  const [cards, setCards] = useState<CreditCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCardItem | null>(null);
  const [selectedBankId, setSelectedBankId] = useState('nubank');
  const [name, setName] = useState('');
  const [creditLimit, setCreditLimit] = useState('5000');
  const [closingDay, setClosingDay] = useState(20);
  const [dueDay, setDueDay] = useState(28);
  const [colorHex, setColorHex] = useState('#8A05BE');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const dlg = modalRef.current;
    if (!dlg) return;
    if (showModal && !dlg.open) dlg.showModal();
    else if (!showModal && dlg.open) dlg.close();
  }, [showModal]);

  const loadCards = useCallback(async () => {
    try {
      const data = await apiFetch<CreditCardItem[]>('/credit-cards?scope=HOUSEHOLD');
      setCards(data || []);
    } catch (err: any) {
      console.warn('Erro ao carregar cartões:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  useLiveSync(loadCards);

  const openCreateModal = () => {
    setEditingCard(null);
    setSelectedBankId('nubank');
    setName('Nubank');
    setCreditLimit('5000');
    setClosingDay(20);
    setDueDay(28);
    setColorHex('#8A05BE');
    setShowModal(true);
  };

  const openEditModal = (card: CreditCardItem) => {
    setEditingCard(card);
    const bank = getBankInfo(card.name);
    setSelectedBankId(bank.id);
    setName(card.name || '');
    setCreditLimit(String(parseFloat(String(card.creditLimit ?? 5000)) || 0));
    setClosingDay(Number(card.closingDay) || 20);
    setDueDay(Number(card.dueDay) || 28);
    setColorHex(card.colorHex || bank.gradient[0]);
    setShowModal(true);
  };

  const activeTheme = useMemo(() => {
    return getBankInfo(selectedBankId || name);
  }, [selectedBankId, name]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMessage(null);
    const numLimit = parseFloat(String(creditLimit).replace(',', '.')) || 0;
    const finalName = name.trim() || activeTheme.name;

    try {
      if (editingCard) {
        await apiFetch(`/credit-cards/${encodeURIComponent(editingCard.id)}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: finalName,
            creditLimit: numLimit,
            closingDay: Number(closingDay),
            dueDay: Number(dueDay),
            colorHex,
          }),
        });
        setStatusMessage({ type: 'success', text: 'Cartão atualizado com sucesso!' });
      } else {
        await apiFetch('/credit-cards', {
          method: 'POST',
          body: JSON.stringify({
            name: finalName,
            creditLimit: numLimit,
            closingDay: Number(closingDay),
            dueDay: Number(dueDay),
            colorHex,
          }),
        });
        setStatusMessage({ type: 'success', text: 'Cartão cadastrado com sucesso!' });
      }

      setShowModal(false);
      setEditingCard(null);
      notifyDataChanged();
      loadCards();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (card: CreditCardItem) => {
    setStatusMessage(null);
    try {
      await apiFetch(`/credit-cards/${encodeURIComponent(card.id)}`, { method: 'DELETE' });
      setStatusMessage({ type: 'success', text: `Cartão "${card.name}" removido!` });
      notifyDataChanged();
      loadCards();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <main className="min-h-[100dvh] bg-white max-w-6xl mx-auto p-4 sm:p-6 lg:p-10 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-[#EFEAF8]">
        <div>
          <h1 className="finn-page-title font-extrabold tracking-tight text-zinc-900 flex items-center gap-2.5">
            <CardIcon className="w-6 h-6 text-violet-600" aria-hidden="true" />
            Meus Cartões
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Controle de limites, faturas e temas oficiais dos seus cartões de crédito.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Novo Cartão</span>
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

      {loading ? (
        <div className="p-10 text-center text-sm text-zinc-500">
          Carregando cartões de crédito...
        </div>
      ) : cards.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white border border-[#EFEAF8] shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto mb-3">
            <CardIcon className="w-6 h-6" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-zinc-900">Nenhum cartão cadastrado ainda</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto mb-5">
            Cadastre seus cartões (Nubank, Itaú, Inter, C6, Santander, Bradesco, BB, etc.) para controlar faturas e limites.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-semibold"
          >
            Adicionar Cartão
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card) => {
            const theme = getBankInfo(card.name);
            const limitNum = parseFloat(String(card.creditLimit ?? 0)) || 0;
            const invoiceNum = parseFloat(String(card.currentBill?.totalAmount ?? 0)) || 0;
            const availNum = Math.max(0, limitNum - invoiceNum);
            const usedPct = limitNum > 0 ? Math.min(100, Math.round((invoiceNum / limitNum) * 100)) : 0;
            const gradientColors = card.colorHex
              ? [card.colorHex, theme.gradient[1], theme.gradient[2]]
              : theme.gradient;

            return (
              <div
                key={card.id}
                className="bg-white border border-[#EFEAF8] rounded-3xl overflow-hidden shadow-sm flex flex-col"
              >
                {/* Cartão Físico Estilizado igual ao App com BankLogo Oficial */}
                <div
                  className="relative p-5 text-white flex flex-col justify-between min-h-[185px] overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${gradientColors[0]} 0%, ${gradientColors[1]} 55%, ${gradientColors[2]} 100%)`,
                  }}
                >
                  <div
                    aria-hidden="true"
                    className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-white/10 pointer-events-none"
                  />
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <BankLogo bank={theme.id} size={32} />
                      <span className="font-bold text-base tracking-tight truncate">{card.name}</span>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/15 shrink-0">
                      {theme.cardLabel}
                    </span>
                  </div>

                  {/* Chip EMV + Contactless */}
                  <div className="relative flex items-center justify-between my-3">
                    <div className="w-10 h-7 rounded-md bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 border border-amber-100/60 shadow-inner" />
                    <Wifi className="w-5 h-5 rotate-90 text-white/80" aria-hidden="true" />
                  </div>

                  <div className="relative flex items-end justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/70">Fatura Atual</p>
                      <p className="text-lg font-extrabold">{formatCurrencyBRL(invoiceNum)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs tracking-widest text-white/80">
                        •••• {card.lastFourDigits || '••••'}
                      </p>
                      <p className="text-[11px] font-bold text-white/90 mt-0.5">{theme.brand}</p>
                    </div>
                  </div>
                </div>

                {/* Detalhes, Barra de Limite e Botões Editar / Excluir */}
                <div className="p-5 flex flex-col gap-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-zinc-500 font-medium">Limite utilizado ({usedPct}%)</span>
                      <span className="font-bold text-zinc-900">{formatCurrencyBRL(limitNum)}</span>
                    </div>
                    <div className="h-2 w-full bg-violet-50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-600 rounded-full"
                        style={{ width: `${usedPct}%` }}
                      />
                    </div>
                    <p className="text-xs text-emerald-600 font-semibold mt-1.5">
                      Disponível: {formatCurrencyBRL(availNum)}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#F3F0FA] flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      Fecha dia {card.closingDay} • Vence dia {card.dueDay}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(card)}
                        aria-label={`Editar cartão ${card.name}`}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                      >
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(card)}
                        aria-label={`Excluir cartão ${card.name}`}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal / Diálogo de Criação / Edição de Cartão com Seleção de Banco Fiel ao App */}
      <dialog
        ref={modalRef}
        aria-labelledby="card-modal-title"
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
            <h2 id="card-modal-title" className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <CardIcon className="w-5 h-5 text-violet-600" />
              {editingCard ? 'Editar Cartão de Crédito' : 'Novo Cartão de Crédito'}
            </h2>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Seleção de Banco idêntica ao APP em Lista com Logos e Filtro */}
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

          {/* Prévia Instantânea do Cartão */}
          <div
            className="p-4 rounded-2xl text-white flex flex-col justify-between shadow-sm relative overflow-hidden transition-all duration-300"
            style={{
              background: `linear-gradient(135deg, ${activeTheme.gradient[0]} 0%, ${activeTheme.gradient[1]} 55%, ${activeTheme.gradient[2]} 100%)`,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BankLogo bank={activeTheme.id} size={28} />
                <span className="font-bold text-sm tracking-tight">{name || activeTheme.name}</span>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/20">
                {activeTheme.cardLabel}
              </span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-[10px] uppercase text-white/70 block">Limite Total</span>
                <span className="text-sm font-extrabold">{formatCurrencyBRL(parseFloat(creditLimit) || 0)}</span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-white/90">{activeTheme.brand}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Limite Total (R$)
            </label>
            <input
              type="text"
              required
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#FAF8FF] border border-[#E2DAF5] rounded-xl text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Dia Fechamento</label>
              <input
                type="number"
                min={1}
                max={31}
                required
                value={closingDay}
                onChange={(e) => setClosingDay(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-[#FAF8FF] border border-[#E2DAF5] rounded-xl text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Dia Vencimento</label>
              <input
                type="number"
                min={1}
                max={31}
                required
                value={dueDay}
                onChange={(e) => setDueDay(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-[#FAF8FF] border border-[#E2DAF5] rounded-xl text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5 flex items-center justify-between">
              <span>Paleta de Cores dos Bancos</span>
              <span className="text-[10px] text-zinc-400">Personalize o tom</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_BANKS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setSelectedBankId(b.id);
                    if (!name.trim()) setName(b.name);
                    setColorHex(b.gradient[0]);
                  }}
                  title={b.name}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    colorHex === b.gradient[0] || selectedBankId === b.id
                      ? 'border-zinc-900 scale-110 shadow-md ring-2 ring-violet-500/30'
                      : 'border-white hover:scale-105'
                  }`}
                  style={{ backgroundColor: b.gradient[0] }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-[#F3F0FA]">
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
              {submitting ? 'Salvando...' : editingCard ? 'Atualizar Cartão' : 'Salvar Cartão'}
            </button>
          </div>
        </form>
      </dialog>
    </main>
  );
}
