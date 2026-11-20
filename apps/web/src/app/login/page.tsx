'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn, Lock, Mail, AlertCircle, ArrowRight, Check } from 'lucide-react';
import {
  apiFetch,
  getAuthToken,
  getRememberedWebCredentials,
  saveAuthSession,
  setRememberedWebCredentials,
} from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepConnected, setKeepConnected] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const remembered = getRememberedWebCredentials();
    setKeepConnected(remembered.keepConnected);
    if (remembered.email) {
      setEmail(remembered.email);
    }

    if (getAuthToken()) {
      router.replace('/');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await apiFetch<{ accessToken?: string; token?: string; user?: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      setRememberedWebCredentials(cleanEmail, keepConnected);
      saveAuthSession(
        res?.accessToken || res?.token || null,
        res?.user ? { ...res.user, email: res.user.email || cleanEmail } : { id: 'usr', email: cleanEmail },
        keepConnected,
      );
      router.push('/');
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-white flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 bg-white border border-[#E9E5F5] rounded-[32px] overflow-hidden shadow-2xl shadow-violet-900/10">
        {/* Painel Esquerdo: Logo, Fonte Audiowide e Mascote do App */}
        <div className="bg-gradient-to-br from-[#3B0764] via-[#5B21B6] to-[#7C3AED] text-white p-8 sm:p-10 flex flex-col items-center justify-between text-center relative overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-purple-300/15 pointer-events-none"
          />
          <div
            aria-hidden="true"
            className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-purple-200/10 pointer-events-none"
          />

          <div className="relative flex items-center gap-3 self-start">
            <img
              src="/finn-logo.png"
              alt="Logo FINN"
              className="w-10 h-10 rounded-xl bg-white/95 p-1 object-contain aspect-square"
            />
            <span className="font-finn text-2xl tracking-widest text-white">FINN</span>
          </div>

          <div className="relative my-6 flex flex-col items-center">
            <img
              src="/finn-login-robot.png"
              alt="Mascote Robô FINN"
              className="w-44 h-44 sm:w-52 sm:h-52 object-contain aspect-square drop-shadow-2xl"
            />
            <h2 className="font-finn text-lg tracking-wide mt-4 text-white">
              Suas finanças em sincronia
            </h2>
            <p className="text-xs text-violet-100/90 mt-2 max-w-xs leading-relaxed">
              Acesse com a mesma conta do aplicativo FINN no celular. Tudo o que você lançar aqui aparece no app em tempo real.
            </p>
          </div>

          <div className="relative text-[11px] text-violet-200/80 font-medium">
            FINN AI • Pessoal &amp; Grupos Compartilhados
          </div>
        </div>

        {/* Painel Direito: Formulário de Login Branco + Roxo */}
        <div className="p-8 sm:p-10 flex flex-col justify-center bg-white">
          <div className="mb-7">
            <h1 className="finn-page-title font-extrabold text-zinc-900">
              Entrar na sua conta
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Use o mesmo e-mail e senha do aplicativo
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-violet-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#FAF8FF] border border-[#E2DAF5] rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-violet-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#FAF8FF] border border-[#E2DAF5] rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-600 transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                role="checkbox"
                aria-checked={keepConnected}
                onClick={() => setKeepConnected((prev) => !prev)}
                className="flex items-center gap-2.5 text-xs font-semibold text-zinc-700 select-none cursor-pointer group"
              >
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                    keepConnected
                      ? 'bg-violet-600 border-violet-600 text-white'
                      : 'bg-white border-zinc-300 group-hover:border-violet-500'
                  }`}
                >
                  {keepConnected && <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />}
                </span>
                <span>Manter-me conectado</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors shadow-md shadow-violet-600/20 flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" />
              <span>{loading ? 'Entrando...' : 'Entrar no FINN'}</span>
            </button>
          </form>

          <div className="mt-7 pt-5 border-t border-[#EFEAF8] text-center">
            <p className="text-xs text-zinc-500">
              Ainda não possui uma conta?{' '}
              <Link
                href="/register"
                className="font-semibold text-violet-700 hover:underline inline-flex items-center gap-0.5"
              >
                Criar conta grátis <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
