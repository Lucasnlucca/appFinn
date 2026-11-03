import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle, G, Polygon } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

// Lista oficial com os 18 principais bancos e emissores do Brasil
export const ALL_BANKS = [
  { id: 'nubank', name: 'Nubank', shortName: 'Nubank', color: '#820AD1', textColor: '#FFFFFF' },
  { id: 'c6', name: 'C6 Bank', shortName: 'C6 Bank', color: '#18181B', textColor: '#FFFFFF' },
  { id: 'itau', name: 'Itaú', shortName: 'Itaú', color: '#EC7000', textColor: '#FFFFFF' },
  { id: 'bradesco', name: 'Bradesco', shortName: 'Bradesco', color: '#CC092F', textColor: '#FFFFFF' },
  { id: 'bb', name: 'Banco do Brasil', shortName: 'Banco do Brasil', color: '#003882', textColor: '#F8D210' },
  { id: 'santander', name: 'Santander', shortName: 'Santander', color: '#CC0000', textColor: '#FFFFFF' },
  { id: 'inter', name: 'Inter', shortName: 'Inter', color: '#FF7A00', textColor: '#FFFFFF' },
  { id: 'caixa', name: 'Caixa Econômica', shortName: 'Caixa', color: '#005CA9', textColor: '#FFFFFF' },
  { id: 'btg', name: 'BTG Pactual', shortName: 'BTG', color: '#0D1C2E', textColor: '#FFFFFF' },
  { id: 'picpay', name: 'PicPay', shortName: 'PicPay', color: '#11C76F', textColor: '#FFFFFF' },
  { id: 'mercadopago', name: 'Mercado Pago', shortName: 'Mercado Pago', color: '#009EE3', textColor: '#FFFFFF' },
  { id: 'neon', name: 'Neon', shortName: 'Neon', color: '#00E5FF', textColor: '#0D1C2E' },
  { id: 'xp', name: 'XP Investimentos', shortName: 'XP', color: '#000000', textColor: '#FFFFFF' },
  { id: 'pagbank', name: 'PagBank', shortName: 'PagBank', color: '#00A859', textColor: '#FFFFFF' },
  { id: 'will', name: 'Will Bank', shortName: 'will', color: '#FFE600', textColor: '#18181B' },
  { id: 'sicoob', name: 'Sicoob', shortName: 'Sicoob', color: '#003641', textColor: '#FFFFFF' },
  { id: 'sicredi', name: 'Sicredi', shortName: 'Sicredi', color: '#00823B', textColor: '#FFFFFF' },
  { id: 'safra', name: 'Safra', shortName: 'Safra', color: '#0C1E3C', textColor: '#D4AF37' },
];

// Identificador inteligente de banco por nome ou id
export function getBankInfo(bankNameOrId) {
  if (!bankNameOrId) return ALL_BANKS[0];
  const s = String(bankNameOrId).toLowerCase().trim();

  if (s.includes('nubank') || s === 'nu' || s === 'roxinho') return ALL_BANKS.find((b) => b.id === 'nubank');
  if (s.includes('c6')) return ALL_BANKS.find((b) => b.id === 'c6');
  if (s.includes('ita') || s.includes('itau')) return ALL_BANKS.find((b) => b.id === 'itau');
  if (s.includes('bradesco')) return ALL_BANKS.find((b) => b.id === 'bradesco');
  if (s.includes('brasil') || s === 'bb' || s.includes('banco do brasil')) return ALL_BANKS.find((b) => b.id === 'bb');
  if (s.includes('santander')) return ALL_BANKS.find((b) => b.id === 'santander');
  if (s.includes('inter')) return ALL_BANKS.find((b) => b.id === 'inter');
  if (s.includes('caixa') || s === 'cef') return ALL_BANKS.find((b) => b.id === 'caixa');
  if (s.includes('btg')) return ALL_BANKS.find((b) => b.id === 'btg');
  if (s.includes('picpay')) return ALL_BANKS.find((b) => b.id === 'picpay');
  if (s.includes('mercado') || s.includes('pago') || s === 'mp') return ALL_BANKS.find((b) => b.id === 'mercadopago');
  if (s.includes('neon')) return ALL_BANKS.find((b) => b.id === 'neon');
  if (s === 'xp' || s.includes('xp invest')) return ALL_BANKS.find((b) => b.id === 'xp');
  if (s.includes('pag') || s.includes('seguro')) return ALL_BANKS.find((b) => b.id === 'pagbank');
  if (s.includes('will')) return ALL_BANKS.find((b) => b.id === 'will');
  if (s.includes('sicoob')) return ALL_BANKS.find((b) => b.id === 'sicoob');
  if (s.includes('sicredi')) return ALL_BANKS.find((b) => b.id === 'sicredi');
  if (s.includes('safra')) return ALL_BANKS.find((b) => b.id === 'safra');

  // Fallback genérico customizado com o nome fornecido
  return {
    id: 'other',
    name: bankNameOrId,
    shortName: bankNameOrId,
    color: '#7C3AED',
    textColor: '#FFFFFF',
  };
}

