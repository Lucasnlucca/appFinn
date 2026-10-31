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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import {
  getAppwriteConfig,
  saveAppwriteConfig,
  testAppwriteConnection,
} from '../services/appwriteService';
import {
  getGeminiApiKey,
  setGeminiApiKey,
  getGeminiModel,
  setGeminiModel,
} from '../services/geminiService';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    members,
    updateMembersNames,
    clearAllData,
    allTransactions,
    loggedInUser,
    logout,
  } = useFinance();

  const [user1, setUser1] = useState(members.user1);
  const [user2, setUser2] = useState(members.user2);
  const [savedNotice, setSavedNotice] = useState(false);

  // VPS Appwrite
  const [appwriteConfig, setAppwriteConfigState] = useState(null);
  const [testingVps, setTestingVps] = useState(false);
  const [vpsPingStatus, setVpsPingStatus] = useState(null);

  // Google Gemini
  const [geminiKey, setGeminiKeyState] = useState('');
  const [geminiModel, setGeminiModelState] = useState('gemini-3.5-flash');
  const [geminiSavedNotice, setGeminiSavedNotice] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const [cfg, key, model] = await Promise.all([
      getAppwriteConfig(),
      getGeminiApiKey(),
      getGeminiModel(),
    ]);
    setAppwriteConfigState(cfg);
    if (key) setGeminiKeyState(key);
    if (model) setGeminiModelState(model);
  };

  const handleSaveNames = () => {
    updateMembersNames({ user1: user1.trim() || 'Henrique', user2: user2.trim() || 'Esposa' });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleTestVps = async () => {
    setTestingVps(true);
    setVpsPingStatus(null);
    try {
      const res = await testAppwriteConnection();
      setVpsPingStatus(res);
    } catch (e) {
      setVpsPingStatus({ success: false, error: e.message });
    } finally {
      setTestingVps(false);
    }
  };

  const handleSaveGemini = async () => {
    await setGeminiApiKey(geminiKey);
    await setGeminiModel(geminiModel);
    setGeminiSavedNotice(true);
    setTimeout(() => setGeminiSavedNotice(false), 2500);
  };

  const handleReset = () => {
    Alert.alert(
      'Zerar Dados do Aplicativo',
      'Tem certeza que deseja apagar todas as despesas e saldos para começar do zero?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim, Apagar Tudo',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            Alert.alert('Pronto', 'Todos os dados foram resetados com sucesso!');
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Sair da Conta', 'Deseja desconectar a sessão do casal?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Configurações</Text>
          <Text style={styles.headerSubtitle}>Casal, Banco VPS e Inteligência Artificial</Text>
        </View>
        {loggedInUser && (
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={16} color={COLORS.expense} />
            <Text style={styles.logoutBtnText}>Sair</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 90 }]}
      >
        {/* CARD USUÁRIO LOGADO */}
        {loggedInUser && (
          <View style={styles.userBanner}>
            <View style={styles.userAvatar}>
              <Ionicons name="person" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userNameText}>{loggedInUser.name} (Conectado)</Text>
              <Text style={styles.userEmailText}>{loggedInUser.email}</Text>
            </View>
            <View style={styles.statusPill}>
              <View style={styles.statusPillDot} />
              <Text style={styles.statusPillText}>Ativo</Text>
            </View>
          </View>
        )}

        {/* 1. GOOGLE GEMINI AI CONFIG */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="sparkles" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Google Gemini AI (Multimodal)</Text>
              <Text style={styles.cardSubtitle}>Leitura de Prints, Boletos PDF e Voz</Text>
            </View>
          </View>

          <Text style={styles.label}>CHAVE DE API (GEMINI_API_KEY)</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.keyInput}
              value={geminiKey}
              onChangeText={setGeminiKeyState}
              placeholder="Cole sua AI Studio API Key..."
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!showGeminiKey}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowGeminiKey(!showGeminiKey)}>
              <Ionicons
                name={showGeminiKey ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>MODELO DO GEMINI</Text>
          <View style={styles.modelRow}>
            {['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'].map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modelBtn, geminiModel === m && styles.modelBtnActive]}
                onPress={() => setGeminiModelState(m)}
              >
                <Text style={[styles.modelBtnText, geminiModel === m && styles.modelBtnTextActive]}>
                  {m.replace('gemini-', '')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveGemini}>
            <Text style={styles.saveBtnText}>
              {geminiSavedNotice ? '✓ Chave Salva com Sucesso!' : 'Salvar Configuração Gemini'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 2. APPWRITE VPS CLOUD */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Ionicons name="server" size={20} color={COLORS.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Appwrite VPS (Nuvem Privada)</Text>
              <Text style={styles.cardSubtitle}>Sincronização em tempo real do casal</Text>
            </View>
          </View>

          <View style={styles.vpsInfoBox}>
            <Text style={styles.vpsLabel}>ENDPOINT VPS:</Text>
            <Text style={styles.vpsValue} numberOfLines={1}>
              {appwriteConfig?.endpoint || 'https://bancosupa-appwrite.grtbdz.easypanel.host/v1'}
            </Text>

            <Text style={[styles.vpsLabel, { marginTop: 8 }]}>PROJECT ID:</Text>
            <Text style={styles.vpsValue}>{appwriteConfig?.projectId || '6a6cac620021f4c64b3f'}</Text>
          </View>

          {/* STATUS DO PING */}
          {vpsPingStatus && (
            <View
              style={[
                styles.pingResultBox,
                vpsPingStatus.success ? styles.pingSuccess : styles.pingError,
              ]}
            >
              <Ionicons
                name={vpsPingStatus.success ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={vpsPingStatus.success ? COLORS.primary : COLORS.expense}
              />
              <Text
                style={[
                  styles.pingResultText,
                  { color: vpsPingStatus.success ? COLORS.primary : COLORS.expense },
                ]}
              >
                {vpsPingStatus.success
                  ? `VPS Conectada (${vpsPingStatus.latencyMs}ms) • ${vpsPingStatus.version}`
                  : `Falha: ${vpsPingStatus.error}`}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.vpsTestBtn}
            onPress={handleTestVps}
            disabled={testingVps}
          >
            {testingVps ? (
              <ActivityIndicator size="small" color={COLORS.info} />
            ) : (
              <>
                <Ionicons name="wifi-outline" size={16} color={COLORS.info} />
                <Text style={styles.vpsTestBtnText}>Testar Conexão com VPS</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 3. NOMES DO CASAL */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="people" size={20} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Nomes do Casal</Text>
              <Text style={styles.cardSubtitle}>Identificação nas movimentações</Text>
            </View>
          </View>

          <Text style={styles.label}>Você</Text>
          <TextInput
            style={styles.input}
            value={user1}
            onChangeText={setUser1}
            placeholder="Nome (Ex: Henrique)"
            placeholderTextColor={COLORS.textMuted}
          />

          <Text style={styles.label}>Sua Esposa</Text>
          <TextInput
            style={styles.input}
            value={user2}
            onChangeText={setUser2}
            placeholder="Nome (Ex: Esposa)"
            placeholderTextColor={COLORS.textMuted}
          />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveNames}>
            <Text style={styles.saveBtnText}>
              {savedNotice ? '✓ Salvo com sucesso!' : 'Atualizar Nomes'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 4. ZONA DE PERIGO / RESET TOTAL */}
        <View style={[styles.card, { borderColor: 'rgba(244, 63, 94, 0.3)' }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(244, 63, 94, 0.15)' }]}>
              <Ionicons name="trash-bin-outline" size={20} color={COLORS.expense} />
            </View>
            <View>
              <Text style={[styles.cardTitle, { color: COLORS.expense }]}>Zerar Tudo e Começar Limpo</Text>
              <Text style={styles.cardSubtitle}>Apaga todas as despesas e zera saldos</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.dangerBtn} onPress={handleReset}>
            <Ionicons name="trash-outline" size={18} color={COLORS.expense} />
            <Text style={styles.dangerBtnText}>Zerar Todos os Dados</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>
          FINN AI • Desenvolvido para Henrique & Esposa • Expo Go SDK 58
        </Text>
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
  },
  logoutBtnText: {
    color: COLORS.expense,
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  userBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    gap: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userNameText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  userEmailText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  statusPillText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  label: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    marginBottom: 10,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    marginBottom: 10,
  },
  keyInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
  },
  modelRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  modelBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  modelBtnActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  modelBtnText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  modelBtnTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  saveBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  vpsInfoBox: {
    backgroundColor: COLORS.surfaceLight,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  vpsLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  vpsValue: {
    color: COLORS.text,
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
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  pingError: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
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
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  vpsTestBtnText: {
    color: COLORS.info,
    fontWeight: '700',
    fontSize: 13,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: 12,
    paddingVertical: 12,
  },
  dangerBtnText: {
    color: COLORS.expense,
    fontWeight: '700',
    fontSize: 14,
  },
  versionText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 8,
    marginBottom: 16,
  },
});
