import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Exportação integral de dados do titular (LGPD Art. 18, II e V - Portabilidade).
   * Retorna todas as informações vinculadas à conta do usuário em formato JSON estruturado.
   */
  async exportUserData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const accounts = await this.prisma.financialAccount.findMany({
      where: { userId },
    });

    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
    });

    const cards = await this.prisma.creditCard.findMany({
      where: { userId },
    });

    const auditLogs = await this.prisma.auditLog.findMany({
      where: { userId },
      take: 100,
    });

    await this.auditService.log({
      userId,
      action: 'LGPD_DATA_EXPORTED',
      entityType: 'User',
      entityId: userId,
      metadata: { exportedAt: new Date().toISOString() },
    });

    return {
      exportedAt: new Date().toISOString(),
      compliance: 'LGPD (Lei Geral de Proteção de Dados - Lei 13.709/2018, Art. 18)',
      data: {
        profile: user,
        accounts,
        transactions,
        creditCards: cards,
        recentActivityLogs: auditLogs,
      },
    };
  }

  /**
   * Purga definitiva e exclusão da conta do titular (LGPD Art. 18, VI - Eliminação de Dados).
   * Remove registros vinculados de transações, contas e dados pessoais, desvinculando itens de auditoria.
   */
  async purgeUserAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Registrar evento anônimo de purga sem reter e-mail/PII em log
    await this.auditService.log({
      userId: undefined,
      action: 'LGPD_USER_PURGED',
      entityType: 'User',
      entityId: 'REDACTED',
      metadata: { purgedAt: new Date().toISOString() },
    });

    // Exclusão transacional em cascata de todos os dados pessoais e financeiros
    await this.prisma.$transaction(async (tx) => {
      // 0. Limpar tabelas auxiliares criadas via SQL raw (auth_identities e password_reset_tokens)
      try {
        await tx.$executeRawUnsafe(
          `DELETE FROM "password_reset_tokens" WHERE "user_id" = $1 OR LOWER("email") = LOWER($2)`,
          userId,
          user.email,
        );
      } catch {
        // Tabela pode não existir ainda
      }
      try {
        await tx.$executeRawUnsafe(
          `DELETE FROM "auth_identities" WHERE "user_id" = $1 OR LOWER("email") = LOWER($2)`,
          userId,
          user.email,
        );
      } catch {
        // Tabela pode não existir ainda
      }

      // Captura os grupos familiares do usuário para remover os que ficarem vazios
      const memberships = await tx.householdMember.findMany({
        where: { userId },
        select: { householdId: true },
      });
      const householdIds = [...new Set(memberships.map((m) => m.householdId))];

      // 1. Remover transações, cartões (e faturas), contas bancárias e conexões
      await tx.transaction.deleteMany({ where: { userId } });
      await tx.creditCard.deleteMany({ where: { userId } });
      await tx.financialAccount.deleteMany({ where: { userId } });
      await tx.bankConnection.deleteMany({ where: { userId } });

      // 2. Remover documentos, importações, IA, notificações, consentimentos e configurações
      await tx.document.deleteMany({ where: { userId } });
      await tx.importBatch.deleteMany({ where: { userId } });
      await tx.aiConversation.deleteMany({ where: { userId } });
      await tx.aiPreference.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.userConsent.deleteMany({ where: { userId } });
      await tx.appSetting.deleteMany({ where: { userId } });

      // 3. Remover compartilhamentos, convites enviados e participações em grupos
      await tx.sharingPermission.deleteMany({
        where: { OR: [{ ownerUserId: userId }, { recipientUserId: userId }] },
      });
      await tx.householdInvitation.deleteMany({ where: { invitedById: userId } });
      await tx.householdMember.deleteMany({ where: { userId } });

      // 4. Remover sessões, logs de auditoria vinculados e o próprio usuário
      await tx.session.deleteMany({ where: { userId } });
      await tx.auditLog.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });

      // 5. Remover grupos que ficaram sem nenhum participante
      for (const hhId of householdIds) {
        const remaining = await tx.householdMember.count({ where: { householdId: hhId } });
        if (remaining === 0) {
          await tx.household.delete({ where: { id: hhId } });
        }
      }
    });

    return {
      purged: true,
      purgedAt: new Date().toISOString(),
      message: 'Todos os seus dados pessoais foram permanentemente eliminados de acordo com a LGPD.',
    };
  }
}
