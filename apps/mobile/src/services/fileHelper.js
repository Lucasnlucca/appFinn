import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Lê arquivo como Base64 de forma segura e universal (compatível com Android content://, file://, iOS e Web).
 * Evita o erro 'FileSystemFile.base64 has been rejected (Missing READ permission)'.
 */
export async function readFileAsBase64(uri) {
  if (!uri) throw new Error('URI do arquivo não informada.');

  // 1. Tentar ler diretamente com FileSystem
  try {
    if (FileSystem && FileSystem.readAsStringAsync) {
      const result = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType?.Base64 || 'base64',
      });
      if (result) return result;
    }
  } catch (e1) {
    // Continua para o fallback de cópia
  }

  // 2. Se for Android content://, copia para cacheDirectory do app e lê
  try {
    if (FileSystem && FileSystem.copyAsync && FileSystem.cacheDirectory) {
      const ext = uri.includes('.') ? uri.split('.').pop()?.split('?')[0] : 'tmp';
      const tempPath = `${FileSystem.cacheDirectory}cached_upload_${Date.now()}.${ext}`;
      await FileSystem.copyAsync({ from: uri, to: tempPath });
      const b64 = await FileSystem.readAsStringAsync(tempPath, {
        encoding: FileSystem.EncodingType?.Base64 || 'base64',
      });
      FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => {});
      if (b64) return b64;
    }
  } catch (e2) {
    // Continua para o fallback via fetch
  }

  // 3. Fallback nativo universal via fetch + FileReader (funciona para URIs locais no React Native)
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          const parts = result.split(',');
          resolve(parts.length > 1 ? parts[1] : parts[0]);
        } else {
          resolve('');
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e3) {
    console.warn('Fallback fetch blob falhou:', e3.message);
  }

  throw new Error('Não foi possível ler o arquivo selecionado.');
}

/**
 * Lê arquivo como texto UTF-8 (para extratos CSV / TXT)
 */
export async function readFileAsText(uri) {
  if (!uri) return '';

  try {
    if (FileSystem && FileSystem.readAsStringAsync) {
      const txt = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType?.UTF8 || 'utf8',
      });
      if (txt) return txt;
    }
  } catch (e1) {}

  try {
    if (FileSystem && FileSystem.copyAsync && FileSystem.cacheDirectory) {
      const tempPath = `${FileSystem.cacheDirectory}cached_txt_${Date.now()}.csv`;
      await FileSystem.copyAsync({ from: uri, to: tempPath });
      const txt = await FileSystem.readAsStringAsync(tempPath, {
        encoding: FileSystem.EncodingType?.UTF8 || 'utf8',
      });
      FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => {});
      if (txt) return txt;
    }
  } catch (e2) {}

  try {
    const res = await fetch(uri);
    return await res.text();
  } catch (e3) {}

  return '';
}
