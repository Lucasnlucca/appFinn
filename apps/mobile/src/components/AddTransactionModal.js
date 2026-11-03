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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useFinance, CATEGORIES } from '../context/FinanceContext';

export default function AddTransactionModal({ visible, onClose }) {
  const { addTransaction, addBill, accounts, members, activeMember } = useFinance();

  // Modo: 'variable' (Gasto Variável) | 'fixed' (Gasto Fixo - Print 3) | 'income' (Novo Recebimento - Print 2)
  const [mode, setMode] = useState('variable');

  // Campos compartilhados
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('alimentacao');
  const [author, setAuthor] = useState(activeMember === 'Casal' ? members.user1 : activeMember);
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateDisplay, setDateDisplay] = useState(
    new Date().toISOString().split('T')[0].split('-').reverse().join('/')
  );

  const handleDateChange = (text) => {
    setDateDisplay(text);
    if (text.includes('/')) {
      const parts = text.split('/');
      if (parts.length === 3 && parts[2].length === 4) {
        setDate(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
      }
    } else if (text.includes('-') && text.length === 10) {
      setDate(text);
    }
  };

  const setQuickDate = (daysAgo = 0) => {
    const d = new Date(Date.now() - daysAgo * 86400000);
    const iso = d.toISOString().split('T')[0];
    setDate(iso);
    setDateDisplay(iso.split('-').reverse().join('/'));
  };

  // Específico Gasto Fixo (Print 3)
  const [dueDay, setDueDay] = useState('5');
  const [billStatus, setBillStatus] = useState('pending'); // 'pending' | 'paid'
  const [isRecurring, setIsRecurring] = useState(true);

  // Específico Recebimento (Print 2)
  const [incomeSource, setIncomeSource] = useState('salary'); // 'salary' | 'freelance' | 'extra'

  // Modal de seleção de categoria (Print 4)
  const [catPickerVisible, setCatPickerVisible] = useState(false);

  const selectedCategoryObj = CATEGORIES.find((c) => c.id === category) || CATEGORIES[0];

  const handleSave = async () => {
    if (!description.trim() || !amount.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha a descrição e o valor.');
      return;
    }
    const num = parseFloat(amount.replace(',', '.'));
    if (isNaN(num) || num <= 0) {
      Alert.alert('Valor inválido', 'Digite um valor numérico válido.');
      return;
    }

    try {
      if (mode === 'fixed') {
        // Gasto fixo (Salva nas contas a pagar e gera lançamento se pago)
        await addBill({
          title: description.trim(),
          amount: num,
          dueDay: parseInt(dueDay, 10) || 5,
          category,
          paid: billStatus === 'paid',
          isRecurring,
          notes: notes.trim(),
          accountId,
        });

        if (billStatus === 'paid') {
          await addTransaction({
            description: description.trim(),
            amount: num,
            type: 'expense',
            expenseType: 'fixed',
            category,
            author,
            accountId,
            notes: notes.trim(),
          });
        }
      } else if (mode === 'income') {
        // Novo Recebimento (Salário ou Freelance / Renda Extra)
        await addTransaction({
          description: description.trim(),
          amount: num,
          type: 'income',
          incomeSource,
          category: category === 'alimentacao' ? 'receita' : category,
          author,
          accountId,
          date,
          notes: notes.trim(),
        });
      } else {
        // Gasto Variável do dia a dia
        await addTransaction({
          description: description.trim(),
          amount: num,
          type: 'expense',
          expenseType: 'variable',
          category,
          author,
          accountId,
          date,
          notes: notes.trim(),
        });
      }

      // Reset
      setDescription('');
      setAmount('');
      setNotes('');
      onClose();
    } catch (e) {
      Alert.alert('Erro ao salvar', e.message);
    }
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
            <Text style={styles.headerTitle}>
              {mode === 'fixed'
                ? 'Novo Gasto Fixo'
                : mode === 'income'
                ? 'Novo Recebimento'
                : 'Novo Gasto Variável'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Abas Superiores (Variável, Fixo, Recebimento) */}
          <View style={styles.modeTabsRow}>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'variable' && styles.modeTabActive]}
              onPress={() => {
                setMode('variable');
                if (category === 'receita') setCategory('alimentacao');
              }}
            >
              <Ionicons
                name="cart-outline"
                size={15}
                color={mode === 'variable' ? COLORS.white : COLORS.textSecondary}
              />
              <Text style={[styles.modeTabText, mode === 'variable' && styles.modeTabTextActive]}>
                Variável
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, mode === 'fixed' && styles.modeTabFixedActive]}
              onPress={() => {
                setMode('fixed');
                if (category === 'receita') setCategory('moradia');
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={15}
                color={mode === 'fixed' ? COLORS.white : COLORS.textSecondary}
              />
              <Text style={[styles.modeTabText, mode === 'fixed' && styles.modeTabTextActive]}>
                Gasto Fixo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, mode === 'income' && styles.modeTabIncomeActive]}
              onPress={() => {
                setMode('income');
                setCategory('receita');
              }}
            >
              <Ionicons
                name="arrow-up-circle-outline"
                size={15}
                color={mode === 'income' ? COLORS.white : COLORS.textSecondary}
              />
              <Text style={[styles.modeTabText, mode === 'income' && styles.modeTabTextActive]}>
                Recebimento
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Input Descrição */}
            <Text style={styles.fieldLabel}>
              {mode === 'income'
                ? 'Descrição (ex.: Salário, Freela)'
                : mode === 'fixed'
                ? 'Descrição do gasto fixo (ex.: Aluguel)'
                : 'Descrição (ex.: Supermercado, Almoço)'}
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder={
                mode === 'income'
                  ? 'Salário, Freela de Programação...'
                  : mode === 'fixed'
                  ? 'Aluguel, Internet, Condomínio...'
                  : 'Mercado, Uber, Farmácia...'
              }
              placeholderTextColor={COLORS.textMuted}
              value={description}
              onChangeText={setDescription}
            />

            {/* Linha de Valor e Dia/Data */}
            <View style={styles.valRow}>
              <View style={[styles.valBox, { flex: 1.3 }]}>
                <Text style={styles.fieldLabel}>Valor</Text>
                <View style={styles.amountInputWrap}>
                  <Text style={styles.currencyPrefix}>R$</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0,00"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                  />
                </View>
              </View>

              {mode === 'fixed' ? (
                <View style={[styles.valBox, { flex: 0.9 }]}>
                  <Text style={styles.fieldLabel}>Dia Vencimento</Text>
                  <View style={styles.smallInputWrap}>
                    <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.smallInput}
                      placeholder="5"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="number-pad"
                      maxLength={2}
                      value={dueDay}
                      onChangeText={setDueDay}
                    />
                  </View>
                </View>
              ) : (
                <View style={[styles.valBox, { flex: 1.2 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.fieldLabel}>Data</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <TouchableOpacity onPress={() => setQuickDate(0)} style={styles.miniDateBtn}>
                        <Text style={styles.miniDateBtnText}>Hoje</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setQuickDate(1)} style={styles.miniDateBtn}>
                        <Text style={styles.miniDateBtnText}>Ontem</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.smallInputWrap}>
                    <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.smallInput}
                      value={dateDisplay}
                      onChangeText={handleDateChange}
                      placeholder="DD/MM/AAAA"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="numeric"
                      maxLength={10}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* SELETOR DE ORIGEM PARA RECEBIMENTO: SALÁRIO VS FREELANCE */}
            {mode === 'income' && (
              <View style={styles.incomeSourceBox}>
                <Text style={styles.fieldLabel}>Origem da Renda:</Text>
                <View style={styles.sourcePillsRow}>
                  <TouchableOpacity
                    style={[
                      styles.sourcePill,
                      incomeSource === 'salary' && styles.sourcePillSalaryActive,
                    ]}
                    onPress={() => setIncomeSource('salary')}
                  >
                    <Ionicons
                      name="briefcase-outline"
                      size={15}
                      color={incomeSource === 'salary' ? COLORS.white : COLORS.textSecondary}
                    />
                    <Text
                      style={[
                        styles.sourcePillText,
                        incomeSource === 'salary' && styles.sourcePillTextActive,
                      ]}
                    >
                      Salário Fixo
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.sourcePill,
                      incomeSource === 'freelance' && styles.sourcePillFreelaActive,
                    ]}
                    onPress={() => setIncomeSource('freelance')}
                  >
                    <Ionicons
                      name="flash"
                      size={15}
                      color={incomeSource === 'freelance' ? COLORS.white : '#EA580C'}
                    />
                    <Text
                      style={[
                        styles.sourcePillText,
                        incomeSource === 'freelance' && styles.sourcePillTextActive,
                      ]}
                    >
                      ⚡ Freelance / Extra
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* OPÇÕES ESPECÍFICAS DE GASTO FIXO: STATUS E ATIVO (PRINT 3) */}
            {mode === 'fixed' && (
              <View style={styles.fixedOptionsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Status</Text>
                  <View style={styles.statusToggleRow}>
                    <TouchableOpacity
                      style={[
                        styles.statusToggleBtn,
                        billStatus === 'pending' && styles.statusTogglePending,
                      ]}
                      onPress={() => setBillStatus('pending')}
                    >
                      <Text
                        style={[
                          styles.statusToggleText,
                          billStatus === 'pending' && styles.statusToggleTextActive,
                        ]}
                      >
                        Pendente
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.statusToggleBtn,
                        billStatus === 'paid' && styles.statusTogglePaid,
                      ]}
                      onPress={() => setBillStatus('paid')}
                    >
                      <Text
                        style={[
                          styles.statusToggleText,
                          billStatus === 'paid' && styles.statusToggleTextActive,
                        ]}
                      >
                        Pago
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.activeCheckRow}
                  onPress={() => setIsRecurring(!isRecurring)}
                >
                  <Ionicons
                    name={isRecurring ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={isRecurring ? '#F97316' : COLORS.textMuted}
                  />
                  <Text style={styles.activeCheckText}>Ativo</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* BOTÃO SELETOR DE CATEGORIA (EXATAMENTE COMO NO PRINT 4) */}
            <Text style={styles.fieldLabel}>Categoria</Text>
            <TouchableOpacity
              style={styles.categoryDropdownBtn}
              onPress={() => setCatPickerVisible(true)}
            >
              <View style={styles.catSelectedLeft}>
                <Text style={styles.catEmoji}>{selectedCategoryObj.emoji}</Text>
                <Text style={styles.catSelectedText}>{selectedCategoryObj.label}</Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            {/* BANCO (OPCIONAL) */}
            <Text style={styles.fieldLabel}>Banco vinculado (opcional)</Text>
            <View style={styles.accountsRow}>
              {accounts.map((acc) => (
                <TouchableOpacity
                  key={acc.id}
                  style={[styles.accChip, accountId === acc.id && styles.accChipActive]}
                  onPress={() => setAccountId(acc.id)}
                >
                  <Ionicons
                    name="business-outline"
                    size={13}
                    color={accountId === acc.id ? COLORS.white : COLORS.textSecondary}
                  />
                  <Text
                    style={[styles.accChipText, accountId === acc.id && styles.accChipTextActive]}
                  >
                    {acc.name} ({acc.bank})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* RESPONSÁVEL */}
            <Text style={styles.fieldLabel}>Quem realizou?</Text>
            <View style={styles.authorRow}>
              {[members.user1, members.user2].map((name) => (
                <TouchableOpacity
                  key={name}
                  style={[styles.authorChip, author === name && styles.authorChipActive]}
                  onPress={() => setAuthor(name)}
                >
                  <Ionicons
                    name="person-outline"
                    size={14}
                    color={author === name ? COLORS.white : COLORS.textSecondary}
                  />
                  <Text
                    style={[styles.authorText, author === name && styles.authorTextActive]}
                  >
                    {name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* OBSERVAÇÃO (OPCIONAL) */}
            <Text style={styles.fieldLabel}>Observação (opcional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Detalhes adicionais..."
              placeholderTextColor={COLORS.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            {/* BOTÃO PRINCIPAL DE ENVIO (LARANJA COMO NOS PRINTS 2 E 3) */}
            <TouchableOpacity style={styles.submitBtnOrange} onPress={handleSave}>
              <Text style={styles.submitBtnOrangeText}>
                {mode === 'fixed'
                  ? 'Salvar gasto fixo'
                  : mode === 'income'
                  ? 'Registrar recebimento'
                  : 'Registrar gasto variável'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* MODAL DE SELEÇÃO DE CATEGORIAS (PRINT 4) */}
      <Modal visible={catPickerVisible} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerBox}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Selecione a Categoria</Text>
              <TouchableOpacity onPress={() => setCatPickerVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catOptionItem, isSelected && styles.catOptionItemSelected]}
                    onPress={() => {
                      setCategory(cat.id);
                      setCatPickerVisible(false);
                    }}
                  >
                    <View style={styles.catOptionLeft}>
                      <Text style={styles.catOptionEmoji}>{cat.emoji}</Text>
                      <Text
                        style={[
                          styles.catOptionLabel,
                          isSelected && styles.catOptionLabelSelected,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#1E232A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 19,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
  },
  modeTabsRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#13171D',
    padding: 4,
    borderRadius: 14,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modeTabActive: {
    backgroundColor: '#0E2F5A',
  },
  modeTabFixedActive: {
    backgroundColor: '#F97316',
  },
  modeTabIncomeActive: {
    backgroundColor: '#10B981',
  },
  modeTabText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#13171D',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.white,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2A313C',
  },
  valRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
  },
  valBox: {},
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13171D',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2A313C',
  },
  currencyPrefix: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '800',
    padding: 0,
  },
  smallInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#13171D',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#2A313C',
  },
  miniDateBtn: {
    backgroundColor: '#2A313C',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  miniDateBtnText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  smallInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
    padding: 0,
  },
  dateText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  incomeSourceBox: {
    backgroundColor: '#13171D',
    padding: 10,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#2A313C',
  },
  sourcePillsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sourcePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1E232A',
    borderWidth: 1,
    borderColor: '#2A313C',
  },
  sourcePillSalaryActive: {
    backgroundColor: '#0E2F5A',
    borderColor: '#2563EB',
  },
  sourcePillFreelaActive: {
    backgroundColor: '#EA580C',
    borderColor: '#F97316',
  },
  sourcePillText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  sourcePillTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  fixedOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  statusToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#13171D',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#2A313C',
  },
  statusToggleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusTogglePending: {
    backgroundColor: '#374151',
  },
  statusTogglePaid: {
    backgroundColor: '#10B981',
  },
  statusToggleText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  statusToggleTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  activeCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 18,
  },
  activeCheckText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#13171D',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#2A313C',
  },
  catSelectedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  catEmoji: {
    fontSize: 18,
  },
  catSelectedText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  accountsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#13171D',
    borderWidth: 1,
    borderColor: '#2A313C',
  },
  accChipActive: {
    backgroundColor: '#0E2F5A',
    borderColor: '#3B82F6',
  },
  accChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  accChipTextActive: {
    color: COLORS.white,
  },
  authorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  authorChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#13171D',
    borderWidth: 1,
    borderColor: '#2A313C',
  },
  authorChipActive: {
    backgroundColor: '#0E2F5A',
    borderColor: '#3B82F6',
  },
  authorText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  authorTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: '#13171D',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.white,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2A313C',
    minHeight: 50,
  },
  submitBtnOrange: {
    backgroundColor: '#F97316',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  submitBtnOrangeText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerBox: {
    width: '100%',
    backgroundColor: '#1E232A',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A313C',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A313C',
    marginBottom: 8,
  },
  pickerTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  catOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  catOptionItemSelected: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
  },
  catOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  catOptionEmoji: {
    fontSize: 20,
  },
  catOptionLabel: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '500',
  },
  catOptionLabelSelected: {
    color: COLORS.white,
    fontWeight: '700',
  },
});
