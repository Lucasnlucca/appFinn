import { Platform } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { apiRequest, saveAuthToken, saveAuthUser, setRememberedCredentials } from './apiService';

// Web Client ID oficial do Google Cloud Console ("Web application")
export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '633573458015-t6vg6msh5goa9aehacg6pcgct6519l56.apps.googleusercontent.com';

let isConfigured = false;

export function configureGoogleSignIn() {
  if (isConfigured) return;
  try {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: false,
      scopes: ['profile', 'email'],
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
 * @returns {Promise<{ user: any, token: string, isNewUser: boolean } | null>} Retorna null se cancelado pelo usuário
 */
export async function performOfficialGoogleSignIn({ termsAcceptedVersion = '1.0' } = {}) {
  configureGoogleSignIn();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    
    // Inicia o fluxo nativo oficial do Google (abre o seletor de contas do sistema)
    const signInResult = await GoogleSignin.signIn();
    
    // Suporte tanto à API antiga quanto ao Credential Manager da v13+
    const idToken = signInResult?.data?.idToken || signInResult?.idToken;

    if (!idToken) {
      throw new Error('Não foi possível obter a credencial de segurança do Google.');
    }

    // Envia EXCLUSIVAMENTE o idToken e a versão dos termos aceitos
    const authResponse = await apiRequest('auth/google', {
      method: 'POST',
      body: {
        idToken,
        termsAcceptedVersion,
      },
      timeoutMs: 15000,
    });

    if (authResponse?.token) {
      await saveAuthToken(authResponse.token);
    }

    if (authResponse?.user) {
      const cleanEmail = String(authResponse.user.email || '').toLowerCase().trim();
      const baseUser = {
        ...authResponse.user,
        email: cleanEmail,
        name: authResponse.user.fullName || authResponse.user.name || 'Você',
        avatarUri: authResponse.user.avatarUrl || null,
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
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      // Usuário cancelou ou fechou o seletor do Google: não dispara erro ruidoso
      return null;
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error('A autenticação com o Google já está em andamento.');
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('O Google Play Services não está disponível ou está desatualizado neste aparelho.');
    }

    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('internet')) {
      throw new Error('Sem conexão com a internet. Verifique sua rede e tente novamente.');
    }

    throw new Error(error?.message || 'Falha ao autenticar com o Google. Tente novamente.');
  }
}

