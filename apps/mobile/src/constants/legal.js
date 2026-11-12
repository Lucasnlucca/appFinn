import { Alert, Linking } from 'react-native';

export const LEGAL_URLS = {
  HOME: 'https://lucasnlucca.github.io/appFinn/',
  PRIVACY_POLICY: 'https://lucasnlucca.github.io/appFinn/privacidade.html',
  TERMS_OF_USE: 'https://lucasnlucca.github.io/appFinn/termos.html',
  SUPPORT_EMAIL: 'lucasg.nunes19@gmail.com',
};

/**
 * Abre uma URL legal pública (Política de Privacidade ou Termos de Uso) no navegador do sistema.
 */
export async function openLegalUrl(url) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Link indisponível', `Acesse pelo navegador: ${url}`);
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('Erro ao abrir link', `Acesse manualmente pelo navegador: ${url}`);
  }
}

