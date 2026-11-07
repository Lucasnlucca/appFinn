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
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../theme/colors';
import { useFinance, CATEGORIES } from '../context/FinanceContext';

export default function AddTransactionModal({ visible, onClose }) {
  const { addTransaction, addBill, accounts, loggedInUser, sharedGroups = [] } = useFinance();

  // Modo: 'variable' (Gasto Variável) | 'fixed' (Gasto Fixo - Print 3) | 'income' (Novo Recebimento - Print 2)
  const [mode, setMode] = useState('variable');

  // Campos compartilhados
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('alimentacao');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const currentAuthor = loggedInUser?.name || loggedInUser?.fullName || 'Você';
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

        const targetGroup = (sharedGroups || []).find((g) => g.id === selectedGroupId);
        const isShared = !!selectedGroupId;
        const groupName = targetGroup?.name || null;

        if (billStatus === 'paid') {
          await addTransaction({
            description: description.trim(),
            amount: num,
            type: 'expense',
            expenseType: 'fixed',
            category,
            author: currentAuthor,
            isShared,
            groupId: selectedGroupId || null,
            groupName,
            accountId,
            notes: notes.trim(),
          });
        }
      } else if (mode === 'income') {
        // Novo Recebimento (Salário ou Freelance / Renda Extra)
        const targetGroup = (sharedGroups || []).find((g) => g.id === selectedGroupId);
        const isShared = !!selectedGroupId;
        const groupName = targetGroup?.name || null;

        await addTransaction({
          description: description.trim(),
          amount: num,
          type: 'income',
          incomeSource,
          category: category === 'alimentacao' ? 'receita' : category,
          author: currentAuthor,
          isShared,
          groupId: selectedGroupId || null,
          groupName,
          accountId,
          date,
          notes: notes.trim(),
        });
      } else {
        // Gasto Variável do dia a dia
        const targetGroup = (sharedGroups || []).find((g) => g.id === selectedGroupId);
        const isShared = !!selectedGroupId;
        const groupName = targetGroup?.name || null;

        await addTransaction({
          description: description.trim(),
          amount: num,
          type: 'expense',
          expenseType: 'variable',
          category,
          author: currentAuthor,
          isShared,
          groupId: selectedGroupId || null,
          groupName,
          accountId,
          date,
          notes: notes.trim(),
        });
      }

      // Reset
      setDescription('');
      setAmount('');
      setNotes('');
      setSelectedGroupId(null);
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
          {/* Indicador arrastável do Bottom Sheet */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {mode === 'fixed'
                ? 'Novo Gasto Fixo'
                : mode === 'income'
                ? 'Novo Recebimento'
                : 'Novo Gasto Variável'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
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
                      color={incomeSource === 'salary' ? '#7C3AED' : COLORS.textSecondary}
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
                      color={incomeSource === 'freelance' ? '#D97706' : '#F59E0B'}
                    />
                    <Text
                      style={[
                        styles.sourcePillText,
                        incomeSource === 'freelance' && styles.sourcePillFreelaTextActive,
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
                          billStatus === 'paid' && styles.statusTogglePaidTextActive,
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
                    color={isRecurring ? '#7C3AED' : COLORS.textMuted}
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
                    color={accountId === acc.id ? '#7C3AED' : COLORS.textSecondary}
                  />
                  <Text
                    style={[styles.accChipText, accountId === acc.id && styles.accChipTextActive]}
                  >
                    {acc.name} ({acc.bank})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* DESTINO: PESSOAL OU GRUPO COMPARTILHADO (OPCIONAL) */}
            {sharedGroups && sharedGroups.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>Destino do Lançamento</Text>
                <View style={styles.authorRow}>
                  <TouchableOpacity
                    style={[styles.authorChip, !selectedGroupId && styles.authorChipActive]}
                    onPress={() => setSelectedGroupId(null)}
                  >
                    <Ionicons
                      name="person-outline"
                      size={14}
                      color={!selectedGroupId ? '#7C3AED' : COLORS.textSecondary}
                    />
                    <Text
                      style={[styles.authorText, !selectedGroupId && styles.authorTextActive]}
                    >
                      Pessoal (Individual)
                    </Text>
                  </TouchableOpacity>

                  {sharedGroups.map((g) => (
                    <TouchableOpacity
                      key={g.id}
                      style={[styles.authorChip, selectedGroupId === g.id && styles.authorChipActive]}
                      onPress={() => setSelectedGroupId(g.id)}
                    >
                      <Ionicons
                        name="people-outline"
                        size={14}
                        color={selectedGroupId === g.id ? '#7C3AED' : COLORS.textSecondary}
                      />
                      <Text
                        style={[styles.authorText, selectedGroupId === g.id && styles.authorTextActive]}
                        numberOfLines={1}
                      >
                        {g.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

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

            {/* BOTÃO PRINCIPAL DE ENVIO (SISTEMA FINN: ROXO/VERDE GRADIENTE) */}
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.submitBtnWrapper}
              onPress={handleSave}
            >
              <LinearGradient
                colors={
                  mode === 'income'
                    ? ['#10B981', '#059669']
                    : ['#7C3AED', '#9333EA']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitBtn}
              >
                <Ionicons
                  name={
                    mode === 'income'
                      ? 'checkmark-circle'
                      : mode === 'fixed'
                      ? 'calendar'
                      : 'add-circle'
                  }
                  size={19}
                  color="#FFFFFF"
                />
                <Text style={styles.submitBtnText}>
                  {mode === 'fixed'
                    ? 'Salvar gasto fixo'
                    : mode === 'income'
                    ? 'Registrar recebimento'
                    : 'Registrar gasto variável'}
                </Text>
              </LinearGradient>
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
                      <Ionicons name="checkmark-circle" size={18} color="#7C3AED" />
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
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '92%',
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 16,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E4E4E7',
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#F4F4F5',
    borderRadius: 20,
  },
  modeTabsRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F4F2F9',
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
    backgroundColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  modeTabFixedActive: {
    backgroundColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  modeTabIncomeActive: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  modeTabText: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  fieldLabel: {
    color: '#52525B',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#FAF8FD',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#EFEAF8',
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
    backgroundColor: '#FAF8FD',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#EFEAF8',
  },
  currencyPrefix: {
    color: '#7C3AED',
    fontSize: 16,
    fontWeight: '800',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    padding: 0,
  },
  smallInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAF8FD',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#EFEAF8',
  },
  miniDateBtn: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  miniDateBtnText: {
    color: '#7C3AED',
    fontSize: 11,
    fontWeight: '700',
  },
  smallInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    padding: 0,
  },
  dateText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  incomeSourceBox: {
    backgroundColor: '#FAF8FD',
    padding: 12,
    borderRadius: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#EFEAF8',
  },
  sourcePillsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  sourcePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEAF8',
  },
  sourcePillSalaryActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  sourcePillFreelaActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  sourcePillText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
  },
  sourcePillTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  sourcePillFreelaTextActive: {
    color: '#D97706',
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
    backgroundColor: '#F4F2F9',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#EFEAF8',
  },
  statusToggleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusTogglePending: {
    backgroundColor: '#E4E4E7',
  },
  statusTogglePaid: {
    backgroundColor: '#10B981',
  },
  statusToggleText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
  },
  statusToggleTextActive: {
    color: '#18181B',
    fontWeight: '700',
  },
  statusTogglePaidTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  activeCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 18,
  },
  activeCheckText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF8FD',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#EFEAF8',
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
    color: COLORS.text,
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
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#FAF8FD',
    borderWidth: 1,
    borderColor: '#EFEAF8',
  },
  accChipActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  accChipText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
  },
  accChipTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
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
    backgroundColor: '#FAF8FD',
    borderWidth: 1,
    borderColor: '#EFEAF8',
  },
  authorChipActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  authorText: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '600',
  },
  authorTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: '#FAF8FD',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    minHeight: 50,
  },
  submitBtnWrapper: {
    marginTop: 20,
    marginBottom: 10,
    borderRadius: 16,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerBox: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEAF8',
    marginBottom: 10,
  },
  pickerTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  catOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  catOptionItemSelected: {
    backgroundColor: '#EDE9FE',
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
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '500',
  },
  catOptionLabelSelected: {
    color: '#7C3AED',
    fontWeight: '700',
  },
});
