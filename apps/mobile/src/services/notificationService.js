import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CHANNEL_ID = 'finn-smart-alerts';
const LAST_DAILY_PUSH_KEY = '@finn_last_daily_push_date';

// Configura para que as notificações apareçam no topo do celular mesmo com o app aberto
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (e) {
  console.warn('NotificationHandler setup warning:', e?.message);
}

/**
 * Configura canal de alta prioridade no Android e solicita permissão do sistema operacional
 */
export async function initPhoneNotifications() {
  if (Platform.OS === 'web') return false;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Alertas Inteligentes FINN',
        description: 'Notificações sobre movimentação do dinheiro, dicas de economia e lembretes de uso',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 200, 250],
        lightColor: '#7C3AED',
        sound: 'default',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (err) {
    console.warn('Erro ao inicializar permissões de notificação:', err?.message);
    return false;
  }
}

/**
 * Dispara uma notificação imediata na barra de status do celular da pessoa
 */
export async function sendInstantPhoneNotification({ title, body, data = {}, delaySeconds = 1 }) {
  if (Platform.OS === 'web') return null;

  try {
    const hasPermission = await initPhoneNotifications();
    if (!hasPermission) return null;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
        color: '#7C3AED',
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger:
        delaySeconds > 0
          ? {
              type: Notifications.SchedulableTriggerInputTypes
                ? Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL
                : 'timeInterval',
              seconds: Math.max(1, Math.round(delaySeconds)),
              repeats: false,
            }
          : null,
    });
    return id;
  } catch (err) {
    // Fallback com trigger null (imediato) caso o formato de trigger varie na versão nativa
    try {
      return await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
          color: '#7C3AED',
        },
        trigger: null,
      });
    } catch (innerErr) {
      console.warn('Erro ao enviar notificação no celular:', innerErr?.message);
      return null;
    }
  }
}

/**
 * Agenda notificações inteligentes recorrentes no celular da pessoa:
 * 1. Movimento do dinheiro e se deve economizar
 * 2. Lembrete para não esquecer de usar o app
 * 3. Lembrete para atualizar o app e revisar metas
 */
export async function scheduleSmartPhoneNotifications({
  userName = '',
  totalIncome = 0,
  totalExpense = 0,
  totalBalance = 0,
  pendingBillsAmount = 0,
}) {
  if (Platform.OS === 'web') return;

  try {
    const hasPermission = await initPhoneNotifications();
    if (!hasPermission) return;

    const firstName = userName ? userName.trim().split(' ')[0] : '';
    const greet = firstName ? `Olá, ${firstName}! ` : '';

    const formatBRL = (val) =>
      'R$ ' +
      Number(val || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    // Monta mensagem personalizada sobre movimento do dinheiro / economia
    let economyTitle = '💡 Dica Inteligente do FINN';
    let economyBody = `${greet}Acompanhe a movimentação do seu dinheiro hoje e veja onde você pode economizar neste mês.`;

    if (totalIncome > 0 && totalExpense > totalIncome * 0.75) {
      const pct = Math.round((totalExpense / totalIncome) * 100);
      economyTitle = '⚠️ Alerta de Economia FINN';
      economyBody = `${greet}Suas saídas já somam ${formatBRL(totalExpense)} (${pct}% das entradas). Segure gastos variáveis esta semana para fechar no azul!`;
    } else if (totalExpense > 0 && totalIncome === 0) {
      economyTitle = '📊 Movimento do Seu Dinheiro';
      economyBody = `${greet}Você registrou ${formatBRL(totalExpense)} em gastos este mês. Não esqueça de lançar suas entradas e economizar nos supérfluos!`;
    } else if (totalIncome > totalExpense && totalIncome > 0) {
      const saved = totalIncome - totalExpense;
      economyTitle = '🚀 Ótimo Movimento Financeiro!';
      economyBody = `${greet}Você está com saldo positivo de ${formatBRL(saved)} no mês. Que tal separar uma parte no Cofrinho para render mais?`;
    } else if (pendingBillsAmount > 0) {
      economyTitle = '📅 Contas Pendentes no Mês';
      economyBody = `${greet}Você possui ${formatBRL(pendingBillsAmount)} em contas pendentes na agenda. Confira no app para evitar juros!`;
    }

    // Cancela agendamentos antigos para atualizar com os números mais recentes sem duplicar
    await Notifications.cancelAllScheduledNotificationsAsync();

    // 1. Lembrete diário à noite (20:00) para não esquecer de usar o app
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💜 Não se esqueça de usar o FINN hoje!',
          body: `${greet}Gastou algo hoje? Leva só 10 segundos para registrar suas movimentações e manter seu controle em dia.`,
          data: { category: 'reminder', screen: 'Transactions' },
          sound: 'default',
          color: '#7C3AED',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes
            ? Notifications.SchedulableTriggerInputTypes.DAILY
            : 'daily',
          hour: 20,
          minute: 0,
        },
      });
    } catch (e) {}

    // 2. Alerta diário de economia e movimentação do dinheiro (12:30)
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: economyTitle,
          body: economyBody,
          data: { category: 'economy', screen: 'Home' },
          sound: 'default',
          color: '#7C3AED',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes
            ? Notifications.SchedulableTriggerInputTypes.DAILY
            : 'daily',
          hour: 12,
          minute: 30,
        },
      });
    } catch (e) {}

    // 3. Lembrete para manter o app atualizado e conferir novidades (a cada 3 dias / 72h)
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔄 Mantenha seu FINN atualizado!',
          body: 'Verifique se há novas atualizações do aplicativo e aproveite os novos recursos de IA, carteira e faturas.',
          data: { category: 'update', screen: 'Home' },
          sound: 'default',
          color: '#7C3AED',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes
            ? Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL
            : 'timeInterval',
          seconds: 72 * 3600,
          repeats: true,
        },
      });
    } catch (e) {}

    // 4. Dispara 1 notificação inteligente no celular no dia atual (caso ainda não tenha disparado hoje)
    const todayStr = new Date().toISOString().split('T')[0];
    const lastPushDate = await AsyncStorage.getItem(LAST_DAILY_PUSH_KEY);
    if (lastPushDate !== todayStr) {
      await AsyncStorage.setItem(LAST_DAILY_PUSH_KEY, todayStr);
      await sendInstantPhoneNotification({
        title: economyTitle,
        body: economyBody,
        data: { category: 'economy' },
        delaySeconds: 4,
      });
    }
  } catch (err) {
    console.warn('Aviso ao agendar notificações inteligentes:', err?.message);
  }
}

