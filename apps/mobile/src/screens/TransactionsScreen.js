import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useFinance, CATEGORIES } from '../context/FinanceContext';
import AddTransactionModal from '../components/AddTransactionModal';
import EditTransactionModal from '../components/EditTransactionModal';

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const { transactions, removeTransaction, editTransaction, members, hideBalances } = useFinance();

  // Modais de Adicionar / Editar
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);

  // Modal de Filtros Avançados
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Estados de Filtro
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'expense' | 'fixed' | 'variable' | 'income' | 'freelance'
  const [periodFilter, setPeriodFilter] = useState('all'); // 'all' | 'today' | '7days' | 'this_month' | 'last_month' | '30days'
  const [authorFilter, setAuthorFilter] = useState('all'); // 'all' | members.user1 | members.user2 | 'Casal'
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | category.id
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'highest' | 'lowest'

  const formatCurrency = (val) => {
    if (hideBalances) return 'R$ •••••••';
    return 'R$ ' + (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Helper para obter a data ISO (YYYY-MM-DD)
  const getTxIsoDate = (t) => {
    if (t.date && t.date.includes('-') && t.date.length === 10) {
      return t.date;
    }
    if (t.date && t.date.includes('/')) {
      const parts = t.date.split('/');
      if (parts.length === 3) {
        const [d, m, y] = parts;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
    if (t.createdAt) {
      return t.createdAt.split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  };

  // Helper para formatar a data que foi colocado
  const formatDisplayDate = (dateStr, createdAt) => {
    let iso = '';
    if (dateStr && dateStr.includes('-')) {
      iso = dateStr;
    } else if (dateStr && dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const [d, m, y] = parts;
        iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    } else if (createdAt) {
      iso = createdAt.split('T')[0];
    } else {
      iso = new Date().toISOString().split('T')[0];
    }

    const [y, m, d] = (iso || '').split('-');
    const formatted = `${d}/${m}/${y}`;

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    let timeStr = '';
    if (createdAt && createdAt.includes('T')) {
      try {
        const timePart = createdAt.split('T')[1];
        const [hh, mm] = timePart.split(':');
        if (hh && mm) timeStr = ` às ${hh}:${mm}`;
      } catch {}
    }

    if (iso === todayStr) {
      return `Hoje, ${formatted}${timeStr}`;
    }
    if (iso === yesterdayStr) {
      return `Ontem, ${formatted}${timeStr}`;
    }
    return `${formatted}${timeStr}`;
  };

  // Título amigável de agrupamento por dia
  const getDayGroupTitle = (isoDate) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const [y, m, d] = (isoDate || '').split('-');
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const monthName = monthNames[parseInt(m, 10) - 1] || m;

    if (isoDate === todayStr) {
      return `Hoje • ${d} de ${monthName}`;
    }
    if (isoDate === yesterdayStr) {
      return `Ontem • ${d} de ${monthName}`;
    }
    return `${d} de ${monthName} de ${y}`;
  };

  // Lógica de Filtragem e Ordenação
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMonthIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthIso = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    return transactions
      .filter((t) => {
        const iso = getTxIsoDate(t);

        // 1. Filtro de Período
        if (periodFilter === 'today' && iso !== todayStr) return false;
        if (periodFilter === '7days' && iso < sevenDaysAgo) return false;
        if (periodFilter === '30days' && iso < thirtyDaysAgo) return false;
        if (periodFilter === 'this_month' && !iso.startsWith(currentMonthIso)) return false;
        if (periodFilter === 'last_month' && !iso.startsWith(lastMonthIso)) return false;

        // 2. Filtro de Tipo
        if (filterType === 'expense' && t.type !== 'expense') return false;
        if (filterType === 'fixed' && (t.type !== 'expense' || t.expenseType !== 'fixed')) return false;
        if (filterType === 'variable' && (t.type !== 'expense' || t.expenseType === 'fixed')) return false;
        if (filterType === 'income' && t.type !== 'income') return false;
        if (
          filterType === 'freelance' &&
          (t.type !== 'income' || (t.incomeSource !== 'freelance' && t.incomeSource !== 'extra'))
        ) {
          return false;
        }

        // 3. Filtro de Autor
        if (authorFilter !== 'all' && t.author !== authorFilter) return false;

        // 4. Filtro de Categoria
        if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;

        // 5. Busca por texto
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchDesc = t.description?.toLowerCase().includes(q);
          const matchCat = t.category?.toLowerCase().includes(q);
          const matchAuthor = t.author?.toLowerCase().includes(q);
          if (!matchDesc && !matchCat && !matchAuthor) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'highest') return (b.amount || 0) - (a.amount || 0);
        if (sortBy === 'lowest') return (a.amount || 0) - (b.amount || 0);

        const isoA = getTxIsoDate(a);
        const isoB = getTxIsoDate(b);
        if (sortBy === 'oldest') {
          return isoA.localeCompare(isoB) || (a.createdAt || '').localeCompare(b.createdAt || '');
        }
        // 'newest' (padrão)
        return isoB.localeCompare(isoA) || (b.createdAt || '').localeCompare(a.createdAt || '');
      });
  }, [transactions, search, filterType, periodFilter, authorFilter, categoryFilter, sortBy]);

  // Agrupamento por Dia
  const groupedByDate = useMemo(() => {
    const groups = [];
    let currentIso = null;
    let currentList = [];
    let currentTotal = 0;

    filteredTransactions.forEach((tx) => {
      const iso = getTxIsoDate(tx);
      const delta = tx.type === 'income' ? tx.amount : -tx.amount;

      if (iso !== currentIso) {
        if (currentIso !== null) {
          groups.push({
            isoDate: currentIso,
            title: getDayGroupTitle(currentIso),
            total: currentTotal,
            items: currentList,
          });
        }
        currentIso = iso;
        currentList = [tx];
        currentTotal = delta;
      } else {
        currentList.push(tx);
        currentTotal += delta;
      }
    });

    if (currentIso !== null) {
      groups.push({
        isoDate: currentIso,
        title: getDayGroupTitle(currentIso),
        total: currentTotal,
        items: currentList,
      });
    }

    return groups;
  }, [filteredTransactions]);

  // Resumo financeiro do filtro atual
  const { totalIncome, totalExpense, netBalance } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    filteredTransactions.forEach((t) => {
      if (t.type === 'income') inc += t.amount || 0;
      else exp += t.amount || 0;
    });
    return { totalIncome: inc, totalExpense: exp, netBalance: inc - exp };
  }, [filteredTransactions]);

  // Quantidade de filtros ativos além do padrão
  const activeFiltersCount =
    (periodFilter !== 'all' ? 1 : 0) +
    (filterType !== 'all' ? 1 : 0) +
    (authorFilter !== 'all' ? 1 : 0) +
    (categoryFilter !== 'all' ? 1 : 0) +
    (sortBy !== 'newest' ? 1 : 0);

  const handleResetFilters = () => {
    setSearch('');
    setFilterType('all');
    setPeriodFilter('all');
    setAuthorFilter('all');
    setCategoryFilter('all');
    setSortBy('newest');
  };

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
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Extrato & Lançamentos</Text>
          <Text style={styles.headerSubtitle}>
            Histórico completo com data e horário de cada movimentação
          </Text>
        </View>

        <View style={styles.headerRightBtns}>
          {/* Botão de Filtros com Badge */}
          <TouchableOpacity
            style={[styles.filterTriggerBtn, activeFiltersCount > 0 && styles.filterTriggerBtnActive]}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={activeFiltersCount > 0 ? 'funnel' : 'funnel-outline'}
              size={16}
              color={activeFiltersCount > 0 ? COLORS.white : COLORS.text}
            />
            <Text style={[styles.filterTriggerText, activeFiltersCount > 0 && styles.filterTriggerTextActive]}>
              Filtros
            </Text>
            {activeFiltersCount > 0 && (
              <View style={styles.activeFilterBadge}>
                <Text style={styles.activeFilterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.addBtnHeader} onPress={() => setModalVisible(true)}>
            <Ionicons name="add" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* SEARCH BAR */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={17} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por descrição, autor ou categoria..."
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

      {/* CHIPS RÁPIDOS DE PERÍODO */}
      <View style={styles.quickFilterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[
            { id: 'all', label: '📅 Todos os períodos' },
            { id: 'this_month', label: '🗓️ Este mês' },
            { id: '7days', label: '⚡ Últimos 7 dias' },
            { id: '30days', label: '📆 Últimos 30 dias' },
            { id: 'last_month', label: '⏪ Mês anterior' },
            { id: 'today', label: '📍 Hoje' },
          ].map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.quickPeriodChip, periodFilter === p.id && styles.quickPeriodChipActive]}
              onPress={() => setPeriodFilter(p.id)}
            >
              <Text
                style={[
                  styles.quickPeriodChipText,
                  periodFilter === p.id && styles.quickPeriodChipTextActive,
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* CHIPS RÁPIDOS DE TIPO */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[
            { id: 'all', label: 'Todos os tipos' },
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

      {/* BARRA DE RESUMO DO EXTRATO FILTRADO */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Entradas</Text>
          <Text style={[styles.summaryVal, { color: COLORS.income }]}>
            + {formatCurrency(totalIncome)}
          </Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Saídas</Text>
          <Text style={[styles.summaryVal, { color: COLORS.expense }]}>
            - {formatCurrency(totalExpense)}
          </Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Saldo Período</Text>
          <Text
            style={[
              styles.summaryVal,
              { color: netBalance >= 0 ? COLORS.income : COLORS.expense, fontWeight: '900' },
            ]}
          >
            {formatCurrency(netBalance)}
          </Text>
        </View>

        {activeFiltersCount > 0 && (
          <TouchableOpacity style={styles.clearFiltersBtn} onPress={handleResetFilters}>
            <Ionicons name="refresh" size={12} color="#EF4444" />
            <Text style={styles.clearFiltersText}>Limpar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* LISTA DE MOVIMENTAÇÕES AGRUPADAS POR DATA */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
      >
        {filteredTransactions.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="folder-open-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum lançamento encontrado</Text>
            <Text style={styles.emptySubtitle}>
              {search || activeFiltersCount > 0
                ? 'Nenhuma movimentação corresponde aos filtros selecionados. Tente ajustar os filtros ou clique em Limpar.'
                : 'Toque no botão + para adicionar seus gastos ou envie uma mensagem por áudio/comprovante para a IA FINN.'}
            </Text>
            {activeFiltersCount > 0 && (
              <TouchableOpacity style={styles.resetBtnEmpty} onPress={handleResetFilters}>
                <Text style={styles.resetBtnEmptyText}>Limpar todos os filtros</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          groupedByDate.map((group) => (
            <View key={group.isoDate} style={styles.dayGroupContainer}>
              {/* CABEÇALHO DO DIA (DATA VISÍVEL E DESTACADA) */}
              <View style={styles.dayGroupHeader}>
                <View style={styles.dayGroupLeft}>
                  <Ionicons name="calendar" size={14} color="#0284C7" />
                  <Text style={styles.dayGroupTitle}>{group.title}</Text>
                </View>
                <Text
                  style={[
                    styles.dayGroupSubtotal,
                    { color: group.total >= 0 ? COLORS.income : COLORS.textSecondary },
                  ]}
                >
                  {group.total >= 0 ? `+ ${formatCurrency(group.total)}` : formatCurrency(group.total)}
                </Text>
              </View>

              {/* ITENS DO DIA */}
              <View style={styles.dayGroupCard}>
                {group.items.map((item, idx) => {
                  const cat = CATEGORIES.find((c) => c.id === item.category) || CATEGORIES[0];
                  const isExpense = item.type === 'expense';

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.txRow, idx > 0 && styles.txRowBorder]}
                      activeOpacity={0.7}
                      onPress={() => handleEdit(item)}
                    >
                      {/* Ícone com Emoji da Categoria */}
                      <View
                        style={[
                          styles.iconWrap,
                          { backgroundColor: `${cat.color || COLORS.primary}18` },
                        ]}
                      >
                        <Text style={{ fontSize: 20 }}>{cat.emoji || '📦'}</Text>
                      </View>

                      {/* Informações Centrais */}
                      <View style={styles.infoCol}>
                        <Text style={styles.descText} numberOfLines={1}>
                          {item.description}
                        </Text>

                        {/* DATA E HORA EM QUE FOI COLOCADO (SOLICITADO PELO USUÁRIO) */}
                        <View style={styles.dateRow}>
                          <Ionicons name="time-outline" size={11} color="#0284C7" />
                          <Text style={styles.datePlacedText}>
                            {formatDisplayDate(item.date, item.createdAt)}
                          </Text>
                        </View>

                        {/* Linha de Metadados: Categoria, Responsável e Badges */}
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

                      {/* Coluna de Valor e Ações */}
                      <View style={styles.amountCol}>
                        <Text
                          style={[
                            styles.amountText,
                            isExpense ? styles.expenseText : styles.incomeText,
                          ]}
                        >
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
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* MODAL DE FILTROS AVANÇADOS */}
      <Modal visible={filterModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.filterSheetContainer}>
            <View style={styles.filterModalHeader}>
              <View>
                <Text style={styles.filterModalTitle}>Filtrar Lançamentos</Text>
                <Text style={styles.filterModalSubtitle}>
                  Refine o extrato por período, membro, tipo ou categoria
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setFilterModalVisible(false)}
                style={styles.closeModalBtn}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
              {/* 1. SELETOR DE PERÍODO */}
              <Text style={styles.filterSectionTitle}>Período</Text>
              <View style={styles.filterChipsGrid}>
                {[
                  { id: 'all', label: 'Todos os períodos' },
                  { id: 'this_month', label: 'Este mês' },
                  { id: 'last_month', label: 'Mês anterior' },
                  { id: '7days', label: 'Últimos 7 dias' },
                  { id: '30days', label: 'Últimos 30 dias' },
                  { id: 'today', label: 'Hoje' },
                ].map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.modalChip,
                      periodFilter === p.id && styles.modalChipActive,
                    ]}
                    onPress={() => setPeriodFilter(p.id)}
                  >
                    <Text
                      style={[
                        styles.modalChipText,
                        periodFilter === p.id && styles.modalChipTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 2. SELETOR DE TIPO */}
              <Text style={styles.filterSectionTitle}>Tipo de Lançamento</Text>
              <View style={styles.filterChipsGrid}>
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'expense', label: 'Todas as despesas' },
                  { id: 'fixed', label: '📌 Gastos Fixos' },
                  { id: 'variable', label: '🛒 Gastos Variáveis' },
                  { id: 'income', label: 'Todas as receitas' },
                  { id: 'freelance', label: '⚡ Freelance / Extra' },
                ].map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.modalChip, filterType === t.id && styles.modalChipActive]}
                    onPress={() => setFilterType(t.id)}
                  >
                    <Text
                      style={[
                        styles.modalChipText,
                        filterType === t.id && styles.modalChipTextActive,
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 3. QUEM REALIZOU (MEMBRO) */}
              <Text style={styles.filterSectionTitle}>Quem Lançou?</Text>
              <View style={styles.filterChipsGrid}>
                {[
                  { id: 'all', label: 'Todos do Casal' },
                  { id: members.user1, label: members.user1 },
                  { id: members.user2, label: members.user2 },
                ].map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.modalChip, authorFilter === m.id && styles.modalChipActive]}
                    onPress={() => setAuthorFilter(m.id)}
                  >
                    <Text
                      style={[
                        styles.modalChipText,
                        authorFilter === m.id && styles.modalChipTextActive,
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 4. ORDENAÇÃO */}
              <Text style={styles.filterSectionTitle}>Ordem de Exibição</Text>
              <View style={styles.filterChipsGrid}>
                {[
                  { id: 'newest', label: 'Mais recentes primeiro' },
                  { id: 'oldest', label: 'Mais antigos primeiro' },
                  { id: 'highest', label: 'Maior valor' },
                  { id: 'lowest', label: 'Menor valor' },
                ].map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.modalChip, sortBy === s.id && styles.modalChipActive]}
                    onPress={() => setSortBy(s.id)}
                  >
                    <Text
                      style={[
                        styles.modalChipText,
                        sortBy === s.id && styles.modalChipTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 5. CATEGORIA ESPECÍFICA */}
              <Text style={styles.filterSectionTitle}>Categoria</Text>
              <View style={styles.filterChipsGrid}>
                <TouchableOpacity
                  style={[styles.modalChip, categoryFilter === 'all' && styles.modalChipActive]}
                  onPress={() => setCategoryFilter('all')}
                >
                  <Text
                    style={[
                      styles.modalChipText,
                      categoryFilter === 'all' && styles.modalChipTextActive,
                    ]}
                  >
                    Todas as categorias
                  </Text>
                </TouchableOpacity>

                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.modalChip, categoryFilter === c.id && styles.modalChipActive]}
                    onPress={() => setCategoryFilter(c.id)}
                  >
                    <Text
                      style={[
                        styles.modalChipText,
                        categoryFilter === c.id && styles.modalChipTextActive,
                      ]}
                    >
                      {c.emoji} {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* BOTÕES DO MODAL */}
            <View style={styles.modalActionButtonsRow}>
              <TouchableOpacity style={styles.modalResetBtn} onPress={handleResetFilters}>
                <Text style={styles.modalResetBtnText}>Limpar Tudo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.modalApplyBtnText}>Aplicar Filtros</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE ADICIONAR */}
      <AddTransactionModal visible={modalVisible} onClose={() => setModalVisible(false)} />

      {/* MODAL DE EDITAR */}
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
    paddingHorizontal: 18,
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
  headerRightBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  filterTriggerBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  filterTriggerText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  filterTriggerTextActive: {
    color: COLORS.white,
  },
  activeFilterBadge: {
    backgroundColor: COLORS.white,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  activeFilterBadgeText: {
    color: '#7C3AED',
    fontSize: 10,
    fontWeight: '900',
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
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
  },
  quickFilterRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  quickPeriodChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  quickPeriodChipActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderColor: '#7C3AED',
  },
  quickPeriodChipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  quickPeriodChipTextActive: {
    color: '#7C3AED',
    fontWeight: '800',
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  filterChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  filterChipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  summaryCol: {
    alignItems: 'center',
  },
  summaryLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.surfaceBorder,
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  clearFiltersText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 14,
  },
  dayGroupContainer: {
    gap: 6,
  },
  dayGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  dayGroupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayGroupTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
  },
  dayGroupSubtotal: {
    fontSize: 12,
    fontWeight: '700',
  },
  dayGroupCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    overflow: 'hidden',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  txRowBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
  },
  descText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  datePlacedText: {
    color: '#0284C7',
    fontSize: 11,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  catText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  metaDot: {
    color: COLORS.textMuted,
    fontSize: 9,
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
    gap: 4,
  },
  amountText: {
    fontSize: 14,
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
    gap: 8,
  },
  actionIconBtn: {
    padding: 3,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
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
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  resetBtnEmpty: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  resetBtnEmptyText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  filterSheetContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    maxHeight: '90%',
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterModalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  filterModalSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  closeModalBtn: {
    padding: 6,
  },
  filterSectionTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
  },
  filterChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  modalChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  modalChipText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  modalChipTextActive: {
    color: COLORS.white,
    fontWeight: '800',
  },
  modalActionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
  },
  modalResetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  modalResetBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  modalApplyBtn: {
    flex: 1.6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalApplyBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },
});
