import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Path,
  Rect,
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  G,
} from 'react-native-svg';
import { getBankTheme } from '../constants/BankThemeRegistry';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Símbolo Contactless (ondas de aproximação)
function ContactlessIcon({ color = '#FFFFFF', size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.5 16C7.8 13.5 7.8 10.5 6.5 8"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M10.5 18.5C12.8 14.5 12.8 9.5 10.5 5.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M14.5 21C17.8 15.5 17.8 8.5 14.5 3"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Chip EMV com visual realista metálico e contatos gravados
function EmvChip({ variant = 'gold' }) {
  const isGold = variant === 'gold';
  const baseGrad = isGold
    ? ['#FFF1B8', '#F5C026', '#D48806']
    : ['#FFFFFF', '#D1D5DB', '#9CA3AF'];
  const strokeColor = isGold ? '#B7791F' : '#6B7280';

  return (
    <LinearGradient
      colors={baseGrad}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.chipBox}
    >
      <Svg width={42} height={30} viewBox="0 0 42 30">
        {/* Borda interna gravada */}
        <Rect
          x="2"
          y="2"
          width="38"
          height="26"
          rx="4"
          fill="none"
          stroke={strokeColor}
          strokeWidth="0.8"
          opacity="0.8"
        />
        {/* Linha horizontal central */}
        <Path d="M2 15H40" stroke={strokeColor} strokeWidth="0.8" opacity="0.8" />
        {/* Contatos verticais e ranhuras */}
        <Path d="M14 2V28" stroke={strokeColor} strokeWidth="0.8" opacity="0.8" />
        <Path d="M28 2V28" stroke={strokeColor} strokeWidth="0.8" opacity="0.8" />
        {/* Ponto central */}
        <Rect
          x="18"
          y="10"
          width="6"
          height="10"
          rx="1"
          fill="none"
          stroke={strokeColor}
          strokeWidth="0.8"
          opacity="0.9"
        />
      </Svg>
    </LinearGradient>
  );
}

// Emblema da bandeira (Mastercard ou Visa)
function BrandBadge({ brand = 'Mastercard' }) {
  if (brand === 'Visa') {
    return (
      <Text style={styles.visaBrandText}>
        VISA
      </Text>
    );
  }

  // Mastercard oficial de dois círculos entrelaçados
  return (
    <Svg width={36} height={22} viewBox="0 0 36 22">
      <Circle cx="12" cy="11" r="10" fill="#EB001B" opacity="0.95" />
      <Circle cx="24" cy="11" r="10" fill="#F79E1B" opacity="0.95" />
      <Path
        d="M18 4.2C19.7 5.9 20.8 8.3 20.8 11C20.8 13.7 19.7 16.1 18 17.8C16.3 16.1 15.2 13.7 15.2 11C15.2 8.3 16.3 5.9 18 4.2Z"
        fill="#FF5F00"
      />
    </Svg>
  );
}

// Textura artística vetorial de acordo com o tema do banco
function BankCardOverlay({ overlayType, width, height }) {
  if (overlayType === 'waves') {
    // Ondas luminosas características (estilo Nubank)
    return (
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 340 214"
        style={StyleSheet.absoluteFillObject}
      >
        <Defs>
          <SvgGradient id="nuWaveGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#C084FC" stopOpacity="0.7" />
            <Stop offset="0.6" stopColor="#E879F9" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#818CF8" stopOpacity="0.05" />
          </SvgGradient>
        </Defs>
        <Path
          d="M-20 180 C80 130 180 200 360 140 L360 230 L-20 230 Z"
          fill="url(#nuWaveGrad)"
          opacity="0.35"
        />
        <Path
          d="M-20 195 C90 155 190 215 360 170"
          stroke="#F472B6"
          strokeWidth="1.5"
          fill="none"
          opacity="0.6"
        />
        <Path
          d="M220 220 C260 170 310 160 360 150"
          stroke="#C084FC"
          strokeWidth="1.2"
          fill="none"
          opacity="0.7"
        />
      </Svg>
    );
  }

  if (overlayType === 'metallic-streak') {
    // Feixes metálicos de luz diagonal (estilo C6 Bank e BTG)
    return (
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 340 214"
        style={StyleSheet.absoluteFillObject}
      >
        <Defs>
          <SvgGradient id="streakGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.16" />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.03" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgGradient>
        </Defs>
        <Path d="M120 -20 L280 230 L220 230 L60 -20 Z" fill="url(#streakGrad)" />
        <Path d="M220 -20 L380 230 L340 230 L180 -20 Z" fill="url(#streakGrad)" opacity="0.6" />
      </Svg>
    );
  }

  if (overlayType === 'gold-stripe') {
    // Fita nobre dourada (estilo XP e Safra)
    return (
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 340 214"
        style={StyleSheet.absoluteFillObject}
      >
        <Defs>
          <SvgGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FACC15" stopOpacity="0.6" />
            <Stop offset="0.7" stopColor="#CA8A04" stopOpacity="0.3" />
            <Stop offset="1" stopColor="#854D0E" stopOpacity="0.05" />
          </SvgGradient>
        </Defs>
        <Path
          d="M200 -20 C240 60 280 120 360 180"
          stroke="url(#goldGrad)"
          strokeWidth="3.5"
          fill="none"
          opacity="0.8"
        />
        <Path
          d="M170 -20 C220 70 260 140 360 210"
          stroke="#FDE047"
          strokeWidth="1"
          fill="none"
          opacity="0.4"
        />
      </Svg>
    );
  }

  if (overlayType === 'itau-curve') {
    // Arco elegante em degradê laranja (estilo Itaú)
    return (
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 340 214"
        style={StyleSheet.absoluteFillObject}
      >
        <Defs>
          <SvgGradient id="itauGrad" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#EC7000" stopOpacity="0.4" />
            <Stop offset="0.6" stopColor="#FF9838" stopOpacity="0.15" />
            <Stop offset="1" stopColor="#FFC27A" stopOpacity="0" />
          </SvgGradient>
        </Defs>
        <Path
          d="M180 230 C220 160 280 120 360 110 L360 230 Z"
          fill="url(#itauGrad)"
        />
      </Svg>
    );
  }

  // Overlay padrão com brilhos suaves
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 340 214"
      style={StyleSheet.absoluteFillObject}
    >
      <Circle cx="300" cy="40" r="120" fill="#FFFFFF" opacity="0.04" />
      <Circle cx="40" cy="180" r="90" fill="#FFFFFF" opacity="0.03" />
    </Svg>
  );
}

