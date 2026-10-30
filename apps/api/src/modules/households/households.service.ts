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
   */
  async createHousehold(userId: string, dto: CreateHouseholdDto) {
    const existingMembership = await this.prisma.householdMember.findFirst({
      where: { userId },
    });

    if (existingMembership) {
      throw new ConflictException('O usuário já pertence a um núcleo familiar');
    }

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

      return household;
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
   * Aceita um convite com o token seguro.
   */
  async acceptInvitation(userId: string, token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invitation = await this.prisma.householdInvitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
      throw new BadRequestException('Convite inválido ou expirado');
    }

    const existingMembership = await this.prisma.householdMember.findFirst({
      where: { userId },
    });

    if (existingMembership) {
      throw new ConflictException('Você já pertence a um núcleo familiar. Saia do atual antes de aceitar um novo.');
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

    return { message: 'Você agora faz parte do núcleo familiar!' };
  }
}

