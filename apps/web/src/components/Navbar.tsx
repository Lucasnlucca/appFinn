'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
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
  User,
  LogOut,
  RefreshCw,
  Menu,
  X,
  Bug,
  Headset,
  Image as ImageIcon,
  Send,
  CheckCircle2,
} from 'lucide-react';
import {
  AuthUser,
  apiFetch,
  checkWebInactivityAndExpire,
  clearAuthSession,
  getAuthUser,
  notifyDataChanged,
  recordWebUserActivity,
  refreshCurrentUserProfile,
} from '@/lib/api';

export function Navbar({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modal de Reportar Bug (Prints + Texto) na Web
  const [bugModalOpen, setBugModalOpen] = useState(false);
  const [bugDescription, setBugDescription] = useState('');
  const [bugPrints, setBugPrints] = useState<Array<{ id: string; name: string; dataUrl: string }>>([]);
  const [submittingBug, setSubmittingBug] = useState(false);
  const [bugProtocolNotice, setBugProtocolNotice] = useState<string | null>(null);
  const bugDialogRef = useRef<HTMLDialogElement>(null);
  const bugPrintInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dlg = bugDialogRef.current;
    if (!dlg) return;
    if (bugModalOpen && !dlg.open) dlg.showModal();
    else if (!bugModalOpen && dlg.open) dlg.close();
  }, [bugModalOpen]);

  const handleSelectBugPrints = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    files.slice(0, 5 - bugPrints.length).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        if (!dataUrl) return;
        setBugPrints((prev) =>
          [
            ...prev,
            {
              id: `bprt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: file.name,
              dataUrl,
            },
          ].slice(0, 5),
        );
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmitWebBugReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugDescription.trim() && bugPrints.length === 0) return;

    setSubmittingBug(true);
    const protocol = `BUG-${Math.floor(100000 + Math.random() * 900000)}`;
    try {
      await apiFetch('/notifications', {
        method: 'POST',
        body: JSON.stringify({
          id: `web-bug-${Date.now()}`,
          title: `🐞 Bug Reportado Web (${protocol})`,
          body: bugDescription.trim() || `Relato enviado com ${bugPrints.length} print(s).`,
          type: 'BUG_REPORT',
          category: 'sistema',
          priority: 'high',
          dedupeKey: `bug_report_${protocol}`,
          read: true,
          sendPush: false,
          meta: {
            kind: 'bug_report',
            protocol,
            userEmail: user?.email || '',
            userName: user?.fullName || user?.name || 'Usuário Web',
            screenshotsCount: bugPrints.length,
            screenshots: bugPrints.map((p) => ({
              name: p.name,
              dataUrl: p.dataUrl.slice(0, 120000),
            })),
          },
        }),
      }).catch(() => {});

      try {
        const raw = window.localStorage.getItem('finn_web_support_tickets_v1');
        const list = raw ? JSON.parse(raw) : [];
        const next = [
          {
            protocol,
            kind: 'bug',
            subject: 'Relato de Bug na Plataforma',
            category: 'bug',
            message: bugDescription.trim(),
            email: user?.email || '',
            printsCount: bugPrints.length,
            status: 'Recebido',
            createdAt: new Date().toISOString(),
          },
          ...(Array.isArray(list) ? list : []),
        ].slice(0, 25);
        window.localStorage.setItem('finn_web_support_tickets_v1', JSON.stringify(next));
      } catch {}

      setBugProtocolNotice(protocol);
      setBugDescription('');
      setBugPrints([]);
    } finally {
      setSubmittingBug(false);
    }
  };

  useEffect(() => {
    const syncAuth = () => setUser(getAuthUser());
    syncAuth();
    refreshCurrentUserProfile().then((me) => {
      if (me) setUser(me);
    });

    const onDataChanged = () => {
      refreshCurrentUserProfile().then((me) => {
        if (me) setUser(me);
      });
    };

    window.addEventListener('finn-auth-changed', syncAuth);
    window.addEventListener('finn-profile-updated', syncAuth);
    window.addEventListener('finn-data-changed', onDataChanged);
    window.addEventListener('storage', syncAuth);
    return () => {
      window.removeEventListener('finn-auth-changed', syncAuth);
      window.removeEventListener('finn-profile-updated', syncAuth);
      window.removeEventListener('finn-data-changed', onDataChanged);
      window.removeEventListener('storage', syncAuth);
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Monitora inatividade na Web (desconecta após 1 hora inativo preservando "Manter-me conectado" e e-mail)
  useEffect(() => {
    let lastWrite = 0;
    const handleUserActivity = () => {
      if (checkWebInactivityAndExpire()) {
        setUser(null);
        if (pathname !== '/login' && pathname !== '/register') {
          router.replace('/login');
        }
        return;
      }
      const now = Date.now();
      if (now - lastWrite > 10000) {
        lastWrite = now;
        recordWebUserActivity();
      }
    };

    const intervalId = window.setInterval(() => {
      if (checkWebInactivityAndExpire()) {
        setUser(null);
        if (pathname !== '/login' && pathname !== '/register') {
          router.replace('/login');
        }
      }
    }, 30000);

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }));
    window.addEventListener('visibilitychange', handleUserActivity);

    return () => {
      window.clearInterval(intervalId);
      events.forEach((ev) => window.removeEventListener(ev, handleUserActivity));
      window.removeEventListener('visibilitychange', handleUserActivity);
    };
  }, [pathname, router]);

  const handleLogout = () => {
    clearAuthSession();
    setUser(null);
    router.push('/login');
  };

  const handleManualSync = () => {
    setSyncing(true);
    notifyDataChanged();
    setTimeout(() => setSyncing(false), 600);
  };

  const links = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/assistant', label: 'FINN AI', icon: Bot },
    { href: '/household', label: 'Grupos', icon: Users },
    { href: '/transactions', label: 'Transações', icon: ArrowLeftRight },
    { href: '/accounts', label: 'Contas', icon: Wallet },
    { href: '/cards', label: 'Cartões', icon: CreditCard },
    { href: '/goals', label: 'Metas', icon: Target },
    { href: '/budgets', label: 'Orçamentos', icon: PiggyBank },
    { href: '/imports', label: 'Importar', icon: UploadCloud },
    { href: '/connections', label: 'Bancos', icon: Building2 },
    { href: '/profile', label: 'Meu Perfil', icon: User },
  ];

  const isAuthRoute = pathname === '/login' || pathname === '/register';
  const showSidebar = Boolean(user) && !isAuthRoute;
  const userAvatar = user?.avatarUrl || user?.avatarUri || '/finn-ai-avatar.png';

  if (!showSidebar) {
    return <div className="min-h-[100dvh] bg-white">{children}</div>;
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col lg:flex-row">
      {/* Barra superior compacta apenas no mobile (< lg) */}
      <header className="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E9E5F5] px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src="/finn-logo.png"
            alt="Logo FINN"
            className="w-9 h-9 rounded-xl object-contain aspect-square"
          />
          <span className="font-finn text-lg tracking-wide text-violet-700">FINN</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link href="/profile" title="Meu Perfil">
            <img
              src={userAvatar}
              alt="Foto de perfil"
              className="w-8 h-8 rounded-full object-cover aspect-square border border-violet-200"
            />
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-expanded={mobileMenuOpen}
            aria-controls="finn-mobile-nav"
            aria-label="Abrir menu lateral"
            className="p-2 rounded-xl bg-violet-50 text-violet-700 hover:bg-violet-100"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <nav
          id="finn-mobile-nav"
          aria-label="Navegação mobile"
          className="lg:hidden border-b border-[#E9E5F5] bg-white px-4 py-3 z-40"
        >
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`finn-nav-link flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-violet-50 text-violet-800'
                        : 'text-zinc-600 hover:bg-violet-50/60'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0 text-violet-600" aria-hidden="true" />
                    <span>{link.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 pt-3 border-t border-[#E9E5F5] flex items-center justify-between">
            <Link href="/profile" className="flex items-center gap-2 min-w-0">
              <img
                src={userAvatar}
                alt="Foto de perfil"
                className="w-7 h-7 rounded-full object-cover aspect-square border border-violet-200"
              />
              <span className="text-xs font-semibold text-zinc-700 truncate">
                {user?.fullName || user?.name || user?.email}
              </span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              Sair
            </button>
          </div>
        </nav>
      )}

      {/* Sidebar Lateral Desktop: recolhida (76px) e abre suavemente ao passar o mouse (256px) */}
      <aside
        onMouseEnter={() => setSidebarOpen(true)}
        onMouseLeave={() => setSidebarOpen(false)}
        onFocus={() => setSidebarOpen(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setSidebarOpen(false);
          }
        }}
        className={`hidden lg:flex flex-col justify-between fixed inset-y-0 left-0 z-50 bg-white border-r border-[#E9E5F5] finn-sidebar-transition finn-no-scrollbar overflow-hidden select-none ${
          sidebarOpen ? 'w-64 shadow-2xl shadow-violet-900/10' : 'w-[76px]'
        }`}
      >
        <div className="finn-no-scrollbar overflow-y-auto overflow-x-hidden flex-1">
          <Link
            href="/"
            className="h-20 px-4 flex items-center gap-3 border-b border-[#F3F0FA] shrink-0 overflow-hidden"
          >
            <img
              src="/finn-logo.png"
              alt="Logo FINN"
              className="w-10 h-10 rounded-xl object-contain shrink-0 aspect-square"
            />
            <div
              className={`flex flex-col finn-sidebar-label whitespace-nowrap ${
                sidebarOpen
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 -translate-x-2 pointer-events-none'
              }`}
            >
              <span className="font-finn text-xl tracking-wider text-violet-700 leading-none">
                FINN
              </span>
              <span className="text-[11px] font-medium text-zinc-400 mt-1">
                Web &amp; App Sync
              </span>
            </div>
          </Link>

          <nav aria-label="Navegação principal" className="p-3 overflow-hidden">
            <ul className="flex flex-col gap-1">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={isActive ? 'page' : undefined}
                      title={!sidebarOpen ? link.label : undefined}
                      className={`finn-nav-link flex items-center gap-3.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap overflow-hidden ${
                        isActive
                          ? 'bg-violet-50 text-violet-800'
                          : 'text-zinc-600 hover:text-violet-800 hover:bg-violet-50/60'
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 shrink-0 transition-transform duration-200 ${
                          isActive ? 'text-violet-700' : 'text-zinc-500'
                        }`}
                        aria-hidden="true"
                      />
                      <span
                        className={`finn-sidebar-label ${
                          sidebarOpen
                            ? 'opacity-100 translate-x-0'
                            : 'opacity-0 -translate-x-2 pointer-events-none'
                        }`}
                      >
                        {link.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* Rodapé da Sidebar */}
        <div className="flex flex-col shrink-0 overflow-hidden">
          {/* Acima do risco: Botões iguais aos demais itens do menu */}
          <div className="px-3 pb-2 flex flex-col gap-1 overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setBugProtocolNotice(null);
                setBugModalOpen(true);
              }}
              title={!sidebarOpen ? 'Achou algum bug? Reporte aqui' : undefined}
              className="finn-nav-link w-full flex items-center gap-3.5 px-3 py-2 rounded-xl text-sm font-semibold text-zinc-600 hover:text-violet-800 hover:bg-violet-50/60 transition-colors whitespace-nowrap overflow-hidden text-left"
            >
              <Bug className="w-5 h-5 shrink-0 text-zinc-500" aria-hidden="true" />
              <span
                className={`finn-sidebar-label ${
                  sidebarOpen
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 -translate-x-2 pointer-events-none'
                }`}
              >
                Achou algum bug?
              </span>
            </button>

            <Link
              href="/support"
              aria-current={pathname === '/support' ? 'page' : undefined}
              title={!sidebarOpen ? 'Suporte' : undefined}
              className={`finn-nav-link flex items-center gap-3.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap overflow-hidden ${
                pathname === '/support'
                  ? 'bg-violet-50 text-violet-800'
                  : 'text-zinc-600 hover:text-violet-800 hover:bg-violet-50/60'
              }`}
            >
              <Headset
                className={`w-5 h-5 shrink-0 ${
                  pathname === '/support' ? 'text-violet-700' : 'text-zinc-500'
                }`}
                aria-hidden="true"
              />
              <span
                className={`finn-sidebar-label ${
                  sidebarOpen
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 -translate-x-2 pointer-events-none'
                }`}
              >
                Suporte
              </span>
            </Link>
          </div>

          {/* Abaixo do risco: Perfil + Sair */}
          <div className="p-3 border-t border-[#F3F0FA] flex flex-col gap-2 overflow-hidden">
            <Link
              href="/profile"
              title={!sidebarOpen ? 'Meu Perfil' : undefined}
              className="flex items-center gap-3 px-2.5 py-2 rounded-xl bg-[#FAF8FF] hover:bg-violet-50 border border-[#EFEAF8] transition-colors overflow-hidden"
            >
              <img
                src={userAvatar}
                alt="Foto de perfil"
                className="w-8 h-8 rounded-full object-cover shrink-0 aspect-square border border-violet-200"
              />
              <div
                className={`min-w-0 flex-1 finn-sidebar-label whitespace-nowrap ${
                  sidebarOpen
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 -translate-x-2 pointer-events-none'
                }`}
              >
                <p className="text-xs font-bold text-zinc-900 truncate">
                  {user?.fullName || user?.name || 'Minha Conta'}
                </p>
                <p className="text-[11px] text-violet-600 font-medium">Editar perfil</p>
              </div>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              title={!sidebarOpen ? 'Sair da conta' : undefined}
              className="flex items-center gap-3.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors whitespace-nowrap overflow-hidden"
            >
              <LogOut className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span
                className={`finn-sidebar-label ${
                  sidebarOpen
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 -translate-x-2 pointer-events-none'
                }`}
              >
                Sair
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Modal de Reportar Bug (Prints + Texto) */}
      <dialog
        ref={bugDialogRef}
        aria-labelledby="web-bug-modal-title"
        closedby="any"
        onClose={() => setBugModalOpen(false)}
        onClick={(e) => {
          if (e.target === bugDialogRef.current) setBugModalOpen(false);
        }}
        className="finn-dialog"
      >
        <form
          onSubmit={handleSubmitWebBugReport}
          className="bg-white border border-[#EFEAF8] rounded-3xl p-6 shadow-2xl flex flex-col gap-4 max-h-[88vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#F3F0FA]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                <Bug className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h3 id="web-bug-modal-title" className="text-base font-extrabold text-zinc-900">
                  Achou algum bug? Reporte aqui
                </h3>
                <p className="text-xs text-zinc-500">
                  Envie prints da tela e descreva o problema encontrado
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBugModalOpen(false)}
              className="text-zinc-400 hover:text-zinc-600 p-1"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {bugProtocolNotice ? (
            <div className="py-4 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-zinc-900">
                  Bug Reportado com Sucesso!
                </p>
                <p className="text-xs text-violet-700 font-mono font-bold mt-1">
                  Protocolo: #{bugProtocolNotice}
                </p>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                  Recebemos sua descrição e os prints anexados. Obrigado por ajudar a melhorar o FINN!
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBugProtocolNotice(null);
                  setBugModalOpen(false);
                }}
                className="mt-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold"
              >
                Concluir
              </button>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="bug-desc-input" className="block text-xs font-bold text-zinc-700 mb-1.5">
                  O que aconteceu?
                </label>
                <textarea
                  id="bug-desc-input"
                  rows={4}
                  value={bugDescription}
                  onChange={(e) => setBugDescription(e.target.value)}
                  placeholder="Descreva o bug encontrado, em qual tela você estava e o que aconteceu..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8FF] border border-[#E2DAF5] text-sm text-zinc-900 focus:outline-none focus:border-violet-600 resize-y"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-zinc-700">
                    Prints da tela ({bugPrints.length}/5)
                  </span>
                  {bugPrints.length < 5 && (
                    <button
                      type="button"
                      onClick={() => bugPrintInputRef.current?.click()}
                      className="text-xs font-bold text-violet-700 hover:text-violet-800 flex items-center gap-1"
                    >
                      <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                      + Adicionar print
                    </button>
                  )}
                </div>

                <input
                  ref={bugPrintInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleSelectBugPrints}
                  className="hidden"
                />

                {bugPrints.length > 0 ? (
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {bugPrints.map((prt) => (
                      <div
                        key={prt.id}
                        className="relative w-20 h-20 rounded-xl overflow-hidden border border-violet-200 bg-zinc-50"
                      >
                        <img src={prt.dataUrl} alt={prt.name} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() =>
                            setBugPrints((prev) => prev.filter((item) => item.id !== prt.id))
                          }
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center"
                        >
                          <X className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => bugPrintInputRef.current?.click()}
                    className="w-full py-4 px-3 rounded-2xl border-2 border-dashed border-violet-200 bg-[#FAF8FF] hover:bg-violet-50/60 transition-colors flex flex-col items-center justify-center gap-1 text-center"
                  >
                    <ImageIcon className="w-5 h-5 text-violet-600" aria-hidden="true" />
                    <span className="text-xs font-bold text-violet-800">
                      Clique para anexar prints da tela
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Até 5 imagens (PNG, JPG ou WEBP)
                    </span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F3F0FA]">
                <button
                  type="button"
                  onClick={() => setBugModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingBug || (!bugDescription.trim() && bugPrints.length === 0)}
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{submittingBug ? 'Enviando...' : 'Enviar Relato'}</span>
                </button>
              </div>
            </>
          )}
        </form>
      </dialog>

      <div className="flex-1 lg:pl-[76px] min-w-0 bg-white">{children}</div>
    </div>
  );
}
