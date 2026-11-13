import { Platform } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { apiRequest, saveAuthToken, saveAuthUser, sanitizeAvatarUri } from './apiService';
import { setRememberedCredentials } from './biometricService';

// Web Client ID oficial do Google Cloud Console ("Web application")
export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '76639341833-lv3ud7239sr11g9v9rlcmbtkvr95i7ca.apps.googleusercontent.com';

let isConfigured = false;

export function configureGoogleSignIn() {
  if (isConfigured) return;
  try {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: false,
      scopes: ['openid', 'email', 'profile'],
    });
    isConfigured = true;
  } catch (err) {
    console.warn('Erro ao configurar GoogleSignin:', err?.message);
  }
}

/**
 * Serviço unificado oficial de Autenticação com o Google (ETAPA 1).
 * Abre o seletor nativo do sistema (Credential Manager no Android / SDK no iOS),
 * obtém o idToken criptográfico e envia EXCLUSIVAMENTE para POST /auth/google.
 *
 * @param {object} options
 * @param {'1.0'} [options.termsAcceptedVersion='1.0']
 * Limpa a sessão em cache do Google Sign-In no dispositivo para garantir
 * que o seletor de contas seja exibido na próxima tentativa.
 */
export async function signOutGoogle() {
  if (Platform.OS === 'web') return;
  try {
    configureGoogleSignIn();
    await GoogleSignin.signOut();
  } catch {
    // Ignora caso não haja sessão Google ativa
  }
}

/**
 * Executa o fluxo oficial de autenticação Google no app nativo (Android/iOS)
 * garantindo que o seletor de contas do Google sempre abra e respeitando a intenção (login vs register).
 *
 * @param {object} options
 * @param {'login'|'register'} [options.intent='login']
 * @param {string} [options.termsAcceptedVersion='1.0']
 * @returns {Promise<{ user: any, token: string, isNewUser: boolean } | null>} Retorna null se cancelado pelo usuário
 */
export async function performOfficialGoogleSignIn({
  intent = 'login',
  termsAcceptedVersion = '1.0',
} = {}) {
  configureGoogleSignIn();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Limpa eventual conta em cache antes de abrir o fluxo para forçar a tela de seleção de conta
    try {
      await GoogleSignin.signOut();
    } catch {
      // Ignora erro caso não exista sessão prévia
    }

    // Inicia o fluxo nativo oficial do Google (abre o seletor de contas do sistema)
    const signInResult = await GoogleSignin.signIn();

    // Suporte tanto à API antiga quanto ao Credential Manager da v13+
    const idToken = signInResult?.data?.idToken || signInResult?.idToken;

    if (!idToken) {
      throw new Error('Não foi possível obter a credencial de segurança do Google.');
    }

    // Envia o idToken, a intenção (login/register) e a versão dos termos aceitos
    const authResponse = await apiRequest('auth/google', {
      method: 'POST',
      body: {
        idToken,
        intent,
        termsAcceptedVersion,
      },
      timeoutMs: 15000,
    });

    if (authResponse?.token) {
      await saveAuthToken(authResponse.token);
    }

    if (authResponse?.user) {
      const cleanEmail = String(authResponse.user.email || '').toLowerCase().trim();
      const customAvatar = sanitizeAvatarUri(authResponse.user.avatarUrl);
      const baseUser = {
        ...authResponse.user,
        email: cleanEmail,
        name: authResponse.user.fullName || authResponse.user.name || 'Você',
        avatarUri: customAvatar,
        avatarUrl: customAvatar,
        provider: 'google',
      };
      const mergedUser = await saveAuthUser(baseUser, authResponse.token);
      await setRememberedCredentials(cleanEmail, true);
      authResponse.user = mergedUser;
    }

    return {
      user: authResponse.user,
      token: authResponse.token,
      isNewUser: Boolean(authResponse.isNewUser),
    };
  } catch (error) {
    if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
      // Usuário cancelou ou fechou o seletor do Google: não dispara erro ruidoso
      return null;
    } else if (error?.code === statusCodes.IN_PROGRESS) {
      throw new Error('A autenticação com o Google já está em andamento.');
    } else if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('O Google Play Services não está disponível ou está desatualizado neste aparelho.');
    }

    // Se o backend recusou (ex: 409 conta já existe no cadastro, 404 conta não existe no login), limpa cache do Google
    if (error?.status === 409 || error?.status === 404) {
      try {
        await GoogleSignin.signOut();
      } catch {
        // Ignora
      }
      throw error;
    }

    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('internet')) {
      throw new Error('Sem conexão com a internet. Verifique sua rede e tente novamente.');
    }

    const wrapped = new Error(error?.message || 'Falha ao autenticar com o Google. Tente novamente.');
    if (error?.status) wrapped.status = error.status;
    if (error?.data) wrapped.data = error.data;
    if (error?.code) wrapped.code = error.code;
    throw wrapped;
  }
}

