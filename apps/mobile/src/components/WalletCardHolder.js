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
const WALLET_WIDTH = Math.min(SCREEN_WIDTH - 36, 420);
const CARDS_PER_PAGE = 4;
const ELEVATION_PX = -48;

// Símbolo Contactless
function ContactlessIcon({ color = '#FFFFFF', size = 15 }) {
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
 * Retorna as dimensões dinâmicas dos slots e da carteira conforme a quantidade de cartões.
 */
function getWalletLayout(cardCount) {
  const count = Math.max(1, Math.min(4, cardCount));
  switch (count) {
    case 1:
      return {
        slotTops: [20],
        walletHeight: 220,
        frontPocketTop: 110,
        cardHeight: 140,
      };
    case 2:
      return {
        slotTops: [16, 68],
        walletHeight: 235,
        frontPocketTop: 135,
        cardHeight: 140,
      };
    case 3:
      return {
        slotTops: [14, 58, 102],
        walletHeight: 250,
        frontPocketTop: 155,
        cardHeight: 140,
      };
    case 4:
    default:
      return {
        slotTops: [12, 54, 96, 138],
        walletHeight: 265,
        frontPocketTop: 178,
        cardHeight: 140,
      };
  }
}

/**
 * Calcula dinamicamente o índice do slot correspondente à coordenada relativa Y.
 */
function getSlotIndexFromRelativeY(relY, slotTops) {
  const count = slotTops.length;
  if (count <= 1) return 0;
  for (let i = 0; i < count - 1; i++) {
    const threshold = (slotTops[i] + slotTops[i + 1]) / 2 + 10;
    if (relY < threshold) {
      return i;
    }
  }
  return count - 1;
}

/**
 * Componente Carteira Masculina Interativa (FINN Wallet)
 * 
 * Permite deslizar o dedo verticalmente sobre os cartões para elevá-los fluidamente.
 * Um toque em cartão não selecionado eleva-o; um toque no cartão já selecionado abre detalhes.
 */
export default function WalletCardHolder({
  cards = [],
  onSelectCard,
  activeCardId,
}) {
  const totalCards = cards.length;
  const totalPages = Math.ceil(totalCards / CARDS_PER_PAGE);
  const [currentPage, setCurrentPage] = useState(0);

  // Cartões visíveis na página atual (máximo 4 por harmonia visual de carteira física)
  const pageCards = useMemo(() => {
    if (totalCards <= CARDS_PER_PAGE) return cards;
    const start = currentPage * CARDS_PER_PAGE;
    return cards.slice(start, start + CARDS_PER_PAGE);
  }, [cards, currentPage, totalCards]);

  const layout = useMemo(() => getWalletLayout(pageCards.length), [pageCards.length]);

  // ID do cartão atualmente selecionado/elevado
  const initialCardId = activeCardId || pageCards[0]?.id || cards[0]?.id;
  const [selectedCardId, setSelectedCardId] = useState(initialCardId);
  const selectedCardIdRef = useRef(initialCardId);

  // Refs de estado para evitar stale closures em callbacks e no PanResponder
  const pageCardsRef = useRef(pageCards);
  pageCardsRef.current = pageCards;

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  // Dicionário de Animated.Value mapeado por card.id (persistente mesmo com reordenamento)
  const animElevationsRef = useRef({});

  // Garante que cada cartão tenha seu Animated.Value correspondente
  pageCards.forEach((c) => {
    if (!animElevationsRef.current[c.id]) {
      animElevationsRef.current[c.id] = new Animated.Value(
        c.id === selectedCardIdRef.current ? ELEVATION_PX : 0
      );
    }
  });

  // Eleva o cartão especificado com animação fluida (spring native driver)
  const elevateCard = useCallback((targetCardId) => {
    if (!targetCardId) return;
    if (targetCardId === selectedCardIdRef.current) {
      return; // Já está selecionado — evita reiniciar animação a cada pixel
    }

    selectedCardIdRef.current = targetCardId;
    setSelectedCardId(targetCardId);

    // Anima todos os cartões da página atual
    pageCardsRef.current.forEach((card) => {
      let anim = animElevationsRef.current[card.id];
      if (!anim) {
        anim = new Animated.Value(0);
        animElevationsRef.current[card.id] = anim;
      }

      const toValue = card.id === targetCardId ? ELEVATION_PX : 0;
      Animated.spring(anim, {
        toValue,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }).start();
    });
  }, []);

  // Sincroniza se activeCardId mudar externamente (ex: filtro bancário alterado)
  useEffect(() => {
    if (!cards || cards.length === 0) return;
    if (activeCardId) {
      const cardIdx = cards.findIndex((c) => c.id === activeCardId);
      if (cardIdx >= 0) {
        const targetPage = Math.floor(cardIdx / CARDS_PER_PAGE);
        if (targetPage !== currentPage) {
          setCurrentPage(targetPage);
        }
        elevateCard(activeCardId);
      }
    }
  }, [activeCardId, cards, currentPage, elevateCard]);

  // Se a página mudar e o cartão selecionado não estiver nela, seleciona o primeiro da nova página
  useEffect(() => {
    if (pageCards.length === 0) return;
    const isSelectedInPage = pageCards.some((c) => c.id === selectedCardIdRef.current);
    if (!isSelectedInPage) {
      const firstCardId = pageCards[0].id;
      elevateCard(firstCardId);
    }
  }, [currentPage, pageCards, elevateCard]);

  // Medição confiável de coordenadas da carteira na janela
  const walletContainerRef = useRef(null);
  const walletLayoutRef = useRef({ pageX: 0, pageY: 0, width: WALLET_WIDTH, height: 265 });

  const measureWallet = useCallback(() => {
    if (walletContainerRef.current?.measureInWindow) {
      walletContainerRef.current.measureInWindow((x, y, w, h) => {
        if (y !== undefined && !isNaN(y)) {
          walletLayoutRef.current = { pageX: x, pageY: y, width: w, height: h };
        }
      });
    }
  }, []);

  // Calcula a coordenada Y relativa ao topo da carteira
  const getRelativeY = useCallback((evt, gestureState) => {
    const touchPageY = evt?.nativeEvent?.pageY ?? gestureState?.moveY ?? 0;
    if (walletLayoutRef.current.pageY > 0) {
      return touchPageY - walletLayoutRef.current.pageY;
    }
    return evt?.nativeEvent?.locationY ?? 0;
  }, []);

  // Handler de processamento do gesto de arrasto
  const handlePanInput = useCallback((evt, gestureState) => {
    const relY = getRelativeY(evt, gestureState);
    const targetIdx = getSlotIndexFromRelativeY(relY, layoutRef.current.slotTops);
    const targetCard = pageCardsRef.current[targetIdx];
    if (targetCard && targetCard.id !== selectedCardIdRef.current) {
      elevateCard(targetCard.id);
    }
  }, [getRelativeY, elevateCard]);

  // PanResponder configurado para não roubar cliques simples (pass-through para TouchableOpacity)
  // e capturar somente movimentação deliberada vertical pela carteira (> 7px)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,

      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isVertical =
          Math.abs(gestureState.dy) > 7 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2;
        return isVertical;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        const isVertical =
          Math.abs(gestureState.dy) > 7 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2;
        return isVertical;
      },

      onPanResponderGrant: (evt, gestureState) => {
        measureWallet();
        handlePanInput(evt, gestureState);
      },

      onPanResponderMove: (evt, gestureState) => {
        handlePanInput(evt, gestureState);
      },

      onPanResponderRelease: () => {
        // Ao soltar o dedo, o cartão atual permanece elevado. Não retorna ao primeiro e não abre detalhes.
      },
      onPanResponderTerminate: () => {
        // Cartão atual permanece elevado.
      },
    })
  ).current;

  // Ao tocar diretamente em um cartão:
  // Se já estiver elevado -> abre detalhes
  // Se não estiver elevado -> apenas eleva
  const handleCardPress = (card) => {
    if (selectedCardIdRef.current === card.id) {
      onSelectCard?.(card);
    } else {
      elevateCard(card.id);
    }
  };

  if (!cards || cards.length === 0) {
    return (
      <View style={styles.emptyWalletBox}>
        <Ionicons name="card-outline" size={32} color="#6B7280" />
        <Text style={styles.emptyWalletText}>Nenhum cartão cadastrado</Text>
      </View>
    );
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
                style={[
                  styles.pagePill,
                  isCurPage && styles.pagePillActive,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.pagePillText,
                    isCurPage && styles.pagePillTextActive,
                  ]}
                >
                  Cartões {startNum}-{endNum}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* CORPO DE COURO DA CARTEIRA MASCULINA */}
      <View
        ref={walletContainerRef}
        onLayout={() => measureWallet()}
        style={[styles.walletBody, { height: layout.walletHeight }]}
        {...panResponder.panHandlers}
      >
        {/* Costura perimétrica da carteira estilo couro clássico */}
        <View style={styles.outerStitchingBorder} pointerEvents="none" />

        {/* CARTÕES INSERIDOS NOS SLOTS (STACK ORDENADO DINAMICAMENTE) */}
        {pageCards.map((card, i) => {
          const theme = getBankTheme(card.bankId || card.bank || card.name);
          const topOffset = layout.slotTops[i] ?? 12;
          const isElevated = selectedCardId === card.id;

          // Layering consistente no Android e iOS:
          // Em repouso: cartões inferiores ficam à frente dos superiores (i * 2 + 1)
          // Em elevação: cartão elevado vai para o topo absoluto (zIndex: 50, elevation: 20)
          const restingZ = (i + 1) * 2;
          const itemZIndex = isElevated ? 50 : restingZ;
          const itemElevation = isElevated ? 20 : restingZ;

          // Recupera ou cria Animated.Value do cartão
          let anim = animElevationsRef.current[card.id];
          if (!anim) {
            anim = new Animated.Value(isElevated ? ELEVATION_PX : 0);
            animElevationsRef.current[card.id] = anim;
          }

          // Formatação neutra de dados (sem números fictícios)
          const digits = card.lastFourDigits ? String(card.lastFourDigits).slice(-4) : '';
          const digitsDisplay = digits ? `•••• ${digits}` : '•••• ••••';

          const holderDisplay = card.holderName
            ? String(card.holderName).toUpperCase().trim()
            : (card.name || card.bank || 'CARTÃO').toUpperCase();

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
                  height: layout.cardHeight,
                  zIndex: itemZIndex,
                  elevation: itemElevation,
                  transform: [{ translateY: anim }],
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => handleCardPress(card)}
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

                  {/* Linha superior visível da borda do cartão na carteira */}
                  <View style={styles.cardHeaderRow}>
                    <WalletCardBrand theme={theme} />

                    <View style={styles.cardHeaderRight}>
                      <Text
                        style={[
                          styles.cardDigitsMini,
                          { color: theme.secondaryTextColor || 'rgba(255,255,255,0.85)' },
                        ]}
                      >
                        {digitsDisplay}
                      </Text>
                      <ContactlessIcon
                        color={theme.secondaryTextColor || 'rgba(255,255,255,0.85)'}
                        size={15}
                      />
                    </View>
                  </View>

                  {/* Corpo do cartão revelado quando elevado */}
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
                      {holderDisplay}
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* DIVISÓRIAS DE COURO COM COSTURA DUPLA REALISTA (ENTRE OS SLOTS) */}
        {pageCards.map((_, i) => {
          if (i === 0) return null;
          const lipTop = (layout.slotTops[i] ?? 56) + 4;
          const lipZIndex = (i + 1) * 2 - 1; // Fica entre o cartão anterior e o próximo

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
                colors={['#243044', '#17202E']}
                style={styles.slotLipGradient}
              >
                {/* Linha de costura clara tracejada no couro */}
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
              top: layout.frontPocketTop,
              zIndex: 40,
              elevation: 10,
            },
          ]}
        >
          <LinearGradient
            colors={['#263347', '#17202F', '#101722']}
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
      {selectedCard && (
        <TouchableOpacity
          style={styles.detailButton}
          activeOpacity={0.8}
          onPress={() => onSelectCard?.(selectedCard)}
        >
          <Text style={styles.detailButtonText}>
            Ver detalhes do {selectedCard.name || selectedCard.bank || 'Cartão'}
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
    paddingTop: 52, // RESERVA DE ESPAÇO NO TOPO: evita qualquer recorte do cartão elevado
    marginBottom: 8,
  },
  walletBody: {
    width: WALLET_WIDTH,
    backgroundColor: '#151C28',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#263449',
    overflow: 'visible', // Permite que o cartão elevado suba acima da boca da carteira
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  outerStitchingBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderStyle: 'dashed',
    margin: 4,
    zIndex: 45,
  },
  cardSlotItem: {
    position: 'absolute',
    left: 12,
    right: 12,
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
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 16,
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
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
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
  paginationPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  pagePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#F3EEFF',
  },
  pagePillActive: {
    backgroundColor: '#7C3AED',
  },
  pagePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  pagePillTextActive: {
    color: '#FFFFFF',
  },
  interactiveHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
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
  emptyWalletBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWalletText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
});
