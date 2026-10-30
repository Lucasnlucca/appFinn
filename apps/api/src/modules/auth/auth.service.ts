import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from '@finn-ai/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Cadastra um novo usuário no sistema.
   * Se houver convite pendente para o email informado, o usuário é automaticamente
   * associado ao Household da família como MEMBER.
   */
  async register(dto: RegisterDto, invitationToken?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('Já existe um usuário cadastrado com este e-mail');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    // Se houver token de convite fornecido
    let pendingInvitation = null;
    if (invitationToken) {
      const tokenHash = crypto.createHash('sha256').update(invitationToken).digest('hex');
      pendingInvitation = await this.prisma.householdInvitation.findUnique({
        where: { tokenHash },
        include: { household: true },
      });

      if (!pendingInvitation || pendingInvitation.status !== 'PENDING' || pendingInvitation.expiresAt < new Date()) {
        throw new UnauthorizedException('Convite inválido ou expirado');
      }
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase().trim(),
          passwordHash,
          fullName: dto.fullName.trim(),
          phone: dto.phone || null,
        },
      });

      // Se havia convite, vincula diretamente à família convidante
      if (pendingInvitation) {
        await tx.householdMember.create({
          data: {
            householdId: pendingInvitation.householdId,
            userId: newUser.id,
            role: pendingInvitation.role,
          },
        });

        await tx.householdInvitation.update({
          where: { id: pendingInvitation.id },
          data: {
            status: 'ACCEPTED',
            acceptedAt: new Date(),
          },
        });
      }

      return newUser;
    });

    const token = await this.generateToken(user.id, user.email);
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      token,
    };
  }

  /**
   * Autentica usuário com e-mail e senha.
   */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: {
        householdMemberships: {
          include: {
            household: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas ou conta inativa');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const token = await this.generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        activeHousehold: user.householdMemberships[0]?.household || null,
        roleInHousehold: user.householdMemberships[0]?.role || null,
      },
      token,
    };
  }

  /**
   * Obtém os dados completos do usuário autenticado.
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
        householdMemberships: {
          select: {
            role: true,
            joinedAt: true,
            household: {
              select: {
                id: true,
                name: true,
                currency: true,
                members: {
                  select: {
                    role: true,
                    user: {
                      select: {
                        id: true,
                        fullName: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const membership = user.householdMemberships[0];

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      household: membership
        ? {
            id: membership.household.id,
            name: membership.household.name,
            currency: membership.household.currency,
            currentUserRole: membership.role,
            members: membership.household.members.map((m) => ({
              id: m.user.id,
              fullName: m.user.fullName,
              email: m.user.email,
              role: m.role,
            })),
          }
        : null,
    };
  }

  private async generateToken(userId: string, email: string): Promise<string> {
    const payload = { sub: userId, email };
    return this.jwtService.signAsync(payload);
  }
}

