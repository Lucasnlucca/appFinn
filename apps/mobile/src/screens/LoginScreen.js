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
import {
  loginUser,
  registerUser,
  checkEmailExistsApi,
  getIndexedAccountByEmail,
  requestPasswordResetApi,
  resetPasswordWithCodeApi,
} from '../services/apiService';
import { performOfficialGoogleSignIn } from '../services/googleAuthService';
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
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [checkingStep1Email, setCheckingStep1Email] = useState(false);

  // Recuperação de Senha (OTP 6 dígitos via e-mail)
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1 = informar e-mail | 2 = código 6 dígitos + nova senha
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);

  // Regras de validação de senha em tempo real
  const hasMinLength = regPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(regPassword);
  const hasNumber = /[0-9]/.test(regPassword);
  const passwordsMatch = regPassword.length > 0 && regPassword === regConfirmPassword;
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && passwordsMatch;

  // ==========================================
  // INICIALIZAÇÃO: DETECÇÃO DE DIGITAL E SOLICITAÇÃO AUTOMÁTICA DE CARA
  // ==========================================
  useEffect(() => {
    let timerId = null;
    async function initAuth() {
      // 1. Carrega credenciais salvas de "Lembrar de mim"
      const remembered = await getRememberedCredentials();
      if (remembered?.email) {
        setLoginEmail(remembered.email);
        setRememberMe(remembered.rememberMe !== false);
      } else {
        setLoginEmail('');
      }

      // 2. Detecta se o telefone possui leitor de digital
      const support = await checkBiometricSupport();
      setBiometricsSupported(support.available);
      setBiometricType('Digital');

      // 3. Se o cliente já habilitou a digital no primeiro login, dispara DE CARA a solicitação da digital!
      const isBioOn = await isBiometricLoginEnabled();
      setBiometricEnabled(isBioOn);

      if (support.available && isBioOn) {
        timerId = setTimeout(() => {
          triggerAutoBiometrics();
        }, 160);
      }
    }

    initAuth();
    return () => {
      if (timerId) clearTimeout(timerId);
    };
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
      // Se cancelar a leitura da digital, permanece na tela para digitar a senha
    } finally {
      setAuthenticatingBiometric(false);
    }
  };

  /**
   * Ao fazer login pela primeira vez em um telefone com digital, exibe o pop-up
   * perguntando se deseja permitir logar pela digital nas próximas vezes.
   */
  const completeLoginWithDigitalPrompt = async (userObj, tokenObj = null) => {
    const support = await checkBiometricSupport();
    const alreadyEnabled = await isBiometricLoginEnabled();

    if (support.available && alreadyEnabled) {
      await setBiometricLoginEnabled(true, userObj, tokenObj);
      setBiometricEnabled(true);
      setLoggedInUser(userObj);
      if (onLoginSuccess) onLoginSuccess(userObj);
      return;
    }

    if (support.available && !alreadyEnabled) {
      Alert.alert(
        'Permitir Login pela Digital?',
        'Detectamos que o seu telefone possui sensor de digital. Deseja habilitar o login pela digital para que ela seja solicitada automaticamente nas próximas vezes que entrar no app?',
        [
          {
            text: 'Agora não',
            style: 'cancel',
            onPress: () => {
              setLoggedInUser(userObj);
              if (onLoginSuccess) onLoginSuccess(userObj);
            },
          },
          {
            text: 'Permitir Digital',
            onPress: async () => {
              await setBiometricLoginEnabled(true, userObj, tokenObj);
              setBiometricEnabled(true);
              setLoggedInUser(userObj);
              if (onLoginSuccess) onLoginSuccess(userObj);
            },
          },
        ]
      );
      return;
    }

    setLoggedInUser(userObj);
    if (onLoginSuccess) onLoginSuccess(userObj);
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
        await setRememberedCredentials(cleanEmail, rememberMe);
        await completeLoginWithDigitalPrompt(res.user, res.token);
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
  // AÇÕES DE CADASTRO (REGISTRO EM 2 PASSOS COM VALIDAÇÃO DE DUPLICIDADE)
  // ==========================================
  const handleContinueStep1 = async () => {
    if (!regName.trim() || regName.trim().length < 3) {
      Alert.alert('Nome inválido', 'Por favor digite seu nome completo.');
      return;
    }

    const cleanRegEmail = regEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanRegEmail || !emailRegex.test(cleanRegEmail)) {
      Alert.alert('E-mail inválido', 'Por favor digite um endereço de e-mail válido.');
      return;
    }

    setCheckingStep1Email(true);
    try {
      const dupCheck = await checkEmailExistsApi(cleanRegEmail);
      if (dupCheck.exists) {
        Alert.alert(
          'Conta já existente',
          `Já existe uma conta cadastrada com o e-mail ${cleanRegEmail}. Não é permitido criar outra conta com o mesmo e-mail.`,
          [
            { text: 'Alterar e-mail', style: 'cancel' },
            {
              text: 'Ir para o Login',
              onPress: () => {
                setLoginEmail(cleanRegEmail);
                setMode('login');
              },
            },
          ]
        );
        return;
      }
      setMode('register_step2');
    } catch {
      setMode('register_step2');
    } finally {
      setCheckingStep1Email(false);
    }
  };

  const handleRegister = async () => {
    if (!isPasswordValid) {
      Alert.alert(
        'Senha não atende aos requisitos',
        'Sua senha precisa ter no mínimo 8 caracteres, 1 letra maiúscula, 1 número e a confirmação deve ser idêntica.'
      );
      return;
    }

    const cleanRegEmail = regEmail.trim().toLowerCase();
    setLoadingRegister(true);
    try {
      const res = await registerUser(
        cleanRegEmail,
        regPassword,
        regName.trim(),
        regPhone.trim() || undefined
      );

      if (res?.user) {
        // Sucesso no registro
        await setRememberedCredentials(cleanRegEmail, true);
        await completeLoginWithDigitalPrompt(res.user, res.token);
      } else {
        Alert.alert('Erro ao registrar', 'Não foi possível concluir o cadastro.');
      }
    } catch (err) {
      const msg = String(err?.message || '');
      if (msg.toLowerCase().includes('já existe')) {
        Alert.alert(
          'Conta já existente',
          `Já existe uma conta cadastrada com o e-mail ${cleanRegEmail}. Não é permitido criar outra conta com o mesmo e-mail.`,
          [
            { text: 'Voltar', style: 'cancel' },
            {
              text: 'Ir para o Login',
              onPress: () => {
                setLoginEmail(cleanRegEmail);
                setMode('login');
              },
            },
          ]
        );
      } else {
        Alert.alert('Erro no cadastro', msg || 'Tente novamente mais tarde.');
      }
    } finally {
      setLoadingRegister(false);
    }
  };

  const handleForgotPassword = () => {
    setResetEmail((loginEmail || '').trim().toLowerCase());
    setResetCode('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setResetStep(1);
    setResetModalVisible(true);
  };

  const handleSendResetCode = async () => {
    const cleanEmail = (resetEmail || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      Alert.alert('E-mail inválido', 'Informe o endereço de e-mail da sua conta FINN.');
      return;
    }

    setLoadingReset(true);
    try {
      await requestPasswordResetApi(cleanEmail);
      setResetEmail(cleanEmail);
      setResetStep(2);
      Alert.alert(
        'Código Enviado!',
        `Enviamos um código de 6 dígitos para ${cleanEmail}. Verifique sua caixa de entrada (e o spam) e digite o código abaixo.`
      );
    } catch (err) {
      Alert.alert(
        'Não foi possível enviar o código',
        err?.message || 'Verifique se o e-mail está correto e tente novamente.'
      );
    } finally {
      setLoadingReset(false);
    }
  };

  const handleConfirmResetPassword = async () => {
    const cleanEmail = (resetEmail || '').trim().toLowerCase();
    const cleanCode = String(resetCode || '').replace(/\D+/g, '').trim();

    if (cleanCode.length !== 6) {
      Alert.alert('Código inválido', 'Digite o código numérico de 6 dígitos enviado para o seu e-mail.');
      return;
    }
    if (resetNewPassword.length < 6) {
      Alert.alert('Senha curta', 'A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      Alert.alert('Senhas diferentes', 'A confirmação de senha não coincide com a nova senha.');
      return;
    }

    setLoadingReset(true);
    try {
      const res = await resetPasswordWithCodeApi({
        email: cleanEmail,
        code: cleanCode,
        newPassword: resetNewPassword,
      });

      setResetModalVisible(false);
      setLoginEmail(cleanEmail);
      setLoginPassword('');

      if (res?.user) {
        await setRememberedCredentials(cleanEmail, true);
        Alert.alert('Senha Redefinida!', 'Sua senha foi atualizada com sucesso.', [
          {
            text: 'Entrar no FINN',
            onPress: async () => {
              await finalizeAuthentication(res.user, res.token);
            },
          },
        ]);
      } else {
        Alert.alert('Senha Redefinida!', 'Sua nova senha já está ativa. Faça login para entrar.');
      }
    } catch (err) {
      Alert.alert(
        'Erro ao redefinir senha',
        err?.message || 'Verifique o código de 6 dígitos e tente novamente.'
      );
    } finally {
      setLoadingReset(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoadingGoogle(true);
    try {
      const result = await performOfficialGoogleSignIn({ termsAcceptedVersion: '1.0' });
      if (!result) {
        // Usuário fechou ou cancelou o seletor nativo do Google silenciosamente
        return;
      }

      if (result?.user) {
        if (result.isNewUser) {
          Alert.alert(
            'Bem-vindo ao FINN!',
            `Sua conta foi criada com sucesso com o Google. Seus termos de uso foram aceitos.`
          );
        } else {
          Alert.alert(
            'Bem-vindo de volta!',
            'Você já tinha uma conta cadastrada no FINN. Entramos para você.'
          );
        }
        await completeLoginWithDigitalPrompt(result.user, result.token);
      }
    } catch (err) {
      Alert.alert('Google Sign-In', err?.message || 'Falha ao autenticar com o Google.');
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

            {/* DIVISOR "OU" */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* BOTÃO GOOGLE NATIVO (LOGIN) */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleAuth}
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

            {/* AVISO LEGAL E PRIVACIDADE LGPD */}
            <Text style={[styles.termsText, { marginTop: 14, marginBottom: 4 }]}>
              Ao continuar, você aceita os{' '}
              <Text style={styles.termsLink}>Termos de Uso</Text> e a{' '}
              <Text style={styles.termsLink}>Política de Privacidade</Text>.
            </Text>

            {/* LINK PARA CADASTRO */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Ainda não tem uma conta? </Text>
              <TouchableOpacity onPress={() => setMode('register_step1')} activeOpacity={0.7}>
                <Text style={styles.footerLink}>Cadastre-se</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* MODAL DE RECUPERAÇÃO DE SENHA POR E-MAIL (CÓDIGO DE 6 DÍGITOS) */}
        <Modal
          visible={resetModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => !loadingReset && setResetModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.googleModalOverlay}
            activeOpacity={1}
            onPress={() => !loadingReset && setResetModalVisible(false)}
          >
            <View style={styles.googleModalCard} onStartShouldSetResponder={() => true}>
              <View
                style={[
                  styles.googleModalBadge,
                  { backgroundColor: '#EDE9FE', borderColor: '#DDD6FE' },
                ]}
              >
                <Ionicons name="key-outline" size={26} color="#6D28D9" />
              </View>

              <Text style={styles.googleModalTitle}>
                {resetStep === 1 ? 'Recuperar sua senha' : 'Digite o código enviado'}
              </Text>
              <Text style={styles.googleModalSub}>
                {resetStep === 1
                  ? 'Informe o e-mail da sua conta no FINN para receber um código de verificação de 6 dígitos.'
                  : `Enviamos um código de 6 dígitos para ${resetEmail}. Ele expira em 15 minutos.`}
              </Text>

              {resetStep === 1 ? (
                <View style={styles.googleModalForm}>
                  <Text style={styles.googleInputLabel}>E-MAIL DA CONTA</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="mail-outline"
                      size={19}
                      color="#7C3AED"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.inputField}
                      placeholder="seuemail@exemplo.com"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={resetEmail}
                      onChangeText={setResetEmail}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, loadingReset && styles.buttonDisabled]}
                    onPress={handleSendResetCode}
                    disabled={loadingReset}
                    activeOpacity={0.85}
                  >
                    {loadingReset ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Enviar código por e-mail</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.googleCancelBtn}
                    onPress={() => setResetModalVisible(false)}
                    disabled={loadingReset}
                  >
                    <Text style={styles.googleCancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.googleModalForm}>
                  <Text style={styles.googleInputLabel}>CÓDIGO DE 6 DÍGITOS</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={19}
                      color="#7C3AED"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[
                        styles.inputField,
                        { letterSpacing: 6, fontWeight: '800', fontSize: 18 },
                      ]}
                      placeholder="000000"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      maxLength={6}
                      value={resetCode}
                      onChangeText={(txt) => setResetCode(txt.replace(/\D+/g, '').slice(0, 6))}
                    />
                  </View>

                  <Text style={styles.googleInputLabel}>NOVA SENHA</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={19}
                      color="#7C3AED"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.inputField}
                      placeholder="Mínimo de 6 caracteres"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showResetPassword}
                      autoCapitalize="none"
                      value={resetNewPassword}
                      onChangeText={setResetNewPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowResetPassword(!showResetPassword)}
                    >
                      <Ionicons
                        name={showResetPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#9CA3AF"
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.googleInputLabel}>CONFIRMAR NOVA SENHA</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={19}
                      color="#7C3AED"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.inputField}
                      placeholder="Repita a nova senha"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showResetPassword}
                      autoCapitalize="none"
                      value={resetConfirmPassword}
                      onChangeText={setResetConfirmPassword}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, loadingReset && styles.buttonDisabled]}
                    onPress={handleConfirmResetPassword}
                    disabled={loadingReset}
                    activeOpacity={0.85}
                  >
                    {loadingReset ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Redefinir Senha</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ alignItems: 'center', paddingVertical: 8, marginTop: 4 }}
                    onPress={handleSendResetCode}
                    disabled={loadingReset}
                  >
                    <Text style={{ color: '#6D28D9', fontSize: 12.5, fontWeight: '700' }}>
                      Não recebeu o e-mail? Reenviar código
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.googleCancelBtn}
                    onPress={() => setResetStep(1)}
                    disabled={loadingReset}
                  >
                    <Text style={styles.googleCancelBtnText}>Alterar e-mail</Text>
                  </TouchableOpacity>
                </View>
              )}
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

            {/* BOTÃO CONTINUAR (VALIDA DUPLICIDADE DE E-MAIL NO BANCO) */}
            <TouchableOpacity
              style={[styles.primaryButton, checkingStep1Email && styles.buttonDisabled]}
              onPress={handleContinueStep1}
              disabled={checkingStep1Email}
              activeOpacity={0.85}
            >
              {checkingStep1Email ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Continuar</Text>
              )}
            </TouchableOpacity>

            {/* DIVISOR "OU" */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* BOTÃO CADASTRAR COM GOOGLE NATIVO */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleAuth}
              disabled={loadingGoogle || checkingStep1Email}
              activeOpacity={0.8}
            >
              {loadingGoogle ? (
                <ActivityIndicator size="small" color="#4285F4" style={{ marginRight: 10 }} />
              ) : (
                <GoogleColorLogo size={20} style={{ marginRight: 10 }} />
              )}
              <Text style={styles.googleButtonText}>Cadastrar com Google</Text>
            </TouchableOpacity>

            {/* AVISO LEGAL E PRIVACIDADE LGPD */}
            <Text style={[styles.termsText, { marginTop: 14, marginBottom: 4 }]}>
              Ao continuar, você aceita os{' '}
              <Text style={styles.termsLink}>Termos de Uso</Text> e a{' '}
              <Text style={styles.termsLink}>Política de Privacidade</Text>.
            </Text>

            {/* LINK RETORNAR AO LOGIN */}
            <View style={[styles.footerRow, { marginTop: 20 }]}>
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
