'use client';

import React from 'react';

export interface BankInfo {
  id: string;
  name: string;
  shortName: string;
  color: string;
  textColor: string;
  category: string;
  gradient: [string, string, string];
  cardLabel: string;
  brand: string;
}

export const ALL_BANKS: BankInfo[] = [
  { id: 'nubank', name: 'Nubank', shortName: 'Nubank', color: '#820AD1', textColor: '#FFFFFF', category: 'Conta & Cartão', gradient: ['#8A05BE', '#5E0485', '#2C0241'], cardLabel: 'Ultravioleta', brand: 'Mastercard' },
  { id: 'c6', name: 'C6 Bank', shortName: 'C6', color: '#18181B', textColor: '#FFFFFF', category: 'Banco Digital', gradient: ['#2F3034', '#1A1A1E', '#0D0D10'], cardLabel: 'Carbon Black', brand: 'Mastercard' },
  { id: 'itau', name: 'Itaú', shortName: 'Itaú', color: '#EC7000', textColor: '#FFFFFF', category: 'Banco Tradicional', gradient: ['#002855', '#001D40', '#001229'], cardLabel: 'Platinum', brand: 'Visa' },
  { id: 'bradesco', name: 'Bradesco', shortName: 'Bradesco', color: '#CC092F', textColor: '#FFFFFF', category: 'Banco Tradicional', gradient: ['#E1173F', '#B30B2D', '#7A051D'], cardLabel: 'Prime', brand: 'Visa' },
  { id: 'bb', name: 'Banco do Brasil', shortName: 'BB', color: '#003882', textColor: '#F8D210', category: 'Banco Público', gradient: ['#003882', '#00275C', '#001738'], cardLabel: 'Ourocard', brand: 'Visa' },
  { id: 'santander', name: 'Santander', shortName: 'Santander', color: '#CC0000', textColor: '#FFFFFF', category: 'Banco Tradicional', gradient: ['#EC0000', '#B80000', '#6B0000'], cardLabel: 'SX Credit', brand: 'Mastercard' },
  { id: 'inter', name: 'Inter', shortName: 'Inter', color: '#FF7A00', textColor: '#FFFFFF', category: 'Super App Digital', gradient: ['#FF7A00', '#EA580C', '#9A3412'], cardLabel: 'Gold Credit', brand: 'Mastercard' },
  { id: 'caixa', name: 'Caixa Econômica', shortName: 'Caixa', color: '#005CA9', textColor: '#FFFFFF', category: 'Banco Público', gradient: ['#005CA9', '#004380', '#002E5C'], cardLabel: 'Azul', brand: 'Elo' },
  { id: 'btg', name: 'BTG Pactual', shortName: 'BTG', color: '#0D1C2E', textColor: '#FFFFFF', category: 'Investimentos', gradient: ['#1C2D4A', '#0D1C2E', '#060E17'], cardLabel: 'Black Card', brand: 'Mastercard' },
  { id: 'picpay', name: 'PicPay', shortName: 'PicPay', color: '#11C76F', textColor: '#FFFFFF', category: 'Carteira Digital', gradient: ['#11C76F', '#0D9E57', '#065730'], cardLabel: 'PicPay Card', brand: 'Mastercard' },
  { id: 'mercadopago', name: 'Mercado Pago', shortName: 'Mercado Pago', color: '#009EE3', textColor: '#FFFFFF', category: 'Carteira Digital', gradient: ['#009EE3', '#007AB0', '#004F73'], cardLabel: 'Credit card', brand: 'Visa' },
  { id: 'neon', name: 'Neon', shortName: 'Neon', color: '#00E5FF', textColor: '#0D1C2E', category: 'Banco Digital', gradient: ['#00E5FF', '#00B4D8', '#0077B6'], cardLabel: 'Credit card', brand: 'Visa' },
  { id: 'xp', name: 'XP Investimentos', shortName: 'XP', color: '#000000', textColor: '#FFFFFF', category: 'Investimentos', gradient: ['#222222', '#141414', '#080808'], cardLabel: 'Visa Infinite', brand: 'Visa' },
  { id: 'pagbank', name: 'PagBank', shortName: 'PagBank', color: '#00A859', textColor: '#FFFFFF', category: 'Banco Digital', gradient: ['#00A859', '#007A41', '#004726'], cardLabel: 'Credit card', brand: 'Visa' },
  { id: 'will', name: 'Will Bank', shortName: 'will', color: '#FFE600', textColor: '#18181B', category: 'Banco Digital', gradient: ['#FFE600', '#FACC15', '#CA8A04'], cardLabel: 'Credit card', brand: 'Mastercard' },
  { id: 'sicoob', name: 'Sicoob', shortName: 'Sicoob', color: '#003641', textColor: '#FFFFFF', category: 'Cooperativa', gradient: ['#003641', '#00252D', '#001419'], cardLabel: 'Card', brand: 'Mastercard' },
  { id: 'sicredi', name: 'Sicredi', shortName: 'Sicredi', color: '#00823B', textColor: '#FFFFFF', category: 'Cooperativa', gradient: ['#00823B', '#005F2B', '#003E1C'], cardLabel: 'Credit card', brand: 'Mastercard' },
  { id: 'safra', name: 'Safra', shortName: 'Safra', color: '#0C1E3C', textColor: '#D4AF37', category: 'Private Banking', gradient: ['#0C1E3C', '#071224', '#030812'], cardLabel: 'Mastercard Black', brand: 'Mastercard' },
];

