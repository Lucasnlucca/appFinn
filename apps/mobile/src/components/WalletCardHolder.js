import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { getBankTheme } from '../constants/BankThemeRegistry';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WALLET_WIDTH = SCREEN_WIDTH - 40;

// Símbolo Contactless
function ContactlessIcon({ color = '#FFFFFF', size = 16 }) {
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

// Chip EMV pequeno para o cartão na carteira
function MiniEmvChip({ variant = 'gold' }) {
  const isGold = variant === 'gold';
  const baseGrad = isGold
    ? ['#FFF1B8', '#F5C026', '#D48806']
    : ['#FFFFFF', '#D1D5DB', '#9CA3AF'];
  return (
    <LinearGradient
      colors={baseGrad}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.miniChipBox}
    >
      <View style={styles.miniChipLine} />
    </LinearGradient>
  );
}

// Logo simplificado do banco no topo do cartão
function WalletCardBrand({ theme }) {
  const bankId = theme.bankId;
  switch (bankId) {
    case 'nubank':
      return <Text style={[styles.brandNuText, { color: theme.textColor }]}>nu</Text>;
    case 'c6':
      return (
        <Text style={[styles.brandC6Text, { color: theme.textColor }]}>
          C6 <Text style={{ fontWeight: '400' }}>Bank</Text>
        </Text>
      );
    case 'itau':
      return (
        <View style={styles.miniItauBox}>
          <Text style={styles.miniItauText}>itaú</Text>
        </View>
      );
    case 'bradesco':
      return <Text style={[styles.brandTextSmall, { color: theme.textColor }]}>bradesco</Text>;
    case 'bb':
      return (
        <View style={styles.miniBbBox}>
          <Text style={styles.miniBbText}>BB</Text>
        </View>
      );
    case 'santander':
      return <Text style={[styles.brandTextSmall, { color: theme.textColor }]}>Santander</Text>;
    case 'inter':
      return <Text style={[styles.brandTextSmall, { color: theme.textColor }]}>inter</Text>;
    case 'caixa':
      return <Text style={[styles.brandTextSmall, { color: '#F58220' }]}>CAIXA</Text>;
    case 'xp':
      return <Text style={[styles.brandTextSmall, { color: theme.textColor }]}>XP</Text>;
    default:
      return (
        <Text style={[styles.brandTextSmall, { color: theme.textColor }]}>
          {theme.shortName || theme.name || 'CARTÃO'}
        </Text>
      );
  }
}

/**
 * Componente Carteira Masculina com cartões escalonados em slots de couro
 * e animação de elevação ao passar o dedo (pan/touch).
 */
