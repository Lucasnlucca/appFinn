import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useFinance, CATEGORIES } from '../context/FinanceContext';
import AddTransactionModal from '../components/AddTransactionModal';
import EditTransactionModal from '../components/EditTransactionModal';

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const { transactions, removeTransaction, editTransaction } = useFinance();
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'expense' | 'fixed' | 'variable' | 'income' | 'freelance'
  const [search, setSearch] = useState('');

  const formatCurrency = (val) => {
    return 'R$ ' + (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const filtered = transactions.filter((t) => {
    if (filterType === 'expense' && t.type !== 'expense') return false;
    if (filterType === 'fixed' && (t.type !== 'expense' || t.expenseType !== 'fixed')) return false;
    if (filterType === 'variable' && (t.type !== 'expense' || t.expenseType === 'fixed')) return false;
    if (filterType === 'income' && t.type !== 'income') return false;
    if (filterType === 'freelance' && (t.type !== 'income' || (t.incomeSource !== 'freelance' && t.incomeSource !== 'extra'))) return false;
    if (search.trim() && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleDelete = (id, desc) => {
    Alert.alert('Excluir Lançamento', `Deseja realmente remover "${desc}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => removeTransaction(id) },
    ]);
  };

  const handleEdit = (item) => {
    setSelectedTx(item);
    setEditModalVisible(true);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Extrato & Lançamentos</Text>
          <Text style={styles.headerSubtitle}>Toque em uma movimentação para editar ou excluir</Text>
        </View>
        <TouchableOpacity style={styles.addBtnHeader} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* SEARCH BAR */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar movimentações..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* FILTRO TIPO */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[
            { id: 'all', label: 'Todos' },
            { id: 'expense', label: 'Despesas' },
            { id: 'fixed', label: '📌 Fixos' },
            { id: 'variable', label: '🛒 Variáveis' },
            { id: 'income', label: 'Receitas' },
            { id: 'freelance', label: '⚡ Freelance' },
          ].map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterChip, filterType === f.id && styles.filterChipActive]}
              onPress={() => setFilterType(f.id)}
            >
              <Text style={[styles.filterChipText, filterType === f.id && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* LISTA DE MOVIMENTAÇÕES */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="folder-open-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum registro encontrado</Text>
            <Text style={styles.emptySubtitle}>
              {search ? 'Tente buscar com outro termo.' : 'Toque no botão + para adicionar ou envie comprovante para a IA.'}
            </Text>
          </View>
        ) : (
          filtered.map((item) => {
            const cat = CATEGORIES.find((c) => c.id === item.category) || CATEGORIES[0];
            const isExpense = item.type === 'expense';
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.txRow}
                activeOpacity={0.7}
                onPress={() => handleEdit(item)}
              >
                <View style={[styles.iconWrap, { backgroundColor: `${cat.color || COLORS.primary}20` }]}>
                  <Text style={{ fontSize: 18 }}>{cat.emoji || '📦'}</Text>
                </View>

                <View style={styles.infoCol}>
                  <Text style={styles.descText}>{item.description}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.catText}>{cat.label}</Text>
                    <Text style={styles.metaDot}>•</Text>
                    <Text style={styles.authorBadge}>{item.author}</Text>
                    {item.incomeSource === 'freelance' && (
                      <View style={styles.freelaBadge}>
                        <Text style={styles.freelaBadgeText}>⚡ Freela</Text>
                      </View>
                    )}
                    {item.expenseType === 'fixed' && (
                      <View style={styles.fixedBadge}>
                        <Text style={styles.fixedBadgeText}>📌 Fixo</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.amountCol}>
                  <Text style={[styles.amountText, isExpense ? styles.expenseText : styles.incomeText]}>
                    {isExpense ? '- ' : '+ '}
                    {formatCurrency(item.amount)}
                  </Text>
                  <View style={styles.actionsPills}>
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => handleEdit(item)}
                    >
                      <Ionicons name="create-outline" size={16} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => handleDelete(item.id, item.description)}
                    >
                      <Ionicons name="trash-outline" size={16} color={COLORS.expense} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* FLOATING ACTION BUTTON */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 25 }]}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={28} color={COLORS.white} />
      </TouchableOpacity>

      <AddTransactionModal visible={modalVisible} onClose={() => setModalVisible(false)} />
      <EditTransactionModal
        visible={editModalVisible}
        transaction={selectedTx}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedTx(null);
        }}
        onSave={(updated) => editTransaction(updated)}
        onDelete={(id) => removeTransaction(id)}
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
  addBtnHeader: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  filterChipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
  },
  descText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  catText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  metaDot: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  authorBadge: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  freelaBadge: {
    backgroundColor: 'rgba(234, 88, 12, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  freelaBadgeText: {
    color: '#EA580C',
    fontSize: 9,
    fontWeight: '800',
  },
  fixedBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  fixedBadgeText: {
    color: '#2563EB',
    fontSize: 9,
    fontWeight: '800',
  },
  amountCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  expenseText: {
    color: COLORS.expense,
  },
  incomeText: {
    color: COLORS.income,
  },
  actionsPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionIconBtn: {
    padding: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
});