export function getBankInfo(bankNameOrId?: string): BankInfo {
  if (!bankNameOrId) return ALL_BANKS[0];
  const s = String(bankNameOrId).toLowerCase().trim();

  if (s.includes('nubank') || s === 'nu' || s === 'roxinho' || s.includes('ultravioleta')) return ALL_BANKS.find((b) => b.id === 'nubank')!;
  if (s.includes('c6')) return ALL_BANKS.find((b) => b.id === 'c6')!;
  if (s.includes('ita') || s.includes('itau')) return ALL_BANKS.find((b) => b.id === 'itau')!;
  if (s.includes('bradesco')) return ALL_BANKS.find((b) => b.id === 'bradesco')!;
  if (s.includes('brasil') || s === 'bb' || s.includes('banco do brasil') || s.includes('ourocard')) return ALL_BANKS.find((b) => b.id === 'bb')!;
  if (s.includes('santander')) return ALL_BANKS.find((b) => b.id === 'santander')!;
  if (s.includes('inter')) return ALL_BANKS.find((b) => b.id === 'inter')!;
  if (s.includes('caixa') || s === 'cef') return ALL_BANKS.find((b) => b.id === 'caixa')!;
  if (s.includes('btg')) return ALL_BANKS.find((b) => b.id === 'btg')!;
  if (s.includes('picpay')) return ALL_BANKS.find((b) => b.id === 'picpay')!;
  if (s.includes('mercado') || s.includes('pago') || s === 'mp') return ALL_BANKS.find((b) => b.id === 'mercadopago')!;
  if (s.includes('neon')) return ALL_BANKS.find((b) => b.id === 'neon')!;
  if (s === 'xp' || s.includes('xp invest')) return ALL_BANKS.find((b) => b.id === 'xp')!;
  if (s.includes('pag') || s.includes('seguro')) return ALL_BANKS.find((b) => b.id === 'pagbank')!;
  if (s.includes('will')) return ALL_BANKS.find((b) => b.id === 'will')!;
  if (s.includes('sicoob')) return ALL_BANKS.find((b) => b.id === 'sicoob')!;
  if (s.includes('sicredi')) return ALL_BANKS.find((b) => b.id === 'sicredi')!;
  if (s.includes('safra')) return ALL_BANKS.find((b) => b.id === 'safra')!;

  return {
    id: 'other',
    name: bankNameOrId,
    shortName: bankNameOrId,
    color: '#7C3AED',
    textColor: '#FFFFFF',
    category: 'Outro Banco',
    gradient: ['#7C3AED', '#5B21B6', '#3B0764'],
    cardLabel: 'Credit card',
    brand: 'Mastercard',
  };
}

interface BankLogoProps {
  bank: string;
  size?: number;
  className?: string;
}