export default function WalletCardHolder({
  cards = [],
  onSelectCard,
  activeCardId,
}) {
  // Limita até 4 cartões visíveis na carteira para proporção harmônica
  const displayCards = cards.slice(0, 4);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Valores animados de elevação (translateY) para cada cartão
  const animElevations = useRef(
    displayCards.map((_, i) => new Animated.Value(i === 0 ? -48 : 0))
  ).current;

  // Atualiza se activeCardId mudar externamente
  useEffect(() => {
    if (!cards || cards.length === 0) return;
    const foundIdx = displayCards.findIndex((c) => c.id === activeCardId);
    if (foundIdx >= 0) {
      elevateCard(foundIdx);
    }
  }, [activeCardId]);

  const elevateCard = (indexToElevate) => {
    setSelectedIdx(indexToElevate);
    displayCards.forEach((_, i) => {
      Animated.spring(animElevations[i], {
        toValue: i === indexToElevate ? -52 : 0,
        friction: 6,
        tension: 55,
        useNativeDriver: true,
      }).start();
    });
  };

  // PanResponder para detectar o dedo deslizando pelos cartões na carteira
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const y = evt.nativeEvent.locationY;
        detectSlotFromY(y);
      },
      onPanResponderMove: (evt) => {
        const y = evt.nativeEvent.locationY;
        detectSlotFromY(y);
      },
      onPanResponderRelease: () => {
        // Ao soltar o dedo, o cartão atual permanece elevado
      },
    })
  ).current;

  const detectSlotFromY = (y) => {
    const total = displayCards.length;
    if (total === 0) return;
    // O topo de cada slot é escalonado em ~45px
    // 0 a 70 -> slot 0
    // 70 a 115 -> slot 1
    // 115 a 160 -> slot 2
    // > 160 -> slot 3
    let targetIdx = 0;
    if (y < 70) {
      targetIdx = 0;
    } else if (y < 115) {
      targetIdx = Math.min(1, total - 1);
    } else if (y < 160) {
      targetIdx = Math.min(2, total - 1);
    } else {
      targetIdx = Math.min(3, total - 1);
    }

    if (targetIdx !== selectedIdx) {
      elevateCard(targetIdx);
    }
  };

  if (!cards || cards.length === 0) {
    return null;
  }

  // Posições base de cada slot de cima para baixo
  const SLOT_OFFSETS = [14, 56, 98, 140];

  return (
    <View style={styles.walletWrapper}>
      {/* CORPO DE COURO DA CARTEIRA MASCULINA */}
      <View style={styles.walletBody} {...panResponder.panHandlers}>
        {/* Costura perimétrica da carteira */}
        <View style={styles.outerStitchingBorder} pointerEvents="none" />

        {/* CARTÕES INSERIDOS NOS SLOTS (STACK ORDENADO) */}
        {displayCards.map((card, i) => {
          const theme = getBankTheme(card.bankId || card.bank || card.name);
          const topOffset = SLOT_OFFSETS[i] || 14;
          const isElevated = selectedIdx === i;
          const cardZIndex = i * 2 + 1; // 1, 3, 5, 7

          const digits = (card.lastFourDigits || '4568').slice(-4);
          const invoiceText =
            card.currentInvoice !== undefined
              ? `Fatura: R$ ${Number(card.currentInvoice).toFixed(2).replace('.', ',')}`
              : `Vence dia ${card.dueDay || 10}`;

          return (
            <Animated.View
              key={card.id || `card-${i}`}
              style={[
                styles.cardSlotItem,
                {
                  top: topOffset,
                  zIndex: isElevated ? 20 : cardZIndex,
                  transform: [{ translateY: animElevations[i] }],
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => {
                  if (selectedIdx === i) {
                    onSelectCard?.(card);
                  } else {
                    elevateCard(i);
                  }
                }}
                style={styles.cardTouchArea}
              >
                <LinearGradient
                  colors={theme.gradientColors}
                  start={theme.gradientStart}
                  end={theme.gradientEnd}
                  style={[
                    styles.cardGradientSurface,
                    isElevated && styles.cardGradientElevated,
                  ]}
                >
                  {/* Borda superior iluminada */}
                  <View style={styles.cardTopHighlight} />

                  {/* Linha superior visível da borda do cartão */}
                  <View style={styles.cardHeaderRow}>
                    <WalletCardBrand theme={theme} />

                    <View style={styles.cardHeaderRight}>
                      <Text
                        style={[
                          styles.cardDigitsMini,
                          { color: theme.secondaryTextColor || 'rgba(255,255,255,0.8)' },
                        ]}
                      >
                        •••• {digits}
                      </Text>
                      <ContactlessIcon
                        color={theme.secondaryTextColor || 'rgba(255,255,255,0.8)'}
                        size={15}
                      />
                    </View>
                  </View>

                  {/* Corpo do cartão (revelado ao subir) */}
                  <View style={styles.cardRevealedBody}>
                    <View style={styles.revealedRow}>
                      <MiniEmvChip variant={theme.chipVariant} />
                      <Text
                        style={[
                          styles.revealedInvoice,
                          { color: theme.textColor },
                        ]}
                      >
                        {invoiceText}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.revealedHolder,
                        { color: theme.textColor },
                      ]}
                      numberOfLines={1}
                    >
                      {(card.holderName || card.name || 'LUCAS SILVA').toUpperCase()}
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* DIVISÓRIAS DE COURO COM COSTURA DUPLA REALISTA (ENTRE OS SLOTS) */}
        {displayCards.map((_, i) => {
          if (i === 0) return null;
          const lipTop = (SLOT_OFFSETS[i] || 56) + 4;
          const lipZIndex = i * 2; // 2, 4, 6

          return (
            <View
              key={`lip-${i}`}
              pointerEvents="none"
              style={[
                styles.leatherSlotLip,
                {
                  top: lipTop,
                  zIndex: lipZIndex,
                },
              ]}
            >
              <LinearGradient
                colors={['#273248', '#1A2333']}
                style={styles.slotLipGradient}
              >
                {/* Linha de costura branca/creme tracejada (estilo print 4) */}
                <View style={styles.stitchDashedLine} />
              </LinearGradient>
            </View>
          );
        })}

        {/* BOLSO FRONTAL DE COURO (COBRE A BASE DOS CARTÕES COMO CARTEIRA REAL) */}
        <View
          pointerEvents="none"
          style={[
            styles.walletFrontPocket,
            {
              top: (SLOT_OFFSETS[displayCards.length - 1] || 100) + 40,
              zIndex: displayCards.length * 2 + 2,
            },
          ]}
        >
          <LinearGradient
            colors={['#2B374E', '#192232', '#121926']}
            style={styles.frontPocketGradient}
          >
            {/* Costura dupla superior da borda do bolso */}
            <View style={styles.stitchDashedLine} />

            {/* Emblema em relevo da Carteira FINN */}
            <View style={styles.walletEmbossedRow}>
              <View style={styles.embossedLine} />
              <Text style={styles.walletEmbossedText}>FINN WALLET</Text>
              <View style={styles.embossedLine} />
            </View>
          </LinearGradient>
        </View>
      </View>

      {/* RÓTULO INTERATIVO INFERIOR */}
      <View style={styles.interactiveHintRow}>
        <Ionicons name="finger-print-outline" size={15} color="#7C3AED" />
        <Text style={styles.interactiveHintText}>
          Deslize o dedo para subir os cartões • Toque para ver detalhes
        </Text>
      </View>

      {/* BOTÃO PARA DETALHAR O CARTÃO ELEVADO */}
      {displayCards[selectedIdx] && (
        <TouchableOpacity
          style={styles.detailButton}
          activeOpacity={0.8}
          onPress={() => onSelectCard?.(displayCards[selectedIdx])}
        >
          <Text style={styles.detailButtonText}>
            Ver detalhes do {displayCards[selectedIdx]?.name || 'Cartão'}
          </Text>
          <Ionicons name="arrow-forward" size={15} color="#7C3AED" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  walletWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  walletBody: {
    width: WALLET_WIDTH,
    height: 250,
    backgroundColor: '#161F2E',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#2F3D55',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  outerStitchingBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderStyle: 'dashed',
    margin: 4,
    zIndex: 99,
  },
  cardSlotItem: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 185,
    borderRadius: 16,
  },
  cardTouchArea: {
    flex: 1,
  },
  cardGradientSurface: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  cardGradientElevated: {
    borderColor: '#FFFFFF',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 12,
  },
  cardTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandNuText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -1,
  },
  brandC6Text: {
    fontSize: 16,
    fontWeight: '800',
  },
  miniItauBox: {
    backgroundColor: '#002D62',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniItauText: {
    color: '#EC7000',
    fontSize: 12,
    fontWeight: '800',
  },
  miniBbBox: {
    backgroundColor: '#003882',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniBbText: {
    color: '#F8D210',
    fontSize: 12,
    fontWeight: '800',
  },
  brandTextSmall: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardDigitsMini: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardRevealedBody: {
    marginTop: 10,
    gap: 6,
  },
  revealedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  miniChipBox: {
    width: 28,
    height: 20,
    borderRadius: 4,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  miniChipLine: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  revealedInvoice: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  revealedHolder: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    opacity: 0.9,
  },
  leatherSlotLip: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 26,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    overflow: 'hidden',
  },
  slotLipGradient: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 4,
    paddingHorizontal: 12,
  },
  stitchDashedLine: {
    height: 2,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(240, 240, 240, 0.38)',
    borderStyle: 'dashed',
  },
  walletFrontPocket: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  frontPocketGradient: {
    flex: 1,
    paddingTop: 8,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
  },
  walletEmbossedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  embossedLine: {
    width: 30,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  walletEmbossedText: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  interactiveHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  interactiveHintText: {
    fontSize: 11.5,
    color: '#6B7280',
    fontWeight: '600',
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3EEFF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 6,
  },
  detailButtonText: {
    fontSize: 12.5,
    color: '#7C3AED',
    fontWeight: '700',
  },
});
