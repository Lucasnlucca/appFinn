import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useFinance, CATEGORIES } from '../context/FinanceContext';
import AddTransactionModal from '../components/AddTransactionModal';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    transactions,
    totalBalance,
    totalIncome,
    totalExpense,
    activeMember,
    switchActiveMember,
    members,
  } = useFinance();

  const [modalVisible, setModalVisible] = useState(false);

  // Formatação segura de moeda
  const formatCurrency = (val) => {
    return 'R$ ' + (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const remaining = totalIncome - totalExpense;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* HEADER NATIVO COM NOTCH SAFE AREA */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBadge}>
            <Ionicons name="sparkles" size={18} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.brandTitle}>FINN AI</Text>
            <Text style={styles.brandSubtitle}>Finanças do Casal</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.aiQuickHeaderBtn}
          onPress={() => navigation.navigate('FinnAI')}
        >
          <Ionicons name="chatbubbles" size={16} color={COLORS.primary} />
          <Text style={styles.aiQuickHeaderBtnText}>IA</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
      >
        {/* FILTRO VISÃO CASAL / INDIVIDUAL */}
        <View style={styles.filterPillsRow}>
          {['Casal', members.user1, members.user2].map((m) => {
            const isSelected = activeMember === m;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.filterPill, isSelected && styles.filterPillActive]}
                onPress={() => switchActiveMember(m)}
              >
                <Ionicons
                  name={m === 'Casal' ? 'people' : 'person'}
                  size={14}
                  color={isSelected ? COLORS.white : COLORS.textSecondary}
                />
                <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                  {m === 'Casal' ? 'Visão Conjunta' : m}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* CARD PRINCIPAL DE PATRIMÔNIO & SALDO */}
        <View style={styles.mainCard}>
          <View style={styles.mainCardTop}>
            <Text style={styles.mainCardLabel}>SALDO DISPONÍVEL</Text>
            <Ionicons name="wallet-outline" size={20} color={COLORS.primary} />
          </View>
          <Text style={styles.mainBalanceValue}>{formatCurrency(totalBalance)}</Text>

          <View style={styles.divider} />

          {/* Comparativo Receitas x Despesas */}
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <View style={styles.metricIconWrapIncome}>
                <Ionicons name="arrow-up" size={14} color={COLORS.income} />
              </View>
              <View>
                <Text style={styles.metricLabel}>Receitas no mês</Text>
                <Text style={styles.metricValueIncome}>{formatCurrency(totalIncome)}</Text>
              </View>
            </View>

            <View style={styles.metricItem}>
              <View style={styles.metricIconWrapExpense}>
                <Ionicons name="arrow-down" size={14} color={COLORS.expense} />
              </View>
              <View>
                <Text style={styles.metricLabel}>Despesas no mês</Text>
                <Text style={styles.metricValueExpense}>{formatCurrency(totalExpense)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* BOTÕES DE AÇÃO RÁPIDA (ATALHOS NATIVOS) */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setModalVisible(true)}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(244, 63, 94, 0.15)' }]}>
              <Ionicons name="remove-circle" size={22} color={COLORS.expense} />
            </View>
            <Text style={styles.actionBtnText}>+ Despesa</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setModalVisible(true)}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="add-circle" size={22} color={COLORS.income} />
            </View>
            <Text style={styles.actionBtnText}>+ Receita</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('FinnAI')}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
              <Ionicons name="sparkles" size={22} color={COLORS.purple} />
            </View>
            <Text style={styles.actionBtnText}>Falar com IA</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('CardsAccounts')}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Ionicons name="card" size={22} color={COLORS.info} />
            </View>
            <Text style={styles.actionBtnText}>Cartões</Text>
          </TouchableOpacity>
        </View>

        {/* DIAGNÓSTICO INTELIGENTE EM TEMPO REAL DA IA */}
        <TouchableOpacity
          style={styles.aiInsightCard}
          onPress={() => navigation.navigate('FinnAI')}
          activeOpacity={0.85}
        >
          <View style={styles.aiInsightHeader}>
            <View style={styles.aiRobotBadge}>
              <Ionicons name="hardware-chip-outline" size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiInsightTitle}>Diagnóstico do FINN AI</Text>
              <Text style={styles.aiInsightSub}>Toque para conversar e analisar</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </View>
          <Text style={styles.aiInsightBody}>
            {transactions.length === 0
              ? 'Nenhum lançamento no momento. Comece adicionando suas primeiras contas ou me fale por mensagem para mantermos o controle do casal atualizado!'
              : totalExpense > totalIncome && totalIncome > 0
              ? 'Atenção: as despesas superaram as receitas cadastradas este mês. Posso sugerir cortes nas categorias com maior impacto.'
              : `Balanço positivo! Sobra prevista de ${formatCurrency(remaining)} para a família.`}
          </Text>
        </TouchableOpacity>

        {/* ÚLTIMAS MOVIMENTAÇÕES REAIS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Últimas Movimentações</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
            <Text style={styles.sectionAction}>Ver extrato</Text>
          </TouchableOpacity>
        </View>

        {transactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={44} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Sem lançamentos cadastrados</Text>
            <Text style={styles.emptySubtitle}>
              Toque no botão abaixo para adicionar sua primeira despesa real ou peça para a IA cadastrar.
            </Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => setModalVisible(true)}
            >
              <Ionicons name="add" size={18} color={COLORS.white} />
              <Text style={styles.emptyAddBtnText}>Novo Lançamento</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.transactionsList}>
            {transactions.slice(0, 5).map((t) => {
              const cat = CATEGORIES.find((c) => c.id === t.category) || CATEGORIES[6];
              const isExpense = t.type === 'expense';
              return (
                <View key={t.id} style={styles.txCard}>
                  <View style={[styles.txIconWrap, { backgroundColor: `${cat.color}20` }]}>
                    <Ionicons name={cat.icon} size={20} color={cat.color} />
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txTitle}>{t.description}</Text>
                    <View style={styles.txMeta}>
                      <Text style={styles.txCat}>{cat.label}</Text>
                      <Text style={styles.txDot}>•</Text>
                      <Text style={styles.txAuthor}>{t.author}</Text>
                    </View>
                  </View>
                  <Text style={[styles.txAmount, isExpense ? styles.txExpense : styles.txIncome]}>
                    {isExpense ? '- ' : '+ '}
                    {formatCurrency(t.amount)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* MODAL DE ADIÇÃO DE LANÇAMENTO */}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  aiQuickHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  aiQuickHeaderBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterPillText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  mainCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  mainCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mainCardLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  mainBalanceValue: {
    color: COLORS.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.surfaceBorder,
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metricIconWrapIncome: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricIconWrapExpense: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  metricValueIncome: {
    color: COLORS.income,
    fontSize: 14,
    fontWeight: '700',
  },
  metricValueExpense: {
    color: COLORS.expense,
    fontSize: 14,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 6,
    width: '23%',
  },
  actionIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  actionBtnText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  aiInsightCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 24,
  },
  aiInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  aiRobotBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiInsightTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  aiInsightSub: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  aiInsightBody: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  sectionAction: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    borderStyle: 'dashed',
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyAddBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  transactionsList: {
    gap: 10,
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txInfo: {
    flex: 1,
  },
  txTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  txMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  txCat: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  txDot: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  txAuthor: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  txExpense: {
    color: COLORS.expense,
  },
  txIncome: {
    color: COLORS.income,
  },
});