export default function BankLogo({ bank, size = 36, className = '' }: BankLogoProps) {
  const info = getBankInfo(bank);
  const borderRadius = Math.round(size * 0.28);

  const renderContent = () => {
    switch (info.id) {
      case 'nubank':
        return (
          <span
            className="font-black tracking-tighter text-white select-none leading-none"
            style={{ fontSize: `${Math.round(size * 0.46)}px` }}
          >
            nu
          </span>
        );

      case 'c6':
        return (
          <span
            className="font-black text-white select-none leading-none tracking-tight"
            style={{ fontSize: `${Math.round(size * 0.38)}px` }}
          >
            C6
          </span>
        );

      case 'itau':
        return (
          <div
            className="bg-[#002D62] flex items-center justify-center"
            style={{
              width: `${Math.round(size * 0.72)}px`,
              height: `${Math.round(size * 0.72)}px`,
              borderRadius: `${Math.round(size * 0.2)}px`,
            }}
          >
            <span
              className="font-black text-white leading-none tracking-tight"
              style={{ fontSize: `${Math.round(size * 0.26)}px` }}
            >
              ita<span className="text-[#FFD100]">ú</span>
            </span>
          </div>
        );

      case 'bradesco':
        return (
          <svg
            width={size * 0.62}
            height={size * 0.62}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M12 2C8 6 4 10 4 16C4 19 6 22 10 22V15C9 15 8 14 8 13C8 11 10 9 12 7C14 9 16 11 16 13C16 14 15 15 14 15V22C18 22 20 19 20 16C20 10 16 6 12 2Z"
              fill="#FFFFFF"
            />
            <rect x="11" y="9" width="2" height="13" fill="#FFFFFF" rx="1" />
          </svg>
        );

      case 'bb':
        return (
          <span
            className="font-black text-[#F8D210] select-none leading-none tracking-wider"
            style={{ fontSize: `${Math.round(size * 0.38)}px` }}
          >
            BB
          </span>
        );

      case 'santander':
        return (
          <svg
            width={size * 0.6}
            height={size * 0.6}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M12 2C11 5 8 8 8 12C8 16 10 19 12 21C14 19 16 16 16 12C16 8 13 5 12 2Z"
              fill="#FFFFFF"
            />
            <path
              d="M6 7C5 9 4 12 4 14C4 18 7 20 8 21C7 19 6 17 6 15C6 12 8 10 8 8C7 8 6 7 6 7Z"
              fill="#FFFFFF"
            />
            <path
              d="M18 7C19 9 20 12 20 14C20 18 17 20 16 21C17 19 18 17 18 15C18 12 16 10 16 8C17 8 18 7 18 7Z"
              fill="#FFFFFF"
            />
          </svg>
        );

      case 'inter':
        return (
          <span
            className="font-black text-white select-none leading-none tracking-tight lowercase"
            style={{ fontSize: `${Math.round(size * 0.28)}px` }}
          >
            inter
          </span>
        );

      case 'caixa':
        return (
          <span
            className="font-black text-[#F58220] select-none leading-none drop-shadow-sm"
            style={{ fontSize: `${Math.round(size * 0.44)}px` }}
          >
            X
          </span>
        );

      case 'btg':
        return (
          <span
            className="font-black text-white select-none leading-none tracking-wider"
            style={{ fontSize: `${Math.round(size * 0.32)}px` }}
          >
            BTG
          </span>
        );

      case 'picpay':
        return (
          <svg
            width={size * 0.58}
            height={size * 0.58}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 4H14C17.3 4 20 6.7 20 10C20 13.3 17.3 16 14 16H9V21H5V4ZM9 12H14C15.1 12 16 11.1 16 10C16 8.9 15.1 8 14 8H9V12Z"
              fill="#FFFFFF"
            />
            <circle cx="12.5" cy="10" r="1.5" fill="#11C76F" />
          </svg>
        );

      case 'mercadopago':
        return (
          <svg
            width={size * 0.62}
            height={size * 0.62}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M12 4C9 4 5 7 5 10C5 12 6 14 8 15L7 19L11 17L12 18L13 17L17 19L16 15C18 14 19 12 19 10C19 7 15 4 12 4Z"
              fill="#FFFFFF"
            />
            <path d="M9 10L12 13L15 10" stroke="#009EE3" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );

      case 'neon':
        return (
          <span
            className="font-black text-[#0D1C2E] select-none leading-none tracking-tight lowercase"
            style={{ fontSize: `${Math.round(size * 0.26)}px` }}
          >
            neon
          </span>
        );

      case 'xp':
        return (
          <div className="flex flex-col items-center justify-center">
            <span
              className="font-black text-white select-none leading-none tracking-wider"
              style={{ fontSize: `${Math.round(size * 0.36)}px` }}
            >
              XP
            </span>
            <div
              className="bg-[#F8D210] mt-0.5"
              style={{ width: `${Math.round(size * 0.36)}px`, height: '2px' }}
            />
          </div>
        );

      case 'pagbank':
        return (
          <span
            className="font-black text-white select-none leading-none"
            style={{ fontSize: `${Math.round(size * 0.3)}px` }}
          >
            Pag
          </span>
        );

      case 'will':
        return (
          <span
            className="font-black text-[#18181B] select-none leading-none tracking-tight lowercase"
            style={{ fontSize: `${Math.round(size * 0.32)}px` }}
          >
            will
          </span>
        );

      case 'sicoob':
        return (
          <svg
            width={size * 0.6}
            height={size * 0.6}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <polygon points="12,2 22,20 2,20" fill="#00AE9D" />
            <polygon points="12,8 18,18 6,18" fill="#78BE20" />
          </svg>
        );

      case 'sicredi':
        return (
          <svg
            width={size * 0.6}
            height={size * 0.6}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" fill="#00823B" stroke="#FFFFFF" strokeWidth="1.5" />
            <path d="M12 7V17M7 12H17" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="12" r="3" fill="#FFFFFF" />
          </svg>
        );

      case 'safra':
        return (
          <span
            className="font-black text-[#D4AF37] select-none leading-none tracking-widest"
            style={{ fontSize: `${Math.round(size * 0.22)}px` }}
          >
            SAFRA
          </span>
        );

      default:
        return (
          <svg
            width={size * 0.52}
            height={size * 0.52}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white"
            aria-hidden="true"
          >
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <line x1="2" x2="22" y1="10" y2="10" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 shadow-sm overflow-hidden ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${borderRadius}px`,
        backgroundColor: info.color,
      }}
      aria-label={info.name}
    >
      {renderContent()}
    </div>
  );
}
