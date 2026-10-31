import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useFinance, CATEGORIES } from '../context/FinanceContext';

export default function EditTransactionModal({ visible, transaction, onClose, onSave, onDelete }) {
  const { members } = useFinance();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('outros');
  const [author, setAuthor] = useState('Lucas');

  useEffect(() => {
    if (transaction) {
      setDescription(transaction.description || '');
      setAmount(transaction.amount ? String(transaction.amount) : '');
      setType(transaction.type || 'expense');
      setCategory(transaction.category || 'outros');
      setAuthor(transaction.author || members.user1);
    }
  }, [transaction, members]);

  const handleSave = () => {
    if (!description.trim() || !amount) return;
    const num = parseFloat(amount.replace(',', '.'));
    if (isNaN(num) || num <= 0) return;

    onSave({
      ...transaction,
      description: description.trim(),
      amount: num,
      type,
      category,
      author,
    });
    onClose();
  };

  if (!transaction) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Editar Lançamento</Text>
              <Text style={styles.subtitle}>Corrija valores ou detalhes incorretos</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Tipo: Despesa vs Receita */}
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'expense' && styles.typeBtnExpense]}
                onPress={() => setType('expense')}
              >
                <Ionicons
                  name="arrow-down-circle"
                  size={18}
                  color={type === 'expense' ? COLORS.white : COLORS.textMuted}
                />
                <Text style={[styles.typeText, type === 'expense' && styles.typeTextActive]}>
                  Despesa
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeBtn, type === 'income' && styles.typeBtnIncome]}
                onPress={() => setType('income')}
              >
                <Ionicons
                  name="arrow-up-circle"
                  size={18}
                  color={type === 'income' ? COLORS.white : COLORS.textMuted}
                />
                <Text style={[styles.typeText, type === 'income' && styles.typeTextActive]}>
                  Receita
                </Text>
              </TouchableOpacity>
            </View>

            {/* Campo Valor */}
            <Text style={styles.label}>VALOR (R$)</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.currencyPrefix}>R$</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={COLORS.textMuted}
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            {/* Descrição */}
            <Text style={styles.label}>DESCRIÇÃO</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ex: Mercado, Uber, Farmácia..."
              placeholderTextColor={COLORS.textMuted}
              value={description}
              onChangeText={setDescription}
            />

            {/* Responsável (Lucas vs Veronica) */}
            <Text style={styles.label}>QUEM LANÇOU?</Text>
            <View style={styles.authorRow}>
              {[members.user1, members.user2, 'Casal'].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.authorBtn, author === m && styles.authorBtnActive]}
                  onPress={() => setAuthor(m)}
                >
                  <Text style={[styles.authorText, author === m && styles.authorTextActive]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Categoria */}
            <Text style={styles.label}>CATEGORIA</Text>
            <View style={styles.categoriesGrid}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryCard,
                      isSelected && { borderColor: cat.color, backgroundColor: `${cat.color}20` },
                    ]}
                    onPress={() => setCategory(cat.id)}
                  >
                    <Text style={{ fontSize: 18 }}>{cat.emoji || '📦'}</Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.categoryLabel,
                        isSelected && { color: cat.color, fontWeight: '700' },
                      ]}
                    >
                      {cat.label.split('&')[0].trim()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Botões de Ação */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => {
                  onDelete(transaction.id);
                  onClose();
                }}
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.expense} />
                <Text style={styles.deleteBtnText}>Excluir</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  (!description.trim() || !amount) && styles.saveBtnDisabled,
                ]}
                onPress={handleSave}
                disabled={!description.trim() || !amount}
              >
                <Ionicons name="checkmark" size={18} color={COLORS.white} />
                <Text style={styles.saveBtnText}>Salvar Alterações</Text>
              </TouchableOpacity>
            </View>
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
  card: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
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
  typeBtnExpense: {
    backgroundColor: COLORS.expense,
    borderColor: COLORS.expense,
  },
  typeBtnIncome: {
    backgroundColor: COLORS.income,
    borderColor: COLORS.income,
  },
  typeText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  typeTextActive: {
    color: COLORS.white,
  },
  label: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 12,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    paddingHorizontal: 16,
    height: 56,
  },
  currencyPrefix: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: '800',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
  },
  textInput: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    paddingHorizontal: 16,
    height: 50,
    color: COLORS.text,
    fontSize: 15,
  },
  authorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  authorBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  authorBtnActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  authorText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  authorTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  categoryLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 20,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  deleteBtnText: {
    color: COLORS.expense,
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
});

