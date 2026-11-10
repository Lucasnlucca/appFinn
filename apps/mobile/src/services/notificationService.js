import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
  NotificationTemplates,
  normalizeNotificationCategory,
  sanitizeNotificationText,
} from './notificationTemplates';

const CHANNEL_ID = 'finn-smart-alerts';
const MAX_DAILY_PUSHES = 3;

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  categories: {
    [NOTIFICATION_CATEGORIES.GASTOS]: true,
    [NOTIFICATION_CATEGORIES.IA]: true,
    [NOTIFICATION_CATEGORIES.LEMBRETES]: true,
    [NOTIFICATION_CATEGORIES.SISTEMA]: true,
  },
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  hideAmountsOnLockScreen: false,
  maxDailyPushes: MAX_DAILY_PUSHES,
};

const getPrefsStorageKey = (userId = 'guest') =>
  `@finn_usr_${String(userId || 'guest').trim()}_notification_prefs_v1`;

const getPushLogStorageKey = (userId = 'guest') =>
  `@finn_usr_${String(userId || 'guest').trim()}_push_dispatch_log_v1`;

// Configura handler para exibir banner mesmo com o app em primeiro plano
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
  // Ambiente de testes ou web sem módulo nativo
}

/**
 * Converte horário "HH:MM" ou número de hora (0-23) em minutos desde 00:00
 */
export function parseTimeToMinutes(timeValue, fallbackHour = 0) {
  if (typeof timeValue === 'number' && Number.isFinite(timeValue)) {
    return Math.max(0, Math.min(23, Math.floor(timeValue))) * 60;
  }
  const str = String(timeValue || '').trim();
  const match = str.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) return fallbackHour * 60;
  const h = Math.max(0, Math.min(23, parseInt(match[1], 10)));
  const m = Math.max(0, Math.min(59, parseInt(match[2] || '0', 10)));
  return h * 60 + m;
}

/**
 * Verifica se o horário informado está dentro da janela de silêncio (padrão 22:00 às 08:00)
 */
export function isWithinQuietHours(dateInput = new Date(), preferences = DEFAULT_NOTIFICATION_PREFERENCES) {
  const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(preferences || {}) };
  if (!prefs.quietHoursEnabled) return false;

  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return false;

  const currentMinutes = d.getHours() * 60 + d.getMinutes();
  const startMinutes = parseTimeToMinutes(prefs.quietHoursStart, 22);
  const endMinutes = parseTimeToMinutes(prefs.quietHoursEnd, 8);

  if (startMinutes === endMinutes) return false;

  // Janela que cruza a meia-noite (ex.: 22:00 até 08:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  // Janela no mesmo dia (ex.: 01:00 até 07:00)
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Verifica se uma notificação é crítica (conta vencendo hoje ou saldo negativo)
 * Alertas críticos têm permissão para furar o horário de silêncio.
 */
export function isCriticalNotification(notification) {
  if (!notification || typeof notification !== 'object') return false;
  if (notification.priority === NOTIFICATION_PRIORITIES.CRITICAL) return true;
  const criticalTypes = new Set(['bill_due_today', 'negative_balance', 'negative_projection']);
  return criticalTypes.has(notification.type);
}

/**
 * Gera a chave de deduplicação diária (tipo + referência + dia)
 */
export function buildDedupeKey(notification, now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  const dayKey = Number.isNaN(d.getTime())
    ? new Date().toISOString().slice(0, 10)
    : d.toISOString().slice(0, 10);

  if (notification?.dedupeKey) {
    return String(notification.dedupeKey);
  }
  const type = sanitizeNotificationText(notification?.type, 'generic');
  const ref = sanitizeNotificationText(notification?.id || notification?.title, 'default');
  return `${type}:${ref}:${dayKey}`;
}

/**
 * Aplica a regra de privacidade ("ocultar valores na tela bloqueada")
 * substituindo valores monetários por texto genérico seguro no push.
 */
