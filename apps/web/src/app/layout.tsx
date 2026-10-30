import type { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'FINN AI — Gerente Financeiro Familiar com IA',
  description: 'Gestão orçamentária inteligente para o casal, Open Finance via Meu Pluggy e inteligência artificial Google Gemini.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased selection:bg-brand-500 selection:text-white bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
