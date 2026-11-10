import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface NotificationPreferencePayload {
  categories?: {
    gastos?: boolean;
    ia?: boolean;
    lembretes?: boolean;
    sistema?: boolean;
  };
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  hideAmountsOnLockScreen?: boolean;
  maxDailyPushes?: number;
}

export const DEFAULT_DB_NOTIFICATION_PREFS: Required<NotificationPreferencePayload> = {
  categories: {
    gastos: true,
    ia: true,
    lembretes: true,
    sistema: true,
  },
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  hideAmountsOnLockScreen: false,
  maxDailyPushes: 3,
};

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Garante automaticamente a criação/evolução das tabelas de notificações,
   * preferências e tokens de push diretamente no PostgreSQL existente ao iniciar a API.
   */
  async onModuleInit() {
    try {
      // 1. Garante colunas extras na tabela notifications existente
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'ALERT',
          is_read BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE notifications
          ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'sistema',
          ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
          ADD COLUMN IF NOT EXISTS action_json JSONB,
          ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
          ADD COLUMN IF NOT EXISTS metadata_json JSONB;
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_notifications_user_dedupe
          ON notifications (user_id, dedupe_key);
      `);

      // 2. Cria tabela dedicada de preferências de notificação por usuário no PostgreSQL
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS user_notification_preferences (
          user_id TEXT PRIMARY KEY,
          gastos_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          ia_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          lembretes_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          sistema_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          quiet_hours_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          quiet_hours_start TEXT NOT NULL DEFAULT '22:00',
          quiet_hours_end TEXT NOT NULL DEFAULT '08:00',
          hide_amounts_on_lock_screen BOOLEAN NOT NULL DEFAULT FALSE,
          max_daily_pushes INTEGER NOT NULL DEFAULT 3,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // 3. Cria tabela dedicada de tokens de Push (Expo / FCM / APNs) por usuário no PostgreSQL
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS user_push_tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          push_token TEXT NOT NULL UNIQUE,
          platform TEXT NOT NULL DEFAULT 'android',
          device_name TEXT,
          last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id
          ON user_push_tokens (user_id);
      `);

      this.logger.log(
        'PostgreSQL notification tables (notifications, user_notification_preferences, user_push_tokens) verified/created.'
      );
    } catch (error: any) {
      this.logger.warn(
        `Could not auto-migrate notification tables on startup: ${error?.message || error}`
      );
    }
  }

  /**
   * Lista as notificações salvas no PostgreSQL para o usuário autenticado
   */
  async listUserNotifications(userId: string, limit = 50) {
    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT
          id,
          user_id AS "userId",
          title,
          message,
          type,
          is_read AS "isRead",
          category,
          priority,
          action_json AS "action",
          dedupe_key AS "dedupeKey",
          metadata_json AS "meta",
          created_at AS "createdAt"
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        `,
        userId,
        Math.min(Math.max(Number(limit) || 50, 1), 100)
      );

      return (rows || []).map((r) => ({
        id: r.id,
        userId: r.userId,
        title: r.title,
        body: r.message,
        message: r.message,
        type: r.type,
        category: r.category || 'sistema',
        priority: r.priority || 'normal',
        action: r.action || null,
        targetScreen: r.action?.targetScreen || null,
        dedupeKey: r.dedupeKey || null,
        meta: r.meta || {},
        read: Boolean(r.isRead),
        isRead: Boolean(r.isRead),
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      }));
    } catch (error) {
      // Fallback para o model padrão do Prisma caso as colunas extras ainda não existam
      const fallback = await this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return fallback.map((n) => ({
        id: n.id,
        userId: n.userId,
        title: n.title,
        body: n.message,
        message: n.message,
        type: n.type,
        category: 'sistema',
        priority: 'normal',
        read: n.isRead,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      }));
    }
  }

  /**
   * Cria ou atualiza (com deduplicação por dedupeKey) uma notificação no PostgreSQL
   */
  async createOrUpsertNotification(
    userId: string,
    payload: {
      id?: string;
      title: string;
      body?: string;
      message?: string;
      type?: string;
      category?: string;
      priority?: string;
      action?: any;
      dedupeKey?: string;
      meta?: any;
      read?: boolean;
      sendPush?: boolean;
    }
  ) {
    const cleanTitle = String(payload.title || 'Notificação FINN')
      .replace(/\b(?:undefined|null)\b/gi, '')
      .trim() || 'Notificação FINN';
    const cleanBody = String(payload.body || payload.message || 'Confira os detalhes no aplicativo.')
      .replace(/\b(?:undefined|null)\b/gi, '')
      .trim() || 'Confira os detalhes no aplicativo.';
    const type = String(payload.type || 'ALERT');
    const category = String(payload.category || 'sistema');
    const priority = String(payload.priority || 'normal');
    const dedupeKey =
      payload.dedupeKey || `${type}:${cleanTitle}:${new Date().toISOString().slice(0, 10)}`;
    const isRead = Boolean(payload.read);

    try {
      const existing = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, is_read AS "isRead", created_at AS "createdAt" FROM notifications WHERE user_id = $1 AND dedupe_key = $2 LIMIT 1`,
        userId,
        dedupeKey
      );

      if (existing && existing.length > 0) {
        return {
          id: existing[0].id,
          userId,
          title: cleanTitle,
          body: cleanBody,
          message: cleanBody,
          type,
          category,
          priority,
          dedupeKey,
          read: Boolean(existing[0].isRead),
          createdAt: new Date(existing[0].createdAt).toISOString(),
          deduplicated: true,
        };
      }

      const created = await this.prisma.notification.create({
        data: {
          userId,
          title: cleanTitle,
          message: cleanBody,
          type,
          isRead,
        },
      });

      await this.prisma.$executeRawUnsafe(
        `
        UPDATE notifications
        SET category = $1,
            priority = $2,
            action_json = $3::jsonb,
            dedupe_key = $4,
            metadata_json = $5::jsonb
        WHERE id = $6
        `,
        category,
        priority,
        JSON.stringify(payload.action || null),
        dedupeKey,
        JSON.stringify(payload.meta || {}),
        created.id
      );

      if (payload.sendPush) {
        await this.dispatchRemotePushToUser(userId, {
          title: cleanTitle,
          body: cleanBody,
          category,
          priority,
          data: {
            notificationId: created.id,
            type,
            category,
            targetScreen: payload.action?.targetScreen || null,
          },
        });
      }

      return {
        id: created.id,
        userId,
        title: cleanTitle,
        body: cleanBody,
        message: cleanBody,
        type,
        category,
        priority,
        action: payload.action || null,
        dedupeKey,
        read: created.isRead,
        createdAt: created.createdAt.toISOString(),
      };
    } catch (error) {
      const fallback = await this.prisma.notification.create({
        data: {
          userId,
          title: cleanTitle,
          message: cleanBody,
          type,
          isRead,
        },
      });
      return {
        id: fallback.id,
        userId,
        title: fallback.title,
        body: fallback.message,
        message: fallback.message,
        type: fallback.type,
        category,
        priority,
        read: fallback.isRead,
        createdAt: fallback.createdAt.toISOString(),
      };
    }
  }

  /**
   * Marca uma notificação específica como lida no PostgreSQL
   */
  async markAsRead(userId: string, notificationId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
    return { success: true, id: notificationId };
  }

  /**
   * Marca todas as notificações do usuário como lidas no PostgreSQL
   */
  async markAllAsRead(userId: string, ids?: string[]) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    if (Array.isArray(ids) && ids.length > 0) {
      await this.prisma.aiPreference.upsert({
        where: { userId_key: { userId, key: 'read_notification_ids' } },
        update: { valueJson: ids },
        create: {
          userId,
          key: 'read_notification_ids',
          valueJson: ids,
          description: 'IDs de notificações marcadas como lidas pelo usuário',
        },
      });
    }

    return { success: true };
  }

  /**
   * Busca as preferências de notificação do usuário no PostgreSQL
   */
  async getPreferences(userId: string) {
    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM user_notification_preferences WHERE user_id = $1 LIMIT 1`,
        userId
      );
      if (rows && rows.length > 0) {
        const r = rows[0];
        return {
          categories: {
            gastos: Boolean(r.gastos_enabled),
            ia: Boolean(r.ia_enabled),
            lembretes: Boolean(r.lembretes_enabled),
            sistema: Boolean(r.sistema_enabled),
          },
          quietHoursEnabled: Boolean(r.quiet_hours_enabled),
          quietHoursStart: r.quiet_hours_start || '22:00',
          quietHoursEnd: r.quiet_hours_end || '08:00',
          hideAmountsOnLockScreen: Boolean(r.hide_amounts_on_lock_screen),
          maxDailyPushes: Number(r.max_daily_pushes) || 3,
        };
      }
    } catch (e) {
      // Fallback via ai_preferences
    }

    const pref = await this.prisma.aiPreference.findUnique({
      where: { userId_key: { userId, key: 'notification_preferences' } },
    });
    if (pref?.valueJson && typeof pref.valueJson === 'object') {
      return {
        ...DEFAULT_DB_NOTIFICATION_PREFS,
        ...(pref.valueJson as any),
      };
    }

    return DEFAULT_DB_NOTIFICATION_PREFS;
  }

  /**
   * Salva as preferências de notificação do usuário no PostgreSQL
   */
  async updatePreferences(userId: string, body: NotificationPreferencePayload) {
    const current = await this.getPreferences(userId);
    const merged = {
      categories: {
        gastos: body?.categories?.gastos ?? current.categories.gastos,
        ia: body?.categories?.ia ?? current.categories.ia,
        lembretes: body?.categories?.lembretes ?? current.categories.lembretes,
        sistema: body?.categories?.sistema ?? current.categories.sistema,
      },
      quietHoursEnabled: body?.quietHoursEnabled ?? current.quietHoursEnabled,
      quietHoursStart: body?.quietHoursStart || current.quietHoursStart || '22:00',
      quietHoursEnd: body?.quietHoursEnd || current.quietHoursEnd || '08:00',
      hideAmountsOnLockScreen:
        body?.hideAmountsOnLockScreen ?? current.hideAmountsOnLockScreen,
      maxDailyPushes: Number(body?.maxDailyPushes) || current.maxDailyPushes || 3,
    };

    try {
      await this.prisma.$executeRawUnsafe(
        `
        INSERT INTO user_notification_preferences (
          user_id,
          gastos_enabled,
          ia_enabled,
          lembretes_enabled,
          sistema_enabled,
          quiet_hours_enabled,
          quiet_hours_start,
          quiet_hours_end,
          hide_amounts_on_lock_screen,
          max_daily_pushes,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          gastos_enabled = EXCLUDED.gastos_enabled,
          ia_enabled = EXCLUDED.ia_enabled,
          lembretes_enabled = EXCLUDED.lembretes_enabled,
          sistema_enabled = EXCLUDED.sistema_enabled,
          quiet_hours_enabled = EXCLUDED.quiet_hours_enabled,
          quiet_hours_start = EXCLUDED.quiet_hours_start,
          quiet_hours_end = EXCLUDED.quiet_hours_end,
          hide_amounts_on_lock_screen = EXCLUDED.hide_amounts_on_lock_screen,
          max_daily_pushes = EXCLUDED.max_daily_pushes,
          updated_at = NOW();
        `,
        userId,
        Boolean(merged.categories.gastos),
        Boolean(merged.categories.ia),
        Boolean(merged.categories.lembretes),
        Boolean(merged.categories.sistema),
        Boolean(merged.quietHoursEnabled),
        String(merged.quietHoursStart),
        String(merged.quietHoursEnd),
        Boolean(merged.hideAmountsOnLockScreen),
        Number(merged.maxDailyPushes)
      );
    } catch (e) {
      // Continua para salvar também em ai_preferences
    }

    await this.prisma.aiPreference.upsert({
      where: { userId_key: { userId, key: 'notification_preferences' } },
      update: { valueJson: merged as any },
      create: {
        userId,
        key: 'notification_preferences',
        valueJson: merged as any,
        description: 'Preferências de notificação do usuário',
      },
    });

    return merged;
  }

  /**
   * Registra o token de Push (Expo / FCM / APNs) do aparelho do usuário no PostgreSQL
   */
  async registerPushToken(
    userId: string,
    payload: { pushToken: string; platform?: string; deviceName?: string }
  ) {
    const token = String(payload?.pushToken || '').trim();
    if (!token) {
      return { registered: false, reason: 'empty_token' };
    }
    const platform = String(payload?.platform || 'android').toLowerCase();
    const deviceName = payload?.deviceName ? String(payload.deviceName) : null;
    const rowId = `${userId}:${token.slice(-24)}`;

    try {
      await this.prisma.$executeRawUnsafe(
        `
        INSERT INTO user_push_tokens (id, user_id, push_token, platform, device_name, last_active_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (push_token) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          platform = EXCLUDED.platform,
          device_name = EXCLUDED.device_name,
          last_active_at = NOW();
        `,
        rowId,
        userId,
        token,
        platform,
        deviceName
      );
      return { registered: true, pushToken: token, platform };
    } catch (error: any) {
      return { registered: false, reason: error?.message || 'db_error' };
    }
  }

  /**
   * Envia Push remoto via gateway Expo Push / FCM para os aparelhos registrados do usuário no PostgreSQL,
   * respeitando as preferências salvas no banco (categorias e ocultação de valores na tela bloqueada).
   */
  async dispatchRemotePushToUser(
    userId: string,
    message: {
      title: string;
      body: string;
      category?: string;
      priority?: string;
      data?: Record<string, any>;
    }
  ) {
    try {
      const prefs = await this.getPreferences(userId);
      const cat = String(message.category || 'sistema').toLowerCase() as keyof typeof prefs.categories;
      if (prefs.categories && prefs.categories[cat] === false) {
        return { sent: false, reason: 'category_disabled' };
      }

      const tokens = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT push_token AS "pushToken" FROM user_push_tokens WHERE user_id = $1`,
        userId
      );
      if (!tokens || tokens.length === 0) {
        return { sent: false, reason: 'no_registered_tokens' };
      }

      const safeTitle = prefs.hideAmountsOnLockScreen
        ? message.title.replace(/-?R\$\s*[\d.,]+/gi, '').trim() || 'Nova atualização no FINN'
        : message.title;
      const safeBody = prefs.hideAmountsOnLockScreen
        ? 'Abra o aplicativo FINN para visualizar os valores com privacidade.'
        : message.body;

      const expoMessages = tokens
        .map((t) => String(t.pushToken || '').trim())
        .filter((tk) => tk.startsWith('ExponentPushToken[') || tk.startsWith('ExpoPushToken['))
        .map((to) => ({
          to,
          sound: 'default',
          title: safeTitle,
          body: safeBody,
          data: message.data || {},
          priority: message.priority === 'critical' ? 'high' : 'default',
          channelId: 'finn-smart-alerts',
        }));

      if (expoMessages.length > 0) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(expoMessages),
        });
      }

      return { sent: expoMessages.length > 0, count: expoMessages.length };
    } catch (e: any) {
      return { sent: false, reason: e?.message || 'push_gateway_error' };
    }
  }
}

