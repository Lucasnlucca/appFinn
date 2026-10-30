import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useFinance, CATEGORIES } from '../context/FinanceContext';

export default function AddTransactionModal({ visible, onClose }) {
  const { addTransaction, accounts, members, activeMember } = useFinance();
  const [type, setType] = useState('expense'); // 'expense' | 'income'
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('alimentacao');
  const [author, setAuthor] = useState(activeMember === 'Casal' ? members.user1 : activeMember);
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');

  const handleSave = async () => {
    if (!description.trim() || !amount.trim()) return;

    await addTransaction({
      description: description.trim(),
      amount: parseFloat(amount.replace(',', '.')),
      type,
      category,
      author,
      accountId,
    });

    setDescription('');
    setAmount('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Novo Lançamento</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Toggle Tipo: Despesa / Receita */}
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'expense' && styles.typeBtnExpenseActive]}
                onPress={() => setType('expense')}
              >
                <Ionicons
                  name="arrow-down-circle"
                  size={18}
                  color={type === 'expense' ? COLORS.white : COLORS.expense}
                />
                <Text style={[styles.typeBtnText, type === 'expense' && styles.typeBtnTextActive]}>
                  Despesa
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeBtn, type === 'income' && styles.typeBtnIncomeActive]}
                onPress={() => setType('income')}
              >
                <Ionicons
                  name="arrow-up-circle"
                  size={18}
                  color={type === 'income' ? COLORS.white : COLORS.income}
                />
                <Text style={[styles.typeBtnText, type === 'income' && styles.typeBtnTextActive]}>
                  Receita
                </Text>
              </TouchableOpacity>
            </View>

            {/* Input Valor */}
            <View style={styles.amountWrap}>
              <Text style={styles.currencySymbol}>R$</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0,00"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            {/* Input Descrição */}
            <Text style={styles.label}>Descrição</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Supermercado, Farmácia, Salário"
              placeholderTextColor={COLORS.textMuted}
              value={description}
              onChangeText={setDescription}
            />

            {/* Responsável (Casal: Henrique ou Esposa) */}
            <Text style={styles.label}>Quem realizou?</Text>
            <View style={styles.authorRow}>
              {[members.user1, members.user2].map((name) => (
                <TouchableOpacity
                  key={name}
                  style={[styles.authorChip, author === name && styles.authorChipActive]}
                  onPress={() => setAuthor(name)}
                >
                  <Ionicons
                    name="person"
                    size={14}
                    color={author === name ? COLORS.white : COLORS.textSecondary}
                  />
                  <Text style={[styles.authorText, author === name && styles.authorTextActive]}>
                    {name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Categoria */}
            <Text style={styles.label}>Categoria</Text>
            <View style={styles.categoriesGrid}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryCard,
                      isSelected && { borderColor: cat.color, backgroundColor: 'rgba(255,255,255,0.08)' },
                    ]}
                    onPress={() => setCategory(cat.id)}
                  >
                    <Ionicons name={cat.icon} size={20} color={cat.color} />
                    <Text
                      style={[styles.categoryLabel, isSelected && { color: COLORS.text, fontWeight: '700' }]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Botão Confirmar */}
            <TouchableOpacity style={styles.submitBtn} onPress={handleSave}>
              <Text style={styles.submitBtnText}>Salvar Movimentação</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  typeBtnExpenseActive: {
    backgroundColor: COLORS.expense,
    borderColor: COLORS.expense,
  },
  typeBtnIncomeActive: {
    backgroundColor: COLORS.income,
    borderColor: COLORS.income,
  },
  typeBtnText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  typeBtnTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  amountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  currencySymbol: {
    color: COLORS.textSecondary,
    fontSize: 24,
    fontWeight: '700',
    marginRight: 8,
  },
  amountInput: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '800',
    minWidth: 120,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: COLORS.text,
    fontSize: 15,
    marginBottom: 16,
  },
  authorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  authorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  authorChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  authorText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  authorTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  categoryCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    borderRadius: 14,
  },
  categoryLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    flexShrink: 1,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
