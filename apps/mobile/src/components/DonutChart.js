import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { COLORS } from '../theme/colors';

// 1. Gráfico Donut de Progresso do Orçamento (Usado na Home: "Resumo do Mês")
export function BudgetDonut({
  percent = 66,
  size = 114,
  strokeWidth = 11,
  centerValue = '66%',
  centerLabel = 'Do orçamento',
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(Math.max(percent, 0), 100) / 100) * circumference;

  return (
    <View style={[styles.donutWrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="budgetGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#7C3AED" />
            <Stop offset="50%" stopColor="#9333EA" />
            <Stop offset="100%" stopColor="#EC4899" />
          </LinearGradient>
        </Defs>

        {/* Círculo de fundo / trilha */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E9D5FF"
          strokeWidth={strokeWidth}
          strokeOpacity={0.45}
          fill="none"
        />

        {/* Círculo de progresso com gradiente e borda arredondada */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#budgetGrad)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          originX={size / 2}
          originY={size / 2}
          rotation="-90"
        />
      </Svg>

      <View style={styles.centerTextWrap} pointerEvents="none">
        <Text style={styles.centerValueText}>{centerValue}</Text>
        <Text style={styles.centerLabelText}>{centerLabel}</Text>
      </View>
    </View>
  );
}

// 2. Gráfico Donut Multi-Segmento (Usado em Análises: "Gastos por categoria")
export function MultiCategoryDonut({
  segments = [],
  totalFormatted = 'R$ 5.430,90',
  size = 138,
  strokeWidth = 14,
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Garante que a soma total seja calculada
  const totalValue = segments.reduce((sum, s) => sum + (s.value || 0), 0) || 1;

  let currentAngle = -90;

  return (
    <View style={[styles.donutWrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Base de fundo */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#F3E8FF"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {segments.map((segment, index) => {
          const percent = segment.percent
            ? segment.percent / 100
            : (segment.value || 0) / totalValue;
          const strokeLength = percent * circumference;
          const strokeDashoffset = circumference - strokeLength;
          const rotationAngle = currentAngle;

          currentAngle += percent * 360;

          return (
            <Circle
              key={`seg-${index}-${segment.color}`}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={segment.color || COLORS.primary}
              strokeWidth={strokeWidth}
              strokeDasharray={`${strokeLength} ${circumference}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              fill="none"
              originX={size / 2}
              originY={size / 2}
              rotation={rotationAngle}
            />
          );
        })}
      </Svg>

      <View style={styles.centerTextWrap} pointerEvents="none">
        <Text style={styles.categoryTotalValue} numberOfLines={1}>
          {totalFormatted}
        </Text>
        <Text style={styles.categoryTotalLabel}>Total</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  donutWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  centerTextWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  centerValueText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#18181B',
    letterSpacing: -0.5,
  },
  centerLabelText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#71717A',
    marginTop: 1,
  },
  categoryTotalValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#18181B',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  categoryTotalLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#71717A',
    marginTop: 2,
  },
});

