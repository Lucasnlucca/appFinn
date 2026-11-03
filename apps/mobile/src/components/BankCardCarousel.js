import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import BankCard from './BankCard';
import { getBankTheme } from '../constants/BankThemeRegistry';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40; // 20px de padding em cada lado

export default function BankCardCarousel({
  cards = [],
  activeCardId,
  onSelectCard,
  userName = 'NOME SOBRENOME',
}) {
  const scrollRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Sincroniza index quando activeCardId muda externamente
  useEffect(() => {
    if (!cards || cards.length === 0) return;
    const foundIdx = cards.findIndex((c) => c.id === activeCardId);
    if (foundIdx >= 0 && foundIdx !== currentIndex) {
      setCurrentIndex(foundIdx);
      scrollRef.current?.scrollTo({
        x: foundIdx * CARD_WIDTH,
        animated: true,
      });
    }
  }, [activeCardId, cards]);

  if (!cards || cards.length === 0) {
    return (
      <View style={styles.carouselContainer}>
        <BankCard
          bankId="nubank"
          holderName={userName}
          lastFourDigits="4568"
          expiryMonth="10"
          expiryYear="26"
        />
      </View>
    );
  }

  // Se houver apenas 1 cartão, exibe centralizado sem scroll
  if (cards.length === 1) {
    const card = cards[0];
    const theme = getBankTheme(card.bankId || card.bank || card.name);

    return (
      <View style={styles.carouselContainer}>
        <BankCard
          bankId={theme.bankId}
          cardId={card.id}
          holderName={card.holderName || userName}
          lastFourDigits={card.lastFourDigits || String(card.dueDay || '4568')}
          expiryMonth={card.expiryMonth || '10'}
          expiryYear={card.expiryYear || '26'}
        />
      </View>
    );
  }

  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / CARD_WIDTH);
    if (index >= 0 && index < cards.length && index !== currentIndex) {
      setCurrentIndex(index);
      onSelectCard?.(cards[index]);
    }
  };

  const handleDotPress = (index) => {
    setCurrentIndex(index);
    scrollRef.current?.scrollTo({
      x: index * CARD_WIDTH,
      animated: true,
    });
    onSelectCard?.(cards[index]);
  };

  return (
    <View style={styles.carouselContainer}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH}
        snapToAlignment="center"
        contentContainerStyle={styles.scrollContent}
      >
        {cards.map((card) => {
          const theme = getBankTheme(card.bankId || card.bank || card.name);

          return (
            <View key={card.id} style={{ width: CARD_WIDTH }}>
              <BankCard
                bankId={theme.bankId}
                cardId={card.id}
                holderName={card.holderName || userName}
                lastFourDigits={card.lastFourDigits || String(card.dueDay || '4568')}
                expiryMonth={card.expiryMonth || '10'}
                expiryYear={card.expiryYear || '26'}
              />
            </View>
          );
        })}
      </ScrollView>

      {/* Indicadores de Paginação / Dots */}
      <View style={styles.paginationRow}>
        {cards.map((card, idx) => {
          const isActive = idx === currentIndex;
          return (
            <TouchableOpacity
              key={card.id}
              onPress={() => handleDotPress(idx)}
              activeOpacity={0.7}
              style={[
                styles.dot,
                isActive && styles.dotActive,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carouselContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  scrollContent: {
    alignItems: 'center',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#D8B4FE',
  },
  dotActive: {
    width: 20,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#7C3AED',
  },
});