// Logo oficial do emissor no canto superior esquerdo do cartão
function CardHeaderLogo({ bankId, theme }) {
  const isLightText = theme.textColor !== '#18181B';

  switch (bankId) {
    case 'nubank':
      return (
        <Text style={[styles.nuBrandLogo, { color: theme.textColor }]}>
          nu
        </Text>
      );

    case 'c6':
      return (
        <View style={styles.brandRow}>
          <Text style={[styles.c6BrandLogo, { color: theme.textColor }]}>
            C6 <Text style={{ fontWeight: '400' }}>Bank</Text>
          </Text>
        </View>
      );

    case 'itau':
      return (
        <View style={styles.itauBox}>
          <Text style={styles.itauLogoText}>
            ita<Text style={{ color: '#FFD100' }}>ú</Text>
          </Text>
        </View>
      );

    case 'bradesco':
      return (
        <View style={styles.brandRow}>
          <Text style={[styles.bradescoText, { color: theme.textColor }]}>
            bradesco
          </Text>
        </View>
      );

    case 'bb':
      return (
        <View style={styles.bbBrandBadge}>
          <Text style={styles.bbText}>BB</Text>
        </View>
      );

    case 'santander':
      return (
        <Text style={[styles.santanderText, { color: theme.textColor }]}>
          Santander
        </Text>
      );

    case 'inter':
      return (
        <Text style={[styles.interText, { color: theme.textColor }]}>
          inter
        </Text>
      );

    case 'caixa':
      return (
        <Text style={[styles.caixaText, { color: '#F58220' }]}>
          CAIXA
        </Text>
      );

    case 'btg':
      return (
        <Text style={[styles.btgText, { color: theme.textColor }]}>
          BTG <Text style={{ fontWeight: '300', fontSize: 13 }}>Pactual</Text>
        </Text>
      );

    case 'picpay':
      return (
        <Text style={[styles.picpayText, { color: theme.textColor }]}>
          PicPay
        </Text>
      );

    case 'mercadopago':
      return (
        <Text style={[styles.mpText, { color: theme.textColor }]}>
          mercado <Text style={{ fontWeight: '800' }}>pago</Text>
        </Text>
      );

    case 'neon':
      return (
        <Text style={[styles.neonText, { color: theme.textColor }]}>
          neon
        </Text>
      );

    case 'xp':
      return (
        <View style={styles.xpBox}>
          <Text style={[styles.xpText, { color: theme.textColor }]}>XP</Text>
          <View style={styles.xpUnderline} />
        </View>
      );

    case 'pagbank':
      return (
        <Text style={[styles.pagText, { color: theme.textColor }]}>
          PagBank
        </Text>
      );

    case 'will':
      return (
        <Text style={[styles.willText, { color: theme.textColor }]}>
          will
        </Text>
      );

    case 'sicoob':
      return (
        <Text style={[styles.sicoobText, { color: theme.textColor }]}>
          SICOOB
        </Text>
      );

    case 'sicredi':
      return (
        <Text style={[styles.sicrediText, { color: theme.textColor }]}>
          Sicredi
        </Text>
      );

    case 'safra':
      return (
        <Text style={[styles.safraText, { color: theme.accentColor }]}>
          SAFRA
        </Text>
      );

    default:
      return (
        <Text style={[styles.defaultBrandText, { color: theme.textColor }]}>
          {theme.shortName || 'FINN'}
        </Text>
      );
  }
}

