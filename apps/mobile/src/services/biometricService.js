import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getStoredToken,
  getStoredUser,
  saveAuthToken,
  saveAuthUser,
  getMe,
  mergeWithSavedProfile,
} from './apiService';

const STORAGE_KEYS = {
  BIOMETRIC_ENABLED: '@finn_biometric_enabled_v2',
  SAVED_EMAIL: '@finn_saved_email_v2',
  REMEMBER_ME: '@finn_remember_me_v2',
  BIOMETRIC_USER: '@finn_biometric_user_v2',
  BIOMETRIC_TOKEN: '@finn_biometric_token_v2',
};

/**
 * Verifica se o dispositivo possui sensor de impressão digital (biometria) ativo e cadastrado
 */
export async function checkBiometricSupport() {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return { available: false, enrolled: false, biometricType: 'Digital' };
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const hasFingerprint =
      !Array.isArray(types) ||
      types.length === 0 ||
      types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT) ||
      types.includes(LocalAuthentication.AuthenticationType.BIOMETRIC) ||
      hasHardware;

    return {
      available: Boolean(hasHardware && isEnrolled && hasFingerprint),
      enrolled: Boolean(isEnrolled),
      biometricType: 'Digital',
    };
  } catch (err) {
    console.warn('Erro ao verificar suporte à digital:', err);
    return { available: false, enrolled: false, biometricType: 'Digital' };
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
 * Ativa ou desativa o login por digital persistindo o usuário e o token de sessão
 */
export async function setBiometricLoginEnabled(enabled, user = null, explicitToken = null) {
  try {
    if (enabled) {
      await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, 'true');
      if (user) {
        await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRIC_USER, JSON.stringify(user));
      }
      const tokenToSave = explicitToken || (await getStoredToken());
      if (tokenToSave) {
        await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRIC_TOKEN, tokenToSave);
      }
    } else {
      await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, 'false');
      await AsyncStorage.multiRemove([STORAGE_KEYS.BIOMETRIC_USER, STORAGE_KEYS.BIOMETRIC_TOKEN]);
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
 * Realiza o login direto via digital caso já tenha sido habilitado pelo cliente
 */
export async function performBiometricLogin() {
  const enabled = await isBiometricLoginEnabled();
  if (!enabled) {
    return { success: false, reason: 'Login por digital ainda não habilitado neste aparelho.' };
  }

  const [activeToken, bioToken, storedUserRaw, activeUser] = await Promise.all([
    getStoredToken(),
    AsyncStorage.getItem(STORAGE_KEYS.BIOMETRIC_TOKEN),
    AsyncStorage.getItem(STORAGE_KEYS.BIOMETRIC_USER),
    getStoredUser(),
  ]);

  const token = activeToken || bioToken;
  const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : activeUser;

  if (!storedUser) {
    return { success: false, reason: 'Faça login com sua senha uma primeira vez para ativar a digital.' };
  }

  const authResult = await authenticateWithBiometrics('Coloque sua digital para entrar no FINN');
  if (!authResult.success) {
    return { success: false, reason: 'Leitura da digital cancelada ou não reconhecida.' };
  }

  if (token) {
    await saveAuthToken(token);
    await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRIC_TOKEN, token);
  }

  // Restaura a sessão preservando o perfil salvo pelo cliente
  const mergedLocalUser = await mergeWithSavedProfile(storedUser);
  const savedFinal = await saveAuthUser(mergedLocalUser, token);
  await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRIC_USER, JSON.stringify(savedFinal));

  try {
    const freshUser = await getMe().catch(() => null);
    if (freshUser) {
      const finalUser = await saveAuthUser(
        {
          ...savedFinal,
          ...freshUser,
          firstName: savedFinal?.firstName || freshUser?.firstName,
          lastName:
            savedFinal?.lastName !== undefined ? savedFinal.lastName : freshUser?.lastName,
          fullName: savedFinal?.fullName || freshUser?.fullName,
          name: savedFinal?.fullName || savedFinal?.name || freshUser?.fullName,
          avatarUri:
            savedFinal?.avatarUri !== undefined
              ? savedFinal.avatarUri
              : freshUser?.avatarUri || freshUser?.avatarUrl || null,
        },
        token
      );
      await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRIC_USER, JSON.stringify(finalUser));
      return { success: true, user: finalUser, token };
    }
  } catch {
    // Modo offline resiliente
  }

  return { success: true, user: savedFinal, token };
}

