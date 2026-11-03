import React, { useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import BankLogo, { ALL_BANKS, getBankInfo } from '../components/BankLogo';

const wavesBannerSource = require('../../assets/card-invoices-waves.png');
const finnLogoSource = require('../../assets/finn-logo.png');

const { width } = Dimensions.get('window');

export default function CardInvoicesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { cards, addCard, removeCard } = useFinance();

  const [selectedBankFilter, setSelectedBankFilter] = useState('Todos');
  const [modalNewCard, setModalNewCard] = useState(false);
  const [modalEvolucao, setModalEvolucao] = useState(false);

  // Formulário para novo cartão
  const [newCardName, setNewCardName] = useState('Nubank');
  const [newCardBank, setNewCardBank] = useState('Nubank');
  const [newCardLimit, setNewCardLimit] = useState('');
  const [newCardInvoice, setNewCardInvoice] = useState('');
  const [newCardDueDay, setNewCardDueDay] = useState('10');

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
  const dynamicBanks = Array.from(
    new Set(cards.map((c) => getBankInfo(c.bank || c.name).shortName))
  );
  const filterPills = ['Todos', ...dynamicBanks];

  // Filtragem dos cartões
  const filteredCards =
    selectedBankFilter === 'Todos'
      ? cards
      : cards.filter((c) => {
          const info = getBankInfo(c.bank || c.name);
          return (
            info.shortName.toLowerCase() === selectedBankFilter.toLowerCase() ||
            info.name.toLowerCase() === selectedBankFilter.toLowerCase() ||
            c.bank?.toLowerCase() === selectedBankFilter.toLowerCase() ||
            c.name?.toLowerCase().includes(selectedBankFilter.toLowerCase())
          );
        });

  // Totais calculados
  const totalOpenInvoices = cards.reduce((sum, c) => sum + (c.currentInvoice || 0), 0);
  const totalCardsCount = cards.length;

  const handleCreateCard = async () => {
    if (!newCardName.trim()) {
      Alert.alert('Atenção', 'Informe o nome do cartão.');
      return;
    }
    const limitNum = parseFloat(newCardLimit.replace(',', '.')) || 0;
    const invNum = parseFloat(newCardInvoice.replace(',', '.')) || 0;
    const dueDayNum = parseInt(newCardDueDay, 10) || 10;
    const used = limitNum > 0 ? Math.min(Math.round((invNum / limitNum) * 100), 100) : 0;

    const bankInfo = getBankInfo(newCardBank);

    await addCard({
      name: newCardName.trim(),
      bank: bankInfo.name,
      limit: limitNum,
      currentInvoice: invNum,
      dueDay: dueDayNum,
      dueDateText: `Vence em ${dueDayNum}/11/2026`,
      status: 'Em aberto',
      usedPercent: used,
      color: bankInfo.color,
      logoType: bankInfo.id,
    });

    setNewCardName('Nubank');
    setNewCardBank('Nubank');
    setNewCardLimit('');
    setNewCardInvoice('');
    setNewCardDueDay('10');
    setModalNewCard(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F2FA" />

      {/* HEADER SUPERIOR */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backBtn}
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

        {/* BOTÃO DE AJUDA / INFORMAÇÕES */}
        <TouchableOpacity
          style={styles.helpBtn}
          activeOpacity={0.7}
          onPress={() =>
            Alert.alert(
              'Faturas dos Cartões',
              'Acompanhe as faturas em aberto e fechadas de todos os seus cartões de crédito em um só lugar com sincronização em tempo real.'
            )
          }
        >
          <Ionicons name="help-circle-outline" size={22} color="#71717A" />
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
                onPress={() => setSelectedBankFilter(filterName)}
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
              {formatMoney(totalOpenInvoices > 0 ? totalOpenInvoices : 1856.90)}
            </Text>
            <Text style={styles.summarySub}>
              {totalCardsCount > 0
                ? `${totalCardsCount} faturas em aberto`
                : '7 faturas em aberto'}
            </Text>
          </View>
        </View>

        {/* ILUSTRAÇÃO DO MASCOTE ROBÔ SOBRE AS ONDAS */}
        <View style={styles.wavesContainer}>
          <Image
            source={wavesBannerSource}
            style={styles.wavesImage}
            resizeMode="contain"
          />
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
            const bankInfo = getBankInfo(card.bank || card.name);
            const limit = card.limit || 5000;
            const invoice = card.currentInvoice || 0;
            const usedPercent =
              card.usedPercent ||
              (limit > 0 ? Math.min(Math.round((invoice / limit) * 100), 100) : 0);

            return (
              <View key={card.id} style={styles.cardItem}>
                <View style={styles.cardItemTopRow}>
                  {/* LOGO OFICIAL DO BANCO */}
                  <BankLogo bank={card.bank || card.name} size={44} />

                  {/* INFORMAÇÕES CENTRAIS */}
                  <View style={styles.cardItemInfo}>
                    <Text style={styles.cardItemName}>{card.name || card.bank}</Text>
                    <Text style={styles.cardItemDueDate}>
                      {card.dueDateText || `Vence em ${card.dueDay || 10}/11/2026`}
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
                          backgroundColor: bankInfo.color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressMetaText}>
                    {usedPercent}% do limite usado · Limite: {formatMoney(limit)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* BOTÃO PARA ADICIONAR NOVO CARTÃO */}
        <TouchableOpacity
          style={styles.addCardBtn}
          activeOpacity={0.8}
          onPress={() => setModalNewCard(true)}
        >
          <Ionicons name="add-circle-outline" size={18} color="#7C3AED" />
          <Text style={styles.addCardBtnText}>Adicionar outro cartão</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL NOVO CARTÃO */}
      <Modal visible={modalNewCard} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adicionar Cartão</Text>
              <TouchableOpacity onPress={() => setModalNewCard(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Nome do Cartão</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Nubank Ultravioleta"
              placeholderTextColor="#9CA3AF"
              value={newCardName}
              onChangeText={setNewCardName}
            />

            <Text style={styles.inputLabel}>Selecione o Banco / Emissor</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bankPickerContainer}
            >
              {ALL_BANKS.map((b) => {
                const isSelected =
                  newCardBank === b.name ||
                  newCardBank === b.id ||
                  newCardBank === b.shortName;
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[
                      styles.bankPickerItem,
                      isSelected && styles.bankPickerItemActive,
                    ]}
                    onPress={() => {
                      setNewCardBank(b.name);
                      if (!newCardName.trim() || ALL_BANKS.some((x) => x.name === newCardName)) {
                        setNewCardName(b.name);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <BankLogo bank={b.id} size={36} />
                    <Text
                      style={[
                        styles.bankPickerName,
                        isSelected && styles.bankPickerNameActive,
                      ]}
                      numberOfLines={1}
                    >
                      {b.shortName}
                    </Text>
                    {isSelected && (
                      <View style={styles.bankSelectedBadge}>
                        <Ionicons name="checkmark-circle" size={16} color="#7C3AED" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
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
              <View style={{ flex: 1 }}>
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
          </View>
        </View>
      </Modal>

      {/* MODAL EVOLUÇÃO DAS FATURAS */}
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
                      style={[styles.evolucaoFill, { height: `${item.percent}%` }]}
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  helpBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#18181B',
    marginTop: 8,
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
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
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
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
  wavesContainer: {
    width: '100%',
    height: 105,
    marginTop: -8,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wavesImage: {
    width: '100%',
    height: '100%',
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
  cardItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bankLogoBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nuLogoText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -1,
  },
  c6LogoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
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
  progressMetaText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
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
    marginTop: 14,
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
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#18181B',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
    minWidth: 78,
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
  bankOptionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bankOptionPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  bankOptionPillActive: {
    backgroundColor: '#7C3AED',
  },
  bankOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  bankOptionTextActive: {
    color: '#FFFFFF',
  },
  modalSaveBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
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

