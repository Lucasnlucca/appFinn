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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFinance } from '../context/FinanceContext';
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
  } = useFinance();

  const defaultUserName =
    loggedInUser?.name || members?.user1 || 'LUCAS SILVA';

  const [selectedBankFilter, setSelectedBankFilter] = useState('Todos');
  const [focusedCardId, setFocusedCardId] = useState(cards[0]?.id || null);

  // Modais
  const [modalNewCard, setModalNewCard] = useState(false);
  const [modalEditCard, setModalEditCard] = useState(false);
  const [modalEvolucao, setModalEvolucao] = useState(false);

  // Estado do formulário de criação
  const [newCardBankId, setNewCardBankId] = useState('nubank');
  const [newCardName, setNewCardName] = useState('Nubank');
  const [newCardHolderName, setNewCardHolderName] = useState(defaultUserName);
  const [newCardLastFourDigits, setNewCardLastFourDigits] = useState('4568');
  const [newCardExpiry, setNewCardExpiry] = useState('10/26');
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

  const formatMoney = (val) => {
    return (
      'R$ ' +
      (val || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  // Bancos dinâmicos baseados nos cartões cadastrados
  const dynamicBanks = useMemo(() => {
    const names = cards.map((c) => {
      const theme = getBankTheme(c.bankId || c.bank || c.name);
      return theme.name;
    });
    return Array.from(new Set(names));
  }, [cards]);

  const filterPills = ['Todos', ...dynamicBanks];

  // Filtragem dos cartões de acordo com a pill selecionada
  const filteredCards = useMemo(() => {
    if (selectedBankFilter === 'Todos') return cards;
    return cards.filter((c) => {
      const theme = getBankTheme(c.bankId || c.bank || c.name);
      return (
        theme.name.toLowerCase() === selectedBankFilter.toLowerCase() ||
        theme.bankId.toLowerCase() === selectedBankFilter.toLowerCase() ||
        (c.bank && c.bank.toLowerCase().includes(selectedBankFilter.toLowerCase())) ||
        (c.name && c.name.toLowerCase().includes(selectedBankFilter.toLowerCase()))
      );
    });
  }, [cards, selectedBankFilter]);

  // Totais calculados
  const totalOpenInvoices = useMemo(() => {
    return cards.reduce((sum, c) => sum + (c.currentInvoice || 0), 0);
  }, [cards]);

  const totalCardsCount = cards.length;

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

  // Abertura do modal de criação
  const handleOpenAddModal = () => {
    setNewCardBankId('nubank');
    setNewCardName('Nubank');
    setNewCardHolderName(defaultUserName);
    setNewCardLastFourDigits('4568');
    setNewCardExpiry('10/26');
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

    const [expMonth, expYear] = (newCardExpiry || '10/26').split('/');

    const newCreated = await addCard({
      name: cardTitle,
      bank: theme.name,
      bankId: theme.bankId,
      holderName: (newCardHolderName.trim() || defaultUserName).toUpperCase(),
      lastFourDigits: (newCardLastFourDigits.trim() || '4568').slice(-4),
      expiryMonth: expMonth || '10',
      expiryYear: expYear || '26',
      limit: limitNum,
      currentInvoice: invNum,
      dueDay: dueDayNum,
      dueDateText: `Vence em ${dueDayNum}/11/2026`,
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
    const theme = getBankTheme(card.bankId || card.bank || card.name);
    setEditingCardId(card.id);
    setEditCardBankId(theme.bankId);
    setEditCardName(card.name || theme.name);
    setEditCardHolderName(card.holderName || defaultUserName);
    setEditCardLastFourDigits(card.lastFourDigits || '4568');
    setEditCardExpiry(`${card.expiryMonth || '10'}/${card.expiryYear || '26'}`);
    setEditCardLimit(card.limit ? String(card.limit) : '');
    setEditCardInvoice(card.currentInvoice ? String(card.currentInvoice) : '');
    setEditCardDueDay(card.dueDay ? String(card.dueDay) : '10');
    setModalEditCard(true);
  };

  // Salvar edição do cartão
  const handleSaveEditCard = async () => {
    if (!editingCardId) return;
    const theme = getBankTheme(editCardBankId);
    const cardTitle = editCardName.trim() || theme.name;
    const limitNum = parseFloat(editCardLimit.replace(',', '.')) || 0;
    const invNum = parseFloat(editCardInvoice.replace(',', '.')) || 0;
    const dueDayNum = parseInt(editCardDueDay, 10) || 10;
    const used =
      limitNum > 0 ? Math.min(Math.round((invNum / limitNum) * 100), 100) : 0;
    const [expMonth, expYear] = (editCardExpiry || '10/26').split('/');

    await updateCard(editingCardId, {
      name: cardTitle,
      bank: theme.name,
      bankId: theme.bankId,
      holderName: (editCardHolderName.trim() || defaultUserName).toUpperCase(),
      lastFourDigits: (editCardLastFourDigits.trim() || '4568').slice(-4),
      expiryMonth: expMonth || '10',
      expiryYear: expYear || '26',
      limit: limitNum,
      currentInvoice: invNum,
      dueDay: dueDayNum,
      dueDateText: `Vence em ${dueDayNum}/11/2026`,
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
    if (bankName !== 'Todos') {
      const match = cards.find((c) => {
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

      {/* HEADER SUPERIOR */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation?.goBack?.()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#18181B" />
        </TouchableOpacity>

        {/* LOGO FINN CENTRALIZADA */}
        <View style={styles.headerLogoRow}>
          <Image
            source={finnLogoSource}
            style={styles.headerLogoIcon}
            resizeMode="contain"
          />
          <Text style={styles.headerLogoText}>FINN</Text>
        </View>

        {/* BOTÃO DE AJUDA / CONFIGURAÇÕES */}
        <TouchableOpacity
          style={styles.headerSettingsBtn}
          activeOpacity={0.7}
          onPress={() =>
            Alert.alert(
              'Faturas dos Cartões',
              'Acompanhe as faturas em aberto e fechadas de todos os seus cartões de crédito em um só lugar com sincronização em tempo real.'
            )
          }
        >
          <Ionicons name="settings-sharp" size={19} color="#71717A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        {/* TÍTULO PRINCIPAL */}
        <Text style={styles.pageTitle}>Faturas dos cartões</Text>

        {/* SELETOR DE BANCOS / PILLS */}
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

        {/* CARTÃO VISUAL PRINCIPAL OU CARTEIRA MASCULINA EM 'TODOS' */}
        <View style={styles.cardHeroContainer}>
          {selectedBankFilter === 'Todos' ? (
            <WalletCardHolder
              cards={cards}
              activeCardId={focusedCardId || cards[0]?.id}
              onSelectCard={(c) => {
                const theme = getBankTheme(c.bankId || c.bank || c.name);
                setSelectedBankFilter(theme.name);
                setFocusedCardId(c.id);
              }}
            />
          ) : filteredCards.length > 1 ? (
            <BankCardCarousel
              cards={filteredCards}
              activeCardId={focusedCardId || filteredCards[0]?.id}
              onSelectCard={(c) => setFocusedCardId(c.id)}
              userName={defaultUserName}
            />
          ) : (
            <BankCard
              bankId={
                getBankTheme(
                  filteredCards[0]?.bankId ||
                    filteredCards[0]?.bank ||
                    filteredCards[0]?.name
                ).bankId
              }
              cardId={filteredCards[0]?.id}
              holderName={filteredCards[0]?.holderName || defaultUserName}
              lastFourDigits={filteredCards[0]?.lastFourDigits || ''}
              expiryMonth={filteredCards[0]?.expiryMonth || '10'}
              expiryYear={filteredCards[0]?.expiryYear || '26'}
            />
          )}
        </View>

        {/* DOIS CARDS DE RESUMO SUPERIOR */}
        <View style={styles.summaryRow}>
          {/* CARD 1: A PAGAR */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconBox}>
              <Ionicons name="card-outline" size={18} color="#7C3AED" />
            </View>
            <Text style={styles.summaryLabel}>A pagar</Text>
            <Text style={styles.summaryValue}>R$ 0,00</Text>
            <Text style={styles.summarySub}>0 faturas fechadas</Text>
          </View>

          {/* CARD 2: EM ABERTO */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconBox}>
              <Ionicons name="flash-outline" size={18} color="#7C3AED" />
            </View>
            <Text style={styles.summaryLabel}>Em aberto</Text>
            <Text style={styles.summaryValue}>
              {formatMoney(totalOpenInvoices > 0 ? totalOpenInvoices : 601.5)}
            </Text>
            <Text style={styles.summarySub}>
              {totalCardsCount > 0
                ? `${totalCardsCount} faturas em aberto`
                : '3 faturas em aberto'}
            </Text>
          </View>
        </View>

        {/* SEÇÃO "SEUS CARTÕES" */}
        <View style={styles.cardsSectionHeader}>
          <Text style={styles.cardsSectionTitle}>Seus cartões</Text>
          <TouchableOpacity
            style={styles.evolucaoBtn}
            activeOpacity={0.75}
            onPress={() => setModalEvolucao(true)}
          >
            <Text style={styles.evolucaoBtnText}>Ver evolução</Text>
            <Ionicons name="bar-chart-outline" size={14} color="#7C3AED" />
          </TouchableOpacity>
        </View>

        {/* LISTA DE CARTÕES */}
        <View style={styles.cardsList}>
          {filteredCards.map((card) => {
            const theme = getBankTheme(card.bankId || card.bank || card.name);
            const limit = card.limit || 5000;
            const invoice = card.currentInvoice || 0;
            const usedPercent =
              card.usedPercent !== undefined
                ? card.usedPercent
                : limit > 0
                ? Math.min(Math.round((invoice / limit) * 100), 100)
                : 0;

            const isCardFocused = focusedCardId === card.id;

            return (
              <TouchableOpacity
                key={card.id}
                style={[
                  styles.cardItem,
                  isCardFocused && styles.cardItemFocused,
                ]}
                activeOpacity={0.9}
                onPress={() => {
                  setFocusedCardId(card.id);
                  setSelectedBankFilter(theme.name);
                }}
              >
                <View style={styles.cardItemTopRow}>
                  {/* LOGO OFICIAL DO BANCO */}
                  <BankLogo bank={theme.bankId} size={44} />

                  {/* INFORMAÇÕES CENTRAIS */}
                  <View style={styles.cardItemInfo}>
                    <Text style={styles.cardItemName}>
                      {card.name || theme.name}
                    </Text>
                    <Text style={styles.cardItemDueDate}>
                      {card.dueDateText ||
                        `Vence em ${card.dueDay || 10}/11/2026`}
                    </Text>
                  </View>

                  {/* VALOR E STATUS */}
                  <View style={styles.cardItemRight}>
                    <Text style={styles.cardItemInvoiceValue}>
                      {formatMoney(invoice)}
                    </Text>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>
                        {card.status || 'Em aberto'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* BARRA DE PROGRESSO DE LIMITE */}
                <View style={styles.progressSection}>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${usedPercent}%`,
                          backgroundColor: theme.gradientColors[0],
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.cardItemBottomActionsRow}>
                    <Text style={styles.progressMetaText}>
                      {usedPercent}% do limite usado · Limite: {formatMoney(limit)}
                    </Text>

                    {/* BOTÕES DE AÇÃO: EDITAR E EXCLUIR */}
                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity
                        style={styles.miniActionBtn}
                        onPress={() => handleOpenEditModal(card)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="pencil-outline"
                          size={15}
                          color="#7C3AED"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.miniActionBtn, styles.miniDeleteBtn]}
                        onPress={() => handleConfirmDeleteCard(card)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={15}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* BOTÃO PARA ADICIONAR NOVO CARTÃO */}
        <TouchableOpacity
          style={styles.addCardBtn}
          activeOpacity={0.8}
          onPress={handleOpenAddModal}
        >
          <Ionicons name="add-circle-outline" size={18} color="#7C3AED" />
          <Text style={styles.addCardBtnText}>Adicionar outro cartão</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL ADICIONAR CARTÃO COM PRÉ-VISUALIZAÇÃO AO VIVO E 18 BANCOS SUPORTADOS */}
      {/* ========================================================================= */}
      <Modal visible={modalNewCard} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
                  lastFourDigits={newCardLastFourDigits || '4568'}
                  expiryMonth={newCardExpiry.split('/')[0] || '10'}
                  expiryYear={newCardExpiry.split('/')[1] || '26'}
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
                placeholder="Ex: LUCAS SILVA"
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
                    placeholder="4568"
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
                    placeholder="10/26"
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
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
                  lastFourDigits={editCardLastFourDigits || '4568'}
                  expiryMonth={editCardExpiry.split('/')[0] || '10'}
                  expiryYear={editCardExpiry.split('/')[1] || '26'}
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

              <Text style={styles.inputLabel}>Dia do Vencimento</Text>
              <TextInput
                style={styles.input}
                value={editCardDueDay}
                keyboardType="number-pad"
                onChangeText={setEditCardDueDay}
              />

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
});
