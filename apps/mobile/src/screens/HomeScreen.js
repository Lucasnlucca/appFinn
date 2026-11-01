import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import AddTransactionModal from '../components/AddTransactionModal';
import CofrinhosModal from '../components/CofrinhosModal';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    totalBalance,
    totalIncome,
    totalExpense,
    totalSalaryIncome,
    totalFreelanceIncome,
    totalFixedExpenses,
    totalVariableExpenses,
    resultadoDoMes,
    cofrinhos,
    heroCardMode,
    toggleHeroCardMode,
    accounts,
    allBillsPaid,
    pendingBillsAmount,
    economizadoPercent,
    categoryBreakdown,
    activeMember,
    switchActiveMember,
    members,
    transactions,
    selectedMonth,
    setSelectedMonth,
    hideBalances,
    toggleHideBalances,
    updateAccountBalance,
    addAccount,
  } = useFinance();

  const [modalVisible, setModalVisible] = useState(false);
  const [modalCofrinhos, setModalCofrinhos] = useState(false);
  const [editingAcc, setEditingAcc] = useState(null);
  const [accBalanceInput, setAccBalanceInput] = useState('');
  const [modalNewAcc, setModalNewAcc] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccBank, setNewAccBank] = useState('');
  const [newAccBalance, setNewAccBalance] = useState('');

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

  // Cálculos dinâmicos reais de progresso do mês e orçamento
  const now = new Date();
  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgress = Math.round((currentDay / daysInMonth) * 100);
  const totalBudget = categoryBreakdown.reduce((s, c) => s + (c.budget || 0), 0) || 1;
  const budgetProgress = totalExpense > 0 ? Math.round((totalExpense / totalBudget) * 100) : 0;

  const handleSaveBalance = async () => {
    if (!editingAcc) return;
    const num = parseFloat(accBalanceInput.replace(',', '.'));
    await updateAccountBalance(editingAcc.id, isNaN(num) ? 0 : num);
    setEditingAcc(null);
    setAccBalanceInput('');
  };

  const handleCreateAccount = async () => {
    if (!newAccName.trim()) {
      Alert.alert('Atenção', 'Informe o nome da conta.');
      return;
    }
    const num = parseFloat(newAccBalance.replace(',', '.')) || 0;
    await addAccount({
      name: newAccName.trim(),
      bank: newAccBank.trim() || newAccName.trim(),
      balance: num,
      color: COLORS.navy,
      icon: 'business-outline',
    });
    setNewAccName('');
    setNewAccBank('');
    setNewAccBalance('');
    setModalNewAcc(false);
  };

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
            onPress={() => navigation.navigate('Mais')}
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
          { paddingBottom: insets.bottom + 105 },
        ]}
      >
        {/* CARD HERO AZUL ESCURO: SALDO TOTAL VINCULADO & RESULTADO DO MÊS */}
        <LinearGradient
          colors={[COLORS.navyGradientStart, COLORS.navyGradientEnd]}
          style={styles.heroCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* TOPO DO CARD: ALTERNADOR ENTRE SALDO TOTAL EM CONTAS E RESULTADO DO MÊS */}
          <View style={styles.heroTop}>
            <TouchableOpacity
              style={styles.heroModePill}
              onPress={toggleHeroCardMode}
              activeOpacity={0.8}
            >
              <Ionicons
                name={heroCardMode === 'balance' ? 'wallet' : 'trending-up'}
                size={13}
                color={COLORS.white}
              />
              <Text style={styles.heroTitle}>
                {heroCardMode === 'balance' ? 'SALDO TOTAL EM CONTAS' : 'RESULTADO DO MÊS'}
              </Text>
              <Ionicons name="swap-horizontal" size={13} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>

            <TouchableOpacity onPress={toggleHideBalances} style={styles.eyeBtn}>
              <Ionicons
                name={hideBalances ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color="rgba(255,255,255,0.9)"
              />
            </TouchableOpacity>
          </View>

          {/* VALOR PRINCIPAL VINCULADO E GRÁFICO */}
          <View style={styles.heroValueRow}>
            <View>
              <Text style={styles.heroValue}>
                {formatMoney(heroCardMode === 'balance' ? totalBalance : resultadoDoMes)}
              </Text>
              <View style={styles.trendingBadge}>
                <Ionicons
                  name={resultadoDoMes >= 0 ? 'arrow-up' : 'arrow-down'}
                  size={11}
                  color={resultadoDoMes >= 0 ? COLORS.income : COLORS.expense}
                />
                <Text style={styles.trendingText}>
                  {heroCardMode === 'balance'
                    ? (resultadoDoMes === 0
                        ? 'Patrimônio em contas'
                        : resultadoDoMes >= 0
                        ? `+ ${formatMoney(resultadoDoMes)} no mês`
                        : `${formatMoney(resultadoDoMes)} no mês`)
                    : (totalIncome === 0 && totalExpense === 0
                        ? `Nas contas: ${formatMoney(totalBalance)}`
                        : resultadoDoMes >= 0
                        ? 'Superávit no mês'
                        : 'Déficit no mês')}
                </Text>
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

          {/* SUB-CARDS INFERIORES: ENTRADAS (COM FREELANCE) E SAÍDAS (COM FIXAS/VARIÁVEIS) */}
          <View style={styles.heroMetricsGrid}>
            <View style={styles.heroMetricPill}>
              <View style={styles.incomeArrowCircle}>
                <Ionicons name="arrow-down" size={14} color={COLORS.income} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.metricPillLabel}>Entradas</Text>
                <Text style={styles.metricPillValue}>
                  {formatMoney(totalIncome)}
                </Text>
                {totalFreelanceIncome > 0 && (
                  <Text style={styles.metricSubBadge}>
                    ⚡ {formatMoney(totalFreelanceIncome)} freela
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.heroMetricPill}>
              <View style={styles.expenseArrowCircle}>
                <Ionicons name="arrow-up" size={14} color={COLORS.expense} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.metricPillLabel}>Saídas</Text>
                <Text style={styles.metricPillValue}>
                  {formatMoney(totalExpense)}
                </Text>
                {totalFixedExpenses > 0 && (
                  <Text style={styles.metricSubBadge}>
                    Fixos: {formatMoney(totalFixedExpenses)}
                  </Text>
                )}
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
              {totalExpense === 0 && totalIncome === 0
                ? 'Tudo pronto para começar! Adicione seus saldos reais ou envie comprovantes para a IA FINN.'
                : `Você usou ${budgetProgress}% do orçamento previsto com ${monthProgress}% do mês decorrido.`}
            </Text>

            <TouchableOpacity
              style={styles.mascotBtn}
              onPress={() => navigation.navigate('Planning')}
            >
              <Text style={styles.mascotBtnText}>Ver planejamento →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SEÇÃO COFRINHOS & METAS (PRINT 1 DO USUÁRIO) */}
        <View style={styles.cofrinhosHomeCard}>
          <View style={styles.cofrinhosHomeTop}>
            <View style={styles.cofrinhosTitleRow}>
              <View style={styles.piggyCircle}>
                <Ionicons name="sparkles" size={16} color="#06B6D4" />
              </View>
              <View>
                <Text style={styles.cofrinhosHomeTitle}>Cofrinhos & Metas</Text>
                <Text style={styles.cofrinhosHomeSub}>
                  {cofrinhos.length} {cofrinhos.length === 1 ? 'meta ativa' : 'metas ativas'} com apoio da IA
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.openCofsBtn}
              onPress={() => setModalCofrinhos(true)}
            >
              <Text style={styles.openCofsBtnText}>Abrir cofrinhos →</Text>
            </TouchableOpacity>
          </View>

          {cofrinhos.length > 0 && (
            <TouchableOpacity
              style={styles.firstCofPreview}
              onPress={() => setModalCofrinhos(true)}
              activeOpacity={0.8}
            >
              <View style={styles.firstCofHeader}>
                <Text style={styles.firstCofEmoji}>{cofrinhos[0].emoji || '🚗'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.firstCofTitle}>{cofrinhos[0].title}</Text>
                  <Text style={styles.firstCofSub}>{cofrinhos[0].deadline || 'Sem prazo'}</Text>
                </View>
                <Text style={styles.firstCofPercent}>
                  {Math.min(
                    Math.round(((cofrinhos[0].currentAmount || 0) / (cofrinhos[0].targetAmount || 1)) * 100),
                    100
                  )}% atingido
                </Text>
              </View>

              <View style={styles.previewProgressTrack}>
                <View
                  style={[
                    styles.previewProgressFill,
                    {
                      width: `${Math.min(
                        Math.round(((cofrinhos[0].currentAmount || 0) / (cofrinhos[0].targetAmount || 1)) * 100),
                        100
                      )}%`,
                    },
                  ]}
                />
              </View>

              <View style={styles.firstCofValuesRow}>
                <Text style={styles.firstCofCurrent}>{formatMoney(cofrinhos[0].currentAmount)}</Text>
                <Text style={styles.firstCofTarget}>de {formatMoney(cofrinhos[0].targetAmount)}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* SEÇÃO "MAIORES GASTOS" COM BARRAS DE PROGRESSO (IMAGEM 2) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Maiores gastos</Text>
          <View style={styles.headerLinks}>
            <Text style={styles.activeFilterLink}>Com previstos</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
              <Text style={styles.allLink}>Ver tudo</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.categoryCard}>
          {categoryBreakdown.length === 0 ? (
            <View style={styles.emptyCatWrap}>
              <Ionicons name="pie-chart-outline" size={30} color={COLORS.textMuted} />
              <Text style={styles.emptyCatTitle}>Nenhum gasto lançado em outubro</Text>
              <Text style={styles.emptyCatSub}>
                Toque no botão central (+) ou converse com a IA FINN para lançar suas despesas reais.
              </Text>
            </View>
          ) : (
            categoryBreakdown.map((cat, idx) => (
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
            ))
          )}
        </View>

        {/* SEÇÃO "SUAS CONTAS" (IMAGEM 2) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Suas contas</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => setModalNewAcc(true)}>
              <Text style={styles.allLink}>+ Nova Conta</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Mais')}>
              <Text style={styles.allLink}>Gerenciar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.accountsCard}>
          {accounts.map((acc, index) => (
            <TouchableOpacity
              key={acc.id}
              style={[
                styles.accountRow,
                index > 0 && styles.accountRowBorder,
              ]}
              onPress={() => {
                setEditingAcc(acc);
                setAccBalanceInput(String(acc.balance || 0));
              }}
              activeOpacity={0.7}
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
                  <Text style={styles.accountBank}>{acc.bank} • Toque para ajustar</Text>
                </View>
              </View>

              <Text style={styles.accountBalanceText}>
                {formatMoney(acc.balance)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* SEÇÃO ÚLTIMAS MOVIMENTAÇÕES COM DATA */}
        {transactions && transactions.length > 0 && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>Últimas movimentações</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
                <Text style={styles.allLink}>Ver extrato →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.accountsCard}>
              {transactions.slice(0, 4).map((tx, index) => {
                const isExpense = tx.type === 'expense';
                const formattedDate = tx.date
                  ? (tx.date.includes('-') ? tx.date.split('-').reverse().join('/') : tx.date)
                  : '';
                return (
                  <TouchableOpacity
                    key={tx.id}
                    style={[styles.accountRow, index > 0 && styles.accountRowBorder]}
                    onPress={() => navigation.navigate('Transactions')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.accountLeft}>
                      <View
                        style={[
                          styles.bankIconCircle,
                          {
                            backgroundColor: isExpense
                              ? 'rgba(239, 68, 68, 0.12)'
                              : 'rgba(16, 185, 129, 0.12)',
                          },
                        ]}
                      >
                        <Ionicons
                          name={isExpense ? 'arrow-down' : 'arrow-up'}
                          size={16}
                          color={isExpense ? COLORS.expense : COLORS.income}
                        />
                      </View>
                      <View>
                        <Text style={styles.accountName}>{tx.description}</Text>
                        <Text style={styles.accountBank}>
                          📅 {formattedDate || 'Hoje'} • {tx.author}
                          {tx.incomeSource === 'freelance' ? ' • ⚡ Freela' : ''}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.accountBalanceText,
                        { color: isExpense ? COLORS.expense : COLORS.income },
                      ]}
                    >
                      {isExpense ? '- ' : '+ '}
                      {formatMoney(tx.amount)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* MODAL PARA LANÇAR TRANSAÇÃO */}
      <AddTransactionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />

      {/* MODAL DE COFRINHOS & METAS COM IA */}
      <CofrinhosModal
        visible={modalCofrinhos}
        onClose={() => setModalCofrinhos(false)}
      />

      {/* MODAL PARA AJUSTAR SALDO REAL DA CONTA */}
      <Modal visible={!!editingAcc} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalBalanceBox}>
            <Text style={styles.modalBalanceTitle}>Ajustar Saldo Real</Text>
            <Text style={styles.modalBalanceSub}>
              {editingAcc?.name} ({editingAcc?.bank})
            </Text>

            <View style={styles.inputCurrencyRow}>
              <Text style={styles.currencyPrefix}>R$</Text>
              <TextInput
                style={styles.balanceInput}
                keyboardType="decimal-pad"
                value={accBalanceInput}
                onChangeText={setAccBalanceInput}
                placeholder="0,00"
                placeholderTextColor={COLORS.textMuted}
                autoFocus
              />
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditingAcc(null)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleSaveBalance}
              >
                <Text style={styles.modalConfirmText}>Salvar Saldo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL PARA ADICIONAR NOVA CONTA */}
      <Modal visible={modalNewAcc} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalBalanceBox}>
            <Text style={styles.modalBalanceTitle}>Nova Conta Bancária</Text>
            <Text style={styles.modalBalanceSub}>Cadastre sua conta real para o casal</Text>

            <TextInput
              style={styles.formInput}
              placeholder="Nome da Conta (ex: Conta Principal)"
              placeholderTextColor={COLORS.textMuted}
              value={newAccName}
              onChangeText={setNewAccName}
            />

            <TextInput
              style={styles.formInput}
              placeholder="Instituição (ex: Nubank, Inter, Itaú)"
              placeholderTextColor={COLORS.textMuted}
              value={newAccBank}
              onChangeText={setNewAccBank}
            />

            <TextInput
              style={styles.formInput}
              placeholder="Saldo Inicial (R$ 0,00)"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
              value={newAccBalance}
              onChangeText={setNewAccBalance}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalNewAcc(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleCreateAccount}
              >
                <Text style={styles.modalConfirmText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  heroModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
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
  metricSubBadge: {
    color: '#93C5FD',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  cofrinhosHomeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cofrinhosHomeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cofrinhosTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  piggyCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cofrinhosHomeTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },
  cofrinhosHomeSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  openCofsBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  openCofsBtnText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '700',
  },
  firstCofPreview: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  firstCofHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  firstCofEmoji: {
    fontSize: 20,
  },
  firstCofTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  firstCofSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  firstCofPercent: {
    color: '#0891B2',
    fontSize: 12,
    fontWeight: '800',
  },
  previewProgressTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  previewProgressFill: {
    height: '100%',
    backgroundColor: '#06B6D4',
    borderRadius: 3,
  },
  firstCofValuesRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  firstCofCurrent: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  firstCofTarget: {
    color: COLORS.textSecondary,
    fontSize: 11,
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
  emptyCatWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  emptyCatTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyCatSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 16,
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBalanceBox: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalBalanceTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalBalanceSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 16,
  },
  inputCurrencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 20,
  },
  currencyPrefix: {
    color: COLORS.textSecondary,
    fontSize: 20,
    fontWeight: '700',
    marginRight: 8,
  },
  balanceInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
  },
  formInput: {
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 12,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  modalCancelText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalConfirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
});
