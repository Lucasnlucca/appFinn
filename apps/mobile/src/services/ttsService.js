import * as FileSystem from 'expo-file-system/legacy';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import { getGeminiApiKey } from './geminiService';

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToUint8Array(b64) {
  const clean = String(b64 || '').replace(/[^A-Za-z0-9+/]/g, '');
  const len = clean.length;
  const outLen = Math.floor((len * 3) / 4);
  const bytes = new Uint8Array(outLen);
  let p = 0;

  for (let i = 0; i < len; i += 4) {
    const enc1 = BASE64_CHARS.indexOf(clean.charAt(i));
    const enc2 = BASE64_CHARS.indexOf(clean.charAt(i + 1));
    const enc3 = i + 2 < len ? BASE64_CHARS.indexOf(clean.charAt(i + 2)) : 64;
    const enc4 = i + 3 < len ? BASE64_CHARS.indexOf(clean.charAt(i + 3)) : 64;

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    if (p < outLen) bytes[p++] = chr1;
    if (enc3 !== 64 && enc3 !== -1 && p < outLen) bytes[p++] = chr2;
    if (enc4 !== 64 && enc4 !== -1 && p < outLen) bytes[p++] = chr3;
  }
  return bytes;
}

function uint8ArrayToBase64(bytes) {
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;

    const triplet = (b1 << 16) | (b2 << 8) | b3;
    result += BASE64_CHARS[(triplet >> 18) & 0x3f];
    result += BASE64_CHARS[(triplet >> 12) & 0x3f];
    result += i + 1 < len ? BASE64_CHARS[(triplet >> 6) & 0x3f] : '=';
    result += i + 2 < len ? BASE64_CHARS[triplet & 0x3f] : '=';
  }
  return result;
}

function wrapPcm16InWavBase64(pcmBase64, sampleRate = 24000) {
  const pcmBytes = base64ToUint8Array(pcmBase64);
  const dataSize = pcmBytes.length;
  const wavBytes = new Uint8Array(44 + dataSize);
  const view = new DataView(wavBytes.buffer);

  // "RIFF"
  wavBytes[0] = 0x52;
  wavBytes[1] = 0x49;
  wavBytes[2] = 0x46;
  wavBytes[3] = 0x46;
  view.setUint32(4, 36 + dataSize, true);
  // "WAVE"
  wavBytes[8] = 0x57;
  wavBytes[9] = 0x41;
  wavBytes[10] = 0x56;
  wavBytes[11] = 0x45;
  // "fmt "
  wavBytes[12] = 0x66;
  wavBytes[13] = 0x6d;
  wavBytes[14] = 0x74;
  wavBytes[15] = 0x20;
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // AudioFormat = 1 (PCM)
  view.setUint16(22, 1, true); // Channels = 1 (mono)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  // "data"
  wavBytes[36] = 0x64;
  wavBytes[37] = 0x61;
  wavBytes[38] = 0x74;
  wavBytes[39] = 0x61;
  view.setUint32(40, dataSize, true);

  wavBytes.set(pcmBytes, 44);
  return uint8ArrayToBase64(wavBytes);
}

let currentPlayer = null;
let currentPollTimer = null;
const cachedWavUris = new Map();

export function stopFinnVoice() {
  if (currentPollTimer) {
    clearInterval(currentPollTimer);
    currentPollTimer = null;
  }
  if (currentPlayer) {
    try {
      currentPlayer.pause();
      currentPlayer.remove?.();
    } catch {}
    currentPlayer = null;
  }
  try {
    Speech.stop();
  } catch {}
}

/**
 * Reproduz a resposta do FINN usando a voz neural masculina gratuita (Puck - Gemini 2.5 Flash TTS)
 */
export async function speakWithFinnNeuralVoice({
  id,
  text,
  onStart,
  onDone,
  onError,
}) {
  stopFinnVoice();

  const cleanText = String(text || '')
    .replace(/\[(TRANSACTION|ASK_PAYMENT_METHOD|ASK_CARD):[\s\S]*?\]/gi, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/🎙️\s*Você disse:\s*".*?"/gi, '')
    .replace(/[🍔🎬📚🏷️🎮🏠📦🐾🎁💰💊🚕🚗👕✈️🎯✨⚡📌•#—\(\)]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1600);

  if (!cleanText) {
    onDone?.();
    return;
  }

  try {
    let wavUri = id ? cachedWavUris.get(id) : null;

    if (!wavUri) {
      const apiKey = await getGeminiApiKey();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Leia em português do Brasil com tom natural, amigável e fluido: ${cleanText}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: 'Puck', // Voz masculina neural realista
                },
              },
            },
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const pcmBase64 = inlineData?.data;
      if (!pcmBase64) throw new Error('Sem dados de áudio neural');

      const rateMatch = String(inlineData?.mimeType || '').match(/rate=(\d+)/i);
      const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
      const wavBase64 = wrapPcm16InWavBase64(pcmBase64, sampleRate);

      const filePath = `${FileSystem.cacheDirectory}finn_neural_voice_${id || Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(filePath, wavBase64, {
        encoding: FileSystem.EncodingType?.Base64 || 'base64',
      });
      wavUri = filePath;
      if (id) cachedWavUris.set(id, wavUri);
    }

    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    }).catch(() => {});

    const player = createAudioPlayer(wavUri);
    currentPlayer = player;
    onStart?.();
    player.play();

    let started = false;
    const startTs = Date.now();
    currentPollTimer = setInterval(() => {
      if (currentPlayer !== player) {
        clearInterval(currentPollTimer);
        currentPollTimer = null;
        return;
      }
      if (player.playing) {
        started = true;
      } else if (started || Date.now() - startTs > 4000) {
        clearInterval(currentPollTimer);
        currentPollTimer = null;
        try {
          player.remove?.();
        } catch {}
        currentPlayer = null;
        onDone?.();
      }
    }, 250);
  } catch {
    // Fallback offline para sintetizador do aparelho
    onStart?.();
    Speech.speak(cleanText, {
      language: 'pt-BR',
      rate: 1.05,
      pitch: 0.96,
      onDone: () => onDone?.(),
      onStopped: () => onDone?.(),
      onError: () => (onError ? onError() : onDone?.()),
    });
  }
}
