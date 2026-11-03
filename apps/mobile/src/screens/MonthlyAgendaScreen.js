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
import BankLogo, { getBankInfo } from '../components/BankLogo';

const happyRobotBg = require('../../assets/agenda-robot-happy.png');
const sadRobotBg = require('../../assets/agenda-robot-sad.png');
const finnLogoSource = require('../../assets/finn-logo.png');

const { width } = Dimensions.get('window');

const ALL_CALENDAR_MONTHS = [
  { num: 1, short: 'Jan', full: 'Janeiro' },
  { num: 2, short: 'Fev', full: 'Fevereiro' },
  { num: 3, short: 'Mar', full: 'Março' },
  { num: 4, short: 'Abr', full: 'Abril' },
  { num: 5, short: 'Mai', full: 'Maio' },
  { num: 6, short: 'Jun', full: 'Junho' },
  { num: 7, short: 'Jul', full: 'Julho' },
  { num: 8, short: 'Ago', full: 'Agosto' },
  { num: 9, short: 'Set', full: 'Setembro' },
  { num: 10, short: 'Out', full: 'Outubro' },
  { num: 11, short: 'Nov', full: 'Novembro' },
  { num: 12, short: 'Dez', full: 'Dezembro' },
];

export default function MonthlyAgendaScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    bills,
    transactions,
    toggleBillPaid,
    addBill,
    updateBill,
    deleteBill,
    totalBillsAmount,
    paidBillsAmount,
    pendingBillsAmount,
    allBillsPaid,
    totalBalance,
    totalIncome,
    selectedMonth,
    setSelectedMonth,
  } = useFinance();

  const incomeTransactions = useMemo(() => {
    return (transactions || []).filter((t) => t.type === 'income');
  }, [transactions]);

  // Abas: 'pagar' (A pagar) | 'receber' (A receber)
  const [activeTab, setActiveTab] = useState('pagar');

  // Accordions
  const [expandedPagas, setExpandedPagas] = useState(true);
  const [expandedPendentes, setExpandedPendentes] = useState(true);

  // Modais
  const [modalNewBill, setModalNewBill] = useState(false);
  const [modalMonthPicker, setModalMonthPicker] = useState(false);
  const [modalEditBill, setModalEditBill] = useState(false);

  // Estado para edição de conta
  const [editingBill, setEditingBill] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDay, setEditDay] = useState('10');
  const [editCategory, setEditCategory] = useState('moradia');
  const [editIsRecurring, setEditIsRecurring] = useState(true);
  const [editIsPaid, setEditIsPaid] = useState(false);

  // Ano para o seletor de data moderno
  const [pickerYear, setPickerYear] = useState(2026);

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

  // Abrir modal de edição para qualquer conta
  const handleOpenEditBill = (bill) => {
    setEditingBill(bill);
    setEditTitle(bill.title || '');
    setEditAmount(String(bill.amount !== undefined ? bill.amount : ''));
    setEditDay(String(bill.dueDay || '10'));
    setEditCategory(bill.category || 'moradia');
    setEditIsRecurring(bill.isRecurring !== undefined ? bill.isRecurring : true);
    setEditIsPaid(!!bill.paid);
    setModalEditBill(true);
  };

  // Salvar alterações de valor e detalhes da conta
  const handleSaveEditBill = async () => {
    if (!editingBill) return;
    if (!editTitle.trim()) {
      Alert.alert('Atenção', 'Informe o nome da conta.');
      return;
    }
    const num = parseFloat(String(editAmount).replace(',', '.')) || 0;
    if (num < 0) {
      Alert.alert('Atenção', 'Informe um valor válido.');
      return;
    }
    const day = parseInt(editDay, 10) || 10;

    await updateBill(editingBill.id, {
      title: editTitle.trim(),
      amount: num,
      dueDay: day,
      category: editCategory,
      isRecurring: editIsRecurring,
      paid: editIsPaid,
    });

    setModalEditBill(false);
    setEditingBill(null);
  };

  // Excluir conta com confirmação
  const handleDeleteBill = () => {
    if (!editingBill) return;
    Alert.alert(
      'Excluir Conta',
      `Deseja realmente excluir "${editingBill.title}" da sua agenda?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteBill(editingBill.id);
            setModalEditBill(false);
            setEditingBill(null);
          },
        },
      ]
    );
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
        {/* SUBTÍTULO E LINHA DO MÊS COM DESIGN ELEGANTE */}
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
            <View style={styles.chevronBox}>
              <Ionicons name="chevron-down" size={16} color="#7C3AED" />
            </View>
          </TouchableOpacity>

          <View style={styles.monthHeaderActions}>
            <TouchableOpacity
              style={styles.monthActionBtn}
              activeOpacity={0.7}
              onPress={() => setModalMonthPicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#7C3AED" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.monthActionBtn}
              activeOpacity={0.7}
              onPress={() =>
                Alert.alert(
                  'Agenda Financeira',
                  'Acompanhe todas as contas a pagar e faturas do mês.\n\n• Toque em qualquer conta para editar o valor ou excluir.\n• Toque no botão "Pagar" para alternar o status.'
                )
              }
            >
              <Ionicons name="help-circle-outline" size={20} color="#71717A" />
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
              {/* IMAGEM DE FUNDO DO CARD (FELIZ OU TRISTE - 100% LIMPA SEM BORDAS PRETAS) */}
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
            {pendentesBills.length === 0 && pagasBills.length === 0 && (
              <View style={styles.emptyBillsState}>
                <Ionicons name="receipt-outline" size={40} color="#D1D5DB" />
                <Text style={styles.emptyBillsTitle}>Nenhuma conta agendada</Text>
                <Text style={styles.emptyBillsSub}>
                  Cadastre suas contas fixas e boletos para acompanhar os vencimentos deste mês.
                </Text>
              </View>
            )}

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
                        activeOpacity={0.75}
                        onPress={() => handleOpenEditBill(bill)}
                      >
                        {/* ÍCONE / LOGO DO BANCO */}
                        {renderBillIcon(bill)}

                        {/* DETALHES */}
                        <View style={styles.billInfo}>
                          <View style={styles.billTitleRow}>
                            <Text style={styles.billTitleText} numberOfLines={1}>{bill.title}</Text>
                            {bill.isRecurring && (
                              <Ionicons
                                name="repeat"
                                size={14}
                                color="#6D28D9"
                                style={{ marginLeft: 4 }}
                              />
                            )}
                          </View>
                          <View style={[styles.billDateBadge, styles.billDateBadgePending]}>
                            <Ionicons name="time-outline" size={12} color="#DC2626" />
                            <Text style={styles.billDateTextPending}>
                              {bill.subtext || `Vence dia ${bill.dueDay || 10}`}
                            </Text>
                          </View>
                        </View>

                        {/* VALOR E BOTÃO DE PAGAR */}
                        <View style={styles.billRight}>
                          <Text style={styles.billAmountText}>
                            {formatMoney(bill.amount)}
                          </Text>
                          <TouchableOpacity
                            style={styles.payActionPill}
                            activeOpacity={0.7}
                            onPress={(e) => {
                              e.stopPropagation();
                              toggleBillPaid(bill.id);
                            }}
                          >
                            <Text style={styles.payActionText}>Pagar</Text>
                          </TouchableOpacity>
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
                      activeOpacity={0.75}
                      onPress={() => handleOpenEditBill(bill)}
                    >
                      {/* ÍCONE / LOGO DO BANCO */}
                      {renderBillIcon(bill)}

                      {/* DETALHES */}
                      <View style={styles.billInfo}>
                        <View style={styles.billTitleRow}>
                          <Text style={styles.billTitleText} numberOfLines={1}>{bill.title}</Text>
                          {bill.isRecurring && (
                            <Ionicons
                              name="repeat"
                              size={14}
                              color="#6D28D9"
                              style={{ marginLeft: 4 }}
                            />
                          )}
                        </View>
                        <View style={[styles.billDateBadge, styles.billDateBadgePaid]}>
                          <Ionicons
                            name="checkmark-circle"
                            size={12}
                            color="#16A34A"
                          />
                          <Text style={styles.billDateTextPaid}>
                            {bill.subtext || `Pago · ${bill.dueDay || 10} out`}
                          </Text>
                        </View>
                      </View>

                      {/* VALOR E STATUS PAGO */}
                      <View style={styles.billRight}>
                        <Text style={styles.billAmountText}>
                          {formatMoney(bill.amount)}
                        </Text>
                        <TouchableOpacity
                          style={styles.paidActionPill}
                          activeOpacity={0.7}
                          onPress={(e) => {
                            e.stopPropagation();
                            toggleBillPaid(bill.id);
                          }}
                        >
                          <Ionicons name="checkmark" size={11} color="#16A34A" />
                          <Text style={styles.paidActionText}>Pago</Text>
                        </TouchableOpacity>
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
              <Text style={styles.receberSummaryLabel}>Receitas Registradas</Text>
              <Text style={styles.receberSummaryValue}>
                {formatMoney(totalIncome)}
              </Text>
              <Text style={styles.receberSummarySub}>
                Entradas registradas para {selectedMonth || 'Novembro 2026'}
              </Text>
            </View>

            <View style={styles.billsList}>
              {incomeTransactions.length === 0 ? (
                <View style={styles.emptyBillsState}>
                  <Ionicons name="cash-outline" size={40} color="#D1D5DB" />
                  <Text style={styles.emptyBillsTitle}>Nenhuma receita registrada</Text>
                  <Text style={styles.emptyBillsSub}>
                    Adicione seus rendimentos reais através do botão central (+) no menu inferior.
                  </Text>
                </View>
              ) : (
                incomeTransactions.map((rec) => (
                  <View key={rec.id} style={styles.billCardItem}>
                    <View
                      style={[
                        styles.billIconSquare,
                        { backgroundColor: '#10B98118' },
                      ]}
                    >
                      <Ionicons name="cash-outline" size={20} color="#10B981" />
                    </View>

                    <View style={styles.billInfo}>
                      <Text style={styles.billTitleText}>{rec.description || 'Receita'}</Text>
                      <View style={styles.billStatusRow}>
                        <Ionicons
                          name="checkmark"
                          size={13}
                          color="#22C55E"
                        />
                        <Text style={styles.billPaidText}>
                          Recebido · {rec.date ? rec.date.split('-').reverse().slice(0, 2).join('/') : ''}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.billRight}>
                      <Text style={[styles.billAmountText, { color: '#059669' }]}>
                        + {formatMoney(rec.amount)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
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

      {/* MODAL EDITAR CONTA (EDITAR VALORES MENSAIS E EXCLUIR) */}
      <Modal visible={modalEditBill} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Editar Conta</Text>
                <Text style={styles.modalSubtitle}>
                  Atualize o valor mensal, vencimento ou exclua
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalEditBill(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Nome da Conta</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Celulares internet, Mei, Aluguel"
              placeholderTextColor="#9CA3AF"
              value={editTitle}
              onChangeText={setEditTitle}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Valor Mensal (R$)</Text>
                <TextInput
                  style={[styles.input, styles.inputValueHighlight]}
                  placeholder="0,00"
                  keyboardType="numeric"
                  placeholderTextColor="#9CA3AF"
                  value={editAmount}
                  onChangeText={setEditAmount}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Dia Vencimento</Text>
                <TextInput
                  style={styles.input}
                  placeholder="10"
                  keyboardType="number-pad"
                  placeholderTextColor="#9CA3AF"
                  value={editDay}
                  onChangeText={setEditDay}
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
                    editCategory === cat.id && styles.catPillActive,
                  ]}
                  onPress={() => setEditCategory(cat.id)}
                >
                  <Text
                    style={[
                      styles.catPillText,
                      editCategory === cat.id && styles.catPillTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Status da Conta</Text>
            <View style={styles.statusToggleRow}>
              <TouchableOpacity
                style={[
                  styles.statusToggleBtn,
                  !editIsPaid && styles.statusToggleBtnPendingActive,
                ]}
                onPress={() => setEditIsPaid(false)}
              >
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={!editIsPaid ? '#EF4444' : '#6B7280'}
                />
                <Text
                  style={[
                    styles.statusToggleText,
                    !editIsPaid && styles.statusToggleTextPendingActive,
                  ]}
                >
                  Pendente
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusToggleBtn,
                  editIsPaid && styles.statusToggleBtnPaidActive,
                ]}
                onPress={() => setEditIsPaid(true)}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={editIsPaid ? '#10B981' : '#6B7280'}
                />
                <Text
                  style={[
                    styles.statusToggleText,
                    editIsPaid && styles.statusToggleTextPaidActive,
                  ]}
                >
                  Já Paga
                </Text>
              </TouchableOpacity>
            </View>

            {/* BOTÕES DE AÇÃO: EXCLUIR E SALVAR */}
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalDeleteBtn}
                activeOpacity={0.8}
                onPress={handleDeleteBill}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={styles.modalDeleteBtnText}>Excluir</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveEditBtn}
                activeOpacity={0.85}
                onPress={handleSaveEditBill}
              >
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.modalSaveBtnText}>Salvar Alterações</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL SELETOR DE MÊS & VER DATA MODERNO */}
      <Modal visible={modalMonthPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Ver Data & Período</Text>
                <Text style={styles.modalSubtitle}>
                  Navegue pela agenda mensal das suas finanças
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalMonthPicker(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            {/* SELETOR DE ANO */}
            <View style={styles.pickerYearRow}>
              <TouchableOpacity
                style={styles.pickerYearArrowBtn}
                onPress={() => setPickerYear((y) => y - 1)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={20} color="#7C3AED" />
              </TouchableOpacity>
              <View style={styles.pickerYearBadge}>
                <Ionicons name="calendar" size={16} color="#7C3AED" />
                <Text style={styles.pickerYearText}>{pickerYear}</Text>
              </View>
              <TouchableOpacity
                style={styles.pickerYearArrowBtn}
                onPress={() => setPickerYear((y) => y + 1)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={20} color="#7C3AED" />
              </TouchableOpacity>
            </View>

            {/* GRADE DOS 12 MESES */}
            <View style={styles.monthsGrid}>
              {ALL_CALENDAR_MONTHS.map((m) => {
                const monthString = `${m.full} ${pickerYear}`;
                const isSelected =
                  selectedMonth === monthString ||
                  (!selectedMonth && m.full === 'Outubro' && pickerYear === 2026);

                return (
                  <TouchableOpacity
                    key={m.num}
                    style={[
                      styles.monthGridItem,
                      isSelected && styles.monthGridItemActive,
                    ]}
                    activeOpacity={0.75}
                    onPress={() => {
                      setSelectedMonth?.(monthString);
                      setModalMonthPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.monthGridShortText,
                        isSelected && styles.monthGridShortTextActive,
                      ]}
                    >
                      {m.short}
                    </Text>
                    <Text
                      style={[
                        styles.monthGridFullText,
                        isSelected && styles.monthGridFullTextActive,
                      ]}
                    >
                      {m.full}
                    </Text>
                    {isSelected && (
                      <View style={styles.monthSelectedBadge}>
                        <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* INFORMAÇÃO RESUMO DO MÊS */}
            <View style={styles.monthInfoCard}>
              <Ionicons name="information-circle-outline" size={18} color="#7C3AED" />
              <Text style={styles.monthInfoCardText}>
                Visualizando <Text style={{ fontWeight: '800' }}>{selectedMonth || 'Outubro 2026'}</Text> com {bills.length} contas cadastradas.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Renderiza o badge específico de cada conta igual ao print ou logo oficial do banco
function renderBillIcon(bill) {
  const isCar = bill.title?.toLowerCase().includes('carro') || bill.category === 'transporte';
  const isHome =
    bill.title?.toLowerCase().includes('aluguel') ||
    bill.title?.toLowerCase().includes('net') ||
    bill.title?.toLowerCase().includes('internet') ||
    bill.category === 'moradia';

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

  // Verifica se a conta é um banco / fatura de cartão de crédito
  const bankInfo = getBankInfo(bill.title);
  if (bill.type === 'fatura' || bill.category === 'cartao' || bankInfo.id !== 'other') {
    return <BankLogo bank={bill.title} size={42} />;
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
  chevronBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3EEFF',
    alignItems: 'center',
    justifyContent: 'center',
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
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    aspectRatio: 1008 / 419,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'transparent',
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
  billDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  billDateBadgePaid: {
    backgroundColor: '#ECFDF5',
  },
  billDateBadgePending: {
    backgroundColor: '#FEF2F2',
  },
  billDateTextPaid: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#059669',
  },
  billDateTextPending: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#DC2626',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
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
  paidActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  paidActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16A34A',
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
  modalSubtitle: {
    fontSize: 12.5,
    color: '#71717A',
    marginTop: 2,
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
  inputValueHighlight: {
    fontSize: 17,
    fontWeight: '800',
    color: '#7C3AED',
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
  statusToggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
    marginBottom: 6,
  },
  statusToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  statusToggleBtnPendingActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  statusToggleBtnPaidActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  statusToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  statusToggleTextPendingActive: {
    color: '#DC2626',
  },
  statusToggleTextPaidActive: {
    color: '#059669',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  modalDeleteBtnText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '800',
  },
  modalSaveEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
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
  pickerYearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  pickerYearArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pickerYearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pickerYearText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#18181B',
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  monthGridItem: {
    width: '31%',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  monthGridItemActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#6D28D9',
  },
  monthGridShortText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#18181B',
  },
  monthGridShortTextActive: {
    color: '#FFFFFF',
  },
  monthGridFullText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  monthGridFullTextActive: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  monthSelectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3EEFF',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  monthInfoCardText: {
    flex: 1,
    fontSize: 12,
    color: '#6D28D9',
    fontWeight: '500',
  },
  emptyBillsState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  emptyBillsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#27272A',
    marginTop: 10,
  },
  emptyBillsSub: {
    fontSize: 12,
    color: '#71717A',
    textAlign: 'center',
    marginTop: 4,
  },
});

