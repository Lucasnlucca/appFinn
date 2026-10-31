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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';

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
  } = useFinance();

  const [expandedPagas, setExpandedPagas] = useState(true);
  const [expandedPendentes, setExpandedPendentes] = useState(true);
  const [modalNewBill, setModalNewBill] = useState(false);
  const [billTitle, setBillTitle] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDay, setBillDay] = useState('10');

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
      dueDay: parseInt(billDay, 10) || 10,
      category: 'moradia',
    });

    setBillTitle('');
    setBillAmount('');
    setModalNewBill(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
      >
        {/* HEADER SUPERIOR: "FALTA PAGAR EM OUTUBRO" -> "✓ TUDO PAGO" (IMAGEM 1) */}
        <View style={styles.planningHeader}>
          <Text style={styles.monthSubLabel}>
            Falta pagar em {selectedMonth.toLowerCase().split(' ')[0]}
          </Text>

          {allBillsPaid ? (
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

          {/* TEXTO DE PROGRESSO E BARRA AZUL ESCURO */}
          <Text style={styles.progressSubtitle}>
            {formatMoney(paidBillsAmount)} pago de {formatMoney(totalBillsAmount)} do mês
          </Text>

          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progressPercent}%` },
              ]}
            />
          </View>
        </View>

        {/* CARD: "SE TUDO ACONTECER, NO FIM DO MÊS SOBRA R$ 33.778,15" (IMAGEM 1) */}
        <TouchableOpacity style={styles.projectionCard} activeOpacity={0.85}>
          <View style={{ flex: 1 }}>
            <Text style={styles.projectionLabel}>
              Se tudo acontecer, no fim do mês sobra
            </Text>
            <Text style={styles.projectionValue}>
              {formatMoney(totalBalance)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* SEÇÃO: PENDENTES (SE HOUVER CONTAS EM ABERTO) */}
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
                      <Text style={styles.markPayText}>Toque para pagar</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* SEÇÃO: "PAGAS • 5" COM CONTAS E FATURAS (IDÊNTICO À IMAGEM 1) */}
        <View style={styles.collapsibleBox}>
          <TouchableOpacity
            style={styles.collapsibleHeader}
            onPress={() => setExpandedPagas(!expandedPagas)}
          >
            <View style={styles.collapsibleHeaderLeft}>
              <View style={styles.greenCheckIconWrap}>
                <Ionicons name="checkmark" size={12} color={COLORS.income} />
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
                      { backgroundColor: `${b.iconColor || COLORS.navy}15` },
                    ]}
                  >
                    <Ionicons
                      name={b.icon || 'card'}
                      size={18}
                      color={b.iconColor || COLORS.navy}
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

                  <Text style={styles.billItemAmount}>{formatMoney(b.amount)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* RODAPÉ COM ATALHOS: "🗂️ FATURAS DOS CARTÕES" E "+ CONTA A PAGAR" (IMAGEM 1) */}
        <View style={styles.bottomActionsRow}>
          <TouchableOpacity
            style={styles.actionFooterBtn}
            onPress={() => navigation.navigate('Mais')}
          >
            <Ionicons name="file-tray-full-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.actionFooterText}>Faturas dos cartões</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionFooterBtn}
            onPress={() => setModalNewBill(true)}
          >
            <Text style={styles.plusSign}>+</Text>
            <Text style={styles.actionFooterText}>Conta a pagar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* MODAL PARA ADICIONAR CONTA A PAGAR */}
      <Modal visible={modalNewBill} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Conta a Pagar</Text>
              <TouchableOpacity onPress={() => setModalNewBill(false)}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>NOME DA CONTA</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: Energia Elétrica, Aluguel, Celular..."
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
              placeholder="Dia do mês (ex: 10)"
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
                <Text style={styles.modalConfirmText}>Adicionar Conta</Text>
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  planningHeader: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  monthSubLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  tudoPagoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 6,
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
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
  },
  pendingHeadline: {
    color: COLORS.warning,
    fontSize: 22,
    fontWeight: '800',
    marginVertical: 6,
  },
  progressSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EDF2F7',
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.navy,
    borderRadius: 3,
  },
  projectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  projectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  projectionValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  collapsibleBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapsibleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  greenCheckIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
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
    gap: 8,
  },
  collapsibleAmount: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  billsList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
    paddingTop: 8,
  },
  billItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  billItemBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
  },
  billIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  billItemTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  billItemSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  billItemAmount: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  markPayText: {
    color: COLORS.warning,
    fontSize: 10,
    fontWeight: '700',
  },
  bottomActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 4,
  },
  actionFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  plusSign: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  actionFooterText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  fieldLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    paddingHorizontal: 14,
    height: 48,
    color: COLORS.text,
    fontSize: 14,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
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

