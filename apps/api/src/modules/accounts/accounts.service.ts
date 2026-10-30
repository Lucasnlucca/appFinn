import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto, FinancialScope, SharingAccessLevel } from '@finn-ai/shared';
import { Decimal } from '@finn-ai/database';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista contas financeiras respeitando o escopo e as permissões de compartilhamento
   */
  async listAccounts(userId: string, scope: FinancialScope = FinancialScope.PERSONAL) {
    if (scope === FinancialScope.PERSONAL) {
      return this.prisma.financialAccount.findMany({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Escopo HOUSEHOLD: Busca contas próprias + contas autorizadas do parceiro
    const memberships = await this.prisma.householdMember.findMany({
      where: { userId },
    });

    if (memberships.length === 0) {
      return this.prisma.financialAccount.findMany({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    const householdId = memberships[0].householdId;
    const householdMembers = await this.prisma.householdMember.findMany({
      where: { householdId },
      select: { userId: true },
    });

    const partnerUserIds = householdMembers
      .map((m) => m.userId)
      .filter((id) => id !== userId);

    // Busca permissões concedidas ao solicitante pelo parceiro
    const grantedPermissions = await this.prisma.sharingPermission.findMany({
      where: {
        recipientUserId: userId,
        ownerUserId: { in: partnerUserIds },
        resourceType: 'ACCOUNT',
        accessLevel: { in: [SharingAccessLevel.VIEW_ONLY, SharingAccessLevel.VIEW_AND_EDIT] },
      },
      select: { resourceId: true },
    });

    const authorizedAccountIds = grantedPermissions.map((p) => p.resourceId);

    return this.prisma.financialAccount.findMany({
      where: {
        isActive: true,
        OR: [
          { userId }, // Contas próprias
          { id: { in: authorizedAccountIds } }, // Contas autorizadas pelo cônjuge
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Cadastra uma nova conta bancária ou carteira
   */
  async createAccount(userId: string, dto: CreateAccountDto) {
    const initialDecimal = new Decimal(dto.initialBalance || 0);

    return this.prisma.financialAccount.create({
      data: {
        userId,
        name: dto.name.trim(),
        type: dto.type,
        currentBalance: initialDecimal,
        calculatedBalance: initialDecimal,
        colorHex: dto.colorHex || '#10b981',
        isShared: dto.isShared || false,
      },
    });
  }

  /**
   * Obtém detalhes de uma conta validando permissão
   */
  async getAccount(userId: string, accountId: string) {
    const account = await this.prisma.financialAccount.findUnique({
      where: { id: accountId },
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('Conta financeira não encontrada');
    }

    if (account.userId !== userId) {
      // Verifica se há permissão de compartilhamento
      const permission = await this.prisma.sharingPermission.findUnique({
        where: {
          ownerUserId_recipientUserId_resourceType_resourceId: {
            ownerUserId: account.userId,
            recipientUserId: userId,
            resourceType: 'ACCOUNT',
            resourceId: accountId,
          },
        },
      });

      if (!permission || permission.accessLevel === SharingAccessLevel.NONE) {
        throw new ForbiddenException('Acesso negado a esta conta bancária');
      }
    }

    return account;
  }
}

