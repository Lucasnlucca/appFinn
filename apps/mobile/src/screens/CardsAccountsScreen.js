import React, { useState } from 'react';
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

export default function CardsAccountsScreen() {
  const insets = useSafeAreaInsets();
  const { accounts, cards, updateAccountBalance } = useFinance();
  const [editingAcc, setEditingAcc] = useState(null);
  const [newBalance, setNewBalance] = useState('');

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
        <Text style={styles.headerTitle}>Contas & Cartões</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 90 }]}
      >
        {/* SEÇÃO CONTAS BANCÁRIAS */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Contas do Casal</Text>
          <Text style={styles.sectionHint}>Toque para ajustar o saldo real</Text>
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
                  <Text style={styles.editText}>Editar</Text>
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
                  <Text style={styles.cardMetaLabel}>Limite</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
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
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
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
    borderRadius: 18,
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
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  accountBank: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  accountRight: {
    alignItems: 'flex-end',
  },
  accountBalance: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  creditCardBox: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBank: {
    color: COLORS.purple,
    fontSize: 14,
    fontWeight: '700',
  },
  cardName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
    paddingTop: 14,
  },
  cardMetaLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginBottom: 2,
  },
  cardMetaValue: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSub: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginBottom: 18,
  },
  modalInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    marginBottom: 20,
  },
  modalCurrency: {
    color: COLORS.textSecondary,
    fontSize: 20,
    fontWeight: '700',
    marginRight: 8,
  },
  modalInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
  },
  modalCancelText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  modalSave: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  modalSaveText: {
    color: COLORS.white,
    fontWeight: '700',
  },
});
