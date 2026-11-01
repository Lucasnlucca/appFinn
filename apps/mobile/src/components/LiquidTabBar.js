import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Configuração dos 5 slots do menu inferior
const TAB_CONFIG = {
  Home: {
    label: 'Início',
    activeIcon: 'home',
    inactiveIcon: 'home-outline',
    slotIndex: 0,
  },
  Transactions: {
    label: 'Extrato',
    activeIcon: 'receipt',
    inactiveIcon: 'receipt-outline',
    slotIndex: 1,
  },
  AddAction: {
    label: '',
    slotIndex: 2,
    isAction: true,
  },
  Planning: {
    label: 'Metas',
    activeIcon: 'grid',
    inactiveIcon: 'grid-outline',
    slotIndex: 3,
  },
  Mais: {
    label: 'Mais',
    activeIcon: 'menu',
    inactiveIcon: 'menu-outline',
    slotIndex: 4,
  },
  Settings: {
    label: 'Mais',
    activeIcon: 'menu',
    inactiveIcon: 'menu-outline',
    slotIndex: 4,
  },
};

export default function LiquidTabBar({ state, descriptors, navigation, onAddPress }) {
  const [barWidth, setBarWidth] = useState(SCREEN_WIDTH - 32);
  const slotWidth = (barWidth - 12) / 5;

  // Identifica a aba ativa atual (exceto o botão de ação central)
  const currentRouteName = state.routes[state.index]?.name || 'Home';
  const activeSlotIndex = TAB_CONFIG[currentRouteName]?.slotIndex ?? 0;

  // Valor animado do deslocamento da cápsula "liquid glass"
  const translateX = useRef(new Animated.Value(activeSlotIndex * slotWidth)).current;

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: activeSlotIndex * slotWidth,
      friction: 9,
      tension: 68,
      useNativeDriver: true,
    }).start();
  }, [activeSlotIndex, slotWidth]);

  return (
    <View
      style={styles.barContainer}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - barWidth) > 2) {
          setBarWidth(w);
        }
      }}
    >
      {/* Camada de Blur Glassmorphism */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 80 : 90}
        tint="light"
        style={StyleSheet.absoluteFill}
      />

      {/* CÁPSULA DESLIZANTE LIQUID GLASS (INSPIRADA NO MODELO) */}
      <Animated.View
        style={[
          styles.slidingIndicator,
          {
            width: slotWidth - 4,
            transform: [{ translateX }],
          },
        ]}
      />

      {/* ITENS DO MENU */}
      <View style={styles.tabsRow}>
        {state.routes.map((route, index) => {
          const config = TAB_CONFIG[route.name] || {
            label: route.name,
            activeIcon: 'ellipse',
            inactiveIcon: 'ellipse-outline',
            slotIndex: index,
          };

          const isFocused = state.index === index;

          // Slot central (+) abre modal de lançamento
          if (config.isAction) {
            return (
              <TouchableOpacity
                key={route.key || 'add-btn'}
                style={[styles.tabItem, { width: slotWidth }]}
                onPress={onAddPress}
                activeOpacity={0.8}
              >
                <View style={styles.centerAddButton}>
                  <Ionicons name="add" size={24} color={COLORS.white} />
                </View>
              </TouchableOpacity>
            );
          }

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              style={[styles.tabItem, { width: slotWidth }]}
              onPress={onPress}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isFocused ? config.activeIcon : config.inactiveIcon}
                size={21}
                color={isFocused ? '#0284C7' : '#334155'}
              />
              <Text
                style={[
                  styles.tabLabel,
                  isFocused ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
                numberOfLines={1}
              >
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: Platform.OS === 'ios' ? 24 : 16,
    height: 64,
    borderRadius: 34,
    backgroundColor:
      Platform.OS === 'ios' ? 'rgba(255, 255, 255, 0.72)' : 'rgba(255, 255, 255, 0.90)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    shadowColor: '#0A192F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 14,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  slidingIndicator: {
    position: 'absolute',
    top: 7,
    left: 8,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: 'rgba(2, 132, 199, 0.20)',
    shadowColor: '#0A192F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    height: '100%',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingVertical: 2,
    zIndex: 2,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
    letterSpacing: -0.2,
  },
  tabLabelActive: {
    color: '#0284C7',
    fontWeight: '800',
  },
  tabLabelInactive: {
    color: '#64748B',
    fontWeight: '600',
  },
  centerAddButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
});
