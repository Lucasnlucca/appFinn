import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import AddTransactionModal from '../components/AddTransactionModal';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    totalBalance,
    totalIncome,
    totalExpense,
    resultadoDoMes,
    accounts,
    allBillsPaid,
    pendingBillsAmount,
    economizadoPercent,
    categoryBreakdown,
    activeMember,
    switchActiveMember,
    members,
    selectedMonth,
    setSelectedMonth,
    hideBalances,
    toggleHideBalances,
  } = useFinance();

  const [modalVisible, setModalVisible] = useState(false);

  // Formatação em Real (com suporte a ocultar valores)
  const formatMoney = (val) => {
    if (hideBalances) return 'R$ •••••••';
    return (
      'R$ ' +
      (val || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  const currentUserName = members.user1 || 'Lucas';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* HEADER SUPERIOR: LOGO, SELETOR DE MÊS, NOTIFICAÇÕES E PERFIL */}
      <View style={styles.topBar}>
        <View style={styles.brandGroup}>
          <View style={styles.appIconBadge}>
            <Ionicons name="wallet" size={18} color={COLORS.white} />
          </View>
          <Text style={styles.brandTitle}>FINN</Text>
        </View>

        {/* SELETOR DE MÊS NO CENTRO (< Out 2026 >) */}
        <TouchableOpacity style={styles.monthPill}>
          <Ionicons name="chevron-back" size={14} color={COLORS.textSecondary} />
          <Text style={styles.monthText}>{selectedMonth}</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* ÍCONES DA DIREITA: NOTIFICAÇÃO E AVATAR */}
        <View style={styles.rightIcons}>
          <TouchableOpacity style={styles.iconCircle}>
            <Ionicons name="notifications-outline" size={18} color={COLORS.text} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.avatarText}>
              {currentUserName.charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
      >
        {/* CARD HERO AZUL ESCURO: "RESULTADO DO MÊS" (IDÊNTICO À IMAGEM 3) */}
        <LinearGradient
          colors={[COLORS.navyGradientStart, COLORS.navyGradientEnd]}
          style={styles.heroCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* TOPO DO CARD */}
          <View style={styles.heroTop}>
            <View style={styles.heroTitleRow}>
              <Text style={styles.heroTitle}>RESULTADO DO MÊS</Text>
              <TouchableOpacity>
                <Ionicons
                  name="information-circle-outline"
                  size={15}
                  color="rgba(255,255,255,0.7)"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={toggleHideBalances} style={styles.eyeBtn}>
              <Ionicons
                name={hideBalances ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color="rgba(255,255,255,0.9)"
              />
            </TouchableOpacity>
          </View>

          {/* VALOR PRINCIPAL E GRÁFICO SPARKLINE */}
          <View style={styles.heroValueRow}>
            <View>
              <Text style={styles.heroValue}>{formatMoney(resultadoDoMes)}</Text>
              <View style={styles.trendingBadge}>
                <Ionicons name="arrow-up" size={11} color={COLORS.income} />
                <Text style={styles.trendingText}>40% vs. mês passado</Text>
              </View>
            </View>

            {/* CURVA DE TENDÊNCIA ESTILIZADA (SPARKLINE) */}
            <View style={styles.sparklineWrap}>
              <View style={styles.sparkDot1} />
              <View style={styles.sparkLine1} />
              <View style={styles.sparkDot2} />
              <View style={styles.sparkLine2} />
              <View style={styles.sparkDot3} />
            </View>
          </View>

          {/* SUB-CARDS INFERIORES: ENTRADAS E SAÍDAS */}
          <View style={styles.heroMetricsGrid}>
            <View style={styles.heroMetricPill}>
              <View style={styles.incomeArrowCircle}>
                <Ionicons name="arrow-down" size={14} color={COLORS.income} />
              </View>
              <View>
                <Text style={styles.metricPillLabel}>Entradas</Text>
                <Text style={styles.metricPillValue}>
                  {formatMoney(totalIncome)}
                </Text>
              </View>
            </View>

            <View style={styles.heroMetricPill}>
              <View style={styles.expenseArrowCircle}>
                <Ionicons name="arrow-up" size={14} color={COLORS.expense} />
              </View>
              <View>
                <Text style={styles.metricPillLabel}>Saídas</Text>
                <Text style={styles.metricPillValue}>
                  {formatMoney(totalExpense)}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* SEÇÃO "VISÃO GERAL" (3 MINI CARDS - IMAGEM 3 & 2) */}
        <Text style={styles.sectionHeaderTitle}>Visão geral</Text>
        <View style={styles.overviewGrid}>
          {/* CARD 1: NAS CONTAS */}
          <TouchableOpacity
            style={styles.overviewCard}
            onPress={() => navigation.navigate('Mais')}
          >
            <Ionicons name="wallet-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.overviewLabel}>Nas contas</Text>
            <Text style={styles.overviewValue} numberOfLines={1}>
              {formatMoney(totalBalance)}
            </Text>
          </TouchableOpacity>

          {/* CARD 2: FALTA PAGAR (TUDO PAGO) */}
          <TouchableOpacity
            style={styles.overviewCard}
            onPress={() => navigation.navigate('Planning')}
          >
            <Ionicons name="calendar-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.overviewLabel}>Falta pagar</Text>
            <Text
              style={[
                styles.overviewValue,
                allBillsPaid && styles.overviewValueGreen,
              ]}
              numberOfLines={1}
            >
              {allBillsPaid ? 'Tudo pago' : formatMoney(pendingBillsAmount)}
            </Text>
          </TouchableOpacity>

          {/* CARD 3: ECONOMIZADO */}
          <View style={styles.overviewCard}>
            <Ionicons name="pie-chart-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.overviewLabel}>Economizado</Text>
            <Text style={styles.overviewValue}>{economizadoPercent}%</Text>
          </View>
        </View>

        {/* CARD DO MASCOTE / GAMIFICAÇÃO (IDÊNTICO À IMAGEM 2) */}
        <View style={styles.mascotCard}>
          <View style={styles.mascotAvatar}>
            <Text style={styles.mascotEmoji}>🐶🕶️</Text>
          </View>

          <View style={styles.mascotContent}>
            <Text style={styles.mascotTitle}>
              Mandou bem este mês, {currentUserName}!
            </Text>
            <Text style={styles.mascotDesc}>
              Você usou 78% do planejado com 84% do mês.
            </Text>

            <TouchableOpacity
              style={styles.mascotBtn}
              onPress={() => navigation.navigate('Planning')}
            >
              <Text style={styles.mascotBtnText}>Ver planejamento →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SEÇÃO "MAIORES GASTOS" COM BARRAS DE PROGRESSO (IMAGEM 2) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Maiores gastos</Text>
          <View style={styles.headerLinks}>
            <Text style={styles.activeFilterLink}>Com previstos</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Transações')}>
              <Text style={styles.allLink}>Ver tudo</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.categoryCard}>
          {categoryBreakdown.map((cat, idx) => (
            <View
              key={cat.id}
              style={[
                styles.categoryRow,
                idx > 0 && styles.categoryRowBorder,
              ]}
            >
              <View style={styles.categoryTopRow}>
                <View
                  style={[
                    styles.catIconWrap,
                    { backgroundColor: `${cat.color}15` },
                  ]}
                >
                  <Ionicons name={cat.icon} size={16} color={cat.color} />
                </View>

                <View style={styles.catNameWrap}>
                  <Text style={styles.catName}>{cat.label}</Text>
                  <Text style={styles.catAmounts}>
                    {formatMoney(cat.spent)} | {formatMoney(cat.budget)}
                  </Text>
                </View>

                <Text style={styles.catPercentage}>{cat.percentOfTotal}%</Text>
              </View>

              {/* BARRA DE PROGRESSO COLORIDA */}
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${cat.percentOfBudget}%`,
                      backgroundColor: cat.color,
                    },
                  ]}
                />
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={styles.categoryFooter}
            onPress={() => navigation.navigate('Transações')}
          >
            <Text style={styles.categoryFooterText}>
              + outras 1 categorias • R$ 164,70
            </Text>
          </TouchableOpacity>
        </View>

        {/* SEÇÃO "SUAS CONTAS" (IMAGEM 2) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Suas contas</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Mais')}>
            <Text style={styles.allLink}>Gerenciar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.accountsCard}>
          {accounts.map((acc, index) => (
            <View
              key={acc.id}
              style={[
                styles.accountRow,
                index > 0 && styles.accountRowBorder,
              ]}
            >
              <View style={styles.accountLeft}>
                <View
                  style={[
                    styles.bankIconCircle,
                    { backgroundColor: `${acc.color || COLORS.primary}15` },
                  ]}
                >
                  <Ionicons
                    name={acc.icon || 'business-outline'}
                    size={18}
                    color={acc.color || COLORS.primary}
                  />
                </View>
                <View>
                  <Text style={styles.accountName}>{acc.name}</Text>
                  <Text style={styles.accountBank}>{acc.bank}</Text>
                </View>
              </View>

              <Text style={styles.accountBalanceText}>
                {formatMoney(acc.balance)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* BOTÃO FLUTUANTE DA IA COM SPARKLE NO CANTO INFERIOR DIREITO (IMAGEM 3) */}
      <TouchableOpacity
        style={[styles.floatingAiBtn, { bottom: insets.bottom + 80 }]}
        onPress={() => navigation.navigate('FinnAI')}
        activeOpacity={0.85}
      >
        <Ionicons name="sparkles" size={22} color={COLORS.white} />
      </TouchableOpacity>

      {/* MODAL PARA LANÇAR TRANSAÇÃO */}
      <AddTransactionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: COLORS.bg,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    color: COLORS.navy,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  monthText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  notificationDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.expense,
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFE5D9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  avatarText: {
    color: '#EA580C',
    fontSize: 14,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 14,
  },
  heroCard: {
    borderRadius: 22,
    padding: 18,
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroTitle: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  eyeBtn: {
    padding: 4,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  heroValue: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  trendingText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  sparklineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingRight: 6,
  },
  sparkDot1: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginBottom: -8,
  },
  sparkLine1: {
    width: 22,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
    transform: [{ rotate: '-25deg' }],
  },
  sparkDot2: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  sparkLine2: {
    width: 26,
    height: 2.5,
    backgroundColor: COLORS.white,
    transform: [{ rotate: '-35deg' }],
  },
  sparkDot3: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
    marginBottom: 20,
  },
  heroMetricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  heroMetricPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  incomeArrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseArrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricPillLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  metricPillValue: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  sectionHeaderTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  overviewGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    gap: 4,
  },
  overviewLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  overviewValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  overviewValueGreen: {
    color: COLORS.income,
  },
  mascotCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.mascotBg,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.mascotBorder,
  },
  mascotAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotEmoji: {
    fontSize: 26,
  },
  mascotContent: {
    flex: 1,
  },
  mascotTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  mascotDesc: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  mascotBtn: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  mascotBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  headerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeFilterLink: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  allLink: {
    color: COLORS.primaryBlue,
    fontSize: 12,
    fontWeight: '700',
  },
  categoryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  categoryRow: {
    paddingVertical: 10,
  },
  categoryRowBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
  },
  categoryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  catIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catNameWrap: {
    flex: 1,
  },
  catName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  catAmounts: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  catPercentage: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EDF2F7',
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  categoryFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
    alignItems: 'center',
  },
  categoryFooterText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  accountsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  accountRowBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
  },
  accountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bankIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  accountBank: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  accountBalanceText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  floatingAiBtn: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});