/**
 * Componente Visual de Cartão Bancário de Alto Padrão (BankCard)
 */
export default function BankCard({
  bankId = 'nubank',
  cardId,
  holderName = 'NOME SOBRENOME',
  lastFourDigits = '4568',
  expiryMonth = '10',
  expiryYear = '26',
  variant = 'premium',
  style,
}) {
  const theme = getBankTheme(bankId);

  // Formatação dos 4 blocos de números do cartão
  const digitsClean = String(lastFourDigits || '4568').slice(-4);
  const formattedCardNumber = `1234  4568  1234  ${digitsClean}`;

  const displayName = String(holderName || 'NOME SOBRENOME').toUpperCase().trim();
  const displayExpiry = `${String(expiryMonth || '10').padStart(2, '0')}/${String(
    expiryYear || '26'
  ).slice(-2)}`;

  return (
    <View style={[styles.outerContainer, style]}>
      <LinearGradient
        colors={theme.gradientColors}
        start={theme.gradientStart}
        end={theme.gradientEnd}
        style={styles.cardSurface}
      >
        {/* Camada artística vetorial / textura totalmente isolada no fundo */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <BankCardOverlay overlayType={theme.overlayType} />
        </View>

        {/* Conteúdo visível do cartão com flexbox protegido */}
        <View style={styles.cardContent}>
          {/* Linha superior: Logo do Banco à esquerda, "Credit card" e Contactless à direita */}
          <View style={styles.topRow}>
            <CardHeaderLogo bankId={theme.bankId} theme={theme} />

            <View style={styles.topRightRow}>
              <Text
                style={[
                  styles.creditCardLabel,
                  { color: theme.secondaryTextColor || 'rgba(255, 255, 255, 0.75)' },
                ]}
              >
                {theme.cardLabel || 'Credit card'}
              </Text>
              <ContactlessIcon
                color={theme.secondaryTextColor || 'rgba(255, 255, 255, 0.75)'}
                size={18}
              />
            </View>
          </View>

          {/* Chip Metálico EMV */}
          <View style={styles.chipRow}>
            <EmvChip variant={theme.chipVariant} />
          </View>

          {/* Número do Cartão (Embossed OCR Style) */}
          <View style={styles.cardNumberRow}>
            <Text
              style={[
                styles.cardNumberText,
                { color: theme.textColor },
              ]}
            >
              {formattedCardNumber}
            </Text>
          </View>

          {/* Linha Inferior: Nome do Titular e Validade */}
          <View style={styles.bottomRow}>
            <View style={styles.holderInfo}>
              <Text
                style={[
                  styles.holderNameText,
                  { color: theme.textColor },
                ]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
            </View>

            <View style={styles.expiryBox}>
              <View style={styles.validThruLabelBox}>
                <Text
                  style={[
                    styles.validThruLabel,
                    { color: theme.secondaryTextColor || 'rgba(255, 255, 255, 0.7)' },
                  ]}
                >
                  VALID
                </Text>
                <Text
                  style={[
                    styles.validThruLabel,
                    { color: theme.secondaryTextColor || 'rgba(255, 255, 255, 0.7)' },
                  ]}
                >
                  THRU
                </Text>
              </View>
              <Text
                style={[
                  styles.expiryValueText,
                  { color: theme.textColor },
                ]}
              >
                {displayExpiry}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    aspectRatio: 1.586,
    borderRadius: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
    marginTop: 6,
    marginBottom: 6,
  },
  cardSurface: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    position: 'relative',
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    justifyContent: 'space-between',
    zIndex: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  topRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  creditCardLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  chipRow: {
    marginTop: 4,
    marginBottom: 6,
    zIndex: 2,
  },
  chipBox: {
    width: 44,
    height: 32,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  cardNumberRow: {
    marginTop: 2,
    marginBottom: 6,
    zIndex: 2,
  },
  cardNumberText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 2.6,
    fontFamily: 'monospace',
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    zIndex: 2,
  },
  holderInfo: {
    flex: 1,
    marginRight: 12,
  },
  holderNameText: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 1.6,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  expiryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  validThruLabelBox: {
    alignItems: 'flex-end',
  },
  validThruLabel: {
    fontSize: 6.5,
    fontWeight: '800',
    lineHeight: 7.5,
  },
  expiryValueText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Logotipos dos emissores
  nuBrandLogo: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  c6BrandLogo: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  itauBox: {
    backgroundColor: '#002D62',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EC7000',
  },
  itauLogoText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: -0.5,
  },
  bradescoText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  bbBrandBadge: {
    backgroundColor: '#F8D210',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bbText: {
    color: '#003882',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  santanderText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  interText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  caixaText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
    textShadowColor: '#FFFFFF',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  btgText: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  picpayText: {
    fontSize: 19,
    fontWeight: '900',
  },
  mpText: {
    fontSize: 16,
    fontWeight: '600',
  },
  neonText: {
    fontSize: 18,
    fontWeight: '900',
  },
  xpBox: {
    alignItems: 'flex-start',
  },
  xpText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  xpUnderline: {
    width: 22,
    height: 2,
    backgroundColor: '#F8D210',
    marginTop: -2,
  },
  pagText: {
    fontSize: 17,
    fontWeight: '900',
  },
  willText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  sicoobText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sicrediText: {
    fontSize: 17,
    fontWeight: '900',
  },
  safraText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  defaultBrandText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visaBrandText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontStyle: 'italic',
    fontSize: 18,
    letterSpacing: 1,
  },
});

