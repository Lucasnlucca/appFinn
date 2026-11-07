import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
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
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { getBankTheme } from '../constants/BankThemeRegistry';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WALLET_WIDTH = Math.min(SCREEN_WIDTH - 40, 360);
const CARDS_PER_PAGE = 4;
const ELEVATION_STEP_PX = -42; // Elevação expressiva ao subir cada cartão da carteira

// Ícone Contactless minimalista
function ContactlessIcon({ color = '#FFFFFF', size = 13 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.5 16C7.8 13.5 7.8 10.5 6.5 8"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <Path
        d="M10.5 18.5C12.8 14.5 12.8 9.5 10.5 5.5"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <Path
        d="M14.5 21C17.8 15.5 17.8 8.5 14.5 3"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Mini Chip EMV metálico
function MiniEmvChip({ variant = 'gold' }) {
  const isGold = variant === 'gold';
  const baseGrad = isGold
    ? ['#FFE89E', '#E6B022', '#B87A04']
    : ['#FFFFFF', '#D1D5DB', '#858E9B'];
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

// Identificador do banco no topo do cartão (estilo print carteira)
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
 * Dimensões dos slots e da carteira proporcional ao print do usuário
 */
function getWalletLayout(cardCount) {
  const count = Math.max(1, Math.min(4, cardCount));
  switch (count) {
    case 1:
      return {
        slotTops: [16],
        walletHeight: 180,
        frontPocketTop: 75,
        cardHeight: 110,
      };
    case 2:
      return {
        slotTops: [14, 52],
        walletHeight: 195,
        frontPocketTop: 96,
        cardHeight: 110,
      };
    case 3:
      return {
        slotTops: [12, 46, 80],
        walletHeight: 215,
        frontPocketTop: 116,
        cardHeight: 110,
      };
    case 4:
    default:
      return {
        slotTops: [10, 40, 70, 100],
        walletHeight: 228,
        frontPocketTop: 134,
        cardHeight: 110,
      };
  }
}

function getSlotIndexFromRelativeY(relY, slotTops) {
  const count = slotTops.length;
  if (count <= 1) return 0;
  for (let i = 0; i < count - 1; i++) {
    const threshold = (slotTops[i] + slotTops[i + 1]) / 2 + 6;
    if (relY < threshold) {
      return i;
    }
  }
  return count - 1;
}

/**
 * Carteira Masculina Porta-Cartões de Couro (Estilo Print Faturas)
 */
export default function WalletCardHolder({
  cards = [],
  onSelectCard,
  activeCardId,
}) {
  const totalCards = cards.length;
  const totalPages = Math.ceil(totalCards / CARDS_PER_PAGE);
  const [currentPage, setCurrentPage] = useState(0);

  const pageCards = useMemo(() => {
    if (totalCards <= CARDS_PER_PAGE) return cards;
    const start = currentPage * CARDS_PER_PAGE;
    return cards.slice(start, start + CARDS_PER_PAGE);
  }, [cards, currentPage, totalCards]);

  const layout = useMemo(() => getWalletLayout(pageCards.length), [pageCards.length]);

  const initialCardId = activeCardId || pageCards[0]?.id || cards[0]?.id;
  const [selectedCardId, setSelectedCardId] = useState(initialCardId);

  // raisedIndex: quantos cartões estão levantados na carteira (de 0 até pageCards.length)
  // Ao passar pra cima ele sobe um cartão, ao passar de novo sobe outro e assim por diante.
  // Na outra direção (passar pra baixo) ele vai voltando os cartões um por um.
  const [raisedIndex, setRaisedIndex] = useState(1);
  const raisedIndexRef = useRef(1);
  raisedIndexRef.current = raisedIndex;

  const pageCardsRef = useRef(pageCards);
  pageCardsRef.current = pageCards;

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  // Dicionário de animação por card.id
  const animElevationsRef = useRef({});

  pageCards.forEach((c, idx) => {
    if (!animElevationsRef.current[c.id]) {
      animElevationsRef.current[c.id] = new Animated.Value(
        idx < raisedIndex ? ELEVATION_STEP_PX : 0
      );
    }
  });

  // Atualiza as animações de todos os cartões quando raisedIndex mudar
  useEffect(() => {
    pageCards.forEach((card, i) => {
      let anim = animElevationsRef.current[card.id];
      if (!anim) {
        anim = new Animated.Value(i < raisedIndex ? ELEVATION_STEP_PX : 0);
        animElevationsRef.current[card.id] = anim;
      }
      const toValue = i < raisedIndex ? ELEVATION_STEP_PX : 0;
      Animated.spring(anim, {
        toValue,
        friction: 7,
        tension: 65,
        useNativeDriver: true,
      }).start();
    });
  }, [raisedIndex, pageCards]);

  const handleSwipeUp = useCallback(() => {
    setRaisedIndex((prev) => {
      const next = Math.min(prev + 1, pageCardsRef.current.length);
      const activeCard = pageCardsRef.current[next - 1];
      if (activeCard) {
        setSelectedCardId(activeCard.id);
        onSelectCard?.(activeCard);
      }
      return next;
    });
  }, [onSelectCard]);

  const handleSwipeDown = useCallback(() => {
    setRaisedIndex((prev) => {
      const next = Math.max(prev - 1, 0);
      const activeCard = next > 0 ? pageCardsRef.current[next - 1] : pageCardsRef.current[0];
      if (activeCard) {
        setSelectedCardId(activeCard.id);
        onSelectCard?.(activeCard);
      }
      return next;
    });
  }, [onSelectCard]);

  // Sincroniza seleção externa se activeCardId mudar
  useEffect(() => {
    if (!cards || cards.length === 0) return;
    if (activeCardId) {
      const cardIdx = pageCards.findIndex((c) => c.id === activeCardId);
      if (cardIdx >= 0) {
        setRaisedIndex(cardIdx + 1);
        setSelectedCardId(activeCardId);
      }
    }
  }, [activeCardId, cards, pageCards]);

  const swipeHandledRef = useRef(false);

  // PanResponder que captura gesto vertical com alta precisão
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderGrant: () => {
        swipeHandledRef.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        if (swipeHandledRef.current) return;
        if (gestureState.dy < -25) {
          swipeHandledRef.current = true;
          handleSwipeUp();
        } else if (gestureState.dy > 25) {
          swipeHandledRef.current = true;
          handleSwipeDown();
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (!swipeHandledRef.current) {
          if (gestureState.dy < -18) {
            handleSwipeUp();
          } else if (gestureState.dy > 18) {
            handleSwipeDown();
          }
        }
        swipeHandledRef.current = false;
      },
    })
  ).current;

  const handleCardPress = (card, i) => {
    if (i < raisedIndex) {
      if (i === raisedIndex - 1) {
        // Se este já é o mais elevado, abaixa ele
        setRaisedIndex(i);
        const prevCard = i > 0 ? pageCards[i - 1] : pageCards[0];
        if (prevCard) {
          setSelectedCardId(prevCard.id);
          onSelectCard?.(prevCard);
        }
      } else {
        setSelectedCardId(card.id);
        onSelectCard?.(card);
      }
    } else {
      // Sobe até este cartão
      setRaisedIndex(i + 1);
      setSelectedCardId(card.id);
      onSelectCard?.(card);
    }
  };

  if (!cards || cards.length === 0) {
    return null;
  }

  const selectedIdx = pageCards.findIndex((c) => c.id === selectedCardId);
  const selectedCard = pageCards[selectedIdx >= 0 ? selectedIdx : 0];

  return (
    <View style={styles.walletWrapper}>
      {/* SELETOR DE PÁGINAS SE HOUVER MAIS DE 4 CARTÕES */}
      {totalPages > 1 && (
        <View style={styles.paginationPillsRow}>
          {Array.from({ length: totalPages }).map((_, pIdx) => {
            const isCurPage = pIdx === currentPage;
            const startNum = pIdx * CARDS_PER_PAGE + 1;
            const endNum = Math.min((pIdx + 1) * CARDS_PER_PAGE, totalCards);
            return (
              <TouchableOpacity
                key={`page-${pIdx}`}
                onPress={() => setCurrentPage(pIdx)}
                style={[styles.pagePill, isCurPage && styles.pagePillActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.pagePillText, isCurPage && styles.pagePillTextActive]}>
                  Cartões {startNum}-{endNum}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* CORPO DE COURO DA CARTEIRA MASCULINA */}
      <View
        style={[styles.walletBody, { height: layout.walletHeight }]}
        {...panResponder.panHandlers}
      >
        {/* Costura perimétrica da carteira estilo couro clássico */}
        <View style={styles.outerStitchingBorder} pointerEvents="none" />

        {/* CARTÕES INSERIDOS NOS SLOTS */}
        {pageCards.map((card, i) => {
          const theme = getBankTheme(card.bankId || card.bank || card.name);
          const topOffset = layout.slotTops[i] ?? 10;
          const isElevated = i < raisedIndex;
          const isCurrentActive = selectedCardId === card.id;

          const restingZ = (i + 1) * 2;
          const itemZIndex = isElevated ? 50 + i : restingZ;
          const itemElevation = isElevated ? 20 + i : restingZ;

          let anim = animElevationsRef.current[card.id];
          if (!anim) {
            anim = new Animated.Value(isElevated ? ELEVATION_STEP_PX : 0);
            animElevationsRef.current[card.id] = anim;
          }

          const digits = card.lastFourDigits ? String(card.lastFourDigits).slice(-4) : '';
          const digitsDisplay = digits ? `•••• ${digits}` : 'VISA';

          const holderDisplay = card.holderName
            ? String(card.holderName).toUpperCase().trim()
            : (card.name || card.bank || 'CARTÃO').toUpperCase();

          const invoiceText =
            card.currentInvoice !== undefined
              ? `R$ ${Number(card.currentInvoice).toFixed(2).replace('.', ',')}`
              : `Vence ${card.dueDay || 10}`;

          return (
            <Animated.View
              key={card.id || `card-${i}`}
              style={[
                styles.cardSlotItem,
                {
                  top: topOffset,
                  height: layout.cardHeight,
                  zIndex: itemZIndex,
                  elevation: itemElevation,
                  transform: [{ translateY: anim }],
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => handleCardPress(card, i)}
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
                  {/* Borda superior sutilmente iluminada */}
                  <View style={styles.cardTopHighlight} />

                  {/* Linha visível do cartão no slot da carteira */}
                  <View style={styles.cardHeaderRow}>
                    <WalletCardBrand theme={theme} />

                    <View style={styles.cardHeaderRight}>
                      <Text
                        style={[
                          styles.cardBrandBadgeText,
                          { color: theme.secondaryTextColor || '#FFFFFF' },
                        ]}
                      >
                        {digitsDisplay}
                      </Text>
                      <ContactlessIcon
                        color={theme.secondaryTextColor || 'rgba(255,255,255,0.85)'}
                        size={13}
                      />
                    </View>
                  </View>

                  {/* Detalhes que surgem ao elevar levemente */}
                  <View style={styles.cardRevealedBody}>
                    <View style={styles.revealedRow}>
                      <MiniEmvChip variant={theme.chipVariant} />
                      <Text style={[styles.revealedInvoice, { color: theme.textColor }]}>
                        {invoiceText}
                      </Text>
                    </View>
                    <Text
                      style={[styles.revealedHolder, { color: theme.textColor }]}
                      numberOfLines={1}
                    >
                      {holderDisplay}
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* DIVISÓRIAS DE COURO COM COSTURA TRACEJADA ENTRE OS SLOTS */}
        {pageCards.map((_, i) => {
          if (i === 0) return null;
          const lipTop = (layout.slotTops[i] ?? 40) - 2;
          const lipZIndex = (i + 1) * 2 - 1;

          return (
            <View
              key={`lip-${i}`}
              pointerEvents="none"
              style={[
                styles.leatherSlotLip,
                {
                  top: lipTop,
                  zIndex: lipZIndex,
                  elevation: lipZIndex,
                },
              ]}
            >
              <LinearGradient
                colors={['#27374D', '#1B2636']}
                style={styles.slotLipGradient}
              >
                <View style={styles.stitchDashedLine} />
              </LinearGradient>
            </View>
          );
        })}

        {/* BOLSO FRONTAL DE COURO DA CARTEIRA */}
        <View
          pointerEvents="none"
          style={[
            styles.walletFrontPocket,
            {
              top: layout.frontPocketTop,
              zIndex: 35,
              elevation: 8,
            },
          ]}
        >
          <LinearGradient
            colors={['#28384F', '#1B2636', '#121A26']}
            style={styles.frontPocketGradient}
          >
            {/* Costura superior do bolso */}
            <View style={styles.stitchDashedLine} />

            {/* Emblema FINN WALLET gravado no couro */}
            <View style={styles.walletEmbossedRow}>
              <View style={styles.embossedLine} />
              <Text style={styles.walletEmbossedText}>FINN WALLET</Text>
              <View style={styles.embossedLine} />
            </View>
          </LinearGradient>
        </View>
      </View>

      {/* RÓTULO INTERATIVO DISCRETO */}
      <View style={styles.interactiveHintRow}>
        <Ionicons name="finger-print-outline" size={14} color="#7C3AED" />
        <Text style={styles.interactiveHintText}>
          Deslize para ver os cartões • Toque para selecionar
        </Text>
      </View>

      {/* BOTÃO PARA SELECIONAR E DETALHAR O CARTÃO ELEVADO */}
      {selectedCard && (
        <TouchableOpacity
          style={styles.detailButton}
          activeOpacity={0.8}
          onPress={() => onSelectCard?.(selectedCard)}
        >
          <Text style={styles.detailButtonText}>
            Ver detalhes do {selectedCard.name || selectedCard.bank || 'Cartão'}
          </Text>
          <Ionicons name="arrow-forward" size={14} color="#7C3AED" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  walletWrapper: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 18, // Espaço exato para o cartão elevar sem voar para fora
    marginBottom: 6,
  },
  walletBody: {
    width: WALLET_WIDTH,
    backgroundColor: '#182333',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#2D3E54',
    overflow: 'hidden', // Mantém o visual compacto e fechado da carteira
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 6,
  },
  outerStitchingBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(235, 240, 255, 0.25)',
    borderStyle: 'dashed',
    margin: 4,
    zIndex: 42,
  },
  cardSlotItem: {
    position: 'absolute',
    left: 10,
    right: 10,
    borderRadius: 12,
  },
  cardTouchArea: {
    flex: 1,
  },
  cardGradientSurface: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  cardGradientElevated: {
    borderColor: '#FFFFFF',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },
  cardTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  brandNuText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  brandC6Text: {
    fontSize: 15,
    fontWeight: '800',
  },
  miniItauBox: {
    backgroundColor: '#002D62',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  miniItauText: {
    color: '#EC7000',
    fontSize: 11,
    fontWeight: '800',
  },
  miniBbBox: {
    backgroundColor: '#003882',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  miniBbText: {
    color: '#F8D210',
    fontSize: 11,
    fontWeight: '800',
  },
  brandTextSmall: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardBrandBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontStyle: 'italic',
  },
  cardRevealedBody: {
    marginTop: 6,
    gap: 4,
  },
  revealedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  miniChipBox: {
    width: 24,
    height: 17,
    borderRadius: 3.5,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  miniChipLine: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  revealedInvoice: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  revealedHolder: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    opacity: 0.85,
  },
  leatherSlotLip: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 22,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    overflow: 'hidden',
  },
  slotLipGradient: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    paddingTop: 3,
    paddingHorizontal: 8,
  },
  stitchDashedLine: {
    height: 2,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(235, 240, 255, 0.32)',
    borderStyle: 'dashed',
  },
  walletFrontPocket: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
  },
  frontPocketGradient: {
    flex: 1,
    paddingTop: 7,
    paddingHorizontal: 14,
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  walletEmbossedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  embossedLine: {
    width: 25,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  walletEmbossedText: {
    color: 'rgba(255, 255, 255, 0.32)',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 2,
  },
  paginationPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  pagePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#F3EEFF',
  },
  pagePillActive: {
    backgroundColor: '#7C3AED',
  },
  pagePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  pagePillTextActive: {
    color: '#FFFFFF',
  },
  interactiveHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    marginBottom: 4,
  },
  interactiveHintText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3EEFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    marginTop: 4,
  },
  detailButtonText: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '700',
  },
});
