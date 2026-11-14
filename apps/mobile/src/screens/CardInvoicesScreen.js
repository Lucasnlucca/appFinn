import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  Dimensions,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { useFinance } from '../context/FinanceContext';
import { readFileAsBase64, readFileAsText } from '../services/fileHelper';
import { analyzeInvoicePdf, sendTextMessageToGemini } from '../services/geminiService';
import BankLogo, { getBankInfo } from '../components/BankLogo';
import BankCard from '../components/BankCard';
import BankCardCarousel from '../components/BankCardCarousel';
import WalletCardHolder from '../components/WalletCardHolder';
import {
  ALL_BANK_THEMES,
  getBankTheme,
} from '../constants/BankThemeRegistry';

const finnLogoSource = require('../../assets/finn-logo.png');
const { width } = Dimensions.get('window');

export default function CardInvoicesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    cards,
    addCard,
    updateCard,
    removeCard,
    members,
    loggedInUser,
    transactions = [],
    addTransactionsBatch,
  } = useFinance();

  const defaultUserName =
    loggedInUser?.name || loggedInUser?.fullName || 'SEU NOME';

  const [selectedBankFilter, setSelectedBankFilter] = useState('Todos');
  const [walletAnimTrigger, setWalletAnimTrigger] = useState(0);
  const [focusedCardId, setFocusedCardId] = useState(cards[0]?.id || null);
  const [selectedInvoiceMonth, setSelectedInvoiceMonth] = useState('Nov/2026');
  const [importingInvoice, setImportingInvoice] = useState(false);

  // Modais
  const [modalNewCard, setModalNewCard] = useState(false);
  const [modalEditCard, setModalEditCard] = useState(false);
  const [modalEvolucao, setModalEvolucao] = useState(false);

  // Estado do formulário de criação
  const [newCardBankId, setNewCardBankId] = useState('nubank');
  const [newCardName, setNewCardName] = useState('Nubank');
  const [newCardHolderName, setNewCardHolderName] = useState(defaultUserName);
  const [newCardLastFourDigits, setNewCardLastFourDigits] = useState('');
  const [newCardExpiry, setNewCardExpiry] = useState('12/28');
  const [newCardLimit, setNewCardLimit] = useState('');
  const [newCardInvoice, setNewCardInvoice] = useState('');
  const [newCardDueDay, setNewCardDueDay] = useState('10');
  const [bankSearchText, setBankSearchText] = useState('');

  // Estado do formulário de edição
  const [editingCardId, setEditingCardId] = useState(null);
  const [editCardBankId, setEditCardBankId] = useState('nubank');
  const [editCardName, setEditCardName] = useState('');
  const [editCardHolderName, setEditCardHolderName] = useState('');
  const [editCardLastFourDigits, setEditCardLastFourDigits] = useState('');
  const [editCardExpiry, setEditCardExpiry] = useState('');
  const [editCardLimit, setEditCardLimit] = useState('');
  const [editCardInvoice, setEditCardInvoice] = useState('');
  const [editCardDueDay, setEditCardDueDay] = useState('10');
  const [editCardClosingDay, setEditCardClosingDay] = useState('3');

  const formatMoney = (val) => {
    return (
      'R$ ' +
      (val || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  // Lista ativa de cartões para exibição na carteira e nas faturas (sem cartões pré-configurados: começa 100% vazia em contas novas)
  const displayCards = useMemo(() => {
    return Array.isArray(cards) ? cards : [];
  }, [cards]);

  // Bancos dinâmicos baseados nos cartões cadastrados
  const dynamicBanks = useMemo(() => {
    const names = displayCards.map((c) => {
      const theme = getBankTheme(c.bankId || c.bank || c.name);
      return theme.name;
    });
    return Array.from(new Set(names));
  }, [displayCards]);

  const filterPills = ['Todos', ...dynamicBanks];

  // Filtragem dos cartões de acordo com a pill selecionada
  const filteredCards = useMemo(() => {
    if (selectedBankFilter === 'Todos') return displayCards;
    return displayCards.filter((c) => {
      const theme = getBankTheme(c.bankId || c.bank || c.name);
      return (
        theme.name.toLowerCase() === selectedBankFilter.toLowerCase() ||
        theme.bankId.toLowerCase() === selectedBankFilter.toLowerCase() ||
        (c.bank && c.bank.toLowerCase().includes(selectedBankFilter.toLowerCase())) ||
        (c.name && c.name.toLowerCase().includes(selectedBankFilter.toLowerCase()))
      );
    });
  }, [displayCards, selectedBankFilter]);

  // Totais calculados de todos os cartões
  const totalOpenInvoices = useMemo(() => {
    return displayCards.reduce((sum, c) => sum + (Number(c.currentInvoice) || 0), 0);
  }, [displayCards]);

  const totalCreditLimit = useMemo(() => {
    return displayCards.reduce((sum, c) => sum + (Number(c.limit) || 0), 0);
  }, [displayCards]);

  const totalUsedLimit = useMemo(() => {
    return displayCards.reduce((sum, c) => {
      const used =
        c.usedLimit !== undefined && c.usedLimit !== null
          ? Number(c.usedLimit)
          : Number(c.currentInvoice) || 0;
      return sum + used;
    }, 0);
  }, [displayCards]);

  const totalAvailableLimit = useMemo(() => {
    return Math.max(totalCreditLimit - totalUsedLimit, 0);
  }, [totalCreditLimit, totalUsedLimit]);

  const totalLimitUsedPercent = useMemo(() => {
    if (totalCreditLimit <= 0) return 0;
    return Math.min(Math.round((totalUsedLimit / totalCreditLimit) * 100), 100);
  }, [totalUsedLimit, totalCreditLimit]);

  const totalCardsCount = displayCards.length;

  // Bancos filtrados pela barra de busca do modal
  const filteredBankThemes = useMemo(() => {
    if (!bankSearchText.trim()) return ALL_BANK_THEMES;
    const q = bankSearchText.toLowerCase().trim();
    return ALL_BANK_THEMES.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.bankId.toLowerCase().includes(q) ||
        (b.brandLabel && b.brandLabel.toLowerCase().includes(q))
    );
  }, [bankSearchText]);

  // Cartão Focado e Tema (Modelo Foto 3)
  const focusedCard = useMemo(() => {
    if (selectedBankFilter !== 'Todos' && filteredCards.length > 0) {
      return filteredCards.find((c) => c.id === focusedCardId) || filteredCards[0];
    }
    return displayCards.find((c) => c.id === focusedCardId) || displayCards[0] || null;
  }, [displayCards, filteredCards, selectedBankFilter, focusedCardId]);

  const focusedCardTheme = useMemo(() => {
    if (!focusedCard) return getBankTheme('nubank');
    return getBankTheme(focusedCard.bankId || focusedCard.bank || focusedCard.name);
  }, [focusedCard]);

  // Transações/Lançamentos reais (todos os cartões em 'Todos' ou apenas do cartão focado)
  const invoiceTransactions = useMemo(() => {
    if (selectedBankFilter === 'Todos') {
      const cardIds = new Set(displayCards.map((c) => c.id));
      const cardNames = new Set(
        displayCards.map((c) => (c.name || '').toLowerCase()).filter(Boolean)
      );
      return transactions.filter(
        (t) =>
          t.paymentMethod === 'credit_card' ||
          (t.cardId && cardIds.has(t.cardId)) ||
          (t.cardName && cardNames.has(t.cardName.toLowerCase()))
      );
    }
    if (!focusedCard) return [];
    return transactions.filter(
      (t) =>
        t.cardId === focusedCard.id ||
        (t.cardName && t.cardName.toLowerCase() === (focusedCard.name || '').toLowerCase()) ||
        (t.paymentMethod === 'credit_card' && (!t.cardId || t.cardId === focusedCard.id))
    );
  }, [transactions, focusedCard, selectedBankFilter, displayCards]);

  const displayInvoiceTxs = useMemo(() => {
    return invoiceTransactions;
  }, [invoiceTransactions]);

  // Importar Fatura (PDF / CSV) diretamente da tela do cartão (Conforme solicitado)
  const handleImportInvoice = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/csv', 'text/comma-separated-values'],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const asset = res.assets[0];
      setImportingInvoice(true);

      const isPdf = asset.name?.toLowerCase().endsWith('.pdf') || asset.mimeType?.includes('pdf');
      let base64OrText = '';
      if (isPdf) {
        base64OrText = await readFileAsBase64(asset.uri);
      } else {
        base64OrText = await readFileAsText(asset.uri);
      }

      const activeCard = focusedCard || cards[0];
      const bankName = activeCard?.name || 'Nubank';
      const promptNotes = `Fatura do cartão de crédito ${bankName}. Extraia o valor total da fatura e liste todas as compras/lançamentos detalhados.`;

      let aiResponse = '';
      const uName = loggedInUser?.name || 'Você';
      if (isPdf) {
        aiResponse = await analyzeInvoicePdf({
          base64Pdf: base64OrText,
          userNotes: promptNotes,
          financialContext: { userName: uName },
        });
      } else {
        aiResponse = await sendTextMessageToGemini({
          message: `Analise este extrato CSV da fatura do cartão ${bankName}:\n\n${base64OrText.slice(0, 10000)}`,
          financialContext: { userName: uName },
        });
      }

      // Regex para capturar valor total da fatura
      const matchTotal = aiResponse.match(/R\$\s*([\d\.,]+)/);
      let parsedInvoiceTotal = 0;
      if (matchTotal) {
        parsedInvoiceTotal = parseFloat(matchTotal[1].replace(/\./g, '').replace(',', '.')) || 0;
      }

      // Regex para capturar lançamentos estruturados
      const txRegex = /\[TRANSACTION:\s*({.*?})\]/g;
      let txMatch;
      const newExtractedTxs = [];
      while ((txMatch = txRegex.exec(aiResponse)) !== null) {
        try {
          const parsed = JSON.parse(txMatch[1]);
          newExtractedTxs.push({
            id: 'tx-inv-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            title: parsed.description || parsed.title || 'Compra Cartão',
            amount: parseFloat(parsed.amount) || 0,
            type: 'expense',
            category: parsed.category || 'outros',
            date: new Date().toISOString().split('T')[0],
            cardId: activeCard?.id,
            cardName: bankName,
            paymentMethod: 'credit_card',
            author: uName,
          });
        } catch (e) {}
      }

      if (newExtractedTxs.length > 0 && addTransactionsBatch) {
        await addTransactionsBatch(newExtractedTxs);
      }

      if (parsedInvoiceTotal > 0 && activeCard?.id) {
        await updateCard(activeCard.id, {
          currentInvoice: parsedInvoiceTotal,
        });
      }

      Alert.alert(
        'Fatura Importada!',
        `A fatura do ${bankName} foi processada pela IA com sucesso.\n${parsedInvoiceTotal > 0 ? `• Total da Fatura: R$ ${parsedInvoiceTotal.toFixed(2).replace('.', ',')}\n` : ''}${newExtractedTxs.length > 0 ? `• ${newExtractedTxs.length} lançamentos adicionados.` : ''}`
      );
    } catch (e) {
      Alert.alert('Erro ao importar', 'Não foi possível ler o arquivo: ' + e.message);
    } finally {
      setImportingInvoice(false);
    }
  };

  // Abertura do modal de criação
  const handleOpenAddModal = () => {
    setNewCardBankId('nubank');
    setNewCardName('Nubank');
    setNewCardHolderName(defaultUserName);
    setNewCardLastFourDigits('');
    setNewCardExpiry('12/28');
    setNewCardLimit('');
    setNewCardInvoice('');
    setNewCardDueDay('10');
    setBankSearchText('');
    setModalNewCard(true);
  };

  // Salvar novo cartão
  const handleCreateCard = async () => {
    const theme = getBankTheme(newCardBankId);
    const cardTitle = newCardName.trim() || theme.name;
    const limitNum = parseFloat(newCardLimit.replace(',', '.')) || 0;
    const invNum = parseFloat(newCardInvoice.replace(',', '.')) || 0;
    const dueDayNum = parseInt(newCardDueDay, 10) || 10;
    const used =
      limitNum > 0 ? Math.min(Math.round((invNum / limitNum) * 100), 100) : 0;

    const [expMonth, expYear] = (newCardExpiry || '12/28').split('/');

    const newCreated = await addCard({
      name: cardTitle,
      bank: theme.name,
      bankId: theme.bankId,
      holderName: (newCardHolderName.trim() || defaultUserName).toUpperCase(),
      lastFourDigits: newCardLastFourDigits.trim().slice(-4),
      expiryMonth: expMonth || '12',
      expiryYear: expYear || '28',
      limit: limitNum,
      currentInvoice: invNum,
      dueDay: dueDayNum,
      dueDateText: `Vence dia ${dueDayNum}`,
      status: 'Em aberto',
      usedPercent: used,
      color: theme.gradientColors[0],
      logoType: theme.bankId,
      owner: 'Casal',
    });

    setModalNewCard(false);
    if (newCreated && newCreated.id) {
      setFocusedCardId(newCreated.id);
      setSelectedBankFilter(theme.name);
    }
    Alert.alert('Sucesso', `Cartão ${theme.name} adicionado com sucesso!`);
  };

  // Abertura do modal de edição
  const handleOpenEditModal = (card) => {
    if (!card) return;
    const theme = getBankTheme(card.bankId || card.bank || card.name);
    const dueNum = parseInt(card.dueDay, 10) || 10;
    const closeNum =
      card.closingDay !== undefined && card.closingDay !== null
        ? parseInt(card.closingDay, 10)
        : Math.max(1, dueNum - 7);

    setEditingCardId(card.id);
    setEditCardBankId(theme.bankId);
    setEditCardName(card.name || theme.name);
    setEditCardHolderName(card.holderName || defaultUserName);
    setEditCardLastFourDigits(card.lastFourDigits || '');
    setEditCardExpiry(`${card.expiryMonth || '12'}/${card.expiryYear || '28'}`);
    setEditCardLimit(card.limit !== undefined && card.limit !== null ? String(card.limit) : '');
    setEditCardInvoice(
      card.currentInvoice !== undefined && card.currentInvoice !== null
        ? String(card.currentInvoice)
        : ''
    );
    setEditCardDueDay(String(dueNum));
    setEditCardClosingDay(String(closeNum));
    setModalEditCard(true);
  };

  // Salvar edição do cartão
  const handleSaveEditCard = async () => {
    if (!editingCardId) return;
    const theme = getBankTheme(editCardBankId);
    const cardTitle = editCardName.trim() || theme.name;
    const limitNum = parseFloat(String(editCardLimit).replace(/\./g, '').replace(',', '.')) || parseFloat(String(editCardLimit).replace(',', '.')) || 0;
    const invNum = parseFloat(String(editCardInvoice).replace(/\./g, '').replace(',', '.')) || parseFloat(String(editCardInvoice).replace(',', '.')) || 0;
    const dueDayNum = Math.min(31, Math.max(1, parseInt(editCardDueDay, 10) || 10));
    const closingDayNum = Math.min(
      31,
      Math.max(1, parseInt(editCardClosingDay, 10) || Math.max(1, dueDayNum - 7))
    );
    const used =
      limitNum > 0 ? Math.min(Math.round((invNum / limitNum) * 100), 100) : 0;
    const [expMonth, expYear] = (editCardExpiry || '12/28').split('/');

    await updateCard(editingCardId, {
      name: cardTitle,
      bank: theme.name,
      bankId: theme.bankId,
      holderName: (editCardHolderName.trim() || defaultUserName).toUpperCase(),
      lastFourDigits: editCardLastFourDigits.trim().slice(-4),
      expiryMonth: expMonth || '12',
      expiryYear: expYear || '28',
      limit: limitNum,
      currentInvoice: invNum,
      dueDay: dueDayNum,
      closingDay: closingDayNum,
      dueDateText: `Vence dia ${dueDayNum}`,
      status: 'Em aberto',
      usedPercent: used,
      color: theme.gradientColors[0],
      logoType: theme.bankId,
    });

    setModalEditCard(false);
    setEditingCardId(null);
    Alert.alert('Atualizado', 'Os dados do cartão foram salvos com sucesso.');
  };

  // Excluir cartão com confirmação
  const handleConfirmDeleteCard = (card) => {
    Alert.alert(
      'Remover Cartão',
      `Tem certeza que deseja remover o cartão "${card.name || card.bank}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            await removeCard(card.id);
            if (focusedCardId === card.id) {
              setFocusedCardId(cards[0]?.id || null);
            }
          },
        },
      ]
    );
  };

  // Trata seleção de filtro
  const handleSelectFilter = (bankName) => {
    setSelectedBankFilter(bankName);
    if (bankName === 'Todos') {
      setWalletAnimTrigger((prev) => prev + 1);
    } else {
      const match = displayCards.find((c) => {
        const theme = getBankTheme(c.bankId || c.bank || c.name);
        return theme.name.toLowerCase() === bankName.toLowerCase();
      });
      if (match) {
        setFocusedCardId(match.id);
      }
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F5FC" />

      {/* HEADER SUPERIOR IDÊNTICO À FOTO 3 */}
      <View style={styles.photo3TopHeader}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation?.goBack?.()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#18181B" />
        </TouchableOpacity>

        <View style={styles.photo3MonthSelector}>
          <TouchableOpacity
            onPress={() => {
              const months = ['Out/2026', 'Nov/2026', 'Dez/2026'];
              const idx = months.indexOf(selectedInvoiceMonth);
              if (idx > 0) setSelectedInvoiceMonth(months[idx - 1]);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={16} color="#71717A" />
          </TouchableOpacity>

          <Text style={styles.photo3MonthTitle}>Fatura {selectedInvoiceMonth}</Text>

          <TouchableOpacity
            onPress={() => {
              const months = ['Out/2026', 'Nov/2026', 'Dez/2026'];
              const idx = months.indexOf(selectedInvoiceMonth);
              if (idx < months.length - 1) setSelectedInvoiceMonth(months[idx + 1]);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-forward" size={16} color="#71717A" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.photo3AddBtn}
          onPress={handleOpenAddModal}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={22} color="#18181B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        {/* TÍTULO PRINCIPAL CONFORME PRINT DO USUÁRIO */}
        <Text style={styles.pageTitle}>Faturas dos cartões</Text>

        {/* SELETOR DE BANCOS / PILLS (Todos, Nubank, C6 Bank, Itaú...) */}
        {displayCards.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsRow}
          >
            {filterPills.map((filterName) => {
              const isActive = selectedBankFilter === filterName;
              return (
                <TouchableOpacity
                  key={filterName}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => handleSelectFilter(filterName)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      isActive && styles.filterPillTextActive,
                    ]}
                  >
                    {filterName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* MODO 'TODOS': CARTEIRA DE COURO + APENAS RESUMO TOTAL DE TODOS OS CARTÕES */}
        {selectedBankFilter === 'Todos' ? (
          displayCards.length === 0 ? (
            <View style={styles.emptyWalletCard}>
              <View style={styles.emptyWalletIconCircle}>
                <Ionicons name="card-outline" size={38} color="#7C3AED" />
              </View>
              <Text style={styles.emptyWalletTitle}>Nenhum cartão cadastrado</Text>
              <Text style={styles.emptyWalletSub}>
                Cadastre seus cartões de crédito para acompanhar faturas, limite disponível e vencimentos em tempo real.
              </Text>
              <TouchableOpacity
                style={styles.emptyWalletAddBtn}
                onPress={handleOpenAddModal}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                <Text style={styles.emptyWalletAddBtnText}>Cadastrar Primeiro Cartão</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.walletSectionWrapper}>
                <WalletCardHolder
                  cards={displayCards}
                  resetTrigger={walletAnimTrigger}
                  onSelectCard={(c) => {
                    setFocusedCardId(c.id);
                  }}
                  onOpenCardDetails={(c) => {
                    const theme = getBankTheme(c.bankId || c.bank || c.name);
                    setFocusedCardId(c.id);
                    setSelectedBankFilter(theme.name);
                  }}
                />
              </View>

              {/* RESUMO TOTAL CONSOLIDADO DE TODOS OS CARTÕES (SEM EXIBIR CARTÃO COMPLETO) */}
              <View style={styles.allCardsSummaryContainer}>
                <LinearGradient
                  colors={['#1E1B4B', '#311068', '#4C1D95']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.allCardsTotalCard}
                >
                  <View style={styles.allCardsHeaderRow}>
                    <View style={styles.allCardsTitleGroup}>
                      <View style={styles.allCardsIconBadge}>
                        <Ionicons name="layers-outline" size={18} color="#DDD6FE" />
                      </View>
                      <View>
                        <Text style={styles.allCardsHeaderTitle}>Resumo de todos os cartões</Text>
                        <Text style={styles.allCardsHeaderSub}>
                          {totalCardsCount} {totalCardsCount === 1 ? 'cartão ativo' : 'cartões ativos'} • {selectedInvoiceMonth}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.allCardsEvolucaoPill}
                      onPress={() => setModalEvolucao(true)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trending-up" size={13} color="#EDE9FE" />
                      <Text style={styles.allCardsEvolucaoText}>Evolução</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.allCardsMainLabel}>Total geral das faturas</Text>
                  <Text style={styles.allCardsMainValue}>
                    {formatMoney(totalOpenInvoices)}
                  </Text>

                  {/* Métricas consolidadas de limite */}
                  <View style={styles.allCardsMetricsGrid}>
                    <View style={styles.allCardsMetricCol}>
                      <Text style={styles.allCardsMetricLabel}>Limite utilizado</Text>
                      <Text style={styles.allCardsMetricVal}>
                        {formatMoney(totalUsedLimit)}
                      </Text>
                    </View>
                    <View style={styles.allCardsMetricDivider} />
                    <View style={styles.allCardsMetricCol}>
                      <Text style={styles.allCardsMetricLabel}>Limite disponível</Text>
                      <Text style={[styles.allCardsMetricVal, { color: '#6EE7B7' }]}>
                        {formatMoney(totalAvailableLimit)}
                      </Text>
                    </View>
                  </View>

                  {/* Barra de progresso do limite total somado */}
                  <View style={styles.photo3LimitHeader}>
                    <Text style={styles.photo3LimitLabel}>Uso do limite total combinado</Text>
                    <Text style={styles.photo3LimitPercent}>{totalLimitUsedPercent}%</Text>
                  </View>
                  <View style={styles.photo3LimitTrack}>
                    <View
                      style={[
                        styles.photo3LimitFill,
                        { width: `${totalLimitUsedPercent}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.photo3LimitSub}>
                    {formatMoney(totalUsedLimit)} utilizados de {formatMoney(totalCreditLimit)} de limite total
                  </Text>
                </LinearGradient>

                {/* LISTA RESUMIDA POR CARTÃO (COMPACTA, SEM EXIBIR CARTÃO COMPLETO) */}
                <View style={styles.allCardsBreakdownBox}>
                  <Text style={styles.allCardsBreakdownTitle}>Resumo por cartão</Text>
                  {displayCards.map((card, idx) => {
                    const theme = getBankTheme(card.bankId || card.bank || card.name);
                    return (
                      <TouchableOpacity
                        key={card.id || `sum-${idx}`}
                        style={[
                          styles.allCardsBreakdownRow,
                          idx > 0 && styles.allCardsBreakdownRowBorder,
                        ]}
                        activeOpacity={0.75}
                        onPress={() => {
                          setFocusedCardId(card.id);
                          setSelectedBankFilter(theme.name);
                        }}
                      >
                        <View style={styles.allCardsBreakdownLeft}>
                          <BankLogo bank={theme.bankId} size={34} />
                          <View>
                            <Text style={styles.allCardsBreakdownName}>
                              {card.name || theme.name}
                            </Text>
                            <Text style={styles.allCardsBreakdownSub}>
                              Vence dia {card.dueDay || 10}
                              {card.lastFourDigits ? ` • Final ${card.lastFourDigits}` : ''}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.allCardsBreakdownRight}>
                          <Text style={styles.allCardsBreakdownVal}>
                            {formatMoney(card.currentInvoice || 0)}
                          </Text>
                          <Ionicons name="chevron-forward" size={15} color="#9CA3AF" />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </>
          )
        ) : !focusedCard ? (
          <View style={styles.emptyWalletCard}>
            <View style={styles.emptyWalletIconCircle}>
              <Ionicons name="card-outline" size={38} color="#7C3AED" />
            </View>
            <Text style={styles.emptyWalletTitle}>Nenhum cartão encontrado</Text>
            <Text style={styles.emptyWalletSub}>
              Nenhum cartão corresponde ao banco selecionado.
            </Text>
            <TouchableOpacity
              style={styles.emptyWalletAddBtn}
              onPress={() => setSelectedBankFilter('Todos')}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyWalletAddBtnText}>Ver Todos os Cartões</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ========================================================================= */
          /* MODO CARTÃO INDIVIDUAL SELECIONADO: EXIBE O CARTÃO COMPLETO E DETALHES    */
          /* ========================================================================= */
          <>
            {filteredCards.length > 1 && (
              <View style={styles.subCardPillsRow}>
                {filteredCards.map((c, idx) => {
                  const isCur = focusedCard?.id === c.id;
                  const label = c.lastFourDigits
                    ? `${c.name || c.bank} (•••• ${c.lastFourDigits})`
                    : `${c.name || c.bank} #${idx + 1}`;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.subCardPill, isCur && styles.subCardPillActive]}
                      onPress={() => setFocusedCardId(c.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.subCardPillText, isCur && styles.subCardPillTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={styles.photo3CardWrapper}>
              <LinearGradient
                colors={focusedCardTheme?.gradientColors || ['#7C3AED', '#4C1D95']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.photo3Card}
              >
                {/* Topo do Cartão: Chip EMV + Nome do Banco + Lápis de Edição no Canto Superior Direito */}
                <View style={styles.photo3CardTopRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={styles.photo3Chip}>
                      <View style={styles.photo3ChipInner} />
                      <View style={styles.photo3ChipLineH} />
                      <View style={styles.photo3ChipLineV} />
                    </View>
                    <Text style={styles.photo3BankName}>
                      {(focusedCard?.name || focusedCardTheme?.name || 'NUBANK').toUpperCase()}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.photo3EditPencilBtn}
                    onPress={() => focusedCard && handleOpenEditModal(focusedCard)}
                    activeOpacity={0.75}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="pencil" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                {/* Total da Fatura */}
                <Text style={styles.photo3TotalLabel}>Total da fatura</Text>
                <Text style={styles.photo3TotalValue}>
                  {formatMoney(
                    focusedCard?.currentInvoice !== undefined && focusedCard?.currentInvoice !== null
                      ? focusedCard.currentInvoice
                      : 0
                  )}
                </Text>

                {/* Datas de Fechamento e Vencimento */}
                <View style={styles.photo3DatesRow}>
                  <View style={styles.photo3DateCol}>
                    <Text style={styles.photo3DateLabel}>Fechamento</Text>
                    <Text style={styles.photo3DateValue}>
                      {`0${focusedCard?.closingDay || Math.max(1, (focusedCard?.dueDay || 10) - 7)}`.slice(-2)}/11/2026
                    </Text>
                  </View>
                  <View style={styles.photo3DateCol}>
                    <Text style={styles.photo3DateLabel}>Vencimento</Text>
                    <Text style={styles.photo3DateValue}>
                      {`0${focusedCard?.dueDay || 10}`.slice(-2)}/11/2026
                    </Text>
                  </View>
                </View>

                {/* Limite Usado no Ciclo */}
                <View style={styles.photo3LimitHeader}>
                  <Text style={styles.photo3LimitLabel}>Limite usado no ciclo</Text>
                  <Text style={styles.photo3LimitPercent}>
                    {focusedCard?.usedPercent !== undefined ? focusedCard.usedPercent : 0}%
                  </Text>
                </View>

                {/* Barra de Progresso */}
                <View style={styles.photo3LimitTrack}>
                  <View
                    style={[
                      styles.photo3LimitFill,
                      {
                        width: `${focusedCard?.usedPercent !== undefined ? Math.min(focusedCard.usedPercent, 100) : 0}%`,
                      },
                    ]}
                  />
                </View>

                {/* Valores de Limite */}
                <Text style={styles.photo3LimitSub}>
                  {formatMoney(
                    focusedCard?.usedLimit ||
                      (focusedCard?.limit
                        ? (focusedCard.limit * (focusedCard.usedPercent || 0)) / 100
                        : focusedCard?.currentInvoice || 0)
                  )}{' '}
                  de {formatMoney(focusedCard?.limit || 0)}
                </Text>
              </LinearGradient>
            </View>

            {/* BOTÃO PARA IMPORTAR FATURA DIRETO DO CARTÃO */}
            <TouchableOpacity
              style={styles.importInvoiceBtn}
              onPress={handleImportInvoice}
              disabled={importingInvoice}
              activeOpacity={0.8}
            >
              {importingInvoice ? (
                <ActivityIndicator size="small" color="#7C3AED" />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={18} color="#7C3AED" />
                  <Text style={styles.importInvoiceBtnText}>
                    Importar fatura (PDF / CSV)
                  </Text>
                  <Ionicons name="sparkles" size={16} color="#7C3AED" />
                </>
              )}
            </TouchableOpacity>

            {/* SEÇÃO: LANÇAMENTOS DA FATURA DO CARTÃO SELECIONADO */}
            <View style={styles.photo3TxSectionHeader}>
              <Text style={styles.photo3TxSectionTitle}>
                Lançamentos da fatura ({displayInvoiceTxs.length})
              </Text>
              <TouchableOpacity
                style={styles.miniManageBtn}
                onPress={() => focusedCard && handleOpenEditModal(focusedCard)}
                activeOpacity={0.7}
              >
                <Ionicons name="settings-outline" size={14} color="#7C3AED" />
                <Text style={styles.miniManageBtnText}>Gerenciar</Text>
              </TouchableOpacity>
            </View>

            {displayInvoiceTxs.length === 0 ? (
              <View style={styles.emptyInvoiceTxBox}>
                <Ionicons name="receipt-outline" size={32} color="#A1A1AA" />
                <Text style={styles.emptyInvoiceTxTitle}>Nenhum lançamento nesta fatura</Text>
                <Text style={styles.emptyInvoiceTxSub}>
                  Toque no botão "Importar fatura (PDF / CSV)" acima para ler seu arquivo automaticamente ou converse com o FINN AI.
                </Text>
              </View>
            ) : (
              displayInvoiceTxs.map((tx) => (
                <View key={tx.id} style={styles.invoiceTxRow}>
                  <View style={styles.invoiceTxIconCircle}>
                    <Ionicons name="card-outline" size={18} color="#7C3AED" />
                  </View>
                  <View style={styles.invoiceTxMain}>
                    <Text style={styles.invoiceTxTitle}>{tx.title || tx.description}</Text>
                    <Text style={styles.invoiceTxSub}>
                      {tx.date || '04/11/2026'} · {tx.author || 'Titular'}
                    </Text>
                  </View>
                  <Text style={styles.invoiceTxAmount}>{formatMoney(tx.amount)}</Text>
                </View>
              ))
            )}
          </>
        )}

        {/* BOTÃO PARA ADICIONAR CARTÃO ADICIONAL */}
        {displayCards.length > 0 && (
          <TouchableOpacity
            style={styles.addCardBtn}
            activeOpacity={0.8}
            onPress={handleOpenAddModal}
          >
            <Ionicons name="add-circle-outline" size={18} color="#7C3AED" />
            <Text style={styles.addCardBtnText}>Adicionar outro cartão</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL ADICIONAR CARTÃO COM PRÉ-VISUALIZAÇÃO AO VIVO E 18 BANCOS SUPORTADOS */}
      {/* ========================================================================= */}
      <Modal visible={modalNewCard} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adicionar Cartão</Text>
              <TouchableOpacity onPress={() => setModalNewCard(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* PRÉ-VISUALIZAÇÃO INTERATIVA EM TEMPO REAL */}
              <Text style={styles.previewSectionTitle}>
                Pré-visualização do Cartão
              </Text>
              <View style={styles.previewCardWrapper}>
                <BankCard
                  bankId={newCardBankId}
                  holderName={newCardHolderName || 'NOME SOBRENOME'}
                  lastFourDigits={newCardLastFourDigits || ''}
                  expiryMonth={newCardExpiry.split('/')[0] || '12'}
                  expiryYear={newCardExpiry.split('/')[1] || '28'}
                />
              </View>

              {/* BUSCA DE BANCO */}
              <Text style={styles.inputLabel}>
                Selecione o Banco / Emissor (18 bancos)
              </Text>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color="#9CA3AF" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar banco ou emissor..."
                  placeholderTextColor="#9CA3AF"
                  value={bankSearchText}
                  onChangeText={setBankSearchText}
                />
                {bankSearchText ? (
                  <TouchableOpacity onPress={() => setBankSearchText('')}>
                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* GRADE / CARROSSEL DOS 18 BANCOS SUPORTADOS */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.bankPickerContainer}
              >
                {filteredBankThemes.map((b) => {
                  const isSelected = newCardBankId === b.bankId;
                  return (
                    <TouchableOpacity
                      key={b.bankId}
                      style={[
                        styles.bankPickerItem,
                        isSelected && styles.bankPickerItemActive,
                      ]}
                      onPress={() => {
                        setNewCardBankId(b.bankId);
                        if (
                          !newCardName.trim() ||
                          ALL_BANK_THEMES.some((x) => x.name === newCardName)
                        ) {
                          setNewCardName(b.name);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <BankLogo bank={b.bankId} size={36} />
                      <Text
                        style={[
                          styles.bankPickerName,
                          isSelected && styles.bankPickerNameActive,
                        ]}
                        numberOfLines={1}
                      >
                        {b.name}
                      </Text>
                      {isSelected && (
                        <View style={styles.bankSelectedBadge}>
                          <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color="#7C3AED"
                          />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* CAMPOS DO FORMULÁRIO */}
              <Text style={styles.inputLabel}>Nome do Titular no Cartão</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: NOME COMPLETO"
                placeholderTextColor="#9CA3AF"
                value={newCardHolderName}
                onChangeText={(t) => setNewCardHolderName(t.toUpperCase())}
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>Apelido do Cartão</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Nubank Ultravioleta"
                placeholderTextColor="#9CA3AF"
                value={newCardName}
                onChangeText={setNewCardName}
              />

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Últimos 4 Dígitos</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1234"
                    keyboardType="number-pad"
                    maxLength={4}
                    placeholderTextColor="#9CA3AF"
                    value={newCardLastFourDigits}
                    onChangeText={setNewCardLastFourDigits}
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Validade (MM/AA)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="12/28"
                    maxLength={5}
                    placeholderTextColor="#9CA3AF"
                    value={newCardExpiry}
                    onChangeText={setNewCardExpiry}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Limite Total (R$)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="5000,00"
                    keyboardType="numeric"
                    placeholderTextColor="#9CA3AF"
                    value={newCardLimit}
                    onChangeText={setNewCardLimit}
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Fatura Atual (R$)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="500,00"
                    keyboardType="numeric"
                    placeholderTextColor="#9CA3AF"
                    value={newCardInvoice}
                    onChangeText={setNewCardInvoice}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Dia do Vencimento</Text>
              <TextInput
                style={styles.input}
                placeholder="10"
                keyboardType="number-pad"
                placeholderTextColor="#9CA3AF"
                value={newCardDueDay}
                onChangeText={setNewCardDueDay}
              />

              <TouchableOpacity
                style={styles.modalSaveBtn}
                activeOpacity={0.85}
                onPress={handleCreateCard}
              >
                <Text style={styles.modalSaveBtnText}>Salvar Cartão</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL EDITAR CARTÃO */}
      {/* ========================================================================= */}
      <Modal visible={modalEditCard} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Cartão</Text>
              <TouchableOpacity onPress={() => setModalEditCard(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* PRÉ-VISUALIZAÇÃO DO CARTÃO EDITADO */}
              <View style={styles.previewCardWrapper}>
                <BankCard
                  bankId={editCardBankId}
                  holderName={editCardHolderName || 'NOME SOBRENOME'}
                  lastFourDigits={editCardLastFourDigits || ''}
                  expiryMonth={editCardExpiry.split('/')[0] || '12'}
                  expiryYear={editCardExpiry.split('/')[1] || '28'}
                />
              </View>

              <Text style={styles.inputLabel}>Nome / Apelido</Text>
              <TextInput
                style={styles.input}
                value={editCardName}
                onChangeText={setEditCardName}
              />

              <Text style={styles.inputLabel}>Nome do Titular no Cartão</Text>
              <TextInput
                style={styles.input}
                value={editCardHolderName}
                onChangeText={(t) => setEditCardHolderName(t.toUpperCase())}
                autoCapitalize="characters"
              />

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Últimos 4 Dígitos</Text>
                  <TextInput
                    style={styles.input}
                    value={editCardLastFourDigits}
                    maxLength={4}
                    keyboardType="number-pad"
                    onChangeText={setEditCardLastFourDigits}
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Validade (MM/AA)</Text>
                  <TextInput
                    style={styles.input}
                    value={editCardExpiry}
                    maxLength={5}
                    onChangeText={setEditCardExpiry}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Limite Total (R$)</Text>
                  <TextInput
                    style={styles.input}
                    value={editCardLimit}
                    keyboardType="numeric"
                    onChangeText={setEditCardLimit}
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Fatura Atual (R$)</Text>
                  <TextInput
                    style={styles.input}
                    value={editCardInvoice}
                    keyboardType="numeric"
                    onChangeText={setEditCardInvoice}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Dia do Fechamento</Text>
                  <TextInput
                    style={styles.input}
                    value={editCardClosingDay}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="Ex: 03"
                    placeholderTextColor="#9CA3AF"
                    onChangeText={setEditCardClosingDay}
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Dia do Vencimento</Text>
                  <TextInput
                    style={styles.input}
                    value={editCardDueDay}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="Ex: 10"
                    placeholderTextColor="#9CA3AF"
                    onChangeText={setEditCardDueDay}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                activeOpacity={0.85}
                onPress={handleSaveEditCard}
              >
                <Text style={styles.modalSaveBtnText}>Salvar Alterações</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL EVOLUÇÃO DAS FATURAS */}
      {/* ========================================================================= */}
      <Modal visible={modalEvolucao} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="trending-up" size={22} color="#7C3AED" />
                <Text style={styles.modalTitle}>Evolução das Faturas</Text>
              </View>
              <TouchableOpacity onPress={() => setModalEvolucao(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.evolucaoSubtitle}>
              Histórico dos últimos 4 meses de faturas:
            </Text>

            <View style={styles.evolucaoBarChart}>
              {[
                { month: 'Jul', val: 1420, percent: 65 },
                { month: 'Ago', val: 1650, percent: 75 },
                { month: 'Set', val: 1210, percent: 55 },
                { month: 'Out', val: 1856.9, percent: 85 },
              ].map((item) => (
                <View key={item.month} style={styles.evolucaoBarCol}>
                  <Text style={styles.evolucaoValText}>
                    R$ {Math.round(item.val)}
                  </Text>
                  <View style={styles.evolucaoTrack}>
                    <LinearGradient
                      colors={['#7C3AED', '#A855F7']}
                      style={[
                        styles.evolucaoFill,
                        { height: `${item.percent}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.evolucaoMonthText}>{item.month}</Text>
                </View>
              ))}
            </View>

            <View style={styles.evolucaoTipBox}>
              <Ionicons name="sparkles" size={16} color="#7C3AED" />
              <Text style={styles.evolucaoTipText}>
                O FINN identificou que sua fatura média é de R$ 1.534,00 por mês.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={() => setModalEvolucao(false)}
            >
              <Text style={styles.modalSaveBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F5FC',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSettingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerLogoIcon: {
    width: 26,
    height: 26,
  },
  headerLogoText: {
    fontFamily: 'Audiowide',
    fontSize: 20,
    color: '#18181B',
    letterSpacing: 1.2,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#18181B',
    marginTop: 4,
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  photo3TopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  photo3MonthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photo3MonthTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#18181B',
  },
  photo3AddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  photo3CardWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  photo3Card: {
    borderRadius: 22,
    padding: 22,
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  photo3CardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  photo3EditPencilBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo3Chip: {
    width: 38,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#EAB308',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CA8A04',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  photo3ChipInner: {
    width: 20,
    height: 18,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#A16207',
  },
  photo3ChipLineH: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: '#A16207',
  },
  photo3ChipLineV: {
    position: 'absolute',
    height: '100%',
    width: 1,
    backgroundColor: '#A16207',
  },
  photo3BankName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  photo3TotalLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.75)',
    marginBottom: 4,
  },
  photo3TotalValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  photo3DatesRow: {
    flexDirection: 'row',
    gap: 28,
    marginBottom: 18,
  },
  photo3DateCol: {},
  photo3DateLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  photo3DateValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  photo3LimitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  photo3LimitLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  photo3LimitPercent: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  photo3LimitTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  photo3LimitFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  photo3LimitSub: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  importInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 20,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  importInvoiceBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7C3AED',
  },
  photo3TxSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  photo3TxSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#18181B',
  },
  miniManageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  miniManageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  emptyInvoiceTxBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 16,
  },
  emptyInvoiceTxTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#18181B',
    marginTop: 10,
    marginBottom: 4,
  },
  emptyInvoiceTxSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  invoiceTxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  invoiceTxIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  invoiceTxMain: {
    flex: 1,
  },
  invoiceTxTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#18181B',
    marginBottom: 2,
  },
  invoiceTxSub: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  invoiceTxAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#18181B',
  },
  walletSectionWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 18,
  },
  allCardsSummaryContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 8,
  },
  allCardsTotalCard: {
    borderRadius: 22,
    padding: 20,
    shadowColor: '#311068',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  allCardsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  allCardsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  allCardsIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allCardsHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  allCardsHeaderSub: {
    fontSize: 11.5,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.72)',
    marginTop: 1,
  },
  allCardsEvolucaoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  allCardsEvolucaoText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EDE9FE',
  },
  allCardsMainLabel: {
    fontSize: 12.5,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.75)',
    marginBottom: 3,
  },
  allCardsMainValue: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  allCardsMetricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  allCardsMetricCol: {
    flex: 1,
  },
  allCardsMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginHorizontal: 12,
  },
  allCardsMetricLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
  },
  allCardsMetricVal: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  allCardsBreakdownBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  allCardsBreakdownTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#18181B',
    marginBottom: 10,
  },
  allCardsBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  allCardsBreakdownRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  allCardsBreakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  allCardsBreakdownName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#18181B',
  },
  allCardsBreakdownSub: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 1,
  },
  allCardsBreakdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  allCardsBreakdownVal: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#18181B',
  },
  subCardPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  subCardPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#EDE9FE',
  },
  subCardPillActive: {
    backgroundColor: '#7C3AED',
  },
  subCardPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6D28D9',
  },
  subCardPillTextActive: {
    color: '#FFFFFF',
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EFEBF8',
  },
  filterPillActive: {
    backgroundColor: '#6D28D9',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  cardHeroContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F3EEFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#18181B',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  summarySub: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  cardsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardsSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#18181B',
  },
  evolucaoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  evolucaoBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C3AED',
  },
  cardsList: {
    gap: 12,
  },
  cardItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardItemFocused: {
    borderColor: '#C4B5FD',
    backgroundColor: '#FCFBFE',
  },
  cardItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardItemInfo: {
    flex: 1,
    marginLeft: 14,
  },
  cardItemName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#18181B',
    marginBottom: 2,
  },
  cardItemDueDate: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  cardItemRight: {
    alignItems: 'flex-end',
  },
  cardItemInvoiceValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#18181B',
    marginBottom: 4,
  },
  statusPill: {
    backgroundColor: '#F3EEFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  progressSection: {
    marginTop: 14,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#EFEBF8',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  cardItemBottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressMetaText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniDeleteBtn: {
    backgroundColor: '#FEE2E2',
  },
  addCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E4DCF5',
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 16,
  },
  addCardBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7C3AED',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: '92%',
  },
  modalScrollContent: {
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#18181B',
  },
  previewSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  previewCardWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    padding: 0,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#111827',
  },
  bankPickerContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  bankPickerItem: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    minWidth: 84,
    position: 'relative',
  },
  bankPickerItemActive: {
    backgroundColor: '#F3EEFF',
    borderColor: '#7C3AED',
  },
  bankPickerName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
    marginTop: 6,
    textAlign: 'center',
  },
  bankPickerNameActive: {
    color: '#7C3AED',
    fontWeight: '800',
  },
  bankSelectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formCol: {
    flex: 1,
  },
  modalSaveBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  evolucaoSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  evolucaoBarChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 180,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  evolucaoBarCol: {
    alignItems: 'center',
    width: 60,
  },
  evolucaoValText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 6,
  },
  evolucaoTrack: {
    width: 24,
    height: 120,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  evolucaoFill: {
    width: '100%',
    borderRadius: 12,
  },
  evolucaoMonthText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 8,
  },
  evolucaoTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3EEFF',
    borderRadius: 12,
    padding: 12,
    marginTop: 18,
  },
  evolucaoTipText: {
    flex: 1,
    fontSize: 12,
    color: '#6D28D9',
    fontWeight: '600',
  },
  emptyCardHeroBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#D8B4FE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    marginHorizontal: 16,
  },
  emptyHeroIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3EEFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyHeroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#18181B',
  },
  emptyHeroSubtitle: {
    fontSize: 13,
    color: '#71717A',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyCardsListBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  emptyCardsListTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#27272A',
    marginTop: 10,
  },
  emptyCardsListSub: {
    fontSize: 12,
    color: '#71717A',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyWalletCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginHorizontal: 16,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#EDE9FE',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  emptyWalletIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyWalletTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#18181B',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyWalletSub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
    maxWidth: 290,
  },
  emptyWalletAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyWalletAddBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
