'use client';

import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Building2,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { formatCurrencyBRL, formatDateBR } from '@finn-ai/ui';

interface FinancialAccount {
  id: string;
  name: string;
}

interface CategoryItem {
  id: string;
  name: string;
}

interface PreviewRow {
  externalId?: string;
  date: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  isDuplicate: boolean;
  suggestedCategoryId?: string;
  suggestedCategoryName?: string;
  selectedCategoryId?: string;
  isApproved: boolean;
}

export default function ImportsPage() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Estados de prévia
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [accs, cats] = await Promise.all([
          apiFetch<FinancialAccount[]>('/accounts?scope=HOUSEHOLD'),
          apiFetch<CategoryItem[]>('/categories'),
        ]);
        setAccounts(accs || []);
        setCategories(cats || []);
        if (accs && accs.length > 0) {
          setSelectedAccountId(accs[0].id);
        }
      } finally {
        setLoadingAccounts(false);
      }
    }
    loadInitialData();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleProcessPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedAccountId) return;

    setPreviewing(true);
    setStatusMessage(null);

    try {
      const fileText = await selectedFile.text();
      const ext = selectedFile.name.toLowerCase().endsWith('.ofx') ? 'OFX' : 'CSV';

      const res = await apiFetch<{ rows: any[]; fileName: string }>('/imports/preview', {
        method: 'POST',
        body: JSON.stringify({
          accountId: selectedAccountId,
          fileContent: fileText,
          fileFormat: ext,
          fileName: selectedFile.name,
        }),
      });

      setFileName(res.fileName);
      setPreviewRows(
        res.rows.map((r: any) => ({
          ...r,
          selectedCategoryId: r.suggestedCategoryId || '',
          isApproved: !r.isDuplicate, // Duplicatas vêm desmarcadas por padrão
        })),
      );
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setPreviewing(false);
    }
  };

  const handleConfirmImport = async () => {
    const approvedRows = previewRows
      .filter((r) => r.isApproved)
      .map((r) => ({
        date: r.date,
        description: r.description,
        amount: r.amount,
        type: r.type,
        categoryId: r.selectedCategoryId || undefined,
        externalId: r.externalId,
      }));

    if (approvedRows.length === 0) {
      setStatusMessage({ type: 'error', text: 'Nenhuma transação selecionada para importação' });
      return;
    }

    setConfirming(true);
    setStatusMessage(null);

    try {
      const res = await apiFetch<{ importedCount: number; netBalanceChange: number }>('/imports/confirm', {
        method: 'POST',
        body: JSON.stringify({
          accountId: selectedAccountId,
          fileName,
          rows: approvedRows,
        }),
      });

      setStatusMessage({
        type: 'success',
        text: `Sucesso! ${res.importedCount} movimentações foram gravadas com sucesso no seu extrato.`,
      });
      setPreviewRows([]);
      setSelectedFile(null);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setConfirming(false);
    }
  };

  const toggleRowApproval = (index: number) => {
    const updated = [...previewRows];
    updated[index].isApproved = !updated[index].isApproved;
    setPreviewRows(updated);
  };

  const updateRowCategory = (index: number, categoryId: string) => {
    const updated = [...previewRows];
    updated[index].selectedCategoryId = categoryId;
    setPreviewRows(updated);
  };

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-10 flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Importação Manual Inteligente
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Deduplicação Ativa
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Importe extratos OFX e CSV de qualquer banco com pré-visualização, categorização e sem duplicação.
          </p>
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

      {/* Etapa 1: Formulário de Upload e Seleção de Conta */}
      {previewRows.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-xl mx-auto w-full shadow-sm">
          <form onSubmit={handleProcessPreview} className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                1. Selecione a Conta Bancária de Destino
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                2. Selecione o Arquivo de Extrato (OFX ou CSV)
              </label>
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center hover:border-brand-500 transition-colors flex flex-col items-center justify-center">
                <UploadCloud className="w-10 h-10 text-brand-500 mb-2" />
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {selectedFile ? selectedFile.name : 'Clique para selecionar seu arquivo OFX ou CSV'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Compatível com Itaú, Nubank, Bradesco, Inter, Santander, BB, C6, etc.
                </p>
                <input
                  type="file"
                  accept=".ofx,.csv"
                  required
                  onChange={handleFileChange}
                  className="mt-3 text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={previewing || !selectedFile}
              className="w-full mt-2 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-brand-500/20 flex items-center justify-center gap-2"
            >
              <FileCode className="w-4 h-4" />
              <span>{previewing ? 'Analisando Extrato...' : 'Processar & Ver Prévia'}</span>
            </button>
          </form>
        </div>
      ) : (
        /* Etapa 2: Tabela de Prévia e Confirmação */
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-100 dark:bg-slate-850">
            <div>
              <span className="text-xs text-slate-400">Arquivo Carregado:</span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{fileName}</h3>
              <p className="text-xs text-slate-500">
                {previewRows.filter((r) => r.isApproved).length} de {previewRows.length} selecionadas para gravar.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setPreviewRows([])}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Cancelar & Voltar
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={confirming}
                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{confirming ? 'Gravando...' : 'Confirmar Importação'}</span>
              </button>
            </div>
          </div>

          {/* Tabela de Linhas */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="p-3.5 pl-5">Importar?</th>
                    <th className="p-3.5">Data</th>
                    <th className="p-3.5">Descrição</th>
                    <th className="p-3.5">Categoria</th>
                    <th className="p-3.5 text-right pr-5">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {previewRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors ${
                        row.isDuplicate ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''
                      }`}
                    >
                      <td className="p-3.5 pl-5">
                        <input
                          type="checkbox"
                          checked={row.isApproved}
                          onChange={() => toggleRowApproval(idx)}
                          className="w-4 h-4 text-brand-600 rounded border-slate-300 cursor-pointer"
                        />
                      </td>
                      <td className="p-3.5 text-slate-500 whitespace-nowrap">
                        {formatDateBR(row.date)}
                      </td>
                      <td className="p-3.5 font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span>{row.description}</span>
                          {row.isDuplicate && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 text-[10px] font-bold border border-rose-300 dark:border-rose-900 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Já Importada
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <select
                          value={row.selectedCategoryId}
                          onChange={(e) => updateRowCategory(idx, e.target.value)}
                          className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        >
                          <option value="">Sem categoria</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td
                        className={`p-3.5 text-right pr-5 font-bold whitespace-nowrap ${
                          row.type === 'INCOME'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {row.type === 'INCOME' ? '+' : '-'}
                        {formatCurrencyBRL(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