export default function BankLogo({ bank, size = 44, style }) {
  const info = getBankInfo(bank);
  const borderRadius = Math.round(size * 0.32);

  // Renderização precisa para cada banco
  const renderLogoContent = () => {
    switch (info.id) {
      case 'nubank':
        return (
          <Text style={[styles.nuText, { fontSize: Math.round(size * 0.46) }]}>
            nu
          </Text>
        );

      case 'c6':
        return (
          <Text style={[styles.c6Text, { fontSize: Math.round(size * 0.38) }]}>
            C6
          </Text>
        );

      case 'itau':
        // Logo oficial Itaú: quadrado azul marinho arredondado centralizado com "itaú" e ponto amarelo
        return (
          <View
            style={[
              styles.itauInnerBox,
              {
                width: Math.round(size * 0.72),
                height: Math.round(size * 0.72),
                borderRadius: Math.round(size * 0.2),
              },
            ]}
          >
            <Text style={[styles.itauText, { fontSize: Math.round(size * 0.26) }]}>
              ita<Text style={styles.itauDot}>ú</Text>
            </Text>
          </View>
        );

      case 'bradesco':
        // Símbolo clássico da árvore Bradesco
        return (
          <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24">
            <Path
              d="M12 2C8 6 4 10 4 16C4 19 6 22 10 22V15C9 15 8 14 8 13C8 11 10 9 12 7C14 9 16 11 16 13C16 14 15 15 14 15V22C18 22 20 19 20 16C20 10 16 6 12 2Z"
              fill="#FFFFFF"
            />
            <Rect x="11" y="9" width="2" height="13" fill="#FFFFFF" rx="1" />
          </Svg>
        );

      case 'bb':
        // Geometria clássica entrelaçada amarela do Banco do Brasil
        return (
          <View style={styles.bbWrap}>
            <Text style={[styles.bbText, { fontSize: Math.round(size * 0.38) }]}>
              BB
            </Text>
          </View>
        );

      case 'santander':
        // Chama tríplice oficial do Santander
        return (
          <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
            <Path
              d="M12 2C11 5 8 8 8 12C8 16 10 19 12 21C14 19 16 16 16 12C16 8 13 5 12 2Z"
              fill="#FFFFFF"
            />
            <Path
              d="M6 7C5 9 4 12 4 14C4 18 7 20 8 21C7 19 6 17 6 15C6 12 8 10 8 8C7 8 6 7 6 7Z"
              fill="#FFFFFF"
            />
            <Path
              d="M18 7C19 9 20 12 20 14C20 18 17 20 16 21C17 19 18 17 18 15C18 12 16 10 16 8C17 8 18 7 18 7Z"
              fill="#FFFFFF"
            />
          </Svg>
        );

      case 'inter':
        return (
          <Text style={[styles.interText, { fontSize: Math.round(size * 0.28) }]}>
            inter
          </Text>
        );

      case 'caixa':
        // X marcante azul e laranja da Caixa
        return (
          <View style={styles.caixaBox}>
            <Text style={[styles.caixaText, { fontSize: Math.round(size * 0.44) }]}>
              X
            </Text>
          </View>
        );

      case 'btg':
        return (
          <Text style={[styles.btgText, { fontSize: Math.round(size * 0.32) }]}>
            BTG
          </Text>
        );

      case 'picpay':
        return (
          <Svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24">
            <Path
              d="M5 4H14C17.3 4 20 6.7 20 10C20 13.3 17.3 16 14 16H9V21H5V4ZM9 12H14C15.1 12 16 11.1 16 10C16 8.9 15.1 8 14 8H9V12Z"
              fill="#FFFFFF"
            />
            <Circle cx="12.5" cy="10" r="1.5" fill="#11C76F" />
          </Svg>
        );

      case 'mercadopago':
        // Apertos de mão estilizados do Mercado Pago
        return (
          <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24">
            <Path
              d="M12 4C9 4 5 7 5 10C5 12 6 14 8 15L7 19L11 17L12 18L13 17L17 19L16 15C18 14 19 12 19 10C19 7 15 4 12 4Z"
              fill="#FFFFFF"
            />
            <Path d="M9 10L12 13L15 10" stroke="#009EE3" strokeWidth="2" strokeLinecap="round" />
          </Svg>
        );

      case 'neon':
        return (
          <Text style={[styles.neonText, { fontSize: Math.round(size * 0.26) }]}>
            neon
          </Text>
        );

      case 'xp':
        return (
          <View style={styles.xpBox}>
            <Text style={[styles.xpText, { fontSize: Math.round(size * 0.36) }]}>
              XP
            </Text>
            <View style={styles.xpUnderline} />
          </View>
        );

      case 'pagbank':
        return (
          <Text style={[styles.pagText, { fontSize: Math.round(size * 0.3) }]}>
            Pag
          </Text>
        );

      case 'will':
        return (
          <Text style={[styles.willText, { fontSize: Math.round(size * 0.32) }]}>
            will
          </Text>
        );

      case 'sicoob':
        return (
          <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
            <Polygon points="12,2 22,20 2,20" fill="#00AE9D" />
            <Polygon points="12,8 18,18 6,18" fill="#78BE20" />
          </Svg>
        );

      case 'sicredi':
        return (
          <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
            <Circle cx="12" cy="12" r="9" fill="#00823B" stroke="#FFFFFF" strokeWidth="1.5" />
            <Path d="M12 7V17M7 12H17" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            <Circle cx="12" cy="12" r="3" fill="#FFFFFF" />
          </Svg>
        );

      case 'safra':
        return (
          <Text style={[styles.safraText, { fontSize: Math.round(size * 0.22) }]}>
            SAFRA
          </Text>
        );

      default:
        return <Ionicons name="card" size={Math.round(size * 0.44)} color="#FFFFFF" />;
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: borderRadius,
          backgroundColor: info.color,
        },
        style,
      ]}
    >
      {renderLogoContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  nuText: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: -1,
  },
  c6Text: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  itauInnerBox: {
    backgroundColor: '#002D62',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itauText: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  itauDot: {
    color: '#FFD100',
  },
  bbWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bbText: {
    color: '#F8D210',
    fontWeight: '900',
    letterSpacing: 1,
  },
  interText: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  caixaBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  caixaText: {
    color: '#F58220',
    fontWeight: '900',
    textShadowColor: '#FFFFFF',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  btgText: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  neonText: {
    color: '#0D1C2E',
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  xpBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  xpText: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 1,
  },
  xpUnderline: {
    width: 14,
    height: 2,
    backgroundColor: '#F8D210',
    marginTop: -1,
  },
  pagText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  willText: {
    color: '#18181B',
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  safraText: {
    color: '#D4AF37',
    fontWeight: '900',
    letterSpacing: 1,
  },
});
