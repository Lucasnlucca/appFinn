import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateAuditLogParams {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: any;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: CreateAuditLogParams): Promise<void> {
    try {
      this.logger.log(`[AUDIT] Action: ${params.action} | User: ${params.userId || 'ANONYMOUS'} | Entity: ${params.entityType}:${params.entityId || 'N/A'}`);

      await this.prisma.auditLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          metadata: params.metadata || {},
          ipAddress: params.ipAddress,
        },
      });
    } catch (error) {
      // Falha no log não deve interromper o fluxo principal mas deve ser registrada
      this.logger.warn(`Falha ao persistir AuditLog no banco: ${(error as Error).message}`);
    }
  }

  async getLogsForUser(userId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

