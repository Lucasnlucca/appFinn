import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
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

// Identificador do banco no topo do cartão (visível no slot da carteira)
function WalletCardBrand({ theme, cardName }) {
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
        <Text style={[styles.brandTextSmall, { color: theme.textColor }]} numberOfLines={1}>
          {cardName || theme.shortName || theme.name || 'CARTÃO'}
        </Text>
      );
  }
}

/**
 * Dimensões dos slots e da carteira para manter todos os cartões encaixados
 * dentro do bolso de couro (nunca exibindo o cartão inteiro para fora).
 */
function getWalletLayout(cardCount) {
  const count = Math.max(1, Math.min(4, cardCount));
  switch (count) {
    case 1:
      return {
        slotTops: [24],
        walletHeight: 162,
        frontPocketTop: 82,
        cardHeight: 102,
      };
    case 2:
      return {
        slotTops: [22, 62],
        walletHeight: 192,
        frontPocketTop: 112,
        cardHeight: 102,
      };
    case 3:
      return {
        slotTops: [20, 58, 96],
        walletHeight: 222,
        frontPocketTop: 144,
        cardHeight: 102,
      };
    case 4:
    default:
      return {
        slotTops: [18, 55, 92, 129],
        walletHeight: 248,
        frontPocketTop: 172,
        cardHeight: 102,
      };
  }
}

/**
 * Calcula o deslocamento vertical (translateY) de cada slot quando um cartão
 * é espiado, garantindo que:
 * 1. Nenhum cartão no topo seja cortado pela borda superior da carteira.
 * 2. Nenhum cartão cubra o cartão de cima.
 * 3. A parte inferior de todos os cartões continue sempre dentro do bolso de couro.
 */
function getTargetTranslateY(slotIndex, activeSlotIndex, totalSlots) {
  if (activeSlotIndex === null || activeSlotIndex === undefined) {
    return 0;
  }
  if (activeSlotIndex === totalSlots - 1) {
    // Último cartão (logo atrás do bolso frontal FINN WALLET):
    // Sobe levemente os anteriores (-10px) e sobe o último (-20px) para abrir espaço sem sair do bolso
    if (slotIndex < activeSlotIndex) return -10;
    return -20;
  }
  // Cartão intermediário ou primeiro:
  // Cartões até o selecionado sobem suavemente (-10px) e cartões abaixo descem (+15px) abrindo a janela do slot
  if (slotIndex <= activeSlotIndex) {
    return -10;
  }
  return 15;
}

/**
 * Carteira Masculina Porta-Cartões de Couro (FINN WALLET)
 * Exibe apenas as abas superiores dos cartões encaixados nos slots de couro,
 * sem exibir o cartão completo para fora do bolso.
 */
