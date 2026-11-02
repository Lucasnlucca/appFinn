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
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import Svg, { Rect, Defs as SvgDefs, LinearGradient as SvgLinearGradient, Stop as SvgStop } from 'react-native-svg';
import { COLORS } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import AddTransactionModal from '../components/AddTransactionModal';
import CofrinhosModal from '../components/CofrinhosModal';
import { BudgetDonut } from '../components/DonutChart';

const heroVideoSource = require('../../assets/hero-robot.mp4');
const heroBgSource = require('../../assets/hero-robot-bg.jpg');

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

  // Player de vídeo animado do robô FINN no card de saldo
  const player = useVideoPlayer(heroVideoSource, (p) => {
    p.loop = false;
    p.muted = true;
    p.play();
  });

  const handleReplayHeroAnimation = () => {
    if (!player) return;
    try {
      player.replay();
    } catch (e) {
      try {
        player.currentTime = 0;
        player.play();
      } catch (err) {}
    }
  };

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

      {/* HEADER SUPERIOR: LOGO FINN COM GRADIENTE, SUBTÍTULO E AÇÕES */}
      <View style={styles.topBar}>
        <View style={styles.brandGroup}>
          <View style={styles.brandIconContainer}>
            <Svg width={30} height={30} viewBox="0 0 28 28">
              <SvgDefs>
                <SvgLinearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
                  <SvgStop offset="0%" stopColor="#7C3AED" />
                  <SvgStop offset="45%" stopColor="#D946EF" />
                  <SvgStop offset="100%" stopColor="#06B6D4" />
                </SvgLinearGradient>
              </SvgDefs>
              <Rect x="2" y="3" width="24" height="5.5" rx="2.75" fill="url(#logoGrad)" />
              <Rect x="5" y="11" width="21" height="5.5" rx="2.75" fill="url(#logoGrad)" />
              <Rect x="8" y="19" width="18" height="5.5" rx="2.75" fill="url(#logoGrad)" />
            </Svg>
          </View>
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.brandTitle}>FINN</Text>
            <Text style={styles.brandSubtitle}>Gestor Financeiro Inteligente</Text>
          </View>
        </View>

        {/* ÍCONES DA DIREITA: NOTIFICAÇÃO E AVATAR */}
        <View style={styles.rightIcons}>
          <TouchableOpacity style={styles.iconCircle}>
            <Ionicons name="notifications-outline" size={19} color="#18181B" />
            <View style={styles.notificationDot} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={() => navigation.navigate('Mais')}
          >
            <Ionicons name="person" size={17} color="#7C3AED" />
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
        {/* SAUDAÇÃO PERSONALIZADA (Olá, Lucas 👋) */}
        <View style={styles.greetingWrap}>
          <Text style={styles.greetingTitle}>Olá, {currentUserName} 👋</Text>
          <Text style={styles.greetingSub}>Aqui está o resumo das suas finanças.</Text>
        </View>

        {/* CARD HERO ROBÔ COM VÍDEO ANIMADO E SALDO DINÂMICO */}
        <View style={styles.heroCardContainer}>
          {/* Fundo de fallback estático imediato (evita qualquer piscar antes do vídeo inicializar) */}
          <Image
            source={heroBgSource}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />

          {/* Vídeo Animado do Robô FINN (pisca os olhos luminosos e finaliza na pose estática) */}
          {player && (
            <VideoView
              player={player}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              nativeControls={false}
              allowsFullscreen={false}
              allowsPictureInPicture={false}
              surfaceType="textureView"
              pointerEvents="none"
            />
          )}

          {/* Overlay clicável (tocar no card repete a animação suave do mascote) */}
          <TouchableOpacity
            style={styles.heroOverlayTouch}
            activeOpacity={0.92}
            onPress={handleReplayHeroAnimation}
          >
            <View style={styles.heroContentLeft}>
              {/* Pill Saldo Atual com Carteira e Olho */}
              <TouchableOpacity
                style={styles.heroWalletPill}
                onPress={toggleHideBalances}
                activeOpacity={0.75}
              >
                <View style={styles.walletIconBox}>
                  <Ionicons name="wallet-outline" size={14} color="#FFFFFF" />
                </View>
                <Text style={styles.heroWalletText}>Saldo atual (contas)</Text>
                <Ionicons
                  name={hideBalances ? 'eye-off-outline' : 'eye-outline'}
                  size={15}
                  color="#FFFFFF"
                />
              </TouchableOpacity>

              {/* Saldo Principal Formatado em Destaque */}
              <Text
                style={styles.heroBalanceValue}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatMoney(heroCardMode === 'balance' ? totalBalance : resultadoDoMes)}
              </Text>

              {/* Tag de Comparativo / Tendência Inferior */}
              <View style={styles.heroTrendPill}>
                <Ionicons name="arrow-up" size={12} color="#34D399" />
                <Text style={styles.heroTrendPercent}>+4,8%</Text>
                <Text style={styles.heroTrendLabel}> em relação ao mês anterior</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* DOIS CARDS RÁPIDOS LADO A LADO: ENTRADAS E SAÍDAS */}
        <View style={styles.metricCardsRow}>
          {/* Card Entradas */}
          <View style={styles.metricCard}>
            <View style={styles.incomeCircleIcon}>
              <Ionicons name="arrow-down" size={19} color="#FFFFFF" />
            </View>
            <View style={styles.metricCardInfo}>
              <Text style={styles.metricCardLabel}>Entradas</Text>
              <Text style={styles.metricCardValue}>{formatMoney(totalIncome)}</Text>
            </View>
          </View>

          {/* Card Saídas */}
          <View style={styles.metricCard}>
            <View style={styles.expenseCircleIcon}>
              <Ionicons name="arrow-up" size={19} color="#FFFFFF" />
            </View>
            <View style={styles.metricCardInfo}>
              <Text style={styles.metricCardLabel}>Saídas</Text>
              <Text style={styles.metricCardValue}>{formatMoney(totalExpense)}</Text>
            </View>
          </View>
        </View>

        {/* CARD RESUMO DO MÊS (COM DONUT CHART E LEGENDA) */}
        <View style={styles.resumoCard}>
          <View style={styles.resumoHeader}>
            <Text style={styles.resumoTitle}>Resumo do mês</Text>
            <TouchableOpacity style={styles.monthSelectorBtn}>
              <Text style={styles.monthSelectorText}>{selectedMonth}</Text>
              <Ionicons name="chevron-down" size={13} color="#71717A" />
            </TouchableOpacity>
          </View>

          <View style={styles.resumoBody}>
            {/* Lado Esquerdo: Donut Chart com Porcentagem do Orçamento */}
            <BudgetDonut
              percent={budgetProgress > 0 ? budgetProgress : 66}
              centerValue={`${budgetProgress > 0 ? budgetProgress : 66}%`}
              centerLabel="Do orçamento"
              size={116}
            />

            {/* Lado Direito: Legenda com Valores */}
            <View style={styles.resumoLegendList}>
              {/* Gastos */}
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: '#EC4899' }]} />
                <Text style={styles.legendLabel}>Gastos</Text>
                <Text style={styles.legendValue}>{formatMoney(totalExpense)}</Text>
              </View>

              {/* Orçamento */}
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={styles.legendLabel}>Orçamento</Text>
                <Text style={styles.legendValue}>{formatMoney(totalBudget)}</Text>
              </View>

              {/* Restante */}
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={styles.legendLabel}>Restante</Text>
                <Text style={[styles.legendValue, { color: '#10B981' }]}>
                  {formatMoney(Math.max(totalBudget - totalExpense, 0))}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* BANNER FINN INSIGHTS */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => navigation.navigate('FinnAI')}
        >
          <LinearGradient
            colors={['#7C3AED', '#9333EA', '#C026D3']}
            style={styles.insightsCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.insightsHeader}>
              <View style={styles.insightsTitleGroup}>
                <Ionicons name="sparkles" size={15} color="#FFFFFF" />
                <Text style={styles.insightsTitle}>FINN Insights</Text>
              </View>
              <View style={styles.novoPill}>
                <Text style={styles.novoPillText}>Novo</Text>
              </View>
            </View>

            <View style={styles.insightsBody}>
              <View style={styles.targetIconCircle}>
                <Ionicons name="disc" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.insightsText}>
                Seus gastos com alimentação subiram 18% neste mês.
              </Text>
              <View style={styles.insightsChevronBtn}>
                <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

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
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.bg,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIconContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    color: '#18181B',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
    lineHeight: 20,
  },
  brandSubtitle: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFEAF8',
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  notificationDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EC4899',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  greetingWrap: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 4,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#18181B',
    letterSpacing: -0.5,
  },
  greetingSub: {
    fontSize: 13,
    fontWeight: '500',
    color: '#71717A',
    marginTop: 2,
  },
  heroCardContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    aspectRatio: 16 / 9,
    backgroundColor: '#0F0826',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.45)',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  heroOverlayTouch: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  heroContentLeft: {
    maxWidth: '63%',
    height: '100%',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroWalletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  walletIconBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWalletText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  heroBalanceValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    marginVertical: 4,
  },
  heroTrendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  heroTrendPercent: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 3,
  },
  heroTrendLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 10,
    fontWeight: '500',
  },
  metricCardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  incomeCircleIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  expenseCircleIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  metricCardInfo: {
    flex: 1,
  },
  metricCardLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#71717A',
  },
  metricCardValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#18181B',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  resumoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  resumoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  resumoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#18181B',
  },
  monthSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FAF8FD',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFEAF8',
  },
  monthSelectorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#71717A',
  },
  resumoBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  resumoLegendList: {
    flex: 1,
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#71717A',
  },
  legendValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#18181B',
  },
  insightsCard: {
    borderRadius: 22,
    padding: 16,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  insightsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  insightsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  novoPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  novoPillText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
  },
  insightsBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  targetIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightsText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
  },
  insightsChevronBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 14,
  },
  oldHeroCard: {
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
