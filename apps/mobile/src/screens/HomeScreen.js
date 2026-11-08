import React, { useState, useEffect, useMemo } from 'react';
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
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { COLORS } from '../theme/colors';
import { useFinance, CATEGORIES } from '../context/FinanceContext';
import AddTransactionModal from '../components/AddTransactionModal';
import CofrinhosModal from '../components/CofrinhosModal';
import { BudgetDonut } from '../components/DonutChart';
import { useVideoPlayer, VideoView } from 'expo-video';

const heroVideoSource = require('../../assets/hero-robot.mp4');
const heroBgSource = require('../../assets/hero-robot-bg.jpg');
const heroPosterSource = require('../../assets/finn-hero-poster.jpg');
const heroSharedSource = require('../../assets/hero-robot-shared.jpg');
const finnLogoSource = require('../../assets/finn-logo.png');

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    Audiowide: require('../../assets/fonts/Audiowide-Regular.ttf'),
  });
  const {
    loggedInUser,
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
    viewMode,
    setViewMode,
    sharedGroups,
    activeGroupId,
    setActiveGroupId,
    cards = [],
  } = useFinance();

  const [groupModalVisible, setGroupModalVisible] = useState(false);

  const activeSharedGroup = useMemo(() => {
    if (sharedGroups && sharedGroups.length > 0) {
      return sharedGroups.find((g) => g.id === activeGroupId) || sharedGroups[0];
    }
    return {
      id: 'default-casal',
      name: 'Finanças do Casal',
      type: 'Casal',
      members: [
        { id: '1', name: loggedInUser?.name || 'Você' },
        { id: '2', name: 'Parceiro(a)' },
      ],
    };
  }, [sharedGroups, activeGroupId, loggedInUser]);

  const displayGroups = useMemo(() => {
    if (sharedGroups && sharedGroups.length > 0) {
      return sharedGroups;
    }
    return [
      {
        id: 'default-casal',
        name: 'Finanças do Casal',
        type: 'Casal',
        members: [
          { id: '1', name: loggedInUser?.name || 'Você' },
          { id: '2', name: 'Parceiro(a)' },
        ],
      },
    ];
  }, [sharedGroups, loggedInUser]);

  const sharedGroupBalance = useMemo(() => {
    const groupTxs = transactions.filter(
      (t) => t.isShared && (!activeSharedGroup?.id || !t.groupId || t.groupId === activeSharedGroup.id)
    );
    const totalExp = groupTxs
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalInc = groupTxs
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    if (totalInc > 0) return totalInc - totalExp;
    if (totalExp > 0) return totalExp;
    return totalBalance > 0 ? totalBalance : 2968.0;
  }, [transactions, activeSharedGroup, totalBalance]);

  const totalOpenInvoices = useMemo(
    () => (cards || []).reduce((sum, c) => sum + (c.currentInvoice || 0), 0),
    [cards]
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [modalCofrinhos, setModalCofrinhos] = useState(false);
  const [editingAcc, setEditingAcc] = useState(null);
  const [accBalanceInput, setAccBalanceInput] = useState('');
  const [modalNewAcc, setModalNewAcc] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccBank, setNewAccBank] = useState('');
  const [newAccBalance, setNewAccBalance] = useState('');

  // Vídeo nativo do robô FINN com expo-video (executa 1x ao entrar, sem som, sem controles)
  const [showStaticOverlay, setShowStaticOverlay] = useState(false);
  const [isFirstFrameRendered, setIsFirstFrameRendered] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const player = useVideoPlayer(heroVideoSource, (p) => {
    p.loop = false;
    p.muted = true;
    p.play();
  });

  // Gerencia eventos do player de vídeo (conclusão e erros)
  useEffect(() => {
    if (!player) return;
    const playToEndSub = player.addListener('playToEnd', () => {
      setShowStaticOverlay(true);
    });
    const statusSub = player.addListener('statusChange', (payload) => {
      if (payload?.status === 'error') {
        console.warn('Hero Video Player Error:', payload?.error);
        setVideoError(true);
      }
    });
    return () => {
      playToEndSub?.remove();
      statusSub?.remove();
    };
  }, [player]);

  // Pausa a reprodução quando a tela perde o foco ou o app vai para segundo plano
  useEffect(() => {
    if (!player) return;

    const unsubscribeBlur = navigation?.addListener?.('blur', () => {
      try {
        player.pause();
      } catch (e) { }
    });

    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState.match(/inactive|background/)) {
        try {
          player.pause();
        } catch (e) { }
      }
    });

    return () => {
      unsubscribeBlur?.();
      appStateSub?.remove();
    };
  }, [player, navigation]);

  // Tocar no card reinicia a reprodução do vídeo a partir do início
  const handleReplayHeroAnimation = () => {
    setShowStaticOverlay(false);
    if (!player) return;
    try {
      player.replay();
    } catch {
      try {
        player.currentTime = 0;
        player.play();
      } catch (err) {
        console.warn('Erro ao reiniciar vídeo do mascote:', err);
      }
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

  const rawName =
    loggedInUser?.fullName ||
    loggedInUser?.name ||
    '';
  const currentUserName = rawName.trim().split(' ')[0] || '';

  // Cálculos dinâmicos reais de progresso do mês e orçamento
  const now = new Date();
  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgress = Math.round((currentDay / daysInMonth) * 100);
  const totalBudget = CATEGORIES.filter((c) => c.id !== 'receita').reduce(
    (s, c) => s + (c.budget || 0),
    0
  );
  const budgetProgress =
    totalBudget > 0 ? Math.min(Math.round((totalExpense / totalBudget) * 100), 100) : 0;

  const homeInsightText = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return 'Adicione suas contas e transações para a IA analisar seus hábitos financeiros.';
    }
    if (totalExpense === 0 && totalIncome > 0) {
      return `Você já recebeu ${formatMoney(totalIncome)} este mês e ainda não teve despesas registradas.`;
    }
    if (categoryBreakdown && categoryBreakdown.length > 0) {
      const topCat = categoryBreakdown[0];
      return `Sua principal despesa este mês é ${topCat.label} com ${formatMoney(topCat.spent)} (${topCat.percentOfTotal}% do total).`;
    }
    return 'O FINN AI está acompanhando suas despesas em tempo real.';
  }, [transactions, totalExpense, totalIncome, categoryBreakdown]);

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
          <Image
            source={finnLogoSource}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <View style={{ marginLeft: 9 }}>
            <Text style={[styles.brandTitle, fontsLoaded && { fontFamily: 'Audiowide' }]}>
              FINN
            </Text>
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
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            {loggedInUser?.avatarUri ? (
              <Image
                source={{ uri: loggedInUser.avatarUri }}
                style={styles.avatarTopImage}
              />
            ) : (
              <Ionicons name="person" size={17} color="#7C3AED" />
            )}
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
        {/* SAUDAÇÃO PERSONALIZADA */}
        <View style={styles.greetingWrap}>
          <Text style={styles.greetingTitle}>Olá{currentUserName ? `, ${currentUserName}` : ''} 👋</Text>
          <Text style={styles.greetingSub}>Aqui está o resumo das suas finanças.</Text>
        </View>

        {/* SELETOR DE MODO DE VISUALIZAÇÃO: Minhas | Compartilhadas | Consolidada */}
        <View style={styles.viewModeContainer}>
          <View style={styles.viewModePillGroup}>
            {[
              { id: 'personal', label: 'Minhas' },
              { id: 'shared', label: 'Compartilhadas' },
              { id: 'consolidated', label: 'Consolidada' },
            ].map((tab) => {
              const active = (viewMode || 'personal') === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.viewModePill, active && styles.viewModePillActive]}
                  onPress={() => setViewMode && setViewMode(tab.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.viewModePillText, active && styles.viewModePillTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {viewMode === 'shared' && (
            <TouchableOpacity
              style={styles.openSharedBtn}
              onPress={() => navigation.navigate('SharedFinances')}
              activeOpacity={0.8}
            >
              <Ionicons name="people" size={14} color="#7C3AED" />
              <Text style={styles.openSharedBtnText}>Ver Grupo</Text>
              <Ionicons name="chevron-forward" size={12} color="#7C3AED" />
            </TouchableOpacity>
          )}
        </View>

        {/* CARD HERO ROBÔ COM VÍDEO NATIVO E SALDO */}
        <View style={styles.heroCardContainer}>
          {viewMode === 'shared' ? (
            /* Imagem dos dois robôs finanças compartilhadas (Print solicitado pelo usuário) */
            <Image
              source={heroSharedSource}
              style={styles.heroMedia}
              resizeMode="cover"
              pointerEvents="none"
            />
          ) : (
            <>
              {/* Camada 1: Vídeo nativo expo-video (sempre montado em background, não intercepta toques) */}
              <VideoView
                style={styles.heroMedia}
                player={player}
                contentFit="contain"
                nativeControls={false}
                surfaceType="textureView"
                onFirstFrameRender={() => setIsFirstFrameRendered(true)}
                pointerEvents="none"
              />

              {/* Camada 2: Imagem de cobertura perfeitamente alinhada para eliminar flash ou exibir quadro final */}
              {(!isFirstFrameRendered || videoError) ? (
                <Image
                  source={heroPosterSource}
                  style={styles.heroMedia}
                  resizeMode="contain"
                  pointerEvents="none"
                />
              ) : showStaticOverlay ? (
                <Image
                  source={heroBgSource}
                  style={styles.heroMedia}
                  resizeMode="contain"
                  pointerEvents="none"
                />
              ) : null}
            </>
          )}

          {viewMode === 'shared' ? (
            /* Overlay quando selecionado Compartilhadas: Fiel ao print fornecido */
            <View style={styles.heroSharedOverlay}>
              {/* 1. Pill superior: [ 👥 Finanças compartilhadas ⌵ ] */}
              <TouchableOpacity
                style={styles.heroSharedTopPill}
                onPress={() => setGroupModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="people" size={17} color="#FFFFFF" />
                <Text style={styles.heroSharedTopPillText}>
                  Finanças compartilhadas
                </Text>
                <Ionicons name="chevron-down" size={15} color="#FFFFFF" />
              </TouchableOpacity>

              {/* 2. Bloco central: Saldo do grupo + Valor formatado */}
              <View style={styles.heroSharedBalanceBlock}>
                <Text style={styles.heroSharedBalanceLabel}>Saldo do grupo</Text>
                <Text style={styles.heroSharedBalanceValue} numberOfLines={1}>
                  {formatMoney(sharedGroupBalance)}
                </Text>
              </View>

              {/* 3. Pill inferior: [ 👥 X participantes ] */}
              <TouchableOpacity
                style={styles.heroSharedBottomPill}
                onPress={() => setGroupModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="people" size={15} color="#D8B4FE" />
                <Text style={styles.heroSharedBottomPillText}>
                  {activeSharedGroup?.members?.length || 2} participantes
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Camada 3: Overlay clicável individual padrão */
            <TouchableOpacity
              style={styles.heroOverlayTouch}
              activeOpacity={0.92}
              onPress={handleReplayHeroAnimation}
            >
              <View style={styles.heroContentLeft}>
                {/* Pill Saldo Atual com Carteira e Olho */}
                <View style={styles.heroWalletPill}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                    onPress={toggleHeroCardMode}
                    activeOpacity={0.75}
                  >
                    <View style={styles.walletIconBox}>
                      <Ionicons name="wallet-outline" size={13} color="#FFFFFF" />
                    </View>
                    <Text style={styles.heroWalletText}>
                      {heroCardMode === 'monthResult'
                        ? 'Resultado do mês'
                        : accounts.length > 0
                          ? 'Saldo atual (contas)'
                          : 'Saldo disponível'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={toggleHideBalances}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                    style={{ marginLeft: 6 }}
                  >
                    <Ionicons
                      name={hideBalances ? 'eye-off-outline' : 'eye-outline'}
                      size={14}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>
                </View>

                {/* Saldo Principal Formatado em Destaque */}
                <Text
                  style={styles.heroBalanceValue}
                  numberOfLines={1}
                >
                  {formatMoney(heroCardMode === 'balance' ? totalBalance : resultadoDoMes)}
                </Text>

                {/* Tag de Comparativo / Tendência Inferior */}
                {accounts.length > 0 ? (
                  <View style={styles.heroTrendPill}>
                    <Ionicons name="wallet-outline" size={12} color="#34D399" />
                    <Text style={styles.heroTrendLabel}>
                      {accounts.length} conta{accounts.length > 1 ? 's' : ''} cadastrada{accounts.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.heroTrendPill}>
                    <Ionicons name="sparkles" size={12} color="#FBBF24" />
                    <Text style={styles.heroTrendLabel}>
                      {transactions.length > 0
                        ? 'Saldo acumulado das suas movimentações'
                        : 'Toque para adicionar sua primeira conta'}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
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

        {/* SEÇÃO "VISÃO GERAL" (3 MINI CARDS - FATURAS, FALTA PAGAR, ECONOMIZADO) */}
        <View style={{ gap: 8 }}>
          <Text style={styles.sectionHeaderTitle}>Visão geral</Text>
          <View style={styles.overviewGrid}>
            {/* CARD 1: NAS CONTAS / FATURAS DOS CARTÕES */}
            <TouchableOpacity
              style={styles.overviewCard}
              onPress={() => navigation.navigate('CardInvoices')}
            >
              <Ionicons name="card-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.overviewLabel}>Faturas</Text>
              <Text style={styles.overviewValue} numberOfLines={1}>
                {formatMoney(totalBalance)}
              </Text>
            </TouchableOpacity>

            {/* CARD 2: AGENDA DO MÊS / FALTA PAGAR (TUDO PAGO) */}
            <TouchableOpacity
              style={styles.overviewCard}
              onPress={() => navigation.navigate('MonthlyAgenda')}
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
        </View>

        {/* CARD RESUMO DO MÊS (COM DONUT CHART E LEGENDA) */}
        <View style={styles.resumoCard}>
          <View style={styles.resumoHeader}>
            <Text style={styles.resumoTitle}>Resumo do mês</Text>
            <TouchableOpacity
              style={styles.monthSelectorBtn}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('MonthlyAgenda')}
            >
              <Text style={styles.monthSelectorText}>{selectedMonth}</Text>
              <Ionicons name="chevron-down" size={13} color="#71717A" />
            </TouchableOpacity>
          </View>

          <View style={styles.resumoBody}>
            {/* Lado Esquerdo: Donut Chart com Porcentagem do Orçamento */}
            <BudgetDonut
              percent={budgetProgress}
              centerValue={`${budgetProgress}%`}
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
                <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.insightsText}>
                {homeInsightText}
              </Text>
              <View style={styles.insightsChevronBtn}>
                <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

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
          {accounts.length === 0 ? (
            <TouchableOpacity
              style={styles.emptyAccountRow}
              onPress={() => setModalNewAcc(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.bankIconCircle, { backgroundColor: '#F3F4F6' }]}>
                <Ionicons name="add-circle-outline" size={22} color={COLORS.navy} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.emptyAccountTitle}>Nenhuma conta cadastrada</Text>
                <Text style={styles.emptyAccountSubtitle}>Toque para adicionar sua conta corrente ou poupança</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ) : (
            accounts.map((acc, index) => (
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
            ))
          )}
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

      {/* MODAL SELETOR DE GRUPOS COMPARTILHADOS (CONFORME SOLICITADO) */}
      <Modal
        visible={groupModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGroupModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.groupModalOverlay}
          activeOpacity={1}
          onPress={() => setGroupModalVisible(false)}
        >
          <View style={styles.groupModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.groupModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.groupModalIconBox}>
                  <Ionicons name="people" size={20} color="#7C3AED" />
                </View>
                <View>
                  <Text style={styles.groupModalTitle}>Finanças Compartilhadas</Text>
                  <Text style={styles.groupModalSub}>Seus grupos ativos e membros</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setGroupModalVisible(false)}
                style={styles.groupModalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.groupModalList} showsVerticalScrollIndicator={false}>
              {displayGroups.map((grp) => {
                const isSelected = activeSharedGroup?.id === grp.id;
                const memberCount = grp.members?.length || 2;
                return (
                  <TouchableOpacity
                    key={grp.id}
                    style={[styles.groupItemRow, isSelected && styles.groupItemRowActive]}
                    onPress={() => {
                      if (setActiveGroupId) setActiveGroupId(grp.id);
                      setGroupModalVisible(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.groupItemAvatar, isSelected && styles.groupItemAvatarActive]}>
                      <Ionicons
                        name={grp.type === 'Casal' ? 'heart' : 'people'}
                        size={18}
                        color={isSelected ? '#FFFFFF' : '#7C3AED'}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.groupItemName, isSelected && styles.groupItemNameActive]}>
                          {grp.name}
                        </Text>
                        <View style={styles.groupItemTypeBadge}>
                          <Text style={styles.groupItemTypeBadgeText}>{grp.type || 'Casal'}</Text>
                        </View>
                      </View>
                      <Text style={styles.groupItemMembersText}>
                        {memberCount} {memberCount === 1 ? 'participante' : 'participantes'}
                        {grp.members && grp.members.length > 0
                          ? ` • ${grp.members.map((m) => m.name || m.email).slice(0, 2).join(', ')}`
                          : ''}
                      </Text>
                    </View>

                    {isSelected ? (
                      <View style={styles.groupItemCheckCircle}>
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.manageGroupsBtn}
              onPress={() => {
                setGroupModalVisible(false);
                navigation.navigate('SharedFinances');
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="settings-outline" size={16} color="#7C3AED" />
              <Text style={styles.manageGroupsBtnText}>Gerenciar ou criar novos grupos</Text>
              <Ionicons name="arrow-forward" size={15} color="#7C3AED" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
  brandLogo: {
    width: 36,
    height: 23,
  },
  brandTitle: {
    fontFamily: 'Audiowide',
    color: '#18181B',
    fontSize: 20,
    letterSpacing: 1.5,
    lineHeight: 22,
  },
  brandSubtitle: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginTop: 1,
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
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarTopImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    position: 'relative',
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    aspectRatio: 16 / 9,
    backgroundColor: '#0F0826',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.5)',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  heroMedia: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  heroOverlayTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 10,
    elevation: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  heroContentLeft: {
    width: '64%',
    height: '100%',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroWalletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  walletIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    marginVertical: 4,
  },
  heroTrendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
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
  viewModeContainer: {
    paddingHorizontal: 4,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewModePillGroup: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 3,
  },
  viewModePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  viewModePillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  viewModePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  viewModePillTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  openSharedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  openSharedBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
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
  emptyAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  emptyAccountTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyAccountSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  heroSharedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 10,
    elevation: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroSharedTopPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  heroSharedTopPillText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  heroSharedBalanceBlock: {
    marginVertical: 4,
  },
  heroSharedBalanceLabel: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 13.5,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  heroSharedBalanceValue: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroSharedBottomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 8, 38, 0.72)',
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: 'rgba(168, 85, 247, 0.65)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  heroSharedBottomPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  groupModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  groupModalCard: {
    width: '100%',
    maxHeight: '75%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  groupModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  groupModalIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  groupModalSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  groupModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupModalList: {
    marginVertical: 14,
  },
  groupItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    gap: 12,
  },
  groupItemRowActive: {
    backgroundColor: '#F5EEFD',
    borderColor: '#C084FC',
  },
  groupItemAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupItemAvatarActive: {
    backgroundColor: '#7C3AED',
  },
  groupItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  groupItemNameActive: {
    color: '#6D28D9',
  },
  groupItemTypeBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  groupItemTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
  },
  groupItemMembersText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  groupItemCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageGroupsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F3E8FF',
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  manageGroupsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C3AED',
  },
});