export function formatPushPayloadForPrivacy(
  notification,
  preferences = DEFAULT_NOTIFICATION_PREFERENCES
) {
  const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(preferences || {}) };
  const safeTitle = sanitizeNotificationText(notification?.title, 'Notificação FINN', {
    stripEmojis: true,
  });
  const safeBody = sanitizeNotificationText(
    notification?.body || notification?.message,
    'Abra o aplicativo FINN para visualizar os detalhes.'
  );

  if (!prefs.hideAmountsOnLockScreen) {
    return {
      title: safeTitle,
      body: safeBody,
    };
  }

  const cat = normalizeNotificationCategory(notification?.category);
  const defaultGenericTitle =
    cat === NOTIFICATION_CATEGORIES.GASTOS
      ? notification?.type === 'transaction_income'
        ? 'Nova receita registrada'
        : 'Novo gasto registrado'
      : cat === NOTIFICATION_CATEGORIES.IA
      ? 'Novo insight da FINN IA'
      : cat === NOTIFICATION_CATEGORIES.LEMBRETES
      ? 'Lembrete financeiro FINN'
      : 'Atualização no FINN';

  const genericTitle = sanitizeNotificationText(
    notification?.lockScreenTitle,
    defaultGenericTitle,
    { stripEmojis: true }
  ).replace(/-?R\$\s*[\d.,]+/gi, 'valor oculto');

  const genericBody = sanitizeNotificationText(
    notification?.lockScreenBody,
    'Abra o aplicativo FINN para conferir os valores com privacidade.'
  ).replace(/-?R\$\s*[\d.,]+/gi, 'valor oculto');

  return {
    title: genericTitle,
    body: genericBody,
  };
}

/**
 * Agrupa múltiplos insights da IA do mesmo ciclo em uma única notificação consolidada
 * para evitar disparar um push por evento e preservar o limite diário.
 */
export function groupInsightsNotifications(notifications = []) {
  if (!Array.isArray(notifications) || notifications.length <= 1) {
    return notifications || [];
  }

  const insightItems = notifications.filter(
    (n) => normalizeNotificationCategory(n?.category) === NOTIFICATION_CATEGORIES.IA && !n?.isHeroAi
  );
  if (insightItems.length <= 1) {
    return notifications;
  }

  const firstInsight = insightItems[0];
  const combinedTitles = insightItems
    .slice(0, 2)
    .map((i) => sanitizeNotificationText(i.title, 'Insight'))
    .join(' • ');

  const groupedInsight = NotificationTemplates.aiWeeklySummary({
    id: `ai-grouped-${firstInsight.id || Date.now()}`,
    createdAt: firstInsight.createdAt,
    time: firstInsight.time || 'Agora',
  });
  groupedInsight.title = `${insightItems.length} novos insights da FINN IA`;
  groupedInsight.body = `${combinedTitles}. Toque para ver a análise completa.`;
  groupedInsight.dedupeKey = `ai_grouped_insights:${insightItems.length}:${new Date().toISOString().slice(0, 10)}`;

  const result = [];
  let insertedGroup = false;
  for (const item of notifications) {
    const isNonHeroIa =
      normalizeNotificationCategory(item?.category) === NOTIFICATION_CATEGORIES.IA && !item?.isHeroAi;
    if (isNonHeroIa) {
      if (!insertedGroup) {
        result.push(groupedInsight);
        insertedGroup = true;
      }
    } else {
      result.push(item);
    }
  }
  return result;
}

/**
 * Avalia todas as regras de envio (Etapa 2):
 * 1. Preferência da categoria ativa
 * 2. Deduplicação por tipo + referência + dia
 * 3. Horário de silêncio (22h às 8h), exceto alertas críticos
 * 4. Limite máximo de 3 pushes por dia
 */
