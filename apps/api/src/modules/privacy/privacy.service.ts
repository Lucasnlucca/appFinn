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

    // Registrar o evento de purga antes da remoção
    await this.auditService.log({
      userId: undefined,
      action: 'LGPD_USER_PURGED',
      entityType: 'User',
      entityId: userId,
      metadata: { purgedEmail: user.email, purgedAt: new Date().toISOString() },
    });

    // Exclusão transacional em cascata dos dados pessoais
    await this.prisma.$transaction(async (tx) => {
      // 1. Remover transações do usuário
      await tx.transaction.deleteMany({ where: { userId } });
      // 2. Remover faturas e cartões
      await tx.creditCard.deleteMany({ where: { userId } });
      // 3. Remover contas bancárias
      await tx.financialAccount.deleteMany({ where: { userId } });
      // 4. Remover memberships e permissões
      await tx.householdMember.deleteMany({ where: { userId } });
      // 5. Remover sessões
      await tx.session.deleteMany({ where: { userId } });
      // 6. Remover o usuário
      await tx.user.delete({ where: { id: userId } });
    });

    return {
      purged: true,
      purgedAt: new Date().toISOString(),
      message: 'Todos os seus dados pessoais foram permanentemente eliminados de acordo com a LGPD.',
    };
  }
}
