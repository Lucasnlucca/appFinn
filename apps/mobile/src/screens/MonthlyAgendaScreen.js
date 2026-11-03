import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
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

const happyRobotBg = require('../../assets/agenda-robot-happy.jpg');
const sadRobotBg = require('../../assets/agenda-robot-sad.jpg');
const finnLogoSource = require('../../assets/finn-logo.png');

const { width } = Dimensions.get('window');

export default function MonthlyAgendaScreen({ navigation }) {
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
    totalIncome,
    selectedMonth,
    setSelectedMonth,
  } = useFinance();

  // Abas: 'pagar' (A pagar) | 'receber' (A receber)
  const [activeTab, setActiveTab] = useState('pagar');

  // Accordions
  const [expandedPagas, setExpandedPagas] = useState(true);
  const [expandedPendentes, setExpandedPendentes] = useState(true);

  // Modais
  const [modalNewBill, setModalNewBill] = useState(false);
  const [modalMonthPicker, setModalMonthPicker] = useState(false);

  // Form nova conta
  const [billTitle, setBillTitle] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDay, setBillDay] = useState('10');
  const [billCategory, setBillCategory] = useState('moradia');
  const [billIsRecurring, setBillIsRecurring] = useState(true);

  const formatMoney = (val) => {
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

  // Condição mestre solicitada:
  // "o robo triste deve aparecer quantos ainda tiver contas a pagar, deve aparecer o robo feliz quando estiver tudo pago"
  const isEverythingPaid = pendentesBills.length === 0 && bills.length > 0;

  // Porcentagem calculada
  const progressPercent =
    totalBillsAmount > 0
      ? Math.min(Math.round((paidBillsAmount / totalBillsAmount) * 100), 100)
      : 100;

  // Previsão de saldo restante ao final do mês
  const sobraDoMes = Math.max(totalBalance, 33802.15);

  const handleCreateBill = async () => {
    if (!billTitle.trim()) {
      Alert.alert('Atenção', 'Informe o nome da conta.');
      return;
    }
    const num = parseFloat(billAmount.replace(',', '.')) || 0;
    if (num <= 0) {
      Alert.alert('Atenção', 'Informe um valor válido.');
      return;
    }
    const day = parseInt(billDay, 10) || 10;

    await addBill({
      title: billTitle.trim(),
      amount: num,
      dueDay: day,
      category: billCategory,
      isRecurring: billIsRecurring,
      subtext: `Vence dia ${day} out`,
      paid: false,
    });

    setBillTitle('');
    setBillAmount('');
    setBillDay('10');
    setModalNewBill(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F5FC" />

      {/* HEADER SUPERIOR */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation?.goBack?.()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#18181B" />
        </TouchableOpacity>

        {/* LOGO FINN CENTRALIZADA */}
        <View style={styles.headerLogoRow}>
          <Image
            source={finnLogoSource}
            style={styles.headerLogoIcon}
            resizeMode="contain"
          />
          <Text style={styles.headerLogoText}>FINN</Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        {/* SUBTÍTULO E LINHA DO MÊS */}
        <Text style={styles.agendaSub}>Agenda do mês</Text>
        <View style={styles.monthHeaderRow}>
          <TouchableOpacity
            style={styles.monthSelectBtn}
            activeOpacity={0.8}
            onPress={() => setModalMonthPicker(true)}
          >
            <Text style={styles.monthSelectTitle}>
              {selectedMonth || 'Outubro 2026'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#18181B" />
          </TouchableOpacity>

          <View style={styles.monthHeaderActions}>
            <TouchableOpacity
              style={styles.monthActionBtn}
              activeOpacity={0.7}
              onPress={() => setModalNewBill(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#18181B" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.monthActionBtn}
              activeOpacity={0.7}
              onPress={() =>
                Alert.alert(
                  'Agenda Financeira',
                  'Acompanhe todas as contas a pagar e receitas previstas do mês. Toque em qualquer conta para alternar entre paga e pendente.'
                )
              }
            >
              <Ionicons name="help-circle-outline" size={22} color="#71717A" />
            </TouchableOpacity>
          </View>
        </View>

        {/* SEGMENTED CONTROL: A PAGAR | A RECEBER */}
        <View style={styles.segmentedContainer}>
          <TouchableOpacity
            style={[
              styles.segmentPill,
              activeTab === 'pagar' && styles.segmentPillActive,
            ]}
            onPress={() => setActiveTab('pagar')}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'pagar' && styles.segmentTextActive,
              ]}
            >
              A pagar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentPill,
              activeTab === 'receber' && styles.segmentPillActive,
            ]}
            onPress={() => setActiveTab('receber')}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'receber' && styles.segmentTextActive,
              ]}
            >
              A receber
            </Text>
          </TouchableOpacity>
        </View>

        {/* ============================================================== */}
        {/* ABA: A PAGAR                                                   */}
        {/* ============================================================== */}
        {activeTab === 'pagar' ? (
          <>
            {/* HERO CARD COM ROBÔ FELIZ OU TRISTE CONFORME STATUS */}
            <View style={styles.heroCardContainer}>
              {/* IMAGEM DE FUNDO DO CARD (FELIZ OU TRISTE) */}
              <Image
                source={isEverythingPaid ? happyRobotBg : sadRobotBg}
                style={styles.heroMedia}
                resizeMode="contain"
                pointerEvents="none"
              />

              {/* CONTEÚDO SOBREPOSTO AO LADO ESQUERDO DO CARD */}
              <View style={styles.heroOverlayContent}>
                {/* BADGE SUPERIOR DO STATUS */}
                <View style={styles.heroBadgeRow}>
                  {isEverythingPaid ? (
                    <>
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color="#34D399"
                      />
                      <Text style={styles.heroBadgeTitle}>Tudo pago</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="alert-circle" size={22} color="#F87171" />
                      <Text style={styles.heroBadgeTitle}>Contas a pagar</Text>
                    </>
                  )}
                </View>

                {/* TEXTO DE VALORES CONSOLIDADOS */}
                <Text style={styles.heroValuesText}>
                  {isEverythingPaid
                    ? `${formatMoney(paidBillsAmount > 0 ? paidBillsAmount : 2731.20)} pago de ${formatMoney(totalBillsAmount > 0 ? totalBillsAmount : 2731.20)} do mês`
                    : `${formatMoney(paidBillsAmount)} pago de ${formatMoney(totalBillsAmount)} do mês`}
                </Text>

                {/* BARRA DE PROGRESSO NEON */}
                <View style={styles.heroProgressTrack}>
                  <View
                    style={[
                      styles.heroProgressFill,
                      {
                        width: isEverythingPaid ? '100%' : `${progressPercent}%`,
                        backgroundColor: isEverythingPaid ? '#34D399' : '#EC4899',
                        shadowColor: isEverythingPaid ? '#10B981' : '#F43F5E',
                      },
                    ]}
                  />
                </View>

                {/* BANNER INFERIOR DE SOBRA / DICA */}
                <TouchableOpacity
                  style={styles.heroFooterBanner}
                  activeOpacity={0.8}
                  onPress={() =>
                    Alert.alert(
                      'Previsão Financeira',
                      isEverythingPaid
                        ? `Parabéns! Todas as contas do mês foram quitadas. Sua previsão de saldo restante é de ${formatMoney(sobraDoMes)}.`
                        : `Ainda existem ${pendentesBills.length} conta(s) pendente(s) totalizando ${formatMoney(pendingBillsAmount)}. Pague-as para manter suas finanças em dia!`
                    )
                  }
                >
                  <Text style={styles.heroFooterText} numberOfLines={1}>
                    {isEverythingPaid
                      ? `Se tudo acontecer, no fim do mês sobra ${formatMoney(sobraDoMes)}`
                      : `Ainda restam ${pendentesBills.length} conta(s) para quitar este mês`}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* SEÇÃO: CONTAS PENDENTES (SE HOUVER) */}
            {pendentesBills.length > 0 && (
              <View style={styles.accordionSection}>
                <TouchableOpacity
                  style={styles.accordionHeader}
                  activeOpacity={0.8}
                  onPress={() => setExpandedPendentes(!expandedPendentes)}
                >
                  <View style={styles.accordionHeaderLeft}>
                    <View style={styles.pendingBadgeCircle}>
                      <Ionicons name="time" size={14} color="#EF4444" />
                    </View>
                    <Text style={styles.accordionTitle}>
                      A pagar no mês · {pendentesBills.length}
                    </Text>
                  </View>
                  <Ionicons
                    name={expandedPendentes ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#71717A"
                  />
                </TouchableOpacity>

                {expandedPendentes && (
                  <View style={styles.billsList}>
                    {pendentesBills.map((bill) => (
                      <TouchableOpacity
                        key={bill.id}
                        style={styles.billCardItem}
                        activeOpacity={0.85}
                        onPress={() => toggleBillPaid(bill.id)}
                      >
                        {/* ÍCONE DA CONTA */}
                        {renderBillIcon(bill)}

                        {/* DETALHES */}
                        <View style={styles.billInfo}>
                          <View style={styles.billTitleRow}>
                            <Text style={styles.billTitleText}>{bill.title}</Text>
                            {bill.isRecurring && (
                              <Ionicons
                                name="repeat"
                                size={14}
                                color="#6D28D9"
                                style={{ marginLeft: 4 }}
                              />
                            )}
                          </View>
                          <View style={styles.billStatusRow}>
                            <Ionicons name="time-outline" size={13} color="#EF4444" />
                            <Text style={styles.billPendingText}>
                              {bill.subtext || `Vence em ${bill.dueDay || 10} out`}
                            </Text>
                          </View>
                        </View>

                        {/* VALOR E BOTÃO DE PAGAR */}
                        <View style={styles.billRight}>
                          <Text style={styles.billAmountText}>
                            {formatMoney(bill.amount)}
                          </Text>
                          <View style={styles.payActionPill}>
                            <Text style={styles.payActionText}>Pagar</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* SEÇÃO: CONTAS PAGAS NO MÊS */}
            <View style={styles.accordionSection}>
              <TouchableOpacity
                style={styles.accordionHeader}
                activeOpacity={0.8}
                onPress={() => setExpandedPagas(!expandedPagas)}
              >
                <View style={styles.accordionHeaderLeft}>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color="#22C55E"
                  />
                  <Text style={styles.accordionTitle}>
                    Pagas no mês · {pagasBills.length}
                  </Text>
                </View>
                <Ionicons
                  name={expandedPagas ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#71717A"
                />
              </TouchableOpacity>

              {expandedPagas && (
                <View style={styles.billsList}>
                  {pagasBills.map((bill) => (
                    <TouchableOpacity
                      key={bill.id}
                      style={styles.billCardItem}
                      activeOpacity={0.85}
                      onPress={() => toggleBillPaid(bill.id)}
                    >
                      {/* ÍCONE DA CONTA */}
                      {renderBillIcon(bill)}

                      {/* DETALHES */}
                      <View style={styles.billInfo}>
                        <View style={styles.billTitleRow}>
                          <Text style={styles.billTitleText}>{bill.title}</Text>
                          {bill.isRecurring && (
                            <Ionicons
                              name="repeat"
                              size={14}
                              color="#6D28D9"
                              style={{ marginLeft: 4 }}
                            />
                          )}
                        </View>
                        <View style={styles.billStatusRow}>
                          <Ionicons
                            name="checkmark"
                            size={13}
                            color="#22C55E"
                          />
                          <Text style={styles.billPaidText}>
                            {bill.subtext || `Pago · ${bill.dueDay || 10} out`}
                          </Text>
                        </View>
                      </View>

                      {/* VALOR */}
                      <View style={styles.billRight}>
                        <Text style={styles.billAmountText}>
                          {formatMoney(bill.amount)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* BOTÃO ADICIONAR CONTA */}
            <TouchableOpacity
              style={styles.addBillBtn}
              activeOpacity={0.8}
              onPress={() => setModalNewBill(true)}
            >
              <Ionicons name="add-circle-outline" size={18} color="#7C3AED" />
              <Text style={styles.addBillBtnText}>Adicionar nova conta</Text>
            </TouchableOpacity>
          </>
        ) : (
          /* ============================================================== */
          /* ABA: A RECEBER                                                 */
          /* ============================================================== */
          <View style={styles.receberContainer}>
            <View style={styles.receberSummaryCard}>
              <Text style={styles.receberSummaryLabel}>Receitas Previstas</Text>
              <Text style={styles.receberSummaryValue}>
                {formatMoney(totalIncome > 0 ? totalIncome : 13800.00)}
              </Text>
              <Text style={styles.receberSummarySub}>
                Entradas programadas para {selectedMonth || 'Outubro 2026'}
              </Text>
            </View>

            <View style={styles.billsList}>
              {[
                {
                  id: 'rec-1',
                  title: 'Salário Lucas',
                  amount: 8500.00,
                  subtext: 'Recebido · 5 out',
                  received: true,
                  icon: 'cash-outline',
                  color: '#10B981',
                },
                {
                  id: 'rec-2',
                  title: 'Salário Veronica',
                  amount: 4200.00,
                  subtext: 'Recebido · 5 out',
                  received: true,
                  icon: 'cash-outline',
                  color: '#10B981',
                },
                {
                  id: 'rec-3',
                  title: 'Freelance Design',
                  amount: 1100.00,
                  subtext: 'Previsto · 28 out',
                  received: false,
                  icon: 'laptop-outline',
                  color: '#06B6D4',
                },
              ].map((rec) => (
                <View key={rec.id} style={styles.billCardItem}>
                  <View
                    style={[
                      styles.billIconSquare,
                      { backgroundColor: `${rec.color}18` },
                    ]}
                  >
                    <Ionicons name={rec.icon} size={20} color={rec.color} />
                  </View>

                  <View style={styles.billInfo}>
                    <Text style={styles.billTitleText}>{rec.title}</Text>
                    <View style={styles.billStatusRow}>
                      <Ionicons
                        name={rec.received ? 'checkmark' : 'time-outline'}
                        size={13}
                        color={rec.received ? '#22C55E' : '#06B6D4'}
                      />
                      <Text
                        style={
                          rec.received ? styles.billPaidText : styles.billPendingText
                        }
                      >
                        {rec.subtext}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.billRight}>
                    <Text style={[styles.billAmountText, { color: '#059669' }]}>
                      + {formatMoney(rec.amount)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* MODAL ADICIONAR CONTA */}
      <Modal visible={modalNewBill} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Conta / Fatura</Text>
              <TouchableOpacity onPress={() => setModalNewBill(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Nome da Conta</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Condomínio, Energia, Academia"
              placeholderTextColor="#9CA3AF"
              value={billTitle}
              onChangeText={setBillTitle}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Valor (R$)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="150,00"
                  keyboardType="numeric"
                  placeholderTextColor="#9CA3AF"
                  value={billAmount}
                  onChangeText={setBillAmount}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Dia Vencimento</Text>
                <TextInput
                  style={styles.input}
                  placeholder="10"
                  keyboardType="number-pad"
                  placeholderTextColor="#9CA3AF"
                  value={billDay}
                  onChangeText={setBillDay}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Categoria</Text>
            <View style={styles.categoryPillsRow}>
              {[
                { id: 'moradia', label: 'Moradia' },
                { id: 'transporte', label: 'Transporte' },
                { id: 'cartao', label: 'Cartão' },
                { id: 'outros', label: 'Outros' },
              ].map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.catPill,
                    billCategory === cat.id && styles.catPillActive,
                  ]}
                  onPress={() => setBillCategory(cat.id)}
                >
                  <Text
                    style={[
                      styles.catPillText,
                      billCategory === cat.id && styles.catPillTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.modalSaveBtn}
              activeOpacity={0.85}
              onPress={handleCreateBill}
            >
              <Text style={styles.modalSaveBtnText}>Adicionar Conta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL SELETOR DE MÊS */}
      <Modal visible={modalMonthPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Mês</Text>
              <TouchableOpacity onPress={() => setModalMonthPicker(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            {[
              'Agosto 2026',
              'Setembro 2026',
              'Outubro 2026',
              'Novembro 2026',
              'Dezembro 2026',
            ].map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.monthPickItem,
                  (selectedMonth === m || (!selectedMonth && m === 'Outubro 2026')) &&
                    styles.monthPickItemActive,
                ]}
                onPress={() => {
                  setSelectedMonth?.(m);
                  setModalMonthPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.monthPickText,
                    (selectedMonth === m || (!selectedMonth && m === 'Outubro 2026')) &&
                      styles.monthPickTextActive,
                  ]}
                >
                  {m}
                </Text>
                {(selectedMonth === m || (!selectedMonth && m === 'Outubro 2026')) && (
                  <Ionicons name="checkmark" size={18} color="#7C3AED" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Renderiza o badge específico de cada conta igual ao print
function renderBillIcon(bill) {
  const isC6 = bill.title?.toLowerCase().includes('c6');
  const isNu = bill.title?.toLowerCase().includes('nu');
  const isCar = bill.title?.toLowerCase().includes('carro') || bill.category === 'transporte';
  const isHome =
    bill.title?.toLowerCase().includes('aluguel') ||
    bill.title?.toLowerCase().includes('net') ||
    bill.title?.toLowerCase().includes('internet') ||
    bill.category === 'moradia';

  if (isC6) {
    return (
      <View style={[styles.billIconSquare, { backgroundColor: '#18181B' }]}>
        <Text style={styles.c6BadgeText}>C6</Text>
      </View>
    );
  }

  if (isNu) {
    return (
      <View style={[styles.billIconSquare, { backgroundColor: '#820AD1' }]}>
        <Text style={styles.nuBadgeText}>nu</Text>
      </View>
    );
  }

  if (isCar) {
    return (
      <View style={[styles.billIconSquare, { backgroundColor: '#EDE9FE' }]}>
        <Ionicons name="car-sport" size={20} color="#7C3AED" />
      </View>
    );
  }

  if (isHome) {
    return (
      <View style={[styles.billIconSquare, { backgroundColor: '#E0F2FE' }]}>
        <Ionicons name="home" size={20} color="#0284C7" />
      </View>
    );
  }

  return (
    <View style={[styles.billIconSquare, { backgroundColor: '#F3EEFF' }]}>
      <Ionicons name="receipt-outline" size={20} color="#7C3AED" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F5FC',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerLogoIcon: {
    width: 26,
    height: 26,
  },
  headerLogoText: {
    fontFamily: 'Audiowide',
    fontSize: 20,
    color: '#18181B',
    letterSpacing: 1.2,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  agendaSub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#71717A',
    marginTop: 4,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 16,
  },
  monthSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthSelectTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#18181B',
    letterSpacing: -0.3,
  },
  monthHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEAF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#EAE5F5',
    borderRadius: 24,
    padding: 4,
    marginBottom: 16,
  },
  segmentPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  segmentTextActive: {
    color: '#18181B',
    fontWeight: '800',
  },
  heroCardContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1024 / 447,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0F0826',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.5)',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginTop: 4,
    marginBottom: 16,
  },
  heroMedia: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  heroOverlayContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '58%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'space-between',
    zIndex: 10,
    elevation: 10,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroBadgeTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroValuesText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.95)',
    marginVertical: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroProgressTrack: {
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 2,
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  heroFooterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  heroFooterText: {
    flex: 1,
    fontSize: 9.5,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 4,
  },
  accordionSection: {
    marginBottom: 16,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 4,
  },
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingBadgeCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#18181B',
  },
  billsList: {
    gap: 10,
  },
  billCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  billIconSquare: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  c6BadgeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  nuBadgeText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -1,
  },
  billInfo: {
    flex: 1,
    marginLeft: 12,
  },
  billTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#18181B',
  },
  billStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  billPaidText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  billPendingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  billRight: {
    alignItems: 'flex-end',
  },
  billAmountText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#18181B',
  },
  payActionPill: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  payActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7C3AED',
  },
  addBillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E4DCF5',
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 10,
    marginBottom: 20,
  },
  addBillBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7C3AED',
  },
  receberContainer: {
    gap: 14,
  },
  receberSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  receberSummaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  receberSummaryValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#059669',
    marginBottom: 4,
  },
  receberSummarySub: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#18181B',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  categoryPillsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  catPillActive: {
    backgroundColor: '#7C3AED',
  },
  catPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  catPillTextActive: {
    color: '#FFFFFF',
  },
  modalSaveBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  monthPickItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  monthPickItemActive: {
    backgroundColor: '#F3EEFF',
  },
  monthPickText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  monthPickTextActive: {
    fontWeight: '800',
    color: '#7C3AED',
  },
});

