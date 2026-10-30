import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SharingAccessLevel } from '@finn-ai/shared';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Define o nível de permissão concedido a outro membro da família sobre um recurso específico.
   */
  async setSharingPermission(
    ownerUserId: string,
    recipientUserId: string,
    resourceType: 'ACCOUNT' | 'CREDIT_CARD' | 'GOAL',
    resourceId: string,
    accessLevel: SharingAccessLevel,
  ) {
    if (ownerUserId === recipientUserId) {
      throw new ForbiddenException('Não é possível definir permissões de compartilhamento para você mesmo');
    }

    // Valida se ambos pertencem ao mesmo Household
    const memberships = await this.prisma.householdMember.findMany({
      where: {
        userId: { in: [ownerUserId, recipientUserId] },
      },
    });

    if (memberships.length < 2 || memberships[0].householdId !== memberships[1].householdId) {
      throw new ForbiddenException('Usuários não pertencem ao mesmo núcleo familiar');
    }

    return this.prisma.sharingPermission.upsert({
      where: {
        ownerUserId_recipientUserId_resourceType_resourceId: {
          ownerUserId,
          recipientUserId,
          resourceType,
          resourceId,
        },
      },
      update: {
        accessLevel,
      },
      create: {
        ownerUserId,
        recipientUserId,
        resourceType,
        resourceId,
        accessLevel,
      },
    });
  }

  /**
   * Verifica se o usuário solicitante tem permissão de leitura sobre um recurso pertencente a outro usuário.
   */
  async canAccessResource(
    requestingUserId: string,
    ownerUserId: string,
    resourceType: string,
    resourceId: string,
  ): Promise<boolean> {
    // Se o solicitante for o próprio dono, o acesso é garantido
    if (requestingUserId === ownerUserId) {
      return true;
    }

    // Caso contrário, busca na tabela de permissões expressas
    const permission = await this.prisma.sharingPermission.findUnique({
      where: {
        ownerUserId_recipientUserId_resourceType_resourceId: {
          ownerUserId,
          recipientUserId: requestingUserId,
          resourceType,
          resourceId,
        },
      },
    });

    return !!permission && permission.accessLevel !== SharingAccessLevel.NONE;
  }
}

