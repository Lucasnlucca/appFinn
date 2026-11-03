import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStoredToken, getStoredUser, saveAuthToken, saveAuthUser, getMe } from './apiService';

const STORAGE_KEYS = {
  BIOMETRIC_ENABLED: '@finn_biometric_enabled_v2',
  SAVED_EMAIL: '@finn_saved_email_v2',
  REMEMBER_ME: '@finn_remember_me_v2',
  BIOMETRIC_USER: '@finn_biometric_user_v2',
};

/**
 * Verifica se o dispositivo possui hardware de biometria e se há digitais cadastradas
 */
export async function checkBiometricSupport() {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return { available: false, enrolled: false, biometricType: 'Nenhum' };
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let biometricType = 'Biometria';
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      biometricType = 'FaceID';
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      biometricType = 'Digital';
    }

    return {
      available: hasHardware && isEnrolled,
      enrolled: isEnrolled,
      biometricType,
    };
  } catch (err) {
    console.warn('Erro ao verificar suporte à biometria:', err);
    return { available: false, enrolled: false, biometricType: 'Biometria' };
  }
}

/**
 * Verifica se o usuário ativou o login por digital
 */
export async function isBiometricLoginEnabled() {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
    return val === 'true';
  } catch {
    return false;
  }
}

/**
 * Ativa ou desativa o login por digital
 */
export async function setBiometricLoginEnabled(enabled, user = null) {
  try {
    if (enabled) {
      await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, 'true');
      if (user) {
        await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRIC_USER, JSON.stringify(user));
      }
    } else {
      await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, 'false');
      await AsyncStorage.removeItem(STORAGE_KEYS.BIOMETRIC_USER);
    }
  } catch (e) {
    console.warn('Erro ao atualizar configuração de biometria:', e);
  }
}

/**
 * Lembrar de mim (e-mail pré-preenchido)
 */
export async function getRememberedCredentials() {
  try {
    const [savedEmail, rememberMe] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.SAVED_EMAIL),
      AsyncStorage.getItem(STORAGE_KEYS.REMEMBER_ME),
    ]);
    return {
      email: savedEmail || '',
      rememberMe: rememberMe === 'true',
    };
  } catch {
    return { email: '', rememberMe: false };
  }
}

export async function setRememberedCredentials(email, rememberMe) {
  try {
    if (rememberMe) {
      await AsyncStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'true');
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_EMAIL, email || '');
    } else {
      await AsyncStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'false');
      await AsyncStorage.removeItem(STORAGE_KEYS.SAVED_EMAIL);
    }
  } catch (e) {
    console.warn('Erro ao salvar credenciais para lembrar:', e);
  }
}

/**
 * Executa o prompt de autenticação biométrica nativa (Digital / FaceID)
 */
export async function authenticateWithBiometrics(promptMessage = 'Toque no sensor para acessar o FINN') {
  try {
    const support = await checkBiometricSupport();
    if (!support.available) {
      return { success: false, reason: 'Biometria não disponível ou sem digitais cadastradas no aparelho.' };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Usar Senha',
      fallbackLabel: 'Usar Senha',
      disableDeviceFallback: false,
    });

    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Realiza o login direto via biometria caso já tenha logado uma primeira vez
 */
export async function performBiometricLogin() {
  const enabled = await isBiometricLoginEnabled();
  if (!enabled) {
    return { success: false, reason: 'Biometria não habilitada neste dispositivo.' };
  }

  const token = await getStoredToken();
  const storedUserRaw = await AsyncStorage.getItem(STORAGE_KEYS.BIOMETRIC_USER);
  const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : await getStoredUser();

  if (!token || !storedUser) {
    return { success: false, reason: 'Faça login com sua senha uma primeira vez para ativar a digital.' };
  }

  const authResult = await authenticateWithBiometrics('Confirme sua digital para acessar o FINN');
  if (!authResult.success) {
    return { success: false, reason: 'Autenticação biométrica cancelada ou não reconhecida.' };
  }

  // Tenta validar a sessão com a API da VPS de forma não-bloqueante
  try {
    const freshUser = await getMe().catch(() => storedUser);
    if (freshUser) {
      await saveAuthUser(freshUser);
      return { success: true, user: freshUser, token };
    }
  } catch {
    // Modo offline resiliente: se a rede falhar, aceita a credencial segura já autenticada localmente
  }

  return { success: true, user: storedUser, token };
}

