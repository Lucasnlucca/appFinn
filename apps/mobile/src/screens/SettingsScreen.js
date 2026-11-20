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
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import {
  getAppwriteConfig,
  testAppwriteConnection,
} from '../services/appwriteService';
import {
  testPostgresConnection,
  DEFAULT_API_URL,
  createNotificationApi,
} from '../services/apiService';
import { LEGAL_URLS, openLegalUrl } from '../constants/legal';
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

  // VPS Appwrite
  const [appwriteConfig, setAppwriteConfigState] = useState(null);
  const [testingVps, setTestingVps] = useState(false);
  const [vpsPingStatus, setVpsPingStatus] = useState(null);

  // Google Gemini
  const [geminiKey, setGeminiKeyState] = useState('');
  const [geminiModel, setGeminiModelState] = useState('gemini-3.5-flash');
  const [geminiSavedNotice, setGeminiSavedNotice] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  // Modal de Reportar Bug (Prints + Texto)
  const [bugModalVisible, setBugModalVisible] = useState(false);
  const [bugDescription, setBugDescription] = useState('');
  const [bugScreenshots, setBugScreenshots] = useState([]);
  const [submittingBug, setSubmittingBug] = useState(false);

  const handlePickBugScreenshots = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permissão necessária',
          'Permita o acesso às suas fotos para anexar prints do bug.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 5,
        quality: 0.65,
        base64: true,
      });

      if (!result.canceled && Array.isArray(result.assets) && result.assets.length > 0) {
        const mapped = result.assets.map((asset, idx) => ({
          id: `print-${Date.now()}-${idx}`,
          uri: asset.uri,
          base64: asset.base64 || null,
          mimeType: asset.mimeType || 'image/jpeg',
          fileName: asset.fileName || `print-${idx + 1}.jpg`,
        }));
        setBugScreenshots((prev) => [...prev, ...mapped].slice(0, 5));
      }
    } catch (e) {
      Alert.alert('Erro ao selecionar print', e.message || 'Tente novamente.');
    }
  };

  const handleRemoveBugScreenshot = (id) => {
    setBugScreenshots((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmitBugReport = async () => {
    const cleanText = (bugDescription || '').trim();
    if (!cleanText && bugScreenshots.length === 0) {
      Alert.alert(
        'Atenção',
        'Escreva uma breve descrição do bug ou anexe pelo menos um print para enviar o relato.'
      );
      return;
    }

    setSubmittingBug(true);
    try {
      const protocol = `BUG-${Math.floor(100000 + Math.random() * 900000)}`;
      const reportPayload = {
        id: protocol,
        userId: loggedInUser?.id || 'guest',
        userName: loggedInUser?.fullName || loggedInUser?.name || 'Usuário',
        userEmail: loggedInUser?.email || '',
        description: cleanText,
        screenshotsCount: bugScreenshots.length,
        screenshots: bugScreenshots.map((s) => ({
          fileName: s.fileName,
          mimeType: s.mimeType,
          uri: s.uri,
          dataUrl: s.base64 ? `data:${s.mimeType};base64,${s.base64.slice(0, 120000)}` : null,
        })),
        platform: Platform.OS,
        createdAt: new Date().toISOString(),
      };

      // Salva localmente no registro de bugs reportados
      try {
        const rawSaved = await AsyncStorage.getItem('@finn_bug_reports_v1');
        const list = rawSaved ? JSON.parse(rawSaved) : [];
        const updated = [reportPayload, ...(Array.isArray(list) ? list : [])].slice(0, 30);
        await AsyncStorage.setItem('@finn_bug_reports_v1', JSON.stringify(updated));
      } catch {}

      // Registra no banco PostgreSQL via API para a equipe técnica
      try {
        await createNotificationApi({
          id: `bug-report-${Date.now()}`,
          title: `🐞 Bug Reportado (${protocol})`,
          body: cleanText || `Relato enviado com ${bugScreenshots.length} print(s).`,
          type: 'BUG_REPORT',
          category: 'sistema',
          priority: 'high',
          dedupeKey: `bug_report_${protocol}`,
          read: true,
          sendPush: false,
          meta: {
            kind: 'bug_report',
            protocol,
            userEmail: reportPayload.userEmail,
            userName: reportPayload.userName,
            screenshotsCount: bugScreenshots.length,
            screenshots: reportPayload.screenshots,
          },
        });
      } catch {}

      setBugDescription('');
      setBugScreenshots([]);
      setBugModalVisible(false);

      Alert.alert(
        'Bug Reportado com Sucesso! ✅',
        `Protocolo: #${protocol}\n\nRecebemos sua mensagem${
          reportPayload.screenshotsCount > 0
            ? ` e ${reportPayload.screenshotsCount} print(s) anexado(s)`
            : ''
        }. Obrigado por ajudar a melhorar o FINN!`
      );
    } catch (e) {
      Alert.alert('Erro ao enviar', e.message || 'Tente novamente.');
    } finally {
      setSubmittingBug(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [cfg, key, model] = await Promise.all([
        getAppwriteConfig(),
        getGeminiApiKey(),
        getGeminiModel(),
      ]);
      setAppwriteConfigState(cfg);
      if (key) setGeminiKeyState(key);
      if (model) setGeminiModelState(model);
    } catch (e) {
      console.warn('Erro ao carregar configurações:', e);
    }
  };

  const toggleSection = (sectionId) => {
    setOpenSection((prev) => (prev === sectionId ? null : sectionId));
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
          {/* 1. MEU PERFIL (PÁGINA ISOLADA CONFORME SOLICITADO) */}
          {/* ================================================================= */}
          <TouchableOpacity
            style={styles.profileNavCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={styles.profileNavAvatarWrapper}>
              {loggedInUser?.avatarUri ? (
                <Image
                  source={{ uri: loggedInUser.avatarUri }}
                  style={styles.profileNavAvatarImg}
                />
              ) : (
                <View style={styles.profileNavAvatarPlaceholder}>
                  <Ionicons name="person" size={24} color="#7C3AED" />
                </View>
              )}
            </View>

            <View style={styles.profileNavInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.profileNavName} numberOfLines={1}>
                  {loggedInUser?.fullName || loggedInUser?.name || 'Meu Perfil'}
                </Text>
                <View style={styles.profileActiveDot} />
              </View>
              <Text style={styles.profileNavEmail} numberOfLines={1}>
                {loggedInUser?.email || 'Ver e editar dados pessoais'}
              </Text>
            </View>

            <View style={styles.profileNavActionPill}>
              <Text style={styles.profileNavActionText}>Editar</Text>
              <Ionicons name="chevron-forward" size={15} color="#7C3AED" />
            </View>
          </TouchableOpacity>

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

                {/* SUBMENU 4: PREFERÊNCIAS DE NOTIFICAÇÃO */}
                <TouchableOpacity
                  style={styles.submenuItem}
                  activeOpacity={0.75}
                  onPress={() => navigation?.navigate?.('NotificationPreferences')}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir preferências de notificação"
                >
                  <View
                    style={[
                      styles.submenuIconBox,
                      { backgroundColor: '#EDE9FE' },
                    ]}
                  >
                    <Ionicons name="notifications-outline" size={18} color="#5B21B6" />
                  </View>
                  <View style={styles.submenuInfo}>
                    <Text style={styles.submenuTitle}>Preferências de Notificação</Text>
                    <Text style={styles.submenuSub}>
                      Categorias, horário de silêncio e privacidade
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

                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 12,
                      paddingTop: 10,
                      borderTopWidth: 1,
                      borderTopColor: '#E5E7EB',
                    }}
                    onPress={() => openLegalUrl(LEGAL_URLS.PRIVACY_POLICY)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 12, color: '#7C3AED', fontWeight: '700' }}>
                      Política de Privacidade (HTTPS) ↗
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 10,
                      paddingTop: 10,
                      borderTopWidth: 1,
                      borderTopColor: '#E5E7EB',
                    }}
                    onPress={() => openLegalUrl(LEGAL_URLS.TERMS_OF_USE)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 12, color: '#7C3AED', fontWeight: '700' }}>
                      Termos de Uso (HTTPS) ↗
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 10,
                      paddingTop: 10,
                      borderTopWidth: 1,
                      borderTopColor: '#E5E7EB',
                    }}
                    onPress={() => navigation.navigate('Profile')}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 12, color: '#DC2626', fontWeight: '700' }}>
                      Perfil e Excluir minha conta e dados →
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* ================================================================= */}
          {/* 5. BOTÃO: ACHOU ALGUM BUG? REPORTE AQUI (PRINTS + TEXTO)          */}
          {/* ================================================================= */}
          <TouchableOpacity
            style={styles.bugReportButtonCard}
            activeOpacity={0.82}
            onPress={() => setBugModalVisible(true)}
          >
            <View style={styles.bugReportIconBox}>
              <Ionicons name="bug-outline" size={22} color="#7C3AED" />
            </View>
            <View style={styles.bugReportInfo}>
              <Text style={styles.bugReportTitle}>
                Achou algum bug? Reporte aqui
              </Text>
              <Text style={styles.bugReportSubtitle}>
                Envie prints da tela e descreva o problema encontrado
              </Text>
            </View>
            <View style={styles.bugReportArrowPill}>
              <Ionicons name="camera-outline" size={15} color="#7C3AED" />
              <Ionicons name="chevron-forward" size={15} color="#7C3AED" />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ================================================================= */}
      {/* MODAL DE REPORTAR BUG (TEXTO + PRINTS)                            */}
      {/* ================================================================= */}
      <Modal
        visible={bugModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBugModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.bugModalOverlay}
        >
          <View style={styles.bugModalCard}>
            <View style={styles.bugModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.bugModalHeaderIcon}>
                  <Ionicons name="bug" size={20} color="#7C3AED" />
                </View>
                <View>
                  <Text style={styles.bugModalTitle}>Reportar um Bug</Text>
                  <Text style={styles.bugModalSubtitle}>
                    Descreva o problema e anexe prints da tela
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setBugModalVisible(false)}
                style={styles.bugModalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#71717A" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <Text style={styles.bugInputLabel}>O QUE ACONTECEU?</Text>
              <TextInput
                style={styles.bugTextInput}
                placeholder="Conte o que aconteceu, em qual tela você estava e o que esperava que acontecesse..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={bugDescription}
                onChangeText={setBugDescription}
              />

              <View style={styles.bugPrintsHeaderRow}>
                <Text style={styles.bugInputLabel}>
                  PRINTS DA TELA ({bugScreenshots.length}/5)
                </Text>
                <TouchableOpacity
                  onPress={handlePickBugScreenshots}
                  activeOpacity={0.75}
                  style={styles.bugAddPrintMiniBtn}
                >
                  <Ionicons name="image-outline" size={14} color="#7C3AED" />
                  <Text style={styles.bugAddPrintMiniText}>+ Adicionar print</Text>
                </TouchableOpacity>
              </View>

              {bugScreenshots.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.bugThumbsRow}
                >
                  {bugScreenshots.map((shot) => (
                    <View key={shot.id} style={styles.bugThumbWrapper}>
                      <Image source={{ uri: shot.uri }} style={styles.bugThumbImg} />
                      <TouchableOpacity
                        style={styles.bugThumbRemoveBtn}
                        onPress={() => handleRemoveBugScreenshot(shot.id)}
                      >
                        <Ionicons name="close" size={13} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {bugScreenshots.length < 5 && (
                    <TouchableOpacity
                      style={styles.bugThumbAddMore}
                      onPress={handlePickBugScreenshots}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="add" size={24} color="#7C3AED" />
                      <Text style={styles.bugThumbAddMoreText}>Mais</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              ) : (
                <TouchableOpacity
                  style={styles.bugEmptyPrintDropzone}
                  onPress={handlePickBugScreenshots}
                  activeOpacity={0.8}
                >
                  <View style={styles.bugEmptyPrintIconCircle}>
                    <Ionicons name="images-outline" size={22} color="#7C3AED" />
                  </View>
                  <Text style={styles.bugEmptyPrintTitle}>
                    Toque para anexar prints da tela
                  </Text>
                  <Text style={styles.bugEmptyPrintSub}>
                    Você pode selecionar até 5 imagens da sua galeria
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            <View style={styles.bugModalFooter}>
              <TouchableOpacity
                style={styles.bugCancelBtn}
                onPress={() => setBugModalVisible(false)}
                disabled={submittingBug}
              >
                <Text style={styles.bugCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.bugSubmitBtn, submittingBug && { opacity: 0.7 }]}
                onPress={handleSubmitBugReport}
                disabled={submittingBug}
                activeOpacity={0.85}
              >
                {submittingBug ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="send" size={15} color="#FFFFFF" />
                    <Text style={styles.bugSubmitBtnText}>Enviar Relato</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  profileNavCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  profileNavAvatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  profileNavAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  profileNavAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileNavInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  profileNavName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  profileActiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  profileNavEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  profileNavActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  profileNavActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  bugReportButtonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 14,
  },
  bugReportIconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bugReportInfo: {
    flex: 1,
  },
  bugReportTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#18181B',
    marginBottom: 2,
  },
  bugReportSubtitle: {
    fontSize: 12,
    color: '#71717A',
    fontWeight: '500',
    lineHeight: 16,
  },
  bugReportArrowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  bugModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  bugModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: '#EFEAF8',
  },
  bugModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  bugModalHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bugModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#18181B',
  },
  bugModalSubtitle: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 1,
  },
  bugModalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bugInputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6D28D9',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  bugTextInput: {
    backgroundColor: '#FAF8FF',
    borderWidth: 1,
    borderColor: '#E9E5F5',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#18181B',
    minHeight: 110,
    marginBottom: 18,
  },
  bugPrintsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bugAddPrintMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
  },
  bugAddPrintMiniText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  bugThumbsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  bugThumbWrapper: {
    width: 88,
    height: 88,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    position: 'relative',
  },
  bugThumbImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bugThumbRemoveBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(220, 38, 38, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bugThumbAddMore: {
    width: 88,
    height: 88,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C4B5FD',
    backgroundColor: '#FAF8FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  bugThumbAddMoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  bugEmptyPrintDropzone: {
    backgroundColor: '#FAF8FF',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C4B5FD',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bugEmptyPrintIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  bugEmptyPrintTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#5B21B6',
  },
  bugEmptyPrintSub: {
    fontSize: 11.5,
    color: '#71717A',
    marginTop: 2,
  },
  bugModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  bugCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
  },
  bugCancelBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#71717A',
  },
  bugSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  bugSubmitBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
