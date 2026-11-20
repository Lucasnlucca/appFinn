import type { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'FINN — Gerente Financeiro Inteligente',
  description: 'Gestão financeira pessoal e em grupo sincronizada com o aplicativo FINN.',
  icons: {
    icon: [
      { url: '/favicon-64.png?v=4', sizes: '64x64', type: 'image/png' },
      { url: '/finn-ai-avatar.png?v=4', sizes: '1024x1024', type: 'image/png' },
    ],
    shortcut: '/favicon-64.png?v=4',
    apple: '/favicon-64.png?v=4',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased selection:bg-violet-600 selection:text-white bg-white text-zinc-900">
        <Navbar>{children}</Navbar>
      </body>
    </html>
  );
}
