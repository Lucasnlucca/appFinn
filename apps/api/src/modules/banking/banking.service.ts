import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PluggyBankingProvider } from './providers/pluggy.provider';
import { Decimal } from '@finn-ai/database';
import { SyncStatus } from '@finn-ai/shared';

@Injectable()
export class BankingService {
  private readonly logger = new Logger(BankingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pluggyProvider: PluggyBankingProvider,
  ) {}

  /**
   * Lista conexões bancárias ativas do usuário
   */
  async listConnections(userId: string) {
    return this.prisma.bankConnection.findMany({
      where: { userId },
      include: {
        items: true,
        accounts: {
          select: {
            id: true,
            name: true,
            type: true,
            currentBalance: true,
            updatedAt: true,
          },
        },
        history: {
          take: 3,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Registra uma nova conexão bancária utilizando o itemId do Meu Pluggy
   */
  async createConnection(userId: string, institutionName: string, externalItemId: string) {
    // 1. Limite de segurança documentado: máximo de 5 conexões simultâneas para conta pessoal
    const totalConnections = await this.prisma.bankConnection.count({
      where: { userId },
    });

    if (totalConnections >= 5) {
      throw new BadRequestException(
        'Limite de 5 conexões bancárias simultâneas atingido (modalidade Meu Pluggy Pessoal). Desconecte uma instituição anterior para adicionar uma nova.',
      );
    }

    // Calcula expiração típica de consentimento (1 ano a partir de hoje)
    const consentExpiresAt = new Date();
    consentExpiresAt.setFullYear(consentExpiresAt.getFullYear() + 1);

    const connection = await this.prisma.$transaction(async (tx) => {
      const conn = await tx.bankConnection.create({
        data: {
          userId,
          provider: 'PLUGGY',
          institutionName: institutionName.trim(),
          status: 'IDLE',
          consentExpiresAt,
        },
      });

      await tx.bankConnectionItem.create({
        data: {
          bankConnectionId: conn.id,
          externalItemId: externalItemId.trim(),
        },
      });

      return conn;
    });

    // Dispara a sincronização inicial
    this.syncConnection(userId, connection.id).catch((err) => {
      this.logger.error(`Erro na sincronização inicial da conexão ${connection.id}: ${err.message}`);
    });

    return connection;
  }

  /**
   * Sincroniza contas e transações da instituição financeira
   */
  async syncConnection(userId: string, connectionId: string) {
    const startTime = Date.now();

    const connection = await this.prisma.bankConnection.findUnique({
      where: { id: connectionId },
      include: { items: true },
    });

    if (!connection || connection.userId !== userId) {
      throw new NotFoundException('Conexão bancária não encontrada');
    }

    if (connection.items.length === 0) {
      throw new BadRequestException('Esta conexão não possui Item ID cadastrado');
    }

    // Atualiza status para RUNNING
    await this.prisma.bankConnection.update({
      where: { id: connectionId },
      data: { status: 'RUNNING' },
    });

    try {
      let totalAccountsSynced = 0;
      let totalTransactionsSynced = 0;

      for (const item of connection.items) {
        // 1. Consulta contas via Provider
        const bankAccounts = await this.pluggyProvider.getAccounts(item.externalItemId);
        totalAccountsSynced += bankAccounts.length;

        for (const bAcc of bankAccounts) {
          // Upsert da conta financeira no FINN AI
          let localAccount = await this.prisma.financialAccount.findFirst({
            where: {
              userId,
              bankConnectionId: connection.id,
              accountNumber: bAcc.number || bAcc.externalId,
            },
          });

          const balanceDecimal = new Decimal(bAcc.balance);

          if (!localAccount) {
            localAccount = await this.prisma.financialAccount.create({
              data: {
                userId,
                bankConnectionId: connection.id,
                name: `${connection.institutionName} - ${bAcc.name}`,
                type: bAcc.type,
                accountNumber: bAcc.number || bAcc.externalId,
                currentBalance: balanceDecimal,
                calculatedBalance: balanceDecimal,
                currency: bAcc.currencyCode,
                isShared: false,
              },
            });
          } else {
            localAccount = await this.prisma.financialAccount.update({
              where: { id: localAccount.id },
              data: {
                currentBalance: balanceDecimal,
                updatedAt: new Date(),
              },
            });
          }

          // 2. Consulta transações da conta
          const txPage = await this.pluggyProvider.getTransactions(bAcc.externalId);

          for (const bTx of txPage.transactions) {
            const dateStr = bTx.date.toISOString().split('T')[0];
            const amountDecimal = new Decimal(bTx.amount);

            // Deduplicação estrita via idempotencyKey
            const idempotencyKey = crypto
              .createHash('sha256')
              .update(`${localAccount.id}:${bTx.externalId}:${amountDecimal.toFixed(2)}:${dateStr}`)
              .digest('hex');

            const existing = await this.prisma.transaction.findUnique({
              where: { idempotencyKey },
            });

            if (!existing) {
              await this.prisma.transaction.create({
                data: {
                  userId,
                  accountId: localAccount.id,
                  type: bTx.type === 'CREDIT' ? 'INCOME' : 'EXPENSE',
                  amount: amountDecimal,
                  date: bTx.date,
                  description: bTx.description,
                  status: bTx.status,
                  idempotencyKey,
                  externalId: bTx.externalId,
                  merchantName: bTx.merchantName || null,
                  isHouseholdShared: false,
                },
              });
              totalTransactionsSynced++;
            }
          }
        }
      }

      const durationMs = Date.now() - startTime;

      // Registra no histórico de sincronizações
      await this.prisma.bankSyncHistory.create({
        data: {
          bankConnectionId: connection.id,
          status: 'SUCCESS',
          accountsSynced: totalAccountsSynced,
          transactionsSynced: totalTransactionsSynced,
          durationMs,
          message: `Sincronização concluída com sucesso (${totalTransactionsSynced} transações importadas).`,
        },
      });

      // Atualiza status da conexão
      await this.prisma.bankConnection.update({
        where: { id: connectionId },
        data: {
          status: 'SUCCESS',
          lastSyncAt: new Date(),
          errorMessage: null,
        },
      });

      return {
        connectionId,
        accountsSynced: totalAccountsSynced,
        transactionsSynced: totalTransactionsSynced,
        durationMs,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      this.logger.error(`Falha ao sincronizar conexão ${connectionId}: ${err.message}`);

      await this.prisma.bankSyncHistory.create({
        data: {
          bankConnectionId: connection.id,
          status: 'FAILED',
          accountsSynced: 0,
          transactionsSynced: 0,
          durationMs,
          message: err.message,
        },
      });

      await this.prisma.bankConnection.update({
        where: { id: connectionId },
        data: {
          status: 'FAILED',
          errorMessage: err.message,
        },
      });

      throw err;
    }
  }

  /**
   * Desconecta uma instituição bancária
   */
  async disconnect(userId: string, connectionId: string) {
    const connection = await this.prisma.bankConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection || connection.userId !== userId) {
      throw new NotFoundException('Conexão bancária não encontrada');
    }

    await this.pluggyProvider.disconnect(connectionId);

    await this.prisma.bankConnection.delete({
      where: { id: connectionId },
    });

    return { message: 'Conexão bancária desvinculada com sucesso' };
  }
}

