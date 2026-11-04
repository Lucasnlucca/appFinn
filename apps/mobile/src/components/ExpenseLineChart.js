import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { COLORS } from '../theme/colors';

export default function ExpenseLineChart({
  data = [],
  peakFormatted = 'R$ 0,00',
}) {
  const chartHeight = 110;
  const chartWidth = 230;

  // Garante dados seguros sem crash caso vazio
  const monthLabels = ['Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out'];
  const safeData = data && data.length >= 2 ? data : monthLabels.map((m) => ({ month: m, value: 0 }));

  const rawMax = Math.max(...safeData.map((d) => d.value || 0), 0);
  const maxValue = rawMax > 0 ? rawMax * 1.25 : 1000;

  const formatAxis = (val) => {
    if (val >= 1000) {
      return `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}K`;
    }
    return `${Math.round(val)}`;
  };

  // Calcula coordenadas dos pontos
  const points = safeData.map((d, index) => {
    const x = 15 + (index * (chartWidth - 30)) / (safeData.length - 1);
    const normalizedY = 1 - Math.min(Math.max(d.value, 0), maxValue) / maxValue;
    const y = 18 + normalizedY * (chartHeight - 32);
    return { x, y, ...d };
  });

  // Cria caminho suave (curva cúbica de Bézier aproximada)
  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const mx = (p0.x + p1.x) / 2;
    linePath += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  // Caminho de área fechada para o gradiente abaixo da linha
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`;

  // Ponto de destaque (último / pico)
  const lastPoint = points[points.length - 1];

  return (
    <View style={styles.container}>
      {/* TOOLTIP DO VALOR DO PICO (NO CANTO SUPERIOR DIREITO) */}
      <View style={styles.tooltipPill}>
        <Text style={styles.tooltipText}>{peakFormatted}</Text>
      </View>

      <View style={styles.chartRow}>
        {/* EIXO Y */}
        <View style={styles.yAxisWrap}>
          <Text style={styles.axisLabel}>{formatAxis(maxValue)}</Text>
          <Text style={styles.axisLabel}>{formatAxis(maxValue * 0.75)}</Text>
          <Text style={styles.axisLabel}>{formatAxis(maxValue * 0.5)}</Text>
          <Text style={styles.axisLabel}>{formatAxis(maxValue * 0.25)}</Text>
          <Text style={styles.axisLabel}>0</Text>
        </View>

        {/* ÁREA SVG DO GRÁFICO */}
        <View style={styles.svgWrap}>
          <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
            <Defs>
              <LinearGradient id="lineFillGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.45" />
                <Stop offset="70%" stopColor="#C084FC" stopOpacity="0.12" />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
              </LinearGradient>
            </Defs>

            {/* Linhas de grade horizontais sutis */}
            <Path
              d={`M 0 18 L ${chartWidth} 18 M 0 40 L ${chartWidth} 40 M 0 63 L ${chartWidth} 63 M 0 85 L ${chartWidth} 85`}
              stroke="rgba(124, 58, 237, 0.08)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />

            {/* Preenchimento de Área Gradiente */}
            <Path d={areaPath} fill="url(#lineFillGrad)" />

            {/* Linha Contínua Roxa */}
            <Path
              d={linePath}
              stroke="#8B5CF6"
              strokeWidth="2.8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Pontos nos nós do gráfico */}
            {points.map((pt, idx) => (
              <Circle
                key={`dot-${idx}`}
                cx={pt.x}
                cy={pt.y}
                r={idx === points.length - 1 ? 4.5 : 3.5}
                fill={idx === points.length - 1 ? '#7C3AED' : '#FFFFFF'}
                stroke="#7C3AED"
                strokeWidth={idx === points.length - 1 ? 2.5 : 2}
              />
            ))}
          </Svg>
        </View>
      </View>

      {/* EIXO X (MESES: Mai, Jun, Jul, Ago, Set, Out) */}
      <View style={styles.xAxisRow}>
        <View style={{ width: 28 }} />
        <View style={styles.monthsWrap}>
          {data.map((item, idx) => (
            <Text
              key={`month-${idx}`}
              style={[
                styles.monthLabel,
                idx === data.length - 1 && styles.monthLabelActive,
              ]}
            >
              {item.month}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 4,
  },
  tooltipPill: {
    alignSelf: 'flex-end',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  yAxisWrap: {
    width: 26,
    height: 110,
    justifyContent: 'space-between',
    paddingVertical: 2,
    alignItems: 'flex-start',
  },
  axisLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#A1A1AA',
  },
  svgWrap: {
    flex: 1,
    height: 110,
    overflow: 'hidden',
  },
  xAxisRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  monthsWrap: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  monthLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#71717A',
  },
  monthLabelActive: {
    color: '#7C3AED',
    fontWeight: '800',
  },
});