export function canSendPushNotification(
  notification,
  {
    preferences = DEFAULT_NOTIFICATION_PREFERENCES,
    pushLog = { dailyCounts: {}, sentKeys: [] },
    now = new Date(),
  } = {}
) {
  if (!notification || typeof notification !== 'object') {
    return { allowed: false, reason: 'invalid_notification' };
  }

  const prefs = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(preferences || {}),
    categories: {
      ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
      ...(preferences?.categories || {}),
    },
  };

  const category = normalizeNotificationCategory(notification.category);
  if (prefs.categories[category] === false) {
    return { allowed: false, reason: 'category_disabled' };
  }

  const d = now instanceof Date ? now : new Date(now);
  const dayKey = Number.isNaN(d.getTime())
    ? new Date().toISOString().slice(0, 10)
    : d.toISOString().slice(0, 10);

  const dedupeKey = buildDedupeKey(notification, d);
  const sentKeys = Array.isArray(pushLog?.sentKeys) ? pushLog.sentKeys : [];
  if (sentKeys.includes(dedupeKey)) {
    return { allowed: false, reason: 'duplicate', dedupeKey };
  }

  const critical = isCriticalNotification(notification);
  if (!critical && isWithinQuietHours(d, prefs)) {
    return { allowed: false, reason: 'quiet_hours', dedupeKey };
  }

  const maxDaily = Number(prefs.maxDailyPushes) > 0 ? Number(prefs.maxDailyPushes) : MAX_DAILY_PUSHES;
  const currentDailyCount = Number(pushLog?.dailyCounts?.[dayKey] || 0);
  if (currentDailyCount >= maxDaily) {
    return { allowed: false, reason: 'daily_limit_reached', dedupeKey };
  }

  return {
    allowed: true,
    reason: 'ok',
    dedupeKey,
    dayKey,
  };
}

/**
 * Carrega as preferências de notificação salvas para o usuário
 */
export async function loadUserNotificationPreferences(userId = 'guest') {
  try {
    const raw = await AsyncStorage.getItem(getPrefsStorageKey(userId));
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...parsed,
      categories: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
        ...(parsed?.categories || {}),
      },
    };
  } catch (e) {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}

/**
 * Salva as preferências de notificação do usuário
 */
export async function saveUserNotificationPreferences(userId = 'guest', preferences = {}) {
  const merged = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(preferences || {}),
    categories: {
      ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
      ...(preferences?.categories || {}),
    },
  };
  try {
    await AsyncStorage.setItem(getPrefsStorageKey(userId), JSON.stringify(merged));
  } catch (e) {
    console.warn('Erro ao salvar preferências de notificação:', e?.message);
  }
  return merged;
}

async function loadPushDispatchLog(userId = 'guest') {
  try {
    const raw = await AsyncStorage.getItem(getPushLogStorageKey(userId));
    if (!raw) return { dailyCounts: {}, sentKeys: [] };
    const parsed = JSON.parse(raw);
    return {
      dailyCounts: parsed?.dailyCounts || {},
      sentKeys: Array.isArray(parsed?.sentKeys) ? parsed.sentKeys.slice(-200) : [],
    };
  } catch (e) {
    return { dailyCounts: {}, sentKeys: [] };
  }
}

