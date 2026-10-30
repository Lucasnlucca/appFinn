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

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const { transactions, removeTransaction, activeMember, members } = useFinance();
  const [modalVisible, setModalVisible] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'expense' | 'income'
  const [search, setSearch] = useState('');

  const formatCurrency = (val) => {
    return 'R$ ' + (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const filtered = transactions.filter((t) => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (search.trim() && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleDelete = (id, desc) => {
    Alert.alert('Excluir Lançamento', `Deseja remover "${desc}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => removeTransaction(id) },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Extrato & Lançamentos</Text>
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
        {[
          { id: 'all', label: 'Todos' },
          { id: 'expense', label: 'Despesas' },
          { id: 'income', label: 'Receitas' },
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
              {search ? 'Tente buscar com outro termo.' : 'Toque no botão + para adicionar uma movimentação.'}
            </Text>
          </View>
        ) : (
          filtered.map((item) => {
            const cat = CATEGORIES.find((c) => c.id === item.category) || CATEGORIES[6];
            const isExpense = item.type === 'expense';
            return (
              <View key={item.id} style={styles.txRow}>
                <View style={[styles.iconWrap, { backgroundColor: `${cat.color}20` }]}>
                  <Ionicons name={cat.icon} size={20} color={cat.color} />
                </View>

                <View style={styles.infoCol}>
                  <Text style={styles.descText}>{item.description}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.catText}>{cat.label}</Text>
                    <Text style={styles.metaDot}>•</Text>
                    <Text style={styles.authorBadge}>{item.author}</Text>
                  </View>
                </View>

                <View style={styles.amountCol}>
                  <Text style={[styles.amountText, isExpense ? styles.expenseText : styles.incomeText]}>
                    {isExpense ? '- ' : '+ '}
                    {formatCurrency(item.amount)}
                  </Text>
                  <TouchableOpacity
                    style={styles.trashBtn}
                    onPress={() => handleDelete(item.id, item.description)}
                  >
                    <Ionicons name="trash-outline" size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 10,
    paddingTop: 4,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoCol: {
    flex: 1,
  },
  descText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
    fontWeight: '600',
  },
  amountCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '700',
  },
  expenseText: {
    color: COLORS.expense,
  },
  incomeText: {
    color: COLORS.income,
  },
  trashBtn: {
    padding: 3,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
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
