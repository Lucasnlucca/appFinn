import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import {
  getAppwriteConfig,
  testAppwriteConnection,
} from '../services/appwriteService';
import {
  testPostgresConnection,
  DEFAULT_API_URL,
} from '../services/apiService';
import {
  checkBiometricSupport,
  isBiometricLoginEnabled,
  setBiometricLoginEnabled,
} from '../services/biometricService';
import {
  getGeminiApiKey,
  setGeminiApiKey,
  getGeminiModel,
  setGeminiModel,
} from '../services/geminiService';

const finnLogoSource = require('../../assets/finn-logo.png');
const finnAvatarSource = require('../../assets/finn-ai-avatar.png');

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    members,
    updateMembersNames,
    updateUserProfile,
    clearAllData,
    loadDemoData,
    loggedInUser,
    logout,
    activeMember,
    switchActiveMember,
    postgresStatus,
    isSyncingPostgres,
    syncWithPostgres,
  } = useFinance();

  // Estado dos accordions: inicialmente TODOS FECHADOS (null)
  const [openSection, setOpenSection] = useState(null);

  // Estados dos formulários internos
  const [displayName, setDisplayName] = useState(
    loggedInUser?.fullName || loggedInUser?.name || members?.user1 || ''
  );
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (loggedInUser?.fullName || loggedInUser?.name) {
      setDisplayName(loggedInUser?.fullName || loggedInUser?.name);
    }
  }, [loggedInUser?.fullName, loggedInUser?.name]);

  // VPS Appwrite
  const [appwriteConfig, setAppwriteConfigState] = useState(null);
  const [testingVps, setTestingVps] = useState(false);
  const [vpsPingStatus, setVpsPingStatus] = useState(null);

  // Biometria
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [biometricType, setBiometricType] = useState('Digital');
  const [biometricActive, setBiometricActive] = useState(false);

  // Google Gemini
  const [geminiKey, setGeminiKeyState] = useState('');
  const [geminiModel, setGeminiModelState] = useState('gemini-3.5-flash');
  const [geminiSavedNotice, setGeminiSavedNotice] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [cfg, key, model, bioSupport, isBioOn] = await Promise.all([
        getAppwriteConfig(),
        getGeminiApiKey(),
        getGeminiModel(),
        checkBiometricSupport(),
        isBiometricLoginEnabled(),
      ]);
      setAppwriteConfigState(cfg);
      if (key) setGeminiKeyState(key);
      if (model) setGeminiModelState(model);
      setBiometricsSupported(bioSupport.available);
      setBiometricType(bioSupport.biometricType || 'Digital');
      setBiometricActive(isBioOn);
    } catch (e) {
      console.warn('Erro ao carregar configurações:', e);
    }
  };

  const handleToggleBiometric = async () => {
    const nextVal = !biometricActive;
    await setBiometricLoginEnabled(nextVal, loggedInUser);
    setBiometricActive(nextVal);
    Alert.alert(
      `Login com ${biometricType}`,
      nextVal
        ? `O acesso com ${biometricType.toLowerCase()} está ativo para os próximos logins!`
        : `O acesso com ${biometricType.toLowerCase()} foi desativado.`
    );
  };

  const toggleSection = (sectionId) => {
    setOpenSection((prev) => (prev === sectionId ? null : sectionId));
  };

  const handleSaveProfile = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      Alert.alert('Nome inválido', 'Por favor, informe seu nome de exibição.');
      return;
    }
    if (updateUserProfile) {
      await updateUserProfile({
        fullName: trimmed,
        name: trimmed,
      });
    }
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleTestPostgres = async () => {
    setTestingVps(true);
    setVpsPingStatus(null);
    try {
      const res = await testPostgresConnection();
      setVpsPingStatus(res);
    } catch (e) {
      setVpsPingStatus({ success: false, error: e.message });
    } finally {
      setTestingVps(false);
    }
  };

  const handleManualSync = async () => {
    try {
      const res = await syncWithPostgres();
      if (res?.success) {
        Alert.alert(
          'Sincronização Concluída',
          `Dados sincronizados com sucesso no PostgreSQL 17!\n• Latência: ${res.latencyMs || 0}ms\n• Cartões e Contas atualizados.`
        );
      } else {
        Alert.alert('Aviso de Sincronização', res?.reason || 'Não foi possível contatar o servidor.');
      }
    } catch (e) {
      Alert.alert('Erro ao sincronizar', e.message);
    }
  };

  const handleTestVps = handleTestPostgres;

  const handleSaveGemini = async () => {
    await setGeminiApiKey(geminiKey);
    await setGeminiModel(geminiModel);
    setGeminiSavedNotice(true);
    setTimeout(() => setGeminiSavedNotice(false), 2500);
  };

  const handleReset = () => {
    Alert.alert(
      'Limpar Todas as Informações de Teste',
      'Deseja apagar todas as despesas e saldos de exemplo para começar a usar seus dados 100% reais?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim, Limpar Tudo',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            Alert.alert(
              'Pronto!',
              'O app agora está 100% limpo para você cadastrar suas informações reais.'
            );
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Sair da Conta', 'Deseja desconectar sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F5FC" />

      {/* CABEÇALHO SUPERIOR COM LOGO FINN CENTRALIZADA */}
      <View style={styles.topBar}>
        <View style={styles.topLogoRow}>
          <Image
            source={finnLogoSource}
            style={styles.topLogoIcon}
            resizeMode="contain"
          />
          <Text style={styles.topLogoText}>FINN</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 105 },
        ]}
      >
        {/* TÍTULO DA PÁGINA "MAIS" E BOTÃO SAIR */}
        <View style={styles.pageHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Mais</Text>
            <Text style={styles.pageSubtitle}>
              Configurações, integrações e preferências do FINN
            </Text>
          </View>

          {loggedInUser && (
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              activeOpacity={0.75}
            >
              <Ionicons name="log-out-outline" size={17} color="#F43F5E" />
              <Text style={styles.logoutBtnText}>Sair</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* LISTA DE ACCORDIONS (TODOS FECHADOS POR PADRÃO) */}
        <View style={styles.accordionList}>
          {/* ================================================================= */}
          {/* 1. PERFIL E CONTA */}
          {/* ================================================================= */}
          <View style={styles.accordionCard}>
            <TouchableOpacity
              style={[
                styles.accordionHeader,
                openSection === 'perfil' && styles.accordionHeaderOpen,
              ]}
              activeOpacity={0.8}
              onPress={() => toggleSection('perfil')}
            >
              <View style={[styles.accordionIconBox, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="person" size={20} color="#7C3AED" />
              </View>
              <View style={styles.accordionHeaderInfo}>
                <Text style={styles.accordionTitle}>Meu Perfil e Conta</Text>
                <Text style={styles.accordionSubtitle}>
                  Nome de exibição, biometria e dados de acesso
                </Text>
              </View>
              <Ionicons
                name={openSection === 'perfil' ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={openSection === 'perfil' ? '#7C3AED' : '#71717A'}
              />
            </TouchableOpacity>

            {openSection === 'perfil' && (
              <View style={styles.accordionBody}>
                {/* Banner do Usuário */}
                {loggedInUser && (
                  <View style={styles.userBanner}>
                    <View style={styles.userAvatar}>
                      <Ionicons name="person" size={20} color="#7C3AED" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userNameText}>
                        {loggedInUser.name || loggedInUser.fullName || 'Usuário'} (Conectado)
                      </Text>
                      <Text style={styles.userEmailText}>{loggedInUser.email}</Text>
                    </View>
                    <View style={styles.statusPill}>
                      <View style={styles.statusPillDot} />
                      <Text style={styles.statusPillText}>Ativo</Text>
                    </View>
                  </View>
                )}

                {/* Configuração de Biometria / Digital */}
                <View style={styles.biometricSettingBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View style={styles.biometricIconCircle}>
                      <Ionicons name="finger-print-outline" size={20} color="#7C3AED" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.biometricSettingTitle}>Acesso com {biometricType}</Text>
                      <Text style={styles.biometricSettingSubtitle}>
                        {biometricActive
                          ? `Ativado para entrar no FINN com sua ${biometricType.toLowerCase()}`
                          : `Desativado • Ative para entrar com sua ${biometricType.toLowerCase()}`}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.biometricToggleBtn,
                      biometricActive && styles.biometricToggleBtnActive,
                    ]}
                    onPress={handleToggleBiometric}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.biometricToggleBtnText,
                        biometricActive && styles.biometricToggleBtnTextActive,
                      ]}
                    >
                      {biometricActive ? 'Ativo' : 'Ativar'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Edição do Nome de Exibição */}
                <Text style={styles.inputLabel}>SEU NOME DE EXIBIÇÃO NO APP</Text>
                <TextInput
                  style={styles.input}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Seu nome (ex: Lucas)"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                />
                <Text style={styles.inputHelpText}>
                  Esse nome é exibido no topo da tela inicial ("Olá, {displayName.trim() ? displayName.trim().split(' ')[0] : 'Usuário'} 👋") e usado pelo FINN AI ao conversar com você.
                </Text>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleSaveProfile}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryBtnText}>
                    {savedNotice ? '✓ Nome atualizado com sucesso!' : 'Salvar Alterações'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ================================================================= */}
          {/* 2. MÓDULOS FINANCEIROS */}
          {/* ================================================================= */}
          <View style={styles.accordionCard}>
            <TouchableOpacity
              style={[
                styles.accordionHeader,
                openSection === 'modulos' && styles.accordionHeaderOpen,
              ]}
              activeOpacity={0.8}
              onPress={() => toggleSection('modulos')}
            >
              <View style={[styles.accordionIconBox, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="layers" size={20} color="#7C3AED" />
              </View>
              <View style={styles.accordionHeaderInfo}>
                <Text style={styles.accordionTitle}>Módulos Financeiros</Text>
                <Text style={styles.accordionSubtitle}>
                  Cartões, agenda do mês e contas bancárias
                </Text>
              </View>
              <Ionicons
                name={openSection === 'modulos' ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={openSection === 'modulos' ? '#7C3AED' : '#71717A'}
              />
            </TouchableOpacity>

            {openSection === 'modulos' && (
              <View style={styles.accordionBody}>
                {/* SUBMENU 1: FATURAS DOS CARTÕES */}
                <TouchableOpacity
                  style={styles.submenuItem}
                  activeOpacity={0.75}
                  onPress={() => navigation?.navigate?.('CardInvoices')}
                >
                  <View
                    style={[
                      styles.submenuIconBox,
                      { backgroundColor: '#EDE9FE' },
                    ]}
                  >
                    <Ionicons name="card-outline" size={18} color="#7C3AED" />
                  </View>
                  <View style={styles.submenuInfo}>
                    <Text style={styles.submenuTitle}>Faturas dos Cartões</Text>
                    <Text style={styles.submenuSub}>
                      A pagar e em aberto de Nubank, C6 e outros
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                {/* SUBMENU 2: AGENDA DO MÊS */}
                <TouchableOpacity
                  style={styles.submenuItem}
                  activeOpacity={0.75}
                  onPress={() => navigation?.navigate?.('MonthlyAgenda')}
                >
                  <View
                    style={[
                      styles.submenuIconBox,
                      { backgroundColor: '#DCFCE7' },
                    ]}
                  >
                    <Ionicons name="calendar-outline" size={18} color="#16A34A" />
                  </View>
                  <View style={styles.submenuInfo}>
                    <Text style={styles.submenuTitle}>Agenda do Mês</Text>
                    <Text style={styles.submenuSub}>
                      Mascote Feliz/Triste com contas pagas e a pagar
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                {/* SUBMENU 3: CONTAS & OPEN FINANCE */}
                <TouchableOpacity
                  style={styles.submenuItem}
                  activeOpacity={0.75}
                  onPress={() => navigation?.navigate?.('CardsAccounts')}
                >
                  <View
                    style={[
                      styles.submenuIconBox,
                      { backgroundColor: '#E0F2FE' },
                    ]}
                  >
                    <Ionicons name="business-outline" size={18} color="#0284C7" />
                  </View>
                  <View style={styles.submenuInfo}>
                    <Text style={styles.submenuTitle}>Contas & Open Finance</Text>
                    <Text style={styles.submenuSub}>
                      Ajuste manual de saldo e conexões bancárias
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ================================================================= */}
          {/* 3. FINANÇAS COMPARTILHADAS (CASAL / FAMÍLIA) */}
          {/* ================================================================= */}
          <View style={styles.accordionCard}>
            <TouchableOpacity
              style={[
                styles.accordionHeader,
                openSection === 'compartilhado' && styles.accordionHeaderOpen,
              ]}
              activeOpacity={0.8}
              onPress={() => toggleSection('compartilhado')}
            >
              <View style={[styles.accordionIconBox, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="people-sharp" size={20} color="#7C3AED" />
              </View>
              <View style={styles.accordionHeaderInfo}>
                <Text style={styles.accordionTitle}>Finanças Compartilhadas</Text>
                <Text style={styles.accordionSubtitle}>
                  Divisão de contas, acerto e grupos para casais
                </Text>
              </View>
              <Ionicons
                name={openSection === 'compartilhado' ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={openSection === 'compartilhado' ? '#7C3AED' : '#71717A'}
              />
            </TouchableOpacity>

            {openSection === 'compartilhado' && (
              <View style={styles.accordionBody}>
                {/* SUBMENU 1: PAINEL & RESUMO CONJUNTO */}
                <TouchableOpacity
                  style={styles.submenuItem}
                  activeOpacity={0.75}
                  onPress={() => navigation?.navigate?.('SharedFinances')}
                >
                  <View style={[styles.submenuIconBox, { backgroundColor: '#EDE9FE' }]}>
                    <Ionicons name="pie-chart-outline" size={18} color="#7C3AED" />
                  </View>
                  <View style={styles.submenuInfo}>
                    <Text style={styles.submenuTitle}>Painel Conjunto</Text>
                    <Text style={styles.submenuSub}>
                      Despesas compartilhadas e gráfico do casal
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                {/* SUBMENU 2: ACERTO DE CONTAS */}
                <TouchableOpacity
                  style={styles.submenuItem}
                  activeOpacity={0.75}
                  onPress={() => navigation?.navigate?.('SharedFinances')}
                >
                  <View style={[styles.submenuIconBox, { backgroundColor: '#DCFCE7' }]}>
                    <Ionicons name="swap-horizontal-outline" size={18} color="#16A34A" />
                  </View>
                  <View style={styles.submenuInfo}>
                    <Text style={styles.submenuTitle}>Acerto de Contas</Text>
                    <Text style={styles.submenuSub}>
                      Veja quem deve para quem e quite o saldo
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                {/* SUBMENU 3: GERENCIAR PARTICIPANTES & CONVITES */}
                <TouchableOpacity
                  style={styles.submenuItem}
                  activeOpacity={0.75}
                  onPress={() => navigation?.navigate?.('SharedFinances')}
                >
                  <View style={[styles.submenuIconBox, { backgroundColor: '#E0F2FE' }]}>
                    <Ionicons name="person-add-outline" size={18} color="#0284C7" />
                  </View>
                  <View style={styles.submenuInfo}>
                    <Text style={styles.submenuTitle}>Convidar & Participantes</Text>
                    <Text style={styles.submenuSub}>
                      Convidar parceiro(a) por e-mail ou código
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ================================================================= */}
          {/* 4. SOBRE O FINN */}
          {/* ================================================================= */}
          <View style={styles.accordionCard}>
            <TouchableOpacity
              style={[
                styles.accordionHeader,
                openSection === 'sobre' && styles.accordionHeaderOpen,
              ]}
              activeOpacity={0.8}
              onPress={() => toggleSection('sobre')}
            >
              <View style={[styles.accordionIconBox, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color="#7C3AED"
                />
              </View>
              <View style={styles.accordionHeaderInfo}>
                <Text style={styles.accordionTitle}>Sobre o FINN</Text>
                <Text style={styles.accordionSubtitle}>
                  Versão, informações e créditos
                </Text>
              </View>
              <Ionicons
                name={openSection === 'sobre' ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={openSection === 'sobre' ? '#7C3AED' : '#71717A'}
              />
            </TouchableOpacity>

            {openSection === 'sobre' && (
              <View style={styles.accordionBody}>
                <View style={styles.aboutBox}>
                  <Text style={styles.aboutTitle}>
                    FINN AI • Gestor Financeiro Inteligente
                  </Text>
                  <Text style={styles.aboutText}>
                    Desenvolvido com tecnologia de ponta para acompanhamento e
                    sincronização de finanças do casal.
                  </Text>
                  <View style={styles.aboutTagRow}>
                    <View style={styles.aboutTag}>
                      <Text style={styles.aboutTagText}>Expo SDK 58</Text>
                    </View>
                    <View style={styles.aboutTag}>
                      <Text style={styles.aboutTagText}>PostgreSQL 17 VPS</Text>
                    </View>
                    <View style={styles.aboutTag}>
                      <Text style={styles.aboutTagText}>NestJS REST API</Text>
                    </View>
                    <View style={styles.aboutTag}>
                      <Text style={styles.aboutTagText}>Gemini AI 3.5</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F5FC',
  },
  topBar: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  topLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  topLogoIcon: {
    width: 26,
    height: 26,
  },
  topLogoText: {
    fontFamily: 'Audiowide',
    fontSize: 20,
    color: '#18181B',
    letterSpacing: 1.2,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  pageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#18181B',
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 3,
    lineHeight: 18,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 2,
  },
  logoutBtnText: {
    color: '#F43F5E',
    fontSize: 13,
    fontWeight: '700',
  },
  accordionList: {
    gap: 12,
  },
  accordionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    overflow: 'hidden',
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    gap: 14,
  },
  accordionHeaderOpen: {
    backgroundColor: '#EDE7FA',
  },
  accordionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionHeaderInfo: {
    flex: 1,
  },
  accordionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#18181B',
    marginBottom: 2,
  },
  accordionSubtitle: {
    fontSize: 12,
    color: '#71717A',
    fontWeight: '500',
    lineHeight: 16,
  },
  accordionBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#EFEAF8',
    backgroundColor: '#FFFFFF',
  },
  submenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    marginBottom: 8,
    gap: 12,
  },
  submenuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submenuInfo: {
    flex: 1,
  },
  submenuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#18181B',
  },
  submenuSub: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 2,
  },
  userBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
    marginBottom: 14,
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userNameText: {
    color: '#18181B',
    fontSize: 14,
    fontWeight: '700',
  },
  userEmailText: {
    color: '#71717A',
    fontSize: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  statusPillText: {
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '700',
  },
  inputLabel: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 8,
  },
  inputHelpText: {
    color: '#6B7280',
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 12,
    marginTop: -2,
  },
  memberPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  memberPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  memberPillActive: {
    backgroundColor: '#7C3AED',
  },
  memberPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  memberPillTextActive: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#18181B',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  keyInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  keyInput: {
    flex: 1,
    color: '#18181B',
    fontSize: 14,
  },
  modelRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  modelBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modelBtnActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  modelBtnText: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '600',
  },
  modelBtnTextActive: {
    color: '#7C3AED',
    fontWeight: '800',
  },
  primaryBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  vpsInfoBox: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  vpsLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  vpsValue: {
    color: '#18181B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  pingResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
  },
  pingSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  pingError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  pingResultText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  vpsTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E0F2FE',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  vpsTestBtnText: {
    color: '#0284C7',
    fontWeight: '700',
    fontSize: 13,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  dangerBtnText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 14,
  },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 12,
    paddingVertical: 12,
  },
  demoBtnText: {
    color: '#7C3AED',
    fontWeight: '700',
    fontSize: 14,
  },
  aboutBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  aboutTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#18181B',
    marginBottom: 4,
  },
  aboutText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 10,
  },
  aboutTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  aboutTag: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aboutTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  biometricSettingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F7FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  biometricIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricSettingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#18181B',
  },
  biometricSettingSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  biometricToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  biometricToggleBtnActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  biometricToggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  biometricToggleBtnTextActive: {
    color: '#FFFFFF',
  },
});
