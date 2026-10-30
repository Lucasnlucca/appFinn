'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  Users,
  LayoutDashboard,
  Wallet,
  CreditCard,
  ArrowLeftRight,
  UploadCloud,
  Building2,
  Bot,
  Target,
  PiggyBank,
  LogIn,
  UserPlus,
} from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/accounts', label: 'Contas', icon: Wallet },
    { href: '/cards', label: 'Cartões', icon: CreditCard },
    { href: '/transactions', label: 'Transações', icon: ArrowLeftRight },
    { href: '/goals', label: 'Metas', icon: Target },
    { href: '/budgets', label: 'Orçamentos', icon: PiggyBank },
    { href: '/assistant', label: 'FINN AI', icon: Bot },
    { href: '/imports', label: 'Importar', icon: UploadCloud },
    { href: '/connections', label: 'Bancos', icon: Building2 },
    { href: '/household', label: 'Família', icon: Users },
  ];

  return (
    <nav className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
            FINN <span className="text-brand-500">AI</span>
          </span>
        </Link>

        {/* Links de navegação principais */}
        <div className="hidden lg:flex items-center gap-1 sm:gap-2">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Acesso rápido */}
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Entrar</span>
          </Link>
          <Link
            href="/register"
            className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white transition-all shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Criar Conta</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
