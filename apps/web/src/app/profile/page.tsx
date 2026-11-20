'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  Trash2,
  User,
  Lock,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  apiFetch,
  clearAuthSession,
  getAuthToken,
  getAuthUser,
  notifyDataChanged,
  refreshCurrentUserProfile,
  saveAuthSession,
  useLiveSync,
} from '@/lib/api';

function resizeImageToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
      img.onload = () => {
        const size = 280;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas indisponível.'));
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!getAuthToken()) {
      router.replace('/login');
      return;
    }

    const applyUser = (u: any) => {
      if (!u) return;
      const full = u.fullName || u.name || '';
      const parts = full.trim().split(/\s+/).filter(Boolean);
      setEmail(u.email || '');
      setFirstName(u.firstName !== undefined ? u.firstName : parts[0] || '');
      setLastName(
        u.lastName !== undefined
          ? u.lastName
          : parts.length > 1
            ? parts.slice(1).join(' ')
            : '',
      );
      setAvatarUri(u.avatarUrl || u.avatarUri || null);
    };

    applyUser(getAuthUser());
    refreshCurrentUserProfile().then((me) => {
      if (me) applyUser(me);
    });
  }, [router]);

  const syncRemoteProfile = useCallback(async () => {
    if (savingProfile) return;
    const me = await refreshCurrentUserProfile();
    if (me) {
      setAvatarUri(me.avatarUrl || me.avatarUri || null);
    }
  }, [savingProfile]);

  useLiveSync(syncRemoteProfile);

  const persistProfile = async (nextFirst: string, nextLast: string, nextAvatar: string | null) => {
    const fullName = [nextFirst.trim(), nextLast.trim()].filter(Boolean).join(' ') || 'Usuário FINN';
    const updated = await apiFetch<any>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({
        firstName: nextFirst.trim(),
        lastName: nextLast.trim(),
        fullName,
        avatarUrl: nextAvatar,
        avatarUri: nextAvatar,
      }),
    });
    const existing = getAuthUser();
    saveAuthSession(getAuthToken(), {
      ...(existing || { id: updated?.id || '', email }),
      ...(updated || {}),
      firstName: nextFirst.trim(),
      lastName: nextLast.trim(),
      fullName,
      name: fullName,
      avatarUrl: nextAvatar,
      avatarUri: nextAvatar,
    });
    notifyDataChanged();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    setSavingProfile(true);
    try {
      const dataUrl = await resizeImageToAvatarDataUrl(file);
      setAvatarUri(dataUrl);
      await persistProfile(firstName, lastName, dataUrl);
      setFeedback({ type: 'success', text: 'Foto de perfil atualizada e sincronizada com o aplicativo!' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Falha ao atualizar foto.' });
    } finally {
      setSavingProfile(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    setFeedback(null);
    setSavingProfile(true);
    try {
      setAvatarUri(null);
      await persistProfile(firstName, lastName, null);
      setFeedback({ type: 'success', text: 'Foto de perfil removida.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Falha ao remover foto.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setFeedback({ type: 'error', text: 'Informe seu nome.' });
      return;
    }
    setSavingProfile(true);
    setFeedback(null);
    try {
      await persistProfile(firstName, lastName, avatarUri);
      setFeedback({ type: 'success', text: 'Dados do perfil salvos com sucesso!' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Falha ao salvar perfil.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setFeedback({ type: 'error', text: 'A nova senha deve ter no mínimo 6 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', text: 'As senhas não conferem.' });
      return;
    }
    setSavingPass(true);
    setFeedback(null);
    try {
      await apiFetch('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ newPassword }),
      });
      setNewPassword('');
      setConfirmPassword('');
      setFeedback({ type: 'success', text: 'Senha redefinida com sucesso!' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Falha ao alterar senha.' });
    } finally {
      setSavingPass(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirmText.trim().toUpperCase() !== 'EXCLUIR') {
      setFeedback({ type: 'error', text: 'Digite EXCLUIR para confirmar.' });
      return;
    }
    setDeleting(true);
    try {
      await apiFetch('/auth/account', { method: 'DELETE' });
      deleteDialogRef.current?.close();
      clearAuthSession();
      router.replace('/login');
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Erro ao excluir conta.' });
    } finally {
      setDeleting(false);
    }
  };

  const displayAvatar = avatarUri || '/finn-ai-avatar.png';

  return (
    <main className="min-h-[100dvh] bg-white max-w-4xl mx-auto p-4 sm:p-6 lg:p-10 flex flex-col gap-6">
      <header className="pb-5 border-b border-[#EFEAF8]">
        <h1 className="finn-page-title font-extrabold tracking-tight text-zinc-900 flex items-center gap-2.5">
          <User className="w-6 h-6 text-violet-600" aria-hidden="true" />
          Meu Perfil
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Edite sua foto, nome e senha. Tudo fica sincronizado entre o site e o aplicativo FINN.
        </p>
      </header>

      {feedback && (
        <div
          role="status"
          className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Foto de Perfil */}
      <section className="bg-white border border-[#EFEAF8] rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row items-center gap-6">
        <div className="relative">
          <img
            src={displayAvatar}
            alt="Foto de perfil do usuário"
            className="w-24 h-24 rounded-full object-cover aspect-square border-2 border-violet-300 shadow-md"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center shadow-md"
            aria-label="Escolher foto de perfil"
          >
            <Camera className="w-4 h-4" aria-hidden="true" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>

        <div className="flex-1 text-center sm:text-left">
          <h2 className="text-base font-bold text-zinc-900">
            {[firstName, lastName].filter(Boolean).join(' ') || 'Usuário FINN'}
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">{email}</p>
          <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-4">
            <button
              type="button"
              disabled={savingProfile}
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" aria-hidden="true" /> Alterar foto
            </button>
            {avatarUri && (
              <button
                type="button"
                disabled={savingProfile}
                onClick={handleRemovePhoto}
                className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Remover foto
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Dados Pessoais */}
      <section className="bg-white border border-[#EFEAF8] rounded-3xl p-6 shadow-sm">
        <h2 className="text-base font-bold text-zinc-900 mb-4">Dados Pessoais</h2>
        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="prof-first" className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Nome
            </label>
            <input
              id="prof-first"
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#FAF8FF] border border-[#E2DAF5] text-sm"
            />
          </div>
          <div>
            <label htmlFor="prof-last" className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Sobrenome
            </label>
            <input
              id="prof-last"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#FAF8FF] border border-[#E2DAF5] text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="prof-email" className="block text-xs font-semibold text-zinc-700 mb-1.5">
              E-mail da conta
            </label>
            <input
              id="prof-email"
              type="email"
              disabled
              value={email}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-100 border border-zinc-200 text-sm text-zinc-500"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold"
            >
              {savingProfile ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </section>

      {/* Redefinir Senha */}
      <section className="bg-white border border-[#EFEAF8] rounded-3xl p-6 shadow-sm">
        <h2 className="text-base font-bold text-zinc-900 mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4 text-violet-600" aria-hidden="true" />
          Alterar Senha
        </h2>
        <form onSubmit={handleSavePassword} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="new-pass" className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Nova senha
            </label>
            <div className="relative">
              <input
                id="new-pass"
                type={showPass ? 'text' : 'password'}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-4 py-2.5 rounded-xl bg-[#FAF8FF] border border-[#E2DAF5] text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                aria-label="Mostrar ou ocultar senha"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="conf-pass" className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Confirmar nova senha
            </label>
            <input
              id="conf-pass"
              type={showPass ? 'text' : 'password'}
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              className="w-full px-4 py-2.5 rounded-xl bg-[#FAF8FF] border border-[#E2DAF5] text-sm"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={savingPass}
              className="px-6 py-2.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 text-xs font-bold"
            >
              {savingPass ? 'Atualizando...' : 'Atualizar senha'}
            </button>
          </div>
        </form>
      </section>

      {/* Zona de Exclusão */}
      <section className="bg-rose-50/50 border border-rose-200 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-rose-800 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" aria-hidden="true" /> Excluir minha conta
          </h2>
          <p className="text-xs text-rose-700/80 mt-1">
            Remove permanentemente sua conta e todos os dados vinculados no FINN.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDeleteConfirmText('');
            deleteDialogRef.current?.showModal();
          }}
          className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shrink-0"
        >
          Excluir conta
        </button>
      </section>

      <dialog
        ref={deleteDialogRef}
        aria-labelledby="dialog-delete-acc"
        closedby="any"
        onClick={(e) => {
          if (e.target === deleteDialogRef.current) deleteDialogRef.current?.close();
        }}
        className="finn-dialog"
      >
        <form onSubmit={handleDeleteAccount} className="bg-white border border-rose-200 rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
          <h3 id="dialog-delete-acc" className="text-lg font-bold text-rose-700">
            Confirmar exclusão definitiva
          </h3>
          <p className="text-xs text-zinc-600">
            Para confirmar, digite <strong>EXCLUIR</strong> no campo abaixo. Esta ação não pode ser desfeita.
          </p>
          <input
            type="text"
            autoFocus
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Digite EXCLUIR"
            className="w-full px-4 py-2.5 rounded-xl border border-rose-200 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => deleteDialogRef.current?.close()}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={deleting}
              className="px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold"
            >
              {deleting ? 'Excluindo...' : 'Confirmar Exclusão'}
            </button>
          </div>
        </form>
      </dialog>
    </main>
  );
}
