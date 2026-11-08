import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHouseholdDto, InviteMemberDto } from '@finn-ai/shared';

@Injectable()
export class HouseholdsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria um novo núcleo familiar (Household) e vincula o usuário como OWNER.
   * Suporta múltiplos grupos por usuário.
   */
  async createHousehold(userId: string, dto: CreateHouseholdDto) {
    return this.prisma.$transaction(async (tx) => {
      const household = await tx.household.create({
        data: {
          name: dto.name.trim(),
          currency: dto.currency || 'BRL',
        },
      });

      await tx.householdMember.create({
        data: {
          householdId: household.id,
          userId,
          role: 'OWNER',
        },
      });

      // Gera código de convite rápido inicial de 6 caracteres válido por 30 minutos
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await tx.householdInvitation.create({
        data: {
          householdId: household.id,
          invitedById: userId,
          email: `code-${code}@finn.local`,
          role: 'MEMBER',
          tokenHash,
          expiresAt,
        },
      });

      return {
        ...household,
        inviteCode: code,
        inviteCodeExpiresAt: expiresAt.toISOString(),
      };
    });
  }

  /**
   * Obtém o Household ativo do usuário com detalhes dos membros.
   */
  async getCurrentHousehold(userId: string) {
    const membership = await this.prisma.householdMember.findFirst({
      where: { userId },
      include: {
        household: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            invitations: {
              where: { status: 'PENDING', expiresAt: { gt: new Date() } },
              select: {
                id: true,
                email: true,
                role: true,
                expiresAt: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!membership) {
      return null;
    }

    return {
      id: membership.household.id,
      name: membership.household.name,
      currency: membership.household.currency,
      currentUserRole: membership.role,
      members: membership.household.members.map((m) => ({
        id: m.user.id,
        fullName: m.user.fullName,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      pendingInvitations: membership.household.invitations,
    };
  }

  /**
   * Lista todos os núcleos familiares/grupos que o usuário participa.
   */
  async getUserHouseholds(userId: string) {
    const memberships = await this.prisma.householdMember.findMany({
      where: { userId },
      include: {
        household: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            invitations: {
              where: { status: 'PENDING', expiresAt: { gt: new Date() } },
              select: {
                id: true,
                email: true,
                role: true,
                expiresAt: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map((m) => ({
      id: m.household.id,
      name: m.household.name,
      currency: m.household.currency,
      currentUserRole: m.role,
      members: m.household.members.map((mem) => ({
        id: mem.user.id,
        fullName: mem.user.fullName,
        email: mem.user.email,
        avatarUrl: mem.user.avatarUrl,
        role: mem.role,
        joinedAt: mem.joinedAt,
      })),
      pendingInvitations: m.household.invitations,
    }));
  }

  /**
   * Gera um convite seguro por e-mail para o cônjuge participar do núcleo familiar.
   */
  async createInvitation(userId: string, dto: InviteMemberDto) {
    const membership = await this.prisma.householdMember.findFirst({
      where: { userId },
    });

    if (!membership) {
      throw new BadRequestException('Você precisa criar ou pertencer a um núcleo familiar antes de convidar');
    }

    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenException('Apenas administradores podem enviar convites para o núcleo familiar');
    }

    const email = dto.email.toLowerCase().trim();

    // Verifica se já é membro
    const alreadyMember = await this.prisma.householdMember.findFirst({
      where: {
        householdId: membership.householdId,
        user: { email },
      },
    });

    if (alreadyMember) {
      throw new ConflictException('Este e-mail já é membro do seu núcleo familiar');
    }

    // Gera token seguro e hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias de validade

    // Cancela convites anteriores pendentes para o mesmo e-mail
    await this.prisma.householdInvitation.updateMany({
      where: {
        householdId: membership.householdId,
        email,
        status: 'PENDING',
      },
      data: { status: 'REVOKED' },
    });

    const invitation = await this.prisma.householdInvitation.create({
      data: {
        householdId: membership.householdId,
        invitedById: userId,
        email,
        role: 'MEMBER',
        tokenHash,
        expiresAt,
      },
    });

    return {
      invitationId: invitation.id,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      invitationToken: rawToken,
      invitationLink: `/register?invitationToken=${rawToken}&email=${encodeURIComponent(email)}`,
    };
  }

  /**
   * Gera um código único de 6 caracteres para o grupo, validado rigorosamente por 30 minutos.
   */
  async generateGroupInviteCode(userId: string, householdId?: string) {
    let targetHouseholdId = householdId;
    if (!targetHouseholdId) {
      const membership = await this.prisma.householdMember.findFirst({
        where: { userId },
        orderBy: { joinedAt: 'desc' },
      });
      if (!membership) {
        throw new BadRequestException('Usuário não pertence a nenhum grupo');
      }
      targetHouseholdId = membership.householdId;
    }

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos!

    await this.prisma.householdInvitation.updateMany({
      where: {
        householdId: targetHouseholdId,
        email: { startsWith: 'code-' },
        status: 'PENDING',
      },
      data: { status: 'REVOKED' },
    });

    await this.prisma.householdInvitation.create({
      data: {
        householdId: targetHouseholdId,
        invitedById: userId,
        email: `code-${code}@finn.local`,
        role: 'MEMBER',
        tokenHash,
        expiresAt,
      },
    });

    return {
      code,
      expiresAt: expiresAt.toISOString(),
      expiresInMinutes: 30,
      householdId: targetHouseholdId,
    };
  }

  /**
   * Aceita um convite com o token seguro.
   */
  async acceptInvitation(userId: string, token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invitation = await this.prisma.householdInvitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation || invitation.status !== 'PENDING') {
      throw new BadRequestException('Convite inválido ou revogado');
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Este convite/código expirou (validade de 30 minutos). Solicite um novo código ao criador do grupo.');
    }

    const existingMembership = await this.prisma.householdMember.findUnique({
      where: {
        householdId_userId: {
          householdId: invitation.householdId,
          userId,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException('Você já é membro deste grupo financeiro compartilhado.');
    }

    await this.prisma.$transaction([
      this.prisma.householdMember.create({
        data: {
          householdId: invitation.householdId,
          userId,
          role: invitation.role,
        },
      }),
      this.prisma.householdInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      }),
    ]);

    const updatedHousehold = await this.prisma.household.findUnique({
      where: { id: invitation.householdId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    return {
      message: `Você agora faz parte do grupo '${updatedHousehold?.name || 'Compartilhado'}'!`,
      household: updatedHousehold
        ? {
            id: updatedHousehold.id,
            name: updatedHousehold.name,
            currency: updatedHousehold.currency,
            members: updatedHousehold.members.map((m) => ({
              id: m.user.id,
              name: m.user.fullName || m.user.email || 'Membro',
              email: m.user.email,
              avatarUrl: m.user.avatarUrl,
              role: m.role,
            })),
          }
        : null,
    };
  }

  /**
   * Exclui o grupo criado. Apenas o criador/dono (OWNER) tem permissão para excluir.
   */
  async deleteHousehold(userId: string, householdId: string) {
    const membership = await this.prisma.householdMember.findUnique({
      where: {
        householdId_userId: {
          householdId,
          userId,
        },
      },
      include: {
        household: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Grupo ou vínculo não encontrado.');
    }

    if (membership.role !== 'OWNER') {
      throw new ForbiddenException('Apenas o criador do grupo tem permissão para excluí-lo.');
    }

    await this.prisma.household.delete({
      where: { id: householdId },
    });

    return { message: `Grupo '${membership.household.name}' excluído com sucesso.` };
  }

  /**
   * Permite que um membro saia do grupo.
   * O dono não pode sair (deve excluir).
   * Notifica automaticamente o dono do grupo sobre a saída do participante.
   */
  async leaveHousehold(userId: string, householdId: string) {
    const membership = await this.prisma.householdMember.findUnique({
      where: {
        householdId_userId: {
          householdId,
          userId,
        },
      },
      include: {
        user: true,
        household: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Vínculo com o grupo não encontrado.');
    }

    if (membership.role === 'OWNER') {
      throw new BadRequestException(
        'O criador do grupo não pode sair. Se deseja encerrar o grupo, você deve excluí-lo.',
      );
    }

    // Localiza o criador/dono do grupo para notificação
    const ownerMembership = await this.prisma.householdMember.findFirst({
      where: {
        householdId,
        role: 'OWNER',
      },
      include: {
        user: true,
      },
    });

    const memberName = membership.user.fullName || membership.user.email;
    const groupName = membership.household.name;

    await this.prisma.$transaction(async (tx) => {
      // 1. Remove o membro do grupo
      await tx.householdMember.delete({
        where: {
          householdId_userId: {
            householdId,
            userId,
          },
        },
      });

      // 2. Notifica o criador/dono do grupo
      if (ownerMembership) {
        await tx.notification.create({
          data: {
            userId: ownerMembership.userId,
            title: 'Membro saiu do grupo',
            message: `${memberName} saiu do grupo '${groupName}'.`,
            type: 'HOUSEHOLD_MEMBER_LEFT',
          },
        });
      }
    });

    return {
      message: `Você saiu do grupo '${groupName}' com sucesso. O criador foi notificado.`,
      ownerNotified: !!ownerMembership,
    };
  }

  /**
   * Expulsa um participante do grupo financeiro.
   * Apenas o criador/dono (OWNER) pode expulsar membros.
   * O dono não pode expulsar a si mesmo.
   * Notifica o participante que ele foi expulso do grupo.
   */
  async kickMember(ownerUserId: string, householdId: string, targetMemberIdOrEmail: string) {
    const ownerMembership = await this.prisma.householdMember.findUnique({
      where: {
        householdId_userId: {
          householdId,
          userId: ownerUserId,
        },
      },
      include: {
        household: true,
      },
    });

    if (!ownerMembership) {
      throw new NotFoundException('Grupo ou vínculo do criador não encontrado.');
    }

    if (ownerMembership.role !== 'OWNER' && ownerMembership.role !== 'ADMIN') {
      throw new ForbiddenException('Apenas o criador ou administrador do grupo tem permissão para expulsar participantes.');
    }

    // Localiza o membro alvo por ID ou por E-mail
    let targetMembership = await this.prisma.householdMember.findFirst({
      where: {
        householdId,
        userId: targetMemberIdOrEmail,
      },
      include: {
        user: true,
      },
    });

    if (!targetMembership) {
      targetMembership = await this.prisma.householdMember.findFirst({
        where: {
          householdId,
          user: {
            email: {
              equals: targetMemberIdOrEmail.toLowerCase().trim(),
              mode: 'insensitive',
            },
          },
        },
        include: {
          user: true,
        },
      });
    }

    if (!targetMembership) {
      throw new NotFoundException('Participante não encontrado neste grupo.');
    }

    // Bloqueia expulsão de si mesmo ou do criador
    if (targetMembership.userId === ownerUserId || targetMembership.role === 'OWNER') {
      throw new BadRequestException('O criador/dono do grupo não pode ser expulso.');
    }

    const memberName = targetMembership.user.fullName || targetMembership.user.email || 'Participante';
    const groupName = ownerMembership.household.name;

    await this.prisma.$transaction(async (tx) => {
      // 1. Remove a participação do membro no grupo
      await tx.householdMember.delete({
        where: {
          householdId_userId: {
            householdId,
            userId: targetMembership.userId,
          },
        },
      });

      // 2. Revoga convites pendentes que este membro possa ter
      await tx.householdInvitation.updateMany({
        where: {
          householdId,
          email: targetMembership.user.email,
          status: 'PENDING',
        },
        data: {
          status: 'REVOKED',
        },
      });

      // 3. Notifica o participante sobre a expulsão
      await tx.notification.create({
        data: {
          userId: targetMembership.userId,
          title: 'Você foi removido do grupo',
          message: `Você foi removido do grupo compartilhado '${groupName}' pelo administrador.`,
          type: 'HOUSEHOLD_MEMBER_KICKED',
        },
      });
    });

    return {
      message: `${memberName} foi expulso do grupo '${groupName}' com sucesso.`,
      kickedUserId: targetMembership.userId,
    };
  }
}

