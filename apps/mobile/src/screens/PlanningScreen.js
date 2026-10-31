import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useFinance, CATEGORIES } from '../context/FinanceContext';
import CofrinhosModal from '../components/CofrinhosModal';
import AddTransactionModal from '../components/AddTransactionModal';

export default function PlanningScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    bills,
    toggleBillPaid,
    addBill,
    totalBillsAmount,
    paidBillsAmount,
    pendingBillsAmount,
    allBillsPaid,
    totalBalance,
    selectedMonth,
    cofrinhos,
    depositCofrinho,
    removeCofrinho,
    askAiAboutCofrinho,
    totalFixedExpenses,
    totalVariableExpenses,
    variableExpensesList,
    categoryBreakdown,
    hideBalances,
  } = useFinance();

  // Abas de Planejamento: 'fixed' (Gastos Fixos) | 'variable' (Gastos Variáveis) | 'cofrinhos' (Cofrinhos / Metas)
  const [activeTab, setActiveTab] = useState('fixed');

  const [expandedPagas, setExpandedPagas] = useState(true);
  const [expandedPendentes, setExpandedPendentes] = useState(true);
  const [modalNewBill, setModalNewBill] = useState(false);
  const [billTitle, setBillTitle] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDay, setBillDay] = useState('5');
  const [billCategory, setBillCategory] = useState('moradia');

  // Modais de Cofrinho e Transação
  const [modalCofrinhos, setModalCofrinhos] = useState(false);
  const [modalAddTx, setModalAddTx] = useState(false);

  // IA Advice Modal
  const [aiLoadingId, setAiLoadingId] = useState(null);
  const [aiAdviceModal, setAiAdviceModal] = useState(false);
  const [currentAiAdvice, setCurrentAiAdvice] = useState('');
  const [adviceCofTitle, setAdviceCofTitle] = useState('');

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

  const pagasBills = bills.filter((b) => b.paid);
  const pendentesBills = bills.filter((b) => !b.paid);

  const progressPercent =
    totalBillsAmount > 0
      ? Math.min(Math.round((paidBillsAmount / totalBillsAmount) * 100), 100)
      : 100;

  const handleCreateBill = async () => {
    if (!billTitle.trim() || !billAmount) {
      Alert.alert('Atenção', 'Preencha o nome da conta e o valor.');
      return;
    }
    const num = parseFloat(billAmount.replace(',', '.'));
    if (isNaN(num) || num <= 0) return;

    await addBill({
      title: billTitle.trim(),
      amount: num,
      dueDay: parseInt(billDay, 10) || 5,
      category: billCategory,
    });

    setBillTitle('');
    setBillAmount('');
    setModalNewBill(false);
  };

  const handleAskAi = async (cof) => {
    setAiLoadingId(cof.id);
    setAdviceCofTitle(cof.title);
    try {
      const advice = await askAiAboutCofrinho(cof.id);
      setCurrentAiAdvice(advice);
      setAiAdviceModal(true);
    } catch (e) {
      Alert.alert('Erro ao consultar IA', e.message);
    } finally {
      setAiLoadingId(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* HEADER SUPERIOR */}
      <View style={styles.topHeader}>
        <Text style={styles.pageTitle}>Planejamento Financeiro</Text>
        <Text style={styles.pageSubTitle}>
          Controle de gastos fixos, variáveis e metas do casal
        </Text>

        {/* SELETOR DE ABAS: GASTOS FIXOS | GASTOS VARIÁVEIS | COFRINHOS */}
        <View style={styles.tabSegmentsRow}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'fixed' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('fixed')}
          >
            <Ionicons
              name="calendar"
              size={14}
              color={activeTab === 'fixed' ? COLORS.white : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.segmentBtnText,
                activeTab === 'fixed' && styles.segmentBtnTextActive,
              ]}
            >
              Gastos Fixos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'variable' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('variable')}
          >
            <Ionicons
              name="cart"
              size={14}
              color={activeTab === 'variable' ? COLORS.white : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.segmentBtnText,
                activeTab === 'variable' && styles.segmentBtnTextActive,
              ]}
            >
              Variáveis
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'cofrinhos' && styles.segmentBtnCofrinhoActive]}
            onPress={() => setActiveTab('cofrinhos')}
          >
            <Ionicons
              name="sparkles"
              size={14}
              color={activeTab === 'cofrinhos' ? COLORS.white : '#06B6D4'}
            />
            <Text
              style={[
                styles.segmentBtnText,
                activeTab === 'cofrinhos' && styles.segmentBtnTextActive,
              ]}
            >
              Cofrinhos ({cofrinhos.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
      >
        {/* ============================================================== */}
        {/* ABA 1: GASTOS FIXOS (IMAGEM 1 DO IPHONE) */}
        {/* ============================================================== */}
        {activeTab === 'fixed' && (
          <>
            <View style={styles.planningHeader}>
              <Text style={styles.monthSubLabel}>
                Falta pagar em {selectedMonth.toLowerCase().split(' ')[0]}
              </Text>

              {bills.length === 0 ? (
                <View style={styles.tudoPagoRow}>
                  <View style={[styles.tudoPagoCheck, { backgroundColor: COLORS.navy }]}>
                    <Ionicons name="sparkles" size={14} color={COLORS.white} />
                  </View>
                  <Text style={[styles.tudoPagoTitle, { color: COLORS.navy }]}>
                    Tudo em dia
                  </Text>
                </View>
              ) : allBillsPaid ? (
                <View style={styles.tudoPagoRow}>
                  <View style={styles.tudoPagoCheck}>
                    <Ionicons name="checkmark" size={16} color={COLORS.white} />
                  </View>
                  <Text style={styles.tudoPagoTitle}>Tudo pago</Text>
                </View>
              ) : (
                <Text style={styles.pendingHeadline}>
                  Faltam {formatMoney(pendingBillsAmount)}
                </Text>
              )}

              <Text style={styles.progressSubtitle}>
                {bills.length === 0
                  ? 'Nenhuma fatura ou boleto pendente para este mês'
                  : `${formatMoney(paidBillsAmount)} pago de ${formatMoney(totalBillsAmount)} do mês`}
              </Text>

              <View style={styles.progressBarTrack}>
                <View
                  style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
                />
              </View>
            </View>

            {/* CARD: PROJEÇÃO REAL FIM DO MÊS */}
            <TouchableOpacity style={styles.projectionCard} activeOpacity={0.85}>
              <View style={{ flex: 1 }}>
                <Text style={styles.projectionLabel}>
                  Se tudo acontecer, no fim do mês sobra
                </Text>
                <Text style={styles.projectionValue}>
                  {formatMoney(totalBalance - pendingBillsAmount)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            {/* MENSAGEM SE NÃO HOUVER CONTAS */}
            {bills.length === 0 && (
              <View style={styles.emptyBillsCard}>
                <Ionicons name="calendar-outline" size={32} color={COLORS.textMuted} />
                <Text style={styles.emptyBillsTitle}>Nenhum gasto fixo cadastrado</Text>
                <Text style={styles.emptyBillsSub}>
                  Toque em "+ Conta a pagar" no rodapé para adicionar aluguel, internet, condomínio ou faturas.
                </Text>
              </View>
            )}

            {/* SEÇÃO: PENDENTES */}
            {pendentesBills.length > 0 && (
              <View style={styles.collapsibleBox}>
                <TouchableOpacity
                  style={styles.collapsibleHeader}
                  onPress={() => setExpandedPendentes(!expandedPendentes)}
                >
                  <View style={styles.collapsibleHeaderLeft}>
                    <View style={styles.clockIconWrap}>
                      <Ionicons name="time" size={14} color={COLORS.warning} />
                    </View>
                    <Text style={styles.collapsibleTitle}>
                      Pendentes • {pendentesBills.length}
                    </Text>
                  </View>

                  <View style={styles.collapsibleHeaderRight}>
                    <Text style={[styles.collapsibleAmount, { color: COLORS.warning }]}>
                      {formatMoney(pendingBillsAmount)}
                    </Text>
                    <Ionicons
                      name={expandedPendentes ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={COLORS.textSecondary}
                    />
                  </View>
                </TouchableOpacity>

                {expandedPendentes && (
                  <View style={styles.billsList}>
                    {pendentesBills.map((b, idx) => (
                      <TouchableOpacity
                        key={b.id}
                        style={[styles.billItemRow, idx > 0 && styles.billItemBorder]}
                        onPress={() => toggleBillPaid(b.id)}
                      >
                        <View
                          style={[
                            styles.billIconCircle,
                            { backgroundColor: `${b.iconColor || COLORS.info}15` },
                          ]}
                        >
                          <Ionicons
                            name={b.icon || 'receipt-outline'}
                            size={18}
                            color={b.iconColor || COLORS.info}
                          />
                        </View>

                        <View style={styles.billItemInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.billItemTitle}>{b.title}</Text>
                            {b.isRecurring && (
                              <Ionicons name="sync" size={12} color={COLORS.textMuted} />
                            )}
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="time-outline" size={11} color={COLORS.warning} />
                            <Text style={styles.billItemSub}>{b.subtext}</Text>
                          </View>
                        </View>

                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <Text style={styles.billItemAmount}>{formatMoney(b.amount)}</Text>
                          <View style={styles.actionPillPending}>
                            <Text style={styles.actionPillTextPending}>Pagar</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* SEÇÃO: PAGAS */}
            {pagasBills.length > 0 && (
              <View style={styles.collapsibleBox}>
                <TouchableOpacity
                  style={styles.collapsibleHeader}
                  onPress={() => setExpandedPagas(!expandedPagas)}
                >
                  <View style={styles.collapsibleHeaderLeft}>
                    <View style={styles.checkIconWrap}>
                      <Ionicons name="checkmark" size={13} color={COLORS.income} />
                    </View>
                    <Text style={styles.collapsibleTitle}>
                      Pagas • {pagasBills.length}
                    </Text>
                  </View>

                  <View style={styles.collapsibleHeaderRight}>
                    <Text style={styles.collapsibleAmount}>
                      {formatMoney(paidBillsAmount)}
                    </Text>
                    <Ionicons
                      name={expandedPagas ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={COLORS.textSecondary}
                    />
                  </View>
                </TouchableOpacity>

                {expandedPagas && (
                  <View style={styles.billsList}>
                    {pagasBills.map((b, idx) => (
                      <TouchableOpacity
                        key={b.id}
                        style={[styles.billItemRow, idx > 0 && styles.billItemBorder]}
                        onPress={() => toggleBillPaid(b.id)}
                      >
                        <View
                          style={[
                            styles.billIconCircle,
                            { backgroundColor: `${b.iconColor || COLORS.info}15` },
                          ]}
                        >
                          <Ionicons
                            name={b.icon || 'receipt-outline'}
                            size={18}
                            color={b.iconColor || COLORS.info}
                          />
                        </View>

                        <View style={styles.billItemInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.billItemTitle}>{b.title}</Text>
                            {b.isRecurring && (
                              <Ionicons name="sync" size={12} color={COLORS.textMuted} />
                            )}
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="checkmark-circle" size={11} color={COLORS.income} />
                            <Text style={styles.billItemSub}>{b.subtext}</Text>
                          </View>
                        </View>

                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <Text style={styles.billItemAmount}>{formatMoney(b.amount)}</Text>
                          <View style={styles.actionPillPaid}>
                            <Text style={styles.actionPillTextPaid}>Pago</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* BOTÕES DE RODAPÉ DE GASTOS FIXOS */}
            <View style={styles.bottomActionsRow}>
              <TouchableOpacity
                style={styles.actionFooterBtn}
                onPress={() => navigation.navigate('Mais')}
              >
                <Ionicons name="business-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.actionFooterText}>Gerenciar bancos</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionFooterBtn}
                onPress={() => setModalNewBill(true)}
              >
                <Text style={styles.plusSign}>+</Text>
                <Text style={styles.actionFooterText}>Gasto fixo</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ============================================================== */}
        {/* ABA 2: GASTOS VARIÁVEIS (MERCADO, FARMÁCIA, LAZER) */}
        {/* ============================================================== */}
        {activeTab === 'variable' && (
          <>
            <View style={styles.variableHeroCard}>
              <Text style={styles.varHeroLabel}>Total em Gastos Variáveis</Text>
              <Text style={styles.varHeroValue}>{formatMoney(totalVariableExpenses)}</Text>
              <Text style={styles.varHeroSub}>
                Alimentação, transporte, lazer e compras do dia a dia
              </Text>
            </View>

            <View style={styles.sectionHeaderWrap}>
              <Text style={styles.sectionTitleText}>Categorias Variáveis</Text>
              <TouchableOpacity onPress={() => setModalAddTx(true)}>
                <Text style={styles.linkOrange}>+ Lançar gasto</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.categoriesCard}>
              {categoryBreakdown.length === 0 ? (
                <View style={styles.emptyCatWrap}>
                  <Ionicons name="cart-outline" size={32} color={COLORS.textMuted} />
                  <Text style={styles.emptyBillsTitle}>Nenhum gasto variável este mês</Text>
                  <Text style={styles.emptyBillsSub}>
                    Despesas do dia a dia lançadas aqui ajudam a IA a traçar metas de economia.
                  </Text>
                </View>
              ) : (
                categoryBreakdown.map((cat, idx) => (
                  <View
                    key={cat.id}
                    style={[styles.catRowItem, idx > 0 && styles.billItemBorder]}
                  >
                    <View style={styles.catLeftRow}>
                      <Text style={{ fontSize: 20 }}>{cat.emoji || '📦'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.catLabelText}>{cat.label}</Text>
                        <View style={styles.catProgTrack}>
                          <View
                            style={[
                              styles.catProgFill,
                              {
                                width: `${cat.percentOfBudget || 0}%`,
                                backgroundColor: cat.color || '#3B82F6',
                              },
                            ]}
                          />
                        </View>
                      </View>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.catSpentText}>{formatMoney(cat.spent)}</Text>
                      <Text style={styles.catBudgetText}>meta {formatMoney(cat.budget)}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {/* ============================================================== */}
        {/* ABA 3: COFRINHOS & METAS (PRINT 1 DO USUÁRIO) */}
        {/* ============================================================== */}
        {activeTab === 'cofrinhos' && (
          <>
            <View style={styles.cofrinhosBanner}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>Cofrinhos de Metas</Text>
                <Text style={styles.bannerSub}>
                  {cofrinhos.length} {cofrinhos.length === 1 ? 'meta ativa' : 'metas ativas'} com consultoria da IA FINN
                </Text>
              </View>

              <TouchableOpacity
                style={styles.addCofHeaderBtn}
                onPress={() => setModalCofrinhos(true)}
              >
                <Ionicons name="add" size={16} color={COLORS.white} />
                <Text style={styles.addCofHeaderBtnText}>Novo Cofrinho</Text>
              </TouchableOpacity>
            </View>

            {cofrinhos.length === 0 ? (
              <View style={styles.emptyBillsCard}>
                <Ionicons name="wallet-outline" size={36} color={COLORS.textMuted} />
                <Text style={styles.emptyBillsTitle}>Nenhum cofrinho cadastrado</Text>
                <Text style={styles.emptyBillsSub}>
                  Toque no botão acima para planejar uma aquisição (Carro, Viagem, Reforma) e a IA FINN te dirá onde economizar.
                </Text>
              </View>
            ) : (
              cofrinhos.map((cof) => {
                const target = cof.targetAmount || 1;
                const current = cof.currentAmount || 0;
                const percent = Math.min(Math.round((current / target) * 1000) / 10, 100);
                const remaining = Math.max(target - current, 0);

                return (
                  <View key={cof.id} style={styles.cofCardLarge}>
                    <View style={styles.cofCardLargeTop}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={styles.largeEmojiBox}>
                          <Text style={{ fontSize: 24 }}>{cof.emoji || '🚗'}</Text>
                        </View>
                        <View>
                          <Text style={styles.largeCofTitle}>{cof.title}</Text>
                          <Text style={styles.largeCofDeadline}>{cof.deadline || 'Sem prazo'}</Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        onPress={() => {
                          Alert.alert('Excluir meta', `Deseja remover "${cof.title}"?`, [
                            { text: 'Cancelar', style: 'cancel' },
                            { text: 'Excluir', style: 'destructive', onPress: () => removeCofrinho(cof.id) },
                          ]);
                        }}
                      >
                        <Ionicons name="trash-outline" size={17} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.numbersLargeRow}>
                      <Text style={styles.largeCurrentVal}>{formatMoney(current)}</Text>
                      <Text style={styles.largeTargetVal}>de {formatMoney(target)}</Text>
                    </View>

                    <View style={styles.progressTrackCyan}>
                      <View style={[styles.progressFillCyan, { width: `${percent}%` }]} />
                    </View>

                    <View style={styles.progressFooterCyan}>
                      <Text style={styles.percentCyanText}>{percent.toFixed(1)}% atingido</Text>
                      <Text style={styles.remainingCyanText}>Falta {formatMoney(remaining)}</Text>
                    </View>

                    <View style={styles.cofActionButtonsRow}>
                      <TouchableOpacity
                        style={styles.depositCofActionBtn}
                        onPress={() => setModalCofrinhos(true)}
                      >
                        <Ionicons name="wallet-outline" size={15} color={COLORS.white} />
                        <Text style={styles.depositCofActionBtnText}>Guardar valor</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.aiAdviceCofBtn}
                        onPress={() => handleAskAi(cof)}
                        disabled={aiLoadingId === cof.id}
                      >
                        {aiLoadingId === cof.id ? (
                          <ActivityIndicator size="small" color="#06B6D4" />
                        ) : (
                          <>
                            <Ionicons name="sparkles" size={15} color="#06B6D4" />
                            <Text style={styles.aiAdviceCofBtnText}>Onde Economizar?</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* MODAL PARA ADICIONAR GASTO FIXO */}
      <Modal visible={modalNewBill} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Novo Gasto Fixo</Text>
              <TouchableOpacity onPress={() => setModalNewBill(false)}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>DESCRIÇÃO</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: Aluguel, Internet, Condomínio..."
              placeholderTextColor={COLORS.textMuted}
              value={billTitle}
              onChangeText={setBillTitle}
            />

            <Text style={styles.fieldLabel}>VALOR (R$)</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={COLORS.textMuted}
              value={billAmount}
              onChangeText={setBillAmount}
            />

            <Text style={styles.fieldLabel}>DIA DO VENCIMENTO</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              placeholder="Ex: 5"
              placeholderTextColor={COLORS.textMuted}
              value={billDay}
              onChangeText={setBillDay}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalNewBill(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleCreateBill}
              >
                <Text style={styles.modalConfirmText}>Salvar Gasto Fixo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL GERAL DE COFRINHOS */}
      <CofrinhosModal
        visible={modalCofrinhos}
        onClose={() => setModalCofrinhos(false)}
      />

      {/* MODAL DE LANÇAR TRANSAÇÃO */}
      <AddTransactionModal
        visible={modalAddTx}
        onClose={() => setModalAddTx(false)}
      />

      {/* MODAL DE CONSELHO DA IA */}
      <Modal visible={aiAdviceModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="sparkles" size={18} color="#06B6D4" />
                <Text style={styles.modalTitle}>Dica da IA FINN: {adviceCofTitle}</Text>
              </View>
              <TouchableOpacity onPress={() => setAiAdviceModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginVertical: 10 }}>
              <Text style={styles.aiAdviceText}>{currentAiAdvice}</Text>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalConfirmBtn}
              onPress={() => setAiAdviceModal(false)}
            >
              <Text style={styles.modalConfirmText}>Entendi, vamos aplicar!</Text>
            </TouchableOpacity>
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
  topHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
  },
  pageTitle: {
    color: COLORS.navy,
    fontSize: 20,
    fontWeight: '900',
  },
  pageSubTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 10,
  },
  tabSegmentsRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F1F5F9',
    padding: 4,
    borderRadius: 14,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.navy,
  },
  segmentBtnCofrinhoActive: {
    backgroundColor: '#0E2F5A',
  },
  segmentBtnText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  segmentBtnTextActive: {
    color: COLORS.white,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 14,
  },
  planningHeader: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  monthSubLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  tudoPagoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  tudoPagoCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.income,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tudoPagoTitle: {
    color: COLORS.income,
    fontSize: 24,
    fontWeight: '900',
  },
  pendingHeadline: {
    color: COLORS.navy,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
  },
  progressSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#EEF2F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.navy,
    borderRadius: 4,
  },
  projectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  projectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  projectionValue: {
    color: COLORS.navy,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  emptyBillsCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    gap: 8,
  },
  emptyBillsTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyBillsSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  collapsibleBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  collapsibleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clockIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.incomeLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsibleTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  collapsibleHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  collapsibleAmount: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  billsList: {
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
  },
  billItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  billItemBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  billIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  billItemInfo: {
    flex: 1,
    gap: 3,
  },
  billItemTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  billItemSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  billItemAmount: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  actionPillPending: {
    backgroundColor: COLORS.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  actionPillTextPending: {
    color: COLORS.warning,
    fontSize: 10,
    fontWeight: '800',
  },
  actionPillPaid: {
    backgroundColor: COLORS.incomeLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  actionPillTextPaid: {
    color: COLORS.income,
    fontSize: 10,
    fontWeight: '800',
  },
  bottomActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  actionFooterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  actionFooterText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  plusSign: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: '800',
  },
  variableHeroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  varHeroLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  varHeroValue: {
    color: COLORS.navy,
    fontSize: 28,
    fontWeight: '900',
    marginVertical: 4,
  },
  varHeroSub: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  sectionTitleText: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: '800',
  },
  linkOrange: {
    color: '#F97316',
    fontSize: 13,
    fontWeight: '700',
  },
  categoriesCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  emptyCatWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  catRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  catLeftRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 14,
  },
  catLabelText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  catProgTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  catProgFill: {
    height: '100%',
    borderRadius: 3,
  },
  catSpentText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  catBudgetText: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  cofrinhosBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  bannerTitle: {
    color: COLORS.navy,
    fontSize: 18,
    fontWeight: '900',
  },
  bannerSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  addCofHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0E2F5A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addCofHeaderBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  cofCardLarge: {
    backgroundColor: '#1E232A',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A313C',
  },
  cofCardLargeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  largeEmojiBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#13171D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A313C',
  },
  largeCofTitle: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '800',
  },
  largeCofDeadline: {
    color: '#94A3B8',
    fontSize: 11,
  },
  numbersLargeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 8,
  },
  largeCurrentVal: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '900',
  },
  largeTargetVal: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrackCyan: {
    height: 8,
    backgroundColor: '#13171D',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFillCyan: {
    height: '100%',
    backgroundColor: '#06B6D4',
    borderRadius: 4,
  },
  progressFooterCyan: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  percentCyanText: {
    color: '#06B6D4',
    fontSize: 12,
    fontWeight: '700',
  },
  remainingCyanText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  cofActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#2A313C',
    paddingTop: 12,
  },
  depositCofActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0E2F5A',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  depositCofActionBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  aiAdviceCofBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#13171D',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#06B6D4',
  },
  aiAdviceCofBtnText: {
    color: '#06B6D4',
    fontSize: 13,
    fontWeight: '700',
  },
  aiAdviceText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    color: COLORS.navy,
    fontSize: 18,
    fontWeight: '800',
  },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
  },
  modalCancelText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  modalConfirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.navy,
  },
  modalConfirmText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },
});