async function recordPushDispatched(userId = 'guest', { dayKey, dedupeKey }) {
  try {
    const log = await loadPushDispatchLog(userId);
    const nextCounts = { ...(log.dailyCounts || {}) };
    nextCounts[dayKey] = Number(nextCounts[dayKey] || 0) + 1;

    // Mantém apenas os últimos 14 dias de contadores e últimas 200 chaves de deduplicação
    const recentDays = Object.keys(nextCounts).sort().slice(-14);
    const prunedCounts = {};
    for (const k of recentDays) prunedCounts[k] = nextCounts[k];

    const nextKeys = Array.from(new Set([...(log.sentKeys || []), dedupeKey])).slice(-200);
    await AsyncStorage.setItem(
      getPushLogStorageKey(userId),
      JSON.stringify({ dailyCounts: prunedCounts, sentKeys: nextKeys })
    );
  } catch (e) {
    // silencioso
  }
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
        lightColor: '#5B21B6',
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
 * Dispara uma notificação imediata na barra de status do celular respeitando:
 * - Preferências por categoria
 * - Deduplicação diária (tipo + referência + dia)
 * - Horário de silêncio (22h-8h, exceto alertas críticos)
 * - Limite máximo de 3 pushes por dia
 * - Privacidade na tela bloqueada (ocultar valores)
 */
export async function sendInstantPhoneNotification({
  notification,
  title,
  body,
  data = {},
  delaySeconds = 1,
  userId = 'guest',
  preferences = null,
}) {
  if (Platform.OS === 'web') return null;

  try {
    const prefs = preferences || (await loadUserNotificationPreferences(userId));
    const pushLog = await loadPushDispatchLog(userId);

    const model =
      notification ||
      NotificationTemplates.systemFeatureNews({
        title: title || 'Notificação FINN',
        body: body || 'Confira as novidades no seu painel financeiro.',
        targetScreen: data?.screen || 'Home',
      });

    if (data?.category) {
      model.category = normalizeNotificationCategory(data.category);
    }

    const check = canSendPushNotification(model, {
      preferences: prefs,
      pushLog,
      now: new Date(),
    });

    if (!check.allowed) {
      return null;
    }

    const hasPermission = await initPhoneNotifications();
    if (!hasPermission) return null;

    const payload = formatPushPayloadForPrivacy(model, prefs);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: payload.title,
        body: payload.body,
        data: {
          ...data,
          notificationId: model.id,
          type: model.type,
          category: model.category,
          targetScreen: model.targetScreen,
        },
        sound: 'default',
        color: '#5B21B6',
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

    await recordPushDispatched(userId, {
      dayKey: check.dayKey,
      dedupeKey: check.dedupeKey,
    });

    return id;
  } catch (err) {
    return null;
  }
}

/**
 * Agenda notificações recorrentes no celular respeitando as preferências do usuário,
 * horário de silêncio (agendando apenas em horários diurnos permitidos: 12:30 e 20:00)
 * e privacidade na tela bloqueada.
 */
export async function scheduleSmartPhoneNotifications({
  userId = 'guest',
  userName = '',
  totalIncome = 0,
  totalExpense = 0,
  totalBalance = 0,
  pendingBillsAmount = 0,
  hasRecordedToday = false,
  preferences = null,
}) {
  if (Platform.OS === 'web') return;

  try {
    const prefs = preferences || (await loadUserNotificationPreferences(userId));
    const hasPermission = await initPhoneNotifications();
    if (!hasPermission) return;

    await Notifications.cancelAllScheduledNotificationsAsync();

    // 1. Lembrete diário às 20:00 (fora do horário de silêncio 22h-8h)
    // Só agenda se a categoria 'lembretes' estiver ativa e o usuário ainda não registrou hoje
    if (prefs.categories?.[NOTIFICATION_CATEGORIES.LEMBRETES] !== false && !hasRecordedToday) {
      const reminderNotif = NotificationTemplates.dailyRegisterReminder();
      const reminderPayload = formatPushPayloadForPrivacy(reminderNotif, prefs);
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: reminderPayload.title,
            body: reminderPayload.body,
            data: { category: NOTIFICATION_CATEGORIES.LEMBRETES, screen: 'FinnAI' },
            sound: 'default',
            color: '#5B21B6',
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
    }

    // 2. Insight diário da IA às 12:30 (respeitando preferência de IA e limite diário)
    if (prefs.categories?.[NOTIFICATION_CATEGORIES.IA] !== false) {
      const savedPct =
        totalIncome > 0
          ? Math.max(0, Math.round(((totalIncome - totalExpense) / totalIncome) * 100))
          : 100;
      const aiNotif = NotificationTemplates.aiSavingsOpportunity({
        savedPercent: savedPct,
        freeBalance: Math.max(0, totalBalance),
      });
      const aiPayload = formatPushPayloadForPrivacy(aiNotif, prefs);

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: aiPayload.title,
            body: aiPayload.body,
            data: { category: NOTIFICATION_CATEGORIES.IA, screen: 'Planning' },
            sound: 'default',
            color: '#5B21B6',
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

      // Dispara no máximo 1 insight no dia atual via motor central de regras (deduplicado + limite de 3/dia + horário de silêncio)
      await sendInstantPhoneNotification({
        notification: aiNotif,
        userId,
        preferences: prefs,
        delaySeconds: 4,
      });
    }

    // 3. Alerta de contas pendentes caso haja contas vencendo
    if (pendingBillsAmount > 0 && prefs.categories?.[NOTIFICATION_CATEGORIES.LEMBRETES] !== false) {
      const billNotif = NotificationTemplates.billDueAlert({
        billTitle: 'Contas do mês',
        amount: pendingBillsAmount,
        daysUntilDue: 3,
      });
      await sendInstantPhoneNotification({
        notification: billNotif,
        userId,
        preferences: prefs,
        delaySeconds: 6,
      });
    }
  } catch (err) {
    console.warn('Aviso ao agendar notificações inteligentes:', err?.message);
  }
}
