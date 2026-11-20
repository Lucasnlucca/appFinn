import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Client } from 'pg';
import { PrismaService } from '../prisma/prisma.service';

export interface DbChangeEvent {
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  data: Record<string, any> | null;
  timestamp?: number;
}

@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private pgClient: Client | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private readonly clients = new Map<string, Response>();
  private lastEventSignature = '';
  private lastEventTime = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensurePostgresTriggers();
    this.registerPrismaMiddleware();
    await this.connectListenClient();

    this.heartbeatTimer = setInterval(() => {
      this.broadcastHeartbeat();
    }, 20000);
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    for (const [, res] of this.clients) {
      try {
        res.end();
      } catch {
        // ignore
      }
    }
    this.clients.clear();
    if (this.pgClient) {
      try {
        await this.pgClient.end();
      } catch {
        // ignore
      }
      this.pgClient = null;
    }
  }

  /**
   * Cria automaticamente a função PL/pgSQL `notify_table_changes()` e aplica as triggers
   * AFTER INSERT OR UPDATE OR DELETE nas tabelas do PostgreSQL.
   */
  private async ensurePostgresTriggers() {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION notify_table_changes()
        RETURNS trigger AS $$
        DECLARE
          rec RECORD;
          row_data JSONB;
          payload TEXT;
        BEGIN
          rec := COALESCE(NEW, OLD);
          row_data := to_jsonb(rec) - 'password_hash' - 'avatar_url';

          payload := json_build_object(
            'table', TG_TABLE_NAME,
            'action', TG_OP,
            'data', row_data
          )::text;

          IF octet_length(payload) > 7500 THEN
            payload := json_build_object(
              'table', TG_TABLE_NAME,
              'action', TG_OP,
              'data', json_build_object(
                'id', row_data->'id',
                'user_id', row_data->'user_id',
                'household_id', row_data->'household_id'
              )
            )::text;
          END IF;

          PERFORM pg_notify('db_changes', payload);
          RETURN rec;
        END;
        $$ LANGUAGE plpgsql;
      `);

      await this.prisma.$executeRawUnsafe(`
        DO $$
        DECLARE
          tbl TEXT;
          tables TEXT[] := ARRAY[
            'transactions',
            'financial_accounts',
            'credit_cards',
            'credit_card_bills',
            'households',
            'household_members',
            'household_invitations',
            'goals',
            'budgets',
            'users',
            'app_notifications'
          ];
        BEGIN
          FOREACH tbl IN ARRAY tables LOOP
            IF EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = tbl
            ) THEN
              EXECUTE format('DROP TRIGGER IF EXISTS trg_notify_%I ON public.%I;', tbl, tbl);
              EXECUTE format(
                'CREATE TRIGGER trg_notify_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION notify_table_changes();',
                tbl,
                tbl
              );
            END IF;
          END LOOP;
        END;
        $$;
      `);

      this.logger.log('Triggers PostgreSQL notify_table_changes() configuradas com sucesso.');
    } catch (err: any) {
      this.logger.warn(`Aviso ao configurar triggers LISTEN/NOTIFY: ${err?.message}`);
    }
  }

  /**
   * Middleware complementar no Prisma para garantir emissão imediata mesmo durante reconexão do socket PG.
   */
  private registerPrismaMiddleware() {
    try {
      this.prisma.$use(async (params, next) => {
        const result = await next(params);
        const writeActions: Record<string, 'INSERT' | 'UPDATE' | 'DELETE'> = {
          create: 'INSERT',
          createMany: 'INSERT',
          update: 'UPDATE',
          updateMany: 'UPDATE',
          upsert: 'UPDATE',
          delete: 'DELETE',
          deleteMany: 'DELETE',
        };
        const mappedAction = writeActions[params.action];
        if (mappedAction && params.model) {
          const tableMap: Record<string, string> = {
            Transaction: 'transactions',
            FinancialAccount: 'financial_accounts',
            CreditCard: 'credit_cards',
            CreditCardBill: 'credit_card_bills',
            Household: 'households',
            HouseholdMember: 'household_members',
            HouseholdInvitation: 'household_invitations',
            Goal: 'goals',
            Budget: 'budgets',
            User: 'users',
            AppNotification: 'app_notifications',
          };
          const tableName = tableMap[params.model] || params.model.toLowerCase();
          const safeData =
            result && typeof result === 'object'
              ? {
                  id: (result as any).id,
                  userId: (result as any).userId,
                  householdId: (result as any).householdId,
                }
              : null;
          this.broadcastChange({
            table: tableName,
            action: mappedAction,
            data: safeData,
            timestamp: Date.now(),
          });
        }
        return result;
      });
    } catch {
      // ignore if middleware unsupported
    }
  }

  /**
   * Conecta um client dedicado do PostgreSQL executando `LISTEN db_changes;`.
   */
  private async connectListenClient() {
    if (this.isShuttingDown) return;
    const dbUrl =
      this.configService.get<string>('database.url') || process.env.DATABASE_URL;
    if (!dbUrl) {
      this.logger.warn('DATABASE_URL ausente; escuta LISTEN db_changes desativada.');
      return;
    }

    try {
      if (this.pgClient) {
        try {
          await this.pgClient.end();
        } catch {
          // ignore
        }
      }

      const client = new Client({ connectionString: dbUrl });
      client.on('error', (err) => {
        this.logger.warn(`Erro no client PostgreSQL LISTEN: ${err.message}`);
        this.scheduleReconnect();
      });
      client.on('end', () => {
        if (!this.isShuttingDown) {
          this.scheduleReconnect();
        }
      });
      client.on('notification', (msg) => {
        if (msg.channel === 'db_changes' && msg.payload) {
          try {
            const parsed = JSON.parse(msg.payload) as DbChangeEvent;
            this.broadcastChange({
              ...parsed,
              timestamp: parsed.timestamp || Date.now(),
            });
          } catch {
            this.broadcastChange({
              table: 'unknown',
              action: 'UPDATE',
              data: { raw: msg.payload },
              timestamp: Date.now(),
            });
          }
        }
      });

      await client.connect();
      await client.query('LISTEN db_changes;');
      this.pgClient = client;
      this.logger.log('Conectado ao PostgreSQL executando LISTEN db_changes;');
    } catch (err: any) {
      this.logger.warn(`Falha ao iniciar LISTEN db_changes: ${err?.message}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.isShuttingDown || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectListenClient();
    }, 3000);
  }

  addSseClient(clientId: string, res: Response) {
    this.clients.set(clientId, res);
    res.on('close', () => {
      this.clients.delete(clientId);
    });
  }

  broadcastChange(event: DbChangeEvent) {
    const now = Date.now();
    const recordId = event.data?.id || event.data?.user_id || event.data?.userId || '';
    const sig = `${event.table}:${event.action}:${recordId}`;
    if (sig === this.lastEventSignature && now - this.lastEventTime < 80) {
      return;
    }
    this.lastEventSignature = sig;
    this.lastEventTime = now;

    const payload = JSON.stringify({
      table: event.table,
      action: event.action,
      data: event.data,
      timestamp: event.timestamp || now,
    });

    for (const [id, res] of this.clients.entries()) {
      try {
        res.write(`data: ${payload}\n\n`);
      } catch {
        this.clients.delete(id);
      }
    }
  }

  private broadcastHeartbeat() {
    const ts = Date.now();
    for (const [id, res] of this.clients.entries()) {
      try {
        res.write(`: heartbeat ${ts}\n\n`);
      } catch {
        this.clients.delete(id);
      }
    }
  }
}