export default function WalletCardHolder({
  cards = [],
  onSelectCard,
  onOpenCardDetails,
  resetTrigger = 0,
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

  // activeSlotIndex: null = todos os cartões guardados igualmente nos slots (padrão em "Todos")
  // 0..N-1 = cartão levemente espiado dentro do próprio slot
  const [activeSlotIndex, setActiveSlotIndex] = useState(null);
  const activeSlotIndexRef = useRef(null);
  activeSlotIndexRef.current = activeSlotIndex;

  const pageCardsRef = useRef(pageCards);
  pageCardsRef.current = pageCards;

  // Dicionário de Animated.Value por card.id
  const animTranslateYRef = useRef({});
  const walletScaleAnim = useRef(new Animated.Value(0.97)).current;
  const walletOpacityAnim = useRef(new Animated.Value(0)).current;

  pageCards.forEach((c) => {
    if (!animTranslateYRef.current[c.id]) {
      animTranslateYRef.current[c.id] = new Animated.Value(24);
    }
  });

  // Animação suave de entrada ao abrir a aba "Todos" ou trocar de página
  useEffect(() => {
    setActiveSlotIndex(null);
    activeSlotIndexRef.current = null;

    walletScaleAnim.setValue(0.97);
    walletOpacityAnim.setValue(0);

    pageCards.forEach((card) => {
      if (!animTranslateYRef.current[card.id]) {
        animTranslateYRef.current[card.id] = new Animated.Value(24);
      } else {
        animTranslateYRef.current[card.id].setValue(24);
      }
    });

    const slotAnimations = pageCards.map((card) =>
      Animated.spring(animTranslateYRef.current[card.id], {
        toValue: 0,
        friction: 7,
        tension: 60,
        useNativeDriver: true,
      })
    );

    Animated.parallel([
      Animated.timing(walletOpacityAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(walletScaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 65,
        useNativeDriver: true,
      }),
      Animated.stagger(55, slotAnimations),
    ]).start();
  }, [currentPage, pageCards.length, resetTrigger]);

  // Anima suavemente o deslocamento de cada slot quando activeSlotIndex muda
  const animateSlotsToIndex = useCallback((nextIndex) => {
    const currentList = pageCardsRef.current;
    const count = currentList.length;

    currentList.forEach((card, i) => {
      let anim = animTranslateYRef.current[card.id];
      if (!anim) {
        anim = new Animated.Value(0);
        animTranslateYRef.current[card.id] = anim;
      }
      const toValue = getTargetTranslateY(i, nextIndex, count);
      Animated.spring(anim, {
        toValue,
        friction: 8,
        tension: 70,
        useNativeDriver: true,
      }).start();
    });
  }, []);

  const selectSlotIndex = useCallback(
    (nextIndex) => {
      activeSlotIndexRef.current = nextIndex;
      setActiveSlotIndex(nextIndex);
      animateSlotsToIndex(nextIndex);

      if (nextIndex !== null && pageCardsRef.current[nextIndex]) {
        onSelectCard?.(pageCardsRef.current[nextIndex]);
      }
    },
    [animateSlotsToIndex, onSelectCard]
  );

  const handleSwipeUp = useCallback(() => {
    const count = pageCardsRef.current.length;
    if (count === 0) return;
    const cur = activeSlotIndexRef.current;
    // Ao deslizar para cima: espia o primeiro cartão (0), depois o próximo (1), etc.
    const next = cur === null ? 0 : Math.min(cur + 1, count - 1);
    selectSlotIndex(next);
  }, [selectSlotIndex]);

  const handleSwipeDown = useCallback(() => {
    const count = pageCardsRef.current.length;
    if (count === 0) return;
    const cur = activeSlotIndexRef.current;
    // Ao deslizar para baixo: volta para o cartão anterior ou guarda todos (null)
    if (cur === null) return;
    const next = cur > 0 ? cur - 1 : null;
    selectSlotIndex(next);
  }, [selectSlotIndex]);

  const swipeHandledRef = useRef(false);

  // PanResponder fluido para deslizar verticalmente sobre a carteira
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dy) > 9 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.1
        );
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return (
          Math.abs(gestureState.dy) > 9 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.1
        );
      },
      onPanResponderGrant: () => {
        swipeHandledRef.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        if (swipeHandledRef.current) return;
        if (gestureState.dy < -20) {
          swipeHandledRef.current = true;
          handleSwipeUp();
        } else if (gestureState.dy > 20) {
          swipeHandledRef.current = true;
          handleSwipeDown();
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (!swipeHandledRef.current) {
          if (gestureState.dy < -14) {
            handleSwipeUp();
          } else if (gestureState.dy > 14) {
            handleSwipeDown();
          }
        }
        swipeHandledRef.current = false;
      },
    })
  ).current;

  const handleCardPress = (card, i) => {
    if (activeSlotIndex === i) {
      // Toque novamente no cartão já espiado guarda ele de volta no slot
      selectSlotIndex(null);
    } else {
      // Espia suavemente o cartão dentro do slot
      selectSlotIndex(i);
    }
  };

  if (!cards || cards.length === 0) {
    return null;
  }

  const activeCard =
    activeSlotIndex !== null && pageCards[activeSlotIndex]
      ? pageCards[activeSlotIndex]
      : null;

  return (
    <Animated.View
      style={[
        styles.walletWrapper,
        {
          opacity: walletOpacityAnim,
          transform: [{ scale: walletScaleAnim }],
        },
      ]}
    >
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
        {/* CARTÕES E DIVISÓRIAS DE COURO RENDERIZADOS EM ORDEM ESTRITA DE CAMADA */}
        {/* Cada cartão fica sempre ATRÁS da divisória do próximo slot e ATRÁS do bolso frontal */}
        {pageCards.map((card, i) => {
          const theme = getBankTheme(card.bankId || card.bank || card.name);
          const topOffset = layout.slotTops[i] ?? 18;
          const isPeeked = activeSlotIndex === i;

          // Z-index estrito de slot físico: nunca ultrapassa o próximo slot nem o bolso frontal (30)
          const lipZ = i * 2 + 1;
          const cardZ = i * 2 + 2;

          let anim = animTranslateYRef.current[card.id];
          if (!anim) {
            anim = new Animated.Value(0);
            animTranslateYRef.current[card.id] = anim;
          }

          const digits = card.lastFourDigits ? String(card.lastFourDigits).slice(-4) : '';
          const digitsDisplay = digits ? `•••• ${digits}` : '••••';

          const invoiceAmount = Number(card.currentInvoice || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });

          const dueText = card.dueDay ? `Vence dia ${card.dueDay}` : 'Fatura aberta';

          return (
            <React.Fragment key={card.id || `card-${i}`}>
              {/* Divisória de couro com costura tracejada que acompanha o movimento do slot */}
              {i > 0 && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.leatherSlotLip,
                    {
                      top: topOffset - 4,
                      zIndex: lipZ,
                      elevation: lipZ,
                      transform: [{ translateY: anim }],
                    },
                  ]}
                >
                  <LinearGradient
                    colors={['#27374D', '#1B2636']}
                    style={styles.slotLipGradient}
                  >
                    <View style={styles.stitchDashedLine} />
                  </LinearGradient>
                </Animated.View>
              )}

              {/* Aba do Cartão dentro do Slot (nunca exibe o cartão completo para fora) */}
              <Animated.View
                style={[
                  styles.cardSlotItem,
                  {
                    top: topOffset,
                    height: layout.cardHeight,
                    zIndex: cardZ,
                    elevation: cardZ,
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
                      isPeeked && styles.cardGradientPeeked,
                    ]}
                  >
                    {/* Borda superior iluminada */}
                    <View
                      style={[
                        styles.cardTopHighlight,
                        isPeeked && styles.cardTopHighlightActive,
                      ]}
                    />

                    {/* Topo visível do cartão no slot: Marca + Final + Resumo da Fatura */}
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.cardHeaderLeft}>
                        <WalletCardBrand theme={theme} cardName={card.name} />
                        <Text
                          style={[
                            styles.cardBrandBadgeText,
                            { color: theme.secondaryTextColor || 'rgba(255,255,255,0.8)' },
                          ]}
                        >
                          {digitsDisplay}
                        </Text>
                      </View>

                      <View style={styles.cardHeaderRight}>
                        <Text
                          style={[
                            styles.cardSlotInvoiceText,
                            { color: theme.textColor || '#FFFFFF' },
                          ]}
                        >
                          R$ {invoiceAmount}
                        </Text>
                        <ContactlessIcon
                          color={theme.secondaryTextColor || 'rgba(255,255,255,0.85)'}
                          size={13}
                        />
                      </View>
                    </View>

                    {/* Faixa de resumo rápido visível apenas na fresta ao espiar o slot */}
                    <View style={styles.cardPeekMetaRow}>
                      <Text
                        style={[
                          styles.cardPeekSubText,
                          { color: theme.secondaryTextColor || 'rgba(255,255,255,0.85)' },
                        ]}
                        numberOfLines={1}
                      >
                        {dueText}
                      </Text>
                      <View style={styles.cardPeekActionTag}>
                        <Text
                          style={[
                            styles.cardPeekActionText,
                            { color: theme.textColor || '#FFFFFF' },
                          ]}
                        >
                          {isPeeked ? 'Selecionado' : ''}
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </React.Fragment>
          );
        })}

        {/* BOLSO FRONTAL DE COURO DA CARTEIRA (SEMPRE À FRENTE DE TODOS OS CARTÕES) */}
        <View
          pointerEvents="none"
          style={[
            styles.walletFrontPocket,
            {
              top: layout.frontPocketTop,
              zIndex: 30,
              elevation: 30,
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

        {/* Costura perimétrica da carteira estilo couro clássico */}
        <View style={styles.outerStitchingBorder} pointerEvents="none" />
      </View>

      {/* RÓTULO INTERATIVO DISCRETO */}
      <View style={styles.interactiveHintRow}>
        <Ionicons name="finger-print-outline" size={14} color="#7C3AED" />
        <Text style={styles.interactiveHintText}>
          Deslize ou toque em uma aba para espiar • Resumo total abaixo
        </Text>
      </View>

      {/* BOTÃO OPCIONAL PARA ABRIR O CARTÃO ESPECÍFICO QUANDO ESPIADO */}
      {activeCard && onOpenCardDetails && (
        <TouchableOpacity
          style={styles.detailButton}
          activeOpacity={0.8}
          onPress={() => onOpenCardDetails(activeCard)}
        >
          <Text style={styles.detailButtonText}>
            Abrir fatura do {activeCard.name || activeCard.bank || 'Cartão'}
          </Text>
          <Ionicons name="arrow-forward" size={14} color="#7C3AED" />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  walletWrapper: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 6,
    marginBottom: 4,
  },
  walletBody: {
    width: WALLET_WIDTH,
    backgroundColor: '#182333',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#2D3E54',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  outerStitchingBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(235, 240, 255, 0.22)',
    borderStyle: 'dashed',
    margin: 4,
    zIndex: 42,
    elevation: 42,
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
    paddingTop: 7,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  cardGradientPeeked: {
    borderColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1.5,
  },
  cardTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  cardTopHighlightActive: {
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandNuText: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  brandC6Text: {
    fontSize: 14,
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
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    opacity: 0.85,
  },
  cardSlotInvoiceText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  cardPeekMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cardPeekSubText: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  cardPeekActionTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  cardPeekActionText: {
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    borderTopColor: 'rgba(255, 255, 255, 0.14)',
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
  },
  frontPocketGradient: {
    flex: 1,
    paddingTop: 7,
    paddingHorizontal: 14,
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.22)',
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
    color: 'rgba(255, 255, 255, 0.36)',
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
    marginBottom: 2,
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
    marginTop: 6,
  },
  detailButtonText: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '700',
  },
});
