import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const expenseSoundSource = require('../../assets/expense-sound.m4a');

let expensePlayer = null;
let isAudioModeConfigured = false;

const initPlayer = () => {
  if (!expensePlayer) {
    try {
      expensePlayer = createAudioPlayer(expenseSoundSource);
    } catch (e) {
      console.warn('[SoundService] Falha ao instanciar player:', e);
    }
  }
  return expensePlayer;
};

// Pré-inicializa o player em background
try {
  initPlayer();
} catch (_) {}

/**
 * Toca o som característico ao registrar um valor gasto
 */
export const playExpenseSound = async () => {
  try {
    if (!isAudioModeConfigured) {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
        });
        isAudioModeConfigured = true;
      } catch (_) {}
    }

    let player = expensePlayer || initPlayer();
    if (!player) {
      player = createAudioPlayer(expenseSoundSource);
      expensePlayer = player;
    }

    if (player) {
      try {
        await player.seekTo(0);
      } catch (_) {}
      player.play();
    }
  } catch (error) {
    console.warn('[SoundService] Erro ao reproduzir áudio de despesa:', error);
  }
};

export default {
  playExpenseSound,
};
