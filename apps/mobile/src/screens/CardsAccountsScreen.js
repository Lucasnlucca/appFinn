import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { getConnectedBanks } from '../services/openFinanceService';
import OpenFinanceModal from '../components/OpenFinanceModal';

export default function CardsAccountsScreen() {
  const insets = useSafeAreaInsets();
  const { accounts, cards, updateAccountBalance } = useFinance();
  const [editingAcc, setEditingAcc] = useState(null);
  const [newBalance, setNewBalance] = useState('');
  const [openFinanceVisible, setOpenFinanceVisible] = useState(false);
  const [connectedBanks, setConnectedBanks] = useState([]);

  useEffect(() => {
    loadBanks();
  }, [openFinanceVisible]);

  const loadBanks = async () => {
    const list = await getConnectedBanks();
    setConnectedBanks(list);
  };

  const formatCurrency = (val) => {
    return 'R$ ' + (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleSaveBalance = async () => {
    if (!editingAcc) return;
    await updateAccountBalance(editingAcc.id, newBalance.replace(',', '.'));
    setEditingAcc(null);
    setNewBalance('');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Contas & Cartões</Text>
          <Text style={styles.headerSubtitle}>Gerenciamento bancário e Open Finance do casal</Text>
        </View>
        <TouchableOpacity
          style={styles.openFinanceHeaderBtn}
          onPress={() => setOpenFinanceVisible(true)}
        >
          <Ionicons name="shield-checkmark" size={16} color={COLORS.primary} />
          <Text style={styles.openFinanceHeaderBtnText}>Open Finance</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 90 }]}
      >
        {/* BANNER OPEN FINANCE BRASIL */}
        <View style={styles.openFinanceBanner}>
          <View style={styles.openFinanceTop}>
            <View style={styles.ofIconWrap}>
              <Ionicons name="link" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.ofTitleRow}>
                <Text style={styles.ofTitle}>Open Finance Brasil</Text>
                <View style={styles.readOnlyBadge}>
                  <Text style={styles.readOnlyText}>Somente Leitura</Text>
                </View>
              </View>
              <Text style={styles.ofSubtitle}>
                {connectedBanks.length > 0
                  ? `${connectedBanks.length} banco(s) conectado(s) e sincronizando transações`
                  : 'Conecte seus bancos para leitura automática de saldo e extrato'}
              </Text>
            </View>
          </View>

          {connectedBanks.length > 0 && (
            <View style={styles.connectedBankChips}>
              {connectedBanks.map((b) => (
                <View key={b.id} style={styles.bankChip}>
                  <View style={[styles.bankChipDot, { backgroundColor: b.color }]} />
                  <Text style={styles.bankChipName}>{b.name}</Text>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.ofActionBtn}
            onPress={() => setOpenFinanceVisible(true)}
          >
            <Text style={styles.ofActionBtnText}>
              {connectedBanks.length > 0 ? 'Gerenciar Bancos Conectados' : 'Conectar Banco (Nubank, Inter, Itaú...)'}
            </Text>
            <Ionicons name="arrow-forward" size={16} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* SEÇÃO CONTAS BANCÁRIAS */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Contas do Casal</Text>
          <Text style={styles.sectionHint}>Toque para ajustar o saldo real manualmente</Text>
        </View>

        <View style={styles.cardList}>
          {accounts.map((acc) => (
            <TouchableOpacity
              key={acc.id}
              style={styles.accountCard}
              onPress={() => {
                setEditingAcc(acc);
                setNewBalance(String(acc.balance || 0));
              }}
            >
              <View style={styles.accountLeft}>
                <View style={styles.bankIconWrap}>
                  <Ionicons name="business-outline" size={20} color={COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.accountName}>{acc.name}</Text>
                  <Text style={styles.accountBank}>{acc.bank}</Text>
                </View>
              </View>

              <View style={styles.accountRight}>
                <Text style={styles.accountBalance}>{formatCurrency(acc.balance)}</Text>
                <View style={styles.editRow}>
                  <Ionicons name="pencil" size={12} color={COLORS.primary} />
                  <Text style={styles.editText}>Editar Saldo</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* SEÇÃO CARTÕES DE CRÉDITO */}
        <View style={[styles.sectionHead, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Cartões de Crédito</Text>
        </View>

        <View style={styles.cardList}>
          {cards.map((card) => (
            <View key={card.id} style={styles.creditCardBox}>
              <View style={styles.cardTop}>
                <View style={styles.cardChip}>
                  <Ionicons name="card" size={24} color={COLORS.purple} />
                </View>
                <Text style={styles.cardBank}>{card.bank}</Text>
              </View>

              <Text style={styles.cardName}>{card.name}</Text>

              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.cardMetaLabel}>Limite Disponível</Text>
                  <Text style={styles.cardMetaValue}>{formatCurrency(card.limit)}</Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.cardMetaLabel}>Dia de Vencimento</Text>
                  <Text style={styles.cardMetaValue}>Todo dia {card.dueDay}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* MODAL DE AJUSTE DE SALDO REAL */}
      <Modal visible={!!editingAcc} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Ajustar Saldo Real</Text>
            <Text style={styles.modalSub}>{editingAcc?.name} ({editingAcc?.bank})</Text>

            <View style={styles.modalInputWrap}>
              <Text style={styles.modalCurrency}>R$</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="decimal-pad"
                value={newBalance}
                onChangeText={setNewBalance}
                placeholder="0,00"
                placeholderTextColor={COLORS.textMuted}
                autoFocus
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setEditingAcc(null)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSave}
                onPress={handleSaveBalance}
              >
                <Text style={styles.modalSaveText}>Salvar Saldo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <OpenFinanceModal
        visible={openFinanceVisible}
        onClose={() => setOpenFinanceVisible(false)}
        onBankConnected={() => loadBanks()}
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
    backgroundColor: COLORS.surface,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  openFinanceHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  openFinanceHeaderBtnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  openFinanceBanner: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    marginBottom: 20,
  },
  openFinanceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ofIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ofTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ofTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },
  readOnlyBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  readOnlyText: {
    color: '#3B82F6',
    fontSize: 10,
    fontWeight: '700',
  },
  ofSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  connectedBankChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
  },
  bankChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  bankChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bankChipName: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  ofActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    height: 44,
    borderRadius: 12,
    marginTop: 14,
  },
  ofActionBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
  sectionHead: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHint: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  cardList: {
    gap: 12,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  accountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bankIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  accountBank: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  accountRight: {
    alignItems: 'flex-end',
  },
  accountBalance: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  editText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  creditCardBox: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardChip: {
    width: 40,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBank: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  cardName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    paddingTop: 12,
  },
  cardMetaLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardMetaValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalSub: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
    marginBottom: 16,
  },
  modalInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 18,
  },
  modalCurrency: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '800',
    marginRight: 6,
  },
  modalInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  modalCancelText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  modalSave: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  modalSaveText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 14,
  },
});
