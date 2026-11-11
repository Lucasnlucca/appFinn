import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useFinance } from '../context/FinanceContext';
import { updatePasswordApi } from '../services/apiService';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { loggedInUser, updateUserProfile, logout, deleteAccount } = useFinance();

  // Estados de Nome e Sobrenome
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUri, setAvatarUri] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  // Estados de Redefinição de Senha
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  // Estados de Conformidade Google Play (Privacidade e Exclusão)
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Inicializa os dados com base no usuário logado
  useEffect(() => {
    if (loggedInUser) {
      const full = loggedInUser.fullName || loggedInUser.name || '';
      const parts = full.trim().split(/\s+/).filter(Boolean);
      setFirstName(loggedInUser.firstName !== undefined ? loggedInUser.firstName : parts[0] || '');
      setLastName(
        loggedInUser.lastName !== undefined
          ? loggedInUser.lastName
          : parts.length > 1
            ? parts.slice(1).join(' ')
            : ''
      );
      setAvatarUri(loggedInUser.avatarUri || loggedInUser.avatarUrl || null);
    }
  }, [
    loggedInUser?.id,
    loggedInUser?.fullName,
    loggedInUser?.firstName,
    loggedInUser?.lastName,
    loggedInUser?.avatarUri,
    loggedInUser?.avatarUrl,
  ]);

  // Escolher Imagem de Perfil (Galeria ou Câmera) com persistência Base64 no banco
  const handlePickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão necessária',
          'Precisamos de permissão para acessar suas fotos para definir sua imagem de perfil.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        // Redimensiona para foto de perfil de 280x280 e comprime para evitar estourar o limite de armazenamento local
        const manipulated = await manipulateAsync(
          asset.uri,
          [{ resize: { width: 280, height: 280 } }],
          { compress: 0.65, format: SaveFormat.JPEG, base64: true }
        );

        const persistentAvatarUri = manipulated.base64
          ? `data:image/jpeg;base64,${manipulated.base64}`
          : manipulated.uri;

        setAvatarUri(persistentAvatarUri);
        if (updateUserProfile) {
          const trimmedFirst = firstName.trim();
          const trimmedLast = lastName.trim();
          const fullName = [trimmedFirst, trimmedLast].filter(Boolean).join(' ');
          await updateUserProfile({
            avatarUri: persistentAvatarUri,
            ...(trimmedFirst
              ? {
                  firstName: trimmedFirst,
                  lastName: trimmedLast,
                  fullName,
                  name: fullName,
                }
              : {}),
          });
        }
      }
    } catch (err) {
      Alert.alert('Erro ao carregar imagem', err.message);
    }
  };

  // Remover Imagem de Perfil
  const handleRemoveAvatar = async () => {
    setAvatarUri(null);
    if (updateUserProfile) {
      const trimmedFirst = firstName.trim();
      const trimmedLast = lastName.trim();
      const fullName = [trimmedFirst, trimmedLast].filter(Boolean).join(' ');
      await updateUserProfile({
        avatarUri: null,
        ...(trimmedFirst
          ? {
              firstName: trimmedFirst,
              lastName: trimmedLast,
              fullName,
              name: fullName,
            }
          : {}),
      });
    }
  };

  // Salvar Nome, Sobrenome e Foto de Perfil no Banco
  const handleSaveProfile = async () => {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst) {
      Alert.alert('Campo obrigatório', 'Por favor, informe ao menos o seu nome.');
      return;
    }

    setSavingProfile(true);
    try {
      const fullName = trimmedLast ? `${trimmedFirst} ${trimmedLast}` : trimmedFirst;
      if (updateUserProfile) {
        await updateUserProfile({
          name: fullName,
          fullName,
          firstName: trimmedFirst,
          lastName: trimmedLast,
          avatarUri,
        });
      }
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } catch (err) {
      Alert.alert('Erro ao salvar perfil', err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  // Redefinir Senha
  const handleUpdatePassword = async () => {
    if (!newPassword.trim()) {
      Alert.alert('Atenção', 'Digite sua nova senha.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Senha muito curta', 'A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Senhas não coincidem', 'A confirmação de senha é diferente da nova senha.');
      return;
    }

    setSavingPass(true);
    try {
      await updatePasswordApi(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Sucesso! 🎉', 'Sua senha foi redefinida com sucesso.');
    } catch (err) {
      Alert.alert('Erro ao redefinir senha', err.message);
    } finally {
      setSavingPass(false);
    }
  };

  // Logout seguro
  const handleLogout = () => {
    Alert.alert('Sair do FINN', 'Deseja realmente desconectar sua conta deste dispositivo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          if (logout) await logout();
        },
      },
    ]);
  };

  // Exclusão definitiva de conta (Diretriz Obrigatória Google Play Store)
  const handleDeleteAccount = () => {
    Alert.alert(
      'Excluir Conta Definitivamente',
      'Tem certeza de que deseja apagar sua conta? Esta ação é irreversível e excluirá permanentemente seu cadastro, contas bancárias, cartões, cofrinhos e histórico de transações.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim, Excluir Tudo',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              if (deleteAccount) {
                await deleteAccount();
              }
              Alert.alert('Conta Excluída', 'Sua conta e dados foram removidos com sucesso.');
            } catch (err) {
              Alert.alert('Erro ao excluir conta', err.message);
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* HEADER SUPERIOR COM BOTÃO DE VOLTAR */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Meu Perfil</Text>
          <Text style={styles.headerSubtitle}>Dados pessoais e segurança da conta</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: Math.max(insets.bottom, 24) + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* SEÇÃO 1: FOTO DE PERFIL */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={44} color="#7C3AED" />
              </View>
            )}

            <TouchableOpacity
              style={styles.avatarBadgeBtn}
              onPress={handlePickAvatar}
              activeOpacity={0.8}
            >
              <Ionicons name="camera" size={17} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.avatarActionRow}>
            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.7}>
              <Text style={styles.avatarActionText}>Alterar foto de perfil</Text>
            </TouchableOpacity>
            {avatarUri && (
              <>
                <Text style={styles.avatarActionDot}>•</Text>
                <TouchableOpacity onPress={handleRemoveAvatar} activeOpacity={0.7}>
                  <Text style={styles.avatarRemoveText}>Remover</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* SEÇÃO 2: DADOS PESSOAIS */}
        <View style={styles.cardBox}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderIcon}>
              <Ionicons name="person-outline" size={18} color="#7C3AED" />
            </View>
            <Text style={styles.cardTitle}>Dados Pessoais</Text>
          </View>

          {/* NOME E SOBRENOME EM 2 COLUNAS */}
          <View style={styles.nameRow}>
            <View style={styles.nameCol}>
              <Text style={styles.fieldLabel}>Nome</Text>
              <TextInput
                style={styles.textInput}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Ex: Lucas"
                placeholderTextColor="#94A3B8"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.nameCol}>
              <Text style={styles.fieldLabel}>Sobrenome</Text>
              <TextInput
                style={styles.textInput}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Ex: Gabriel"
                placeholderTextColor="#94A3B8"
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* E-MAIL DA CONTA (APENAS LEITURA / IDENTIFICAÇÃO) */}
          <View style={{ marginTop: 14 }}>
            <Text style={styles.fieldLabel}>E-mail cadastrado</Text>
            <View style={styles.emailBox}>
              <Ionicons name="mail-outline" size={18} color="#64748B" />
              <Text style={styles.emailText} numberOfLines={1}>
                {loggedInUser?.email || 'email@exemplo.com'}
              </Text>
              <View style={styles.verifiedPill}>
                <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                <Text style={styles.verifiedText}>Conta ativa</Text>
              </View>
            </View>
          </View>

          {/* BOTÃO DE SALVAR DADOS */}
          <TouchableOpacity
            style={[styles.primaryBtn, savingProfile && styles.btnDisabled]}
            onPress={handleSaveProfile}
            disabled={savingProfile}
            activeOpacity={0.8}
          >
            {savingProfile ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {savedNotice ? '✓ Perfil atualizado com sucesso!' : 'Salvar Alterações'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* SEÇÃO 3: REDEFINIR SENHA */}
        <View style={styles.cardBox}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardHeaderIcon, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="lock-closed-outline" size={18} color="#7C3AED" />
            </View>
            <View>
              <Text style={styles.cardTitle}>Redefinir Senha</Text>
              <Text style={styles.cardSubtitle}>Mínimo de 6 caracteres</Text>
            </View>
          </View>

          {/* CAMPO NOVA SENHA */}
          <View style={{ marginTop: 8 }}>
            <Text style={styles.fieldLabel}>Nova Senha</Text>
            <View style={styles.passwordInputWrap}>
              <TextInput
                style={styles.passwordInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Digite a nova senha"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showNewPass}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowNewPass(!showNewPass)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showNewPass ? 'eye-off-outline' : 'eye-outline'}
                  size={19}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* CAMPO CONFIRMAR NOVA SENHA */}
          <View style={{ marginTop: 14 }}>
            <Text style={styles.fieldLabel}>Confirmar Nova Senha</Text>
            <View style={styles.passwordInputWrap}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repita a nova senha"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showConfirmPass}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowConfirmPass(!showConfirmPass)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showConfirmPass ? 'eye-off-outline' : 'eye-outline'}
                  size={19}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* BOTÃO ATUALIZAR SENHA */}
          <TouchableOpacity
            style={[styles.securityBtn, savingPass && styles.btnDisabled]}
            onPress={handleUpdatePassword}
            disabled={savingPass}
            activeOpacity={0.8}
          >
            {savingPass ? (
              <ActivityIndicator color="#7C3AED" size="small" />
            ) : (
              <Text style={styles.securityBtnText}>Atualizar Senha</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* SEÇÃO 4: PRIVACIDADE & TERMOS (CONFORMIDADE GOOGLE PLAY) */}
        <View style={styles.cardBox}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardHeaderIcon, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#0284C7" />
            </View>
            <View>
              <Text style={styles.cardTitle}>Privacidade & Segurança</Text>
              <Text style={styles.cardSubtitle}>Proteção de dados e conformidade LGPD</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.privacyLinkRow}
            onPress={() => setPrivacyModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Ionicons name="document-text-outline" size={18} color="#64748B" />
              <Text style={styles.privacyLinkText}>Política de Privacidade e Termos de Uso</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* SEÇÃO 5: BOTÃO DE SAIR DA CONTA */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={19} color="#64748B" />
          <Text style={styles.logoutBtnText}>Sair da conta</Text>
        </TouchableOpacity>

        {/* SEÇÃO 6: ZONA DE PERIGO / EXCLUSÃO DE CONTA (OBRIGATÓRIO GOOGLE PLAY) */}
        <View style={styles.dangerZoneCard}>
          <View style={styles.dangerHeader}>
            <Ionicons name="warning-outline" size={18} color="#DC2626" />
            <Text style={styles.dangerTitle}>Excluir Conta</Text>
          </View>
          <Text style={styles.dangerText}>
            Exclui permanentemente seu cadastro, contas bancárias, cartões e histórico financeiro de nossos servidores, em total conformidade com a LGPD e as diretrizes do Google Play.
          </Text>

          <TouchableOpacity
            style={[styles.deleteAccountBtn, deletingAccount && styles.btnDisabled]}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
            activeOpacity={0.8}
          >
            {deletingAccount ? (
              <ActivityIndicator color="#DC2626" size="small" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={16} color="#DC2626" />
                <Text style={styles.deleteAccountBtnText}>Excluir minha conta e dados</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* MODAL DE POLÍTICA DE PRIVACIDADE E TERMOS DE USO */}
      <Modal
        visible={privacyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPrivacyModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Política de Privacidade & Termos</Text>
            <TouchableOpacity
              onPress={() => setPrivacyModalVisible(false)}
              style={styles.modalCloseBtn}
            >
              <Ionicons name="close" size={20} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.policyUpdated}>Última atualização: Novembro de 2026</Text>

            <Text style={styles.policySectionTitle}>1. Coleta e Uso de Informações</Text>
            <Text style={styles.policyParagraph}>
              O FINN coleta informações de cadastro (nome e e-mail), registros financeiros (contas, faturas, cofrinhos e lançamentos informados pelo usuário) e gravações de voz exclusivamente para a prestação de serviços de consultoria e gestão financeira pessoal inteligente.
            </Text>

            <Text style={styles.policySectionTitle}>2. Processamento de Áudio e IA</Text>
            <Text style={styles.policyParagraph}>
              As mensagens de áudio gravadas através do microfone são utilizadas unicamente para converter fala em texto e identificar lançamentos financeiros solicitados por você. Nenhum dado de áudio é vendido ou utilizado para fins publicitários.
            </Text>

            <Text style={styles.policySectionTitle}>3. Segurança e Criptografia</Text>
            <Text style={styles.policyParagraph}>
              Todas as comunicações entre o aplicativo e os nossos servidores utilizam protocolos criptografados (HTTPS/TLS). Seus dados financeiros são isolados e acessíveis exclusivamente mediante suas credenciais pessoais de login.
            </Text>

            <Text style={styles.policySectionTitle}>4. Exclusão de Conta e Dados (Diretriz Google Play)</Text>
            <Text style={styles.policyParagraph}>
              Em estrita conformidade com a Lei Geral de Proteção de Dados (LGPD) e as políticas do Google Play, você tem o direito soberano de excluir integralmente sua conta e todos os dados associados a qualquer momento pelo botão "Excluir minha conta" no seu Perfil. Todos os registros locais e remotos são apagados de forma permanente e irreversível.
            </Text>

            <Text style={styles.policySectionTitle}>5. Contato com o Suporte</Text>
            <Text style={styles.policyParagraph}>
              Para dúvidas sobre privacidade ou requisição de dados, você pode entrar em contato com nossa equipe pelo e-mail oficial de suporte do FINN.
            </Text>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarWrapper: {
    position: 'relative',
    width: 96,
    height: 96,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#7C3AED',
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#DDD6FE',
  },
  avatarBadgeBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  avatarActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  avatarActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C3AED',
  },
  avatarActionDot: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  avatarRemoveText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  cardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  cardHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nameCol: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  emailBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 8,
  },
  emailText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  eyeBtn: {
    padding: 6,
  },
  primaryBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  securityBtn: {
    backgroundColor: '#EDE9FE',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  securityBtnText: {
    color: '#7C3AED',
    fontSize: 14,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.7,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  privacyLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 10,
  },
  privacyLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  dangerZoneCard: {
    backgroundColor: '#FFF5F5',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginTop: 8,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
  dangerText: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 18,
    marginBottom: 14,
  },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteAccountBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  policyUpdated: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 16,
  },
  policySectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 6,
  },
  policyParagraph: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },
});
