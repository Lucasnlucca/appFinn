'use client';

import React, { useState, useMemo } from 'react';
import BankLogo, { ALL_BANKS, BankInfo, getBankInfo } from './BankLogo';
import { Search, Check, Building2, ChevronDown, Sparkles } from 'lucide-react';

interface BankListSelectorProps {
  selectedBankId?: string;
  customName?: string;
  onSelectBank: (bank: BankInfo, displayName: string) => void;
  onChangeCustomName?: (name: string) => void;
  className?: string;
}

export default function BankListSelector({
  selectedBankId,
  customName = '',
  onSelectBank,
  onChangeCustomName,
  className = '',
}: BankListSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const selectedBank = useMemo(() => {
    if (!selectedBankId && !customName) return ALL_BANKS[0];
    return getBankInfo(selectedBankId || customName);
  }, [selectedBankId, customName]);

  const filteredBanks = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return ALL_BANKS;
    return ALL_BANKS.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.shortName.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
    );
  }, [searchTerm]);

  const handleSelect = (bank: BankInfo) => {
    onSelectBank(bank, customName || bank.name);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-zinc-700">
          Instituição Bancária
        </label>
        <span className="text-[11px] text-violet-600 font-medium flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          18 bancos oficiais do App
        </span>
      </div>

      {/* Botão Gatilho / Banco Selecionado */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2.5 bg-[#FAF8FF] hover:bg-[#F4EFFF] border border-[#E2DAF5] rounded-2xl transition-all shadow-sm text-left group"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 min-w-0">
          <BankLogo bank={selectedBank.id} size={38} />
          <div className="truncate">
            <div className="text-sm font-bold text-zinc-900 group-hover:text-violet-900 flex items-center gap-1.5 truncate">
              {selectedBank.name}
            </div>
            <div className="text-[11px] text-zinc-500 truncate">
              {selectedBank.category} • {selectedBank.cardLabel}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 pl-2 text-zinc-400 group-hover:text-violet-600">
          <span className="text-xs font-medium hidden sm:inline">Trocar</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-violet-600' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown / Lista Expansível com Filtro de Busca */}
      {isOpen && (
        <div className="p-3 bg-white border border-[#E2DAF5] rounded-2xl shadow-xl flex flex-col gap-2.5 animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Campo de Pesquisa */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar banco emissor (ex: Nu, Itaú, Inter, C6)..."
              className="w-full pl-9 pr-3 py-2 bg-[#FAF8FF] border border-[#E8E1F7] rounded-xl text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600"
            />
          </div>

          {/* Lista com scroll dos bancos */}
          <div
            role="listbox"
            aria-label="Lista de bancos suportados"
            className="max-h-60 overflow-y-auto space-y-1.5 pr-1 divide-y divide-[#F6F2FC] focus:outline-none"
          >
            {filteredBanks.map((bank) => {
              const isSelected = selectedBank.id === bank.id;
              return (
                <button
                  key={bank.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(bank)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-violet-50/80 border border-violet-200/90 text-violet-950 font-bold'
                      : 'hover:bg-[#FAF8FF] border border-transparent text-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <BankLogo bank={bank.id} size={34} />
                    <div className="truncate">
                      <div className="text-xs font-bold leading-snug truncate">
                        {bank.name}
                      </div>
                      <div className="text-[10px] text-zinc-500 leading-snug">
                        {bank.category}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}

            {filteredBanks.length === 0 && (
              <div className="py-6 text-center text-xs text-zinc-500 flex flex-col items-center gap-1.5">
                <Building2 className="w-6 h-6 text-zinc-300" />
                <span>Nenhum banco encontrado com "{searchTerm}".</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Campo opcional de Nome Personalizado / Apelido do Cartão */}
      <div className="mt-1">
        <label className="block text-xs font-semibold text-zinc-700 mb-1">
          Apelido do Cartão no FINN
        </label>
        <input
          type="text"
          value={customName}
          onChange={(e) => onChangeCustomName && onChangeCustomName(e.target.value)}
          placeholder={`Ex: ${selectedBank.name} Principal, Black, etc.`}
          className="w-full px-3.5 py-2.5 bg-[#FAF8FF] border border-[#E2DAF5] rounded-xl text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600"
        />
      </div>
    </div>
  );
}
