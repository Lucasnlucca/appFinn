import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../theme/colors';
import { loginUser, registerUser, loginWithGoogleAccount } from '../services/apiService';
import {
  checkBiometricSupport,
  isBiometricLoginEnabled,
  setBiometricLoginEnabled,
  performBiometricLogin,
  getRememberedCredentials,
  setRememberedCredentials,
} from '../services/biometricService';
import { useFinance } from '../context/FinanceContext';

const finnLogoSource = require('../../assets/finn-logo.png');
const robotMascotSource = require('../../assets/finn-login-robot.png');

// Logo oficial do "G" do Google com as 4 cores oficiais (#4285F4, #34A853, #FBBC05, #EA4335)
function GoogleColorLogo({ size = 20, style }) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          fill="#4285F4"
          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
        />
        <Path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
        />
        <Path
          fill="#FBBC05"
          d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
        />
        <Path
          fill="#EA4335"
          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
        />
      </Svg>
    </View>
  );
}

export default function LoginScreen({ onLoginSuccess }) {
  const insets = useSafeAreaInsets();
  const { setLoggedInUser } = useFinance();

  // Modos de visualização: 'login' | 'register_step1' | 'register_step2'
  const [mode, setMode] = useState('login');

  // ==========================================
  // ESTADOS DO LOGIN
  // ==========================================
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loadingLogin, setLoadingLogin] = useState(false);

  // Biometria
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [biometricType, setBiometricType] = useState('Digital');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [authenticatingBiometric, setAuthenticatingBiometric] = useState(false);

  // ==========================================
  // ESTADOS DO CADASTRO (REGISTRO)
  // ==========================================
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [loadingRegister, setLoadingRegister] = useState(false);

  // Google Sign-In
  const [googleModalVisible, setGoogleModalVisible] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  // Regras de validação de senha em tempo real
  const hasMinLength = regPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(regPassword);
  const hasNumber = /[0-9]/.test(regPassword);
  const passwordsMatch = regPassword.length > 0 && regPassword === regConfirmPassword;
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && passwordsMatch;

  // ==========================================
  // INICIALIZAÇÃO: BIOMETRIA E LEMBRAR DE MIM
  // ==========================================
  useEffect(() => {
    async function initAuth() {
      // 1. Carrega credenciais salvas de "Lembrar de mim"
      const remembered = await getRememberedCredentials();
      if (remembered?.email) {
        setLoginEmail(remembered.email);
        setRememberMe(remembered.rememberMe !== false);
      } else {
        setLoginEmail('');
      }

      // 2. Verifica suporte a biometria no aparelho
      const support = await checkBiometricSupport();
      setBiometricsSupported(support.available);
      setBiometricType(support.biometricType || 'Digital');

      // 3. Se o usuário já ativou a biometria anteriormente, dispara automaticamente
      const isBioOn = await isBiometricLoginEnabled();
      setBiometricEnabled(isBioOn);

      if (support.available && isBioOn) {
        triggerAutoBiometrics();
      }
    }

    initAuth();
  }, []);

  const triggerAutoBiometrics = async () => {
    setAuthenticatingBiometric(true);
    try {
      const res = await performBiometricLogin();
      if (res.success && res.user) {
        setLoggedInUser(res.user);
        if (onLoginSuccess) onLoginSuccess(res.user);
      }
    } catch {
      // Ignora falha silenciosa para deixar o usuário digitar a senha
    } finally {
      setAuthenticatingBiometric(false);
    }
  };

  const handleManualBiometricLogin = async () => {
    setAuthenticatingBiometric(true);
    try {
      const res = await performBiometricLogin();
      if (res.success && res.user) {
        setLoggedInUser(res.user);
        if (onLoginSuccess) onLoginSuccess(res.user);
      } else {
        Alert.alert(
          'Login com Digital',
          res.reason || 'Não foi possível reconhecer a digital. Por favor digite sua senha.'
        );
      }
    } catch (err) {
      Alert.alert('Erro na biometria', err.message || 'Falha ao autenticar.');
    } finally {
      setAuthenticatingBiometric(false);
    }
  };

  // ==========================================
  // AÇÕES DE LOGIN
  // ==========================================
  const handleLogin = async () => {
    const cleanEmail = loginEmail.trim().toLowerCase();
    if (!cleanEmail || !loginPassword) {
      Alert.alert('Campos obrigatórios', 'Por favor informe o seu e-mail e a senha.');
      return;
    }

    setLoadingLogin(true);
    try {
      const res = await loginUser(cleanEmail, loginPassword);

      if (res?.user) {
        // Salva preferência de lembrar e-mail
        await setRememberedCredentials(cleanEmail, rememberMe);

        // Se o aparelho suportar biometria e ainda não estiver ativada, oferece ativação
        if (biometricsSupported && !biometricEnabled) {
          Alert.alert(
            `Ativar Login com ${biometricType}?`,
            `Deseja usar sua ${biometricType.toLowerCase()} para acessar o FINN nos próximos logins sem precisar digitar sua senha?`,
            [
              {
                text: 'Agora não',
                style: 'cancel',
                onPress: () => {
                  setLoggedInUser(res.user);
                  if (onLoginSuccess) onLoginSuccess(res.user);
                },
              },
              {
                text: 'Ativar',
                onPress: async () => {
                  await setBiometricLoginEnabled(true, res.user);
                  setLoggedInUser(res.user);
                  if (onLoginSuccess) onLoginSuccess(res.user);
                },
              },
            ]
          );
        } else {
          setLoggedInUser(res.user);
          if (onLoginSuccess) onLoginSuccess(res.user);
        }
      } else {
        Alert.alert('Erro ao entrar', 'Não foi possível validar suas credenciais.');
      }
    } catch (err) {
      Alert.alert(
        'Falha no Login',
        err.message || 'Verifique seu e-mail e senha e tente novamente.'
      );
    } finally {
      setLoadingLogin(false);
    }
  };

  // ==========================================
  // AÇÕES DE CADASTRO (REGISTRO EM 2 PASSOS)
  // ==========================================
  const handleContinueStep1 = () => {
    if (!regName.trim() || regName.trim().length < 3) {
      Alert.alert('Nome inválido', 'Por favor digite seu nome completo.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regEmail.trim() || !emailRegex.test(regEmail.trim())) {
      Alert.alert('E-mail inválido', 'Por favor digite um endereço de e-mail válido.');
      return;
    }

    setMode('register_step2');
  };

  const handleRegister = async () => {
    if (!isPasswordValid) {
      Alert.alert(
        'Senha não atende aos requisitos',
        'Sua senha precisa ter no mínimo 8 caracteres, 1 letra maiúscula, 1 número e a confirmação deve ser idêntica.'
      );
      return;
    }

    setLoadingRegister(true);
    try {
      const res = await registerUser(
        regEmail.trim().toLowerCase(),
        regPassword,
        regName.trim(),
        regPhone.trim() || undefined
      );

      if (res?.user) {
        // Sucesso no registro
        await setRememberedCredentials(regEmail.trim().toLowerCase(), true);

        // Se suportar biometria, sugere ativação
        if (biometricsSupported) {
          Alert.alert(
            'Conta Criada com Sucesso!',
            `Deseja ativar o acesso com a sua ${biometricType.toLowerCase()} no seu celular para os próximos logins?`,
            [
              {
                text: 'Depois',
                style: 'cancel',
                onPress: () => {
                  setLoggedInUser(res.user);
                  if (onLoginSuccess) onLoginSuccess(res.user);
                },
              },
              {
                text: 'Sim, ativar',
                onPress: async () => {
                  await setBiometricLoginEnabled(true, res.user);
                  setLoggedInUser(res.user);
                  if (onLoginSuccess) onLoginSuccess(res.user);
                },
              },
            ]
          );
        } else {
          Alert.alert('Conta Criada!', 'Bem-vindo ao FINN!');
          setLoggedInUser(res.user);
          if (onLoginSuccess) onLoginSuccess(res.user);
        }
      } else {
        Alert.alert('Erro ao registrar', 'Não foi possível concluir o cadastro.');
      }
    } catch (err) {
      Alert.alert('Erro no cadastro', err.message || 'Tente novamente mais tarde.');
    } finally {
      setLoadingRegister(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Redefinição de Senha',
      `Um link de recuperação será enviado para o e-mail: ${loginEmail || 'seu e-mail'}.\n\nCaso não receba, verifique sua caixa de spam ou contate o suporte.`,
      [{ text: 'OK' }]
    );
  };

  const handleGoogleLogin = () => {
    const initialEmail = loginEmail.trim() || regEmail.trim() || '';
    setGoogleEmail(initialEmail);
    if (!googleName && initialEmail.includes('@')) {
      const prefix = initialEmail
        .split('@')[0]
        .replace(/[._0-9-]+/g, ' ')
        .trim()
        .replace(/\b\w/g, (l) => l.toUpperCase());
      setGoogleName(prefix || '');
    }
    setGoogleModalVisible(true);
  };

  const handleConfirmGoogleLogin = async (customEmail, customName) => {
    const targetEmail = (customEmail !== undefined ? customEmail : googleEmail).trim().toLowerCase();
    const targetName = (customName !== undefined ? customName : googleName).trim();

    if (!targetEmail || !targetEmail.includes('@')) {
      Alert.alert('Conta Google', 'Informe seu endereço de e-mail do Google (ex: voce@gmail.com).');
      return;
    }

    setLoadingGoogle(true);
    try {
      const res = await loginWithGoogleAccount({
        email: targetEmail,
        name: targetName,
      });

      if (res?.user) {
        await setRememberedCredentials(targetEmail, true);
        setGoogleModalVisible(false);
        setLoggedInUser(res.user);
        if (onLoginSuccess) onLoginSuccess(res.user);
      }
    } catch (err) {
      Alert.alert('Erro ao conectar com Google', err.message || 'Tente novamente.');
    } finally {
      setLoadingGoogle(false);
    }
  };

  // ==========================================
  // RENDERIZAÇÃO: CABEÇALHO FINN COM LOGO
  // ==========================================
  const renderHeader = (showBack = false, onBack = null) => (
    <View style={styles.topHeader}>
      {showBack ? (
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#18181B" />
        </TouchableOpacity>
      ) : (
        <View style={styles.backPlaceholder} />
      )}

      <View style={styles.logoRow}>
        <View style={styles.logoStripe}>
          <View style={[styles.stripeBar, { backgroundColor: '#38BDF8' }]} />
          <View style={[styles.stripeBar, { backgroundColor: '#6366F1' }]} />
          <View style={[styles.stripeBar, { backgroundColor: '#A855F7' }]} />
        </View>
        <Text style={styles.logoText}>FINN</Text>
      </View>

      <View style={styles.backPlaceholder} />
    </View>
  );

  // ==========================================
  // RENDERIZAÇÃO: STEPPER DE PROGRESSO (1 E 2)
  // ==========================================
  const renderStepper = (activeStep) => (
    <View style={styles.stepperContainer}>
      {/* Passo 1 */}
      <View style={styles.stepItem}>
        <View
          style={[
            styles.stepCircle,
            activeStep >= 1 && styles.stepCircleActive,
          ]}
        >
          {activeStep > 1 ? (
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          ) : (
            <Text style={styles.stepNumberActive}>1</Text>
          )}
        </View>
        <Text style={[styles.stepLabel, activeStep >= 1 && styles.stepLabelActive]}>
          Seus dados
        </Text>
      </View>

      {/* Linha conectora */}
      <View
        style={[
          styles.stepLine,
          activeStep > 1 && styles.stepLineActive,
        ]}
      />

      {/* Passo 2 */}
      <View style={styles.stepItem}>
        <View
          style={[
            styles.stepCircle,
            activeStep === 2 && styles.stepCircleActive,
          ]}
        >
          <Text style={activeStep === 2 ? styles.stepNumberActive : styles.stepNumberInactive}>
            2
          </Text>
        </View>
        <Text style={[styles.stepLabel, activeStep === 2 && styles.stepLabelActive]}>
          Segurança
        </Text>
      </View>
    </View>
  );

  // =========================================================================
  // TELA 1: LOGIN (BEM-VINDO AO FINN)
  // =========================================================================
  if (mode === 'login') {
    return (
      <KeyboardAvoidingView
        style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderHeader()}

          {/* MASCOTE ROBÔ 3D */}
          <View style={styles.mascotWrapper}>
            <View style={styles.mascotGlow} />
            <Image
              source={robotMascotSource}
              style={styles.mascotImage}
              resizeMode="contain"
            />
          </View>

          {/* TÍTULO E SUBTÍTULO */}
          <View style={styles.titleSection}>
            <Text style={styles.titleText}>Bem-vindo ao FINN</Text>
            <Text style={styles.subtitleText}>Seu assistente financeiro inteligente</Text>
          </View>

          {/* FORMULÁRIO DE LOGIN */}
          <View style={styles.formCard}>
            {/* Campo E-mail */}
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#7C3AED" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="E-mail"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={loginEmail}
                onChangeText={setLoginEmail}
              />
            </View>

            {/* Campo Senha */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#7C3AED" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="Senha"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showLoginPassword}
                value={loginPassword}
                onChangeText={setLoginPassword}
              />
              <TouchableOpacity
                onPress={() => setShowLoginPassword(!showLoginPassword)}
                style={styles.eyeIconBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showLoginPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#9CA3AF"
                />
              </TouchableOpacity>
            </View>

            {/* Linha: Lembrar de mim & Esqueci minha senha */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.checkboxRow}
                activeOpacity={0.8}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                  {rememberMe && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <Text style={styles.checkboxLabel}>Lembrar de mim</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
                <Text style={styles.forgotPasswordText}>Esqueci minha senha</Text>
              </TouchableOpacity>
            </View>

            {/* BOTÃO PRINCIPAL: ENTRAR */}
            <TouchableOpacity
              style={[styles.primaryButton, loadingLogin && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loadingLogin || authenticatingBiometric}
              activeOpacity={0.85}
            >
              {loadingLogin ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Entrar</Text>
              )}
            </TouchableOpacity>

            {/* BOTÃO DE LOGIN BIOMÉTRICO (DIGITAL) */}
            {biometricsSupported && (
              <TouchableOpacity
                style={styles.biometricBtn}
                onPress={handleManualBiometricLogin}
                disabled={authenticatingBiometric || loadingLogin}
                activeOpacity={0.8}
              >
                {authenticatingBiometric ? (
                  <ActivityIndicator size="small" color="#7C3AED" />
                ) : (
                  <>
                    <Ionicons name="finger-print-outline" size={22} color="#7C3AED" />
                    <Text style={styles.biometricBtnText}>
                      Entrar com {biometricType}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* DIVISOR "OU" */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* BOTÃO GOOGLE */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleLogin}
              disabled={loadingGoogle || loadingLogin}
              activeOpacity={0.8}
            >
              {loadingGoogle ? (
                <ActivityIndicator size="small" color="#4285F4" style={{ marginRight: 10 }} />
              ) : (
                <GoogleColorLogo size={20} style={{ marginRight: 10 }} />
              )}
              <Text style={styles.googleButtonText}>Continuar com Google</Text>
            </TouchableOpacity>

            {/* LINK PARA CADASTRO */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Ainda não tem uma conta? </Text>
              <TouchableOpacity onPress={() => setMode('register_step1')} activeOpacity={0.7}>
                <Text style={styles.footerLink}>Cadastre-se</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* MODAL DE CONEXÃO COM CONTA GOOGLE */}
        <Modal
          visible={googleModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => !loadingGoogle && setGoogleModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.googleModalOverlay}
            activeOpacity={1}
            onPress={() => !loadingGoogle && setGoogleModalVisible(false)}
          >
            <View style={styles.googleModalCard} onStartShouldSetResponder={() => true}>
              <View style={styles.googleModalHeader}>
                <GoogleColorLogo size={28} />
                <Text style={styles.googleModalBrandText}>Fazer login com o Google</Text>
                <Text style={styles.googleModalSubText}>
                  Escolha ou informe sua conta Google para prosseguir para o{' '}
                  <Text style={{ fontWeight: '800', color: '#7C3AED' }}>FINN</Text>
                </Text>
              </View>

              {/* Se já houver um e-mail preenchido/lembrado, exibe como opção rápida de 1 toque */}
              {loginEmail.trim().includes('@') && (
                <TouchableOpacity
                  style={styles.googleQuickAccountBtn}
                  onPress={() => handleConfirmGoogleLogin(loginEmail.trim(), googleName)}
                  disabled={loadingGoogle}
                  activeOpacity={0.8}
                >
                  <View style={styles.googleQuickAvatar}>
                    <Text style={styles.googleQuickAvatarLetter}>
                      {loginEmail.trim()[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.googleQuickName} numberOfLines={1}>
                      {googleName ||
                        loginEmail
                          .trim()
                          .split('@')[0]
                          .replace(/[._0-9-]+/g, ' ')
                          .trim()
                          .replace(/\b\w/g, (l) => l.toUpperCase()) ||
                        'Minha Conta Google'}
                    </Text>
                    <Text style={styles.googleQuickEmail} numberOfLines={1}>
                      {loginEmail.trim().toLowerCase()}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#64748B" />
                </TouchableOpacity>
              )}

              <View style={styles.googleModalForm}>
                <Text style={styles.googleInputLabel}>E-MAIL GOOGLE</Text>
                <View style={styles.inputContainer}>
                  <GoogleColorLogo size={18} style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="seuemail@gmail.com"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={googleEmail}
                    onChangeText={setGoogleEmail}
                  />
                </View>

                <Text style={styles.googleInputLabel}>SEU NOME (OPCIONAL)</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={19} color="#4285F4" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="Como quer ser chamado no FINN"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                    value={googleName}
                    onChangeText={setGoogleName}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.googleConfirmBtn, loadingGoogle && styles.buttonDisabled]}
                  onPress={() => handleConfirmGoogleLogin()}
                  disabled={loadingGoogle}
                  activeOpacity={0.85}
                >
                  {loadingGoogle ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.googleConfirmBtnText}>Conectar Conta Google</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.googleCancelBtn}
                  onPress={() => setGoogleModalVisible(false)}
                  disabled={loadingGoogle}
                >
                  <Text style={styles.googleCancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Onda decorativa de fundo suave */}
        <View style={styles.bottomWave} pointerEvents="none" />
      </KeyboardAvoidingView>
    );
  }

  // =========================================================================
  // TELA 2: REGISTRO - PASSO 1 (SEUS DADOS)
  // =========================================================================
  if (mode === 'register_step1') {
    return (
      <KeyboardAvoidingView
        style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderHeader(true, () => setMode('login'))}

          {renderStepper(1)}

          {/* TÍTULO E SUBTÍTULO */}
          <View style={styles.stepTitleSection}>
            <Text style={styles.titleText}>Criar sua conta</Text>
            <Text style={styles.subtitleText}>Vamos começar com seus dados básicos</Text>
          </View>

          {/* FORMULÁRIO */}
          <View style={styles.formCard}>
            {/* Campo Nome */}
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#7C3AED" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="Nome completo"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
                value={regName}
                onChangeText={setRegName}
              />
            </View>

            {/* Campo E-mail */}
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#7C3AED" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="E-mail"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={regEmail}
                onChangeText={setRegEmail}
              />
            </View>

            {/* Campo Telefone */}
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color="#7C3AED" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="Telefone (opcional)"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                value={regPhone}
                onChangeText={setRegPhone}
              />
            </View>

            {/* BOTÃO CONTINUAR */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleContinueStep1}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Continuar</Text>
            </TouchableOpacity>

            {/* LINK RETORNAR AO LOGIN */}
            <View style={[styles.footerRow, { marginTop: 24 }]}>
              <Text style={styles.footerText}>Já tem uma conta? </Text>
              <TouchableOpacity onPress={() => setMode('login')} activeOpacity={0.7}>
                <Text style={styles.footerLink}>Entrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomWave} pointerEvents="none" />
      </KeyboardAvoidingView>
    );
  }

  // =========================================================================
  // TELA 3: REGISTRO - PASSO 2 (SEGURANÇA / SENHA)
  // =========================================================================
  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderHeader(true, () => setMode('register_step1'))}

        {renderStepper(2)}

        {/* TÍTULO E SUBTÍTULO */}
        <View style={styles.stepTitleSection}>
          <Text style={styles.titleText}>Defina sua senha</Text>
          <Text style={styles.subtitleText}>Crie uma senha segura para acessar o FINN</Text>
        </View>

        {/* FORMULÁRIO */}
        <View style={styles.formCard}>
          {/* Campo Senha */}
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#7C3AED" style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              placeholder="Senha"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showRegPassword}
              value={regPassword}
              onChangeText={setRegPassword}
            />
            <TouchableOpacity
              onPress={() => setShowRegPassword(!showRegPassword)}
              style={styles.eyeIconBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={showRegPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#9CA3AF"
              />
            </TouchableOpacity>
          </View>

          {/* Campo Confirmar Senha */}
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#7C3AED" style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              placeholder="Confirmar senha"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showRegConfirmPassword}
              value={regConfirmPassword}
              onChangeText={setRegConfirmPassword}
            />
            <TouchableOpacity
              onPress={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
              style={styles.eyeIconBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={showRegConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#9CA3AF"
              />
            </TouchableOpacity>
          </View>

          {/* CARD DE REQUISITOS DE SENHA */}
          <View style={styles.requirementsCard}>
            <View style={styles.requirementsHeader}>
              <Ionicons name="shield-outline" size={20} color="#7C3AED" />
              <Text style={styles.requirementsTitle}>Sua senha deve conter:</Text>
            </View>

            <View style={styles.requirementRow}>
              <Ionicons
                name={hasMinLength ? 'checkmark' : 'ellipse-outline'}
                size={16}
                color={hasMinLength ? '#7C3AED' : '#9CA3AF'}
              />
              <Text
                style={[
                  styles.requirementText,
                  hasMinLength && styles.requirementTextValid,
                ]}
              >
                Mínimo de 8 caracteres
              </Text>
            </View>

            <View style={styles.requirementRow}>
              <Ionicons
                name={hasUppercase ? 'checkmark' : 'ellipse-outline'}
                size={16}
                color={hasUppercase ? '#7C3AED' : '#9CA3AF'}
              />
              <Text
                style={[
                  styles.requirementText,
                  hasUppercase && styles.requirementTextValid,
                ]}
              >
                Uma letra maiúscula
              </Text>
            </View>

            <View style={styles.requirementRow}>
              <Ionicons
                name={hasNumber ? 'checkmark' : 'ellipse-outline'}
                size={16}
                color={hasNumber ? '#7C3AED' : '#9CA3AF'}
              />
              <Text
                style={[
                  styles.requirementText,
                  hasNumber && styles.requirementTextValid,
                ]}
              >
                Um número
              </Text>
            </View>
          </View>

          {/* BOTÃO CRIAR CONTA */}
          <TouchableOpacity
            style={[styles.primaryButton, loadingRegister && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loadingRegister}
            activeOpacity={0.85}
          >
            {loadingRegister ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Criar conta</Text>
            )}
          </TouchableOpacity>

          {/* TERMOS E POLÍTICA */}
          <Text style={styles.termsText}>
            Ao criar sua conta, você concorda com os{' '}
            <Text style={styles.termsLink}>Termos de Uso</Text> e a{' '}
            <Text style={styles.termsLink}>Política de Privacidade</Text>.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomWave} pointerEvents="none" />
    </KeyboardAvoidingView>
  );
}

// ==========================================
// ESTILOS DE ALTA FIDELIDADE
// ==========================================
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAF9FF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // TOPO & LOGO
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  backPlaceholder: {
    width: 40,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoStripe: {
    flexDirection: 'column',
    gap: 3,
  },
  stripeBar: {
    width: 22,
    height: 3.5,
    borderRadius: 2,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#18181B',
    letterSpacing: 1.5,
  },

  // MASCOTE ROBÔ 3D
  mascotWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  mascotGlow: {
    position: 'absolute',
    width: 158,
    height: 158,
    borderRadius: 79,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
  },
  mascotImage: {
    width: 162,
    height: 150,
  },

  // TÍTULO E SUBTÍTULO
  titleSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  stepTitleSection: {
    alignItems: 'flex-start',
    marginTop: 20,
    marginBottom: 20,
  },
  titleText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#18181B',
    marginBottom: 6,
  },
  subtitleText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '400',
  },

  // STEPPER DE PROGRESSO
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
  },
  stepItem: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepCircleActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  stepNumberActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  stepNumberInactive: {
    color: '#9CA3AF',
    fontWeight: '700',
    fontSize: 14,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  stepLabelActive: {
    color: '#7C3AED',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
    marginBottom: 20,
  },
  stepLineActive: {
    backgroundColor: '#7C3AED',
  },

  // FORMULÁRIO
  formCard: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    color: '#18181B',
    fontWeight: '500',
  },
  eyeIconBtn: {
    padding: 6,
  },

  // LINHA DE OPÇÕES (LEMBRAR DE MIM / ESQUECI MINHA SENHA)
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    marginTop: 2,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  forgotPasswordText: {
    fontSize: 13,
    color: '#7C3AED',
    fontWeight: '700',
  },

  // BOTÕES
  primaryButton: {
    backgroundColor: '#7C3AED',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // BOTÃO BIOMÉTRICO (DIGITAL)
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    height: 48,
    borderRadius: 14,
    marginTop: 10,
  },
  biometricBtnText: {
    color: '#7C3AED',
    fontSize: 14,
    fontWeight: '700',
  },

  // DIVISOR
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '500',
  },

  // BOTÃO GOOGLE
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 50,
    borderRadius: 14,
    marginBottom: 20,
  },
  googleButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  googleModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  googleModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  googleModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  googleModalBrandText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 10,
  },
  googleModalSubText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  googleQuickAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    gap: 12,
  },
  googleQuickAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleQuickAvatarLetter: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  googleQuickName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  googleQuickEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  googleModalForm: {
    width: '100%',
  },
  googleInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  googleConfirmBtn: {
    backgroundColor: '#4285F4',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  googleConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  googleCancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  googleCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },

  // FOOTER
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  footerLink: {
    fontSize: 14,
    color: '#7C3AED',
    fontWeight: '700',
  },

  // CARD DE REQUISITOS DE SENHA
  requirementsCard: {
    backgroundColor: '#F8F7FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    marginTop: 4,
  },
  requirementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#18181B',
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  requirementText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  requirementTextValid: {
    color: '#7C3AED',
    fontWeight: '600',
  },

  // TERMOS E POLÍTICA
  termsText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 14,
    paddingHorizontal: 8,
  },
  termsLink: {
    color: '#7C3AED',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },

  // ONDA SUAVE INFERIOR
  bottomWave: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: 'rgba(237, 233, 254, 0.45)',
    borderTopLeftRadius: 60,
    borderTopRightRadius: 60,
  },
});
