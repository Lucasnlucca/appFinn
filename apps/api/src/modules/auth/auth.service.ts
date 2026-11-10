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
        avatarUrl: user.avatarUrl || null,
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
        avatarUrl: user.avatarUrl || null,
        activeHousehold: user.householdMemberships[0]?.household || null,
        roleInHousehold: user.householdMemberships[0]?.role || null,
      },
      token,
    };
  }

  /**
   * Verifica se um e-mail já está cadastrado no banco de dados (evita duplicidade de contas).
   */
  async checkEmailExists(rawEmail?: string) {
    const cleanEmail = (rawEmail || '').toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { exists: false };
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true, email: true, fullName: true },
    });

    return {
      exists: Boolean(existing),
      email: cleanEmail,
      message: existing
        ? 'Já existe uma conta cadastrada com este e-mail. Não é permitido criar outra conta com o mesmo e-mail.'
        : 'E-mail disponível.',
    };
  }

  /**
   * Autentica ou cria conta via Google OAuth 2.0 validando duplicidade no PostgreSQL.
   */
  async authenticateGoogle(body: {
    idToken?: string;
    accessToken?: string;
    email?: string;
    fullName?: string;
    avatarUrl?: string;
    mode?: 'login' | 'register';
  }) {
    let verifiedEmail = (body.email || '').toLowerCase().trim();
    let verifiedName = (body.fullName || '').trim();
    let verifiedAvatar = body.avatarUrl || null;

    // 1. Se foi enviado idToken ou accessToken do Google OAuth 2.0, valida na API oficial do Google
    if (body.idToken) {
      try {
        const res = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(body.idToken)}`,
        );
        if (res.ok) {
          const tokenInfo: any = await res.json();
          if (tokenInfo?.email) {
            verifiedEmail = String(tokenInfo.email).toLowerCase().trim();
            verifiedName = tokenInfo.name || verifiedName;
            verifiedAvatar = tokenInfo.picture || verifiedAvatar;
          }
        }
      } catch (e: any) {
        this.logger.warn(`Falha ao validar idToken Google: ${e?.message}`);
      }
    } else if (body.accessToken) {
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${body.accessToken}` },
        });
        if (res.ok) {
          const userInfo: any = await res.json();
          if (userInfo?.email) {
            verifiedEmail = String(userInfo.email).toLowerCase().trim();
            verifiedName = userInfo.name || verifiedName;
            verifiedAvatar = userInfo.picture || verifiedAvatar;
          }
        }
      } catch (e: any) {
        this.logger.warn(`Falha ao consultar userinfo Google: ${e?.message}`);
      }
    }

    if (!verifiedEmail || !verifiedEmail.includes('@')) {
      throw new UnauthorizedException('E-mail Google inválido ou não informado.');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: verifiedEmail },
      include: {
        householdMemberships: {
          include: { household: true },
        },
      },
    });

    // 2. Validação estrita contra duplicidade no modo de criação de conta
    if (body.mode === 'register' && existingUser) {
      throw new ConflictException(
        'Já existe uma conta cadastrada com este e-mail. Não é permitido criar outra conta com o mesmo e-mail.',
      );
    }

    // 3. Se a conta já existe no banco, autentica na MESMA conta (preservando ID, nome, foto e dados)
    if (existingUser) {
      if (!existingUser.isActive) {
        throw new UnauthorizedException('Esta conta está desativada.');
      }

      const token = await this.generateToken(existingUser.id, existingUser.email);
      return {
        user: {
          id: existingUser.id,
          email: existingUser.email,
          fullName: existingUser.fullName,
          avatarUrl: existingUser.avatarUrl || verifiedAvatar || null,
          activeHousehold: existingUser.householdMemberships[0]?.household || null,
          roleInHousehold: existingUser.householdMemberships[0]?.role || null,
        },
        token,
        isNewAccount: false,
      };
    }

    // 4. Se não existe, cria a nova conta real no PostgreSQL vinculada ao Google
    const fallbackName =
      verifiedName ||
      verifiedEmail
        .split('@')[0]
        .replace(/[._0-9-]+/g, ' ')
        .trim()
        .replace(/\b\w/g, (l) => l.toUpperCase()) ||
      'Usuário Google';

    const randomPass = crypto.randomBytes(24).toString('hex') + 'G1!';
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(randomPass, salt);

    const newUser = await this.prisma.user.create({
      data: {
        email: verifiedEmail,
        passwordHash,
        fullName: fallbackName,
        avatarUrl: verifiedAvatar,
      },
    });

    const token = await this.generateToken(newUser.id, newUser.email);
    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        avatarUrl: newUser.avatarUrl || null,
      },
      token,
      isNewAccount: true,
    };
  }

  /**
   * Atualiza o perfil do usuário (Nome, Sobrenome e Foto de Perfil) no PostgreSQL.
   */
  async updateProfile(
    userId: string,
    body: {
      fullName?: string;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string | null;
      avatarUri?: string | null;
      phone?: string;
    },
  ) {
    const composedName =
      body.fullName?.trim() ||
      [body.firstName?.trim(), body.lastName?.trim()].filter(Boolean).join(' ');

    const resolvedAvatar =
      body.avatarUrl !== undefined
        ? body.avatarUrl
        : body.avatarUri !== undefined
          ? body.avatarUri
          : undefined;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(composedName ? { fullName: composedName } : {}),
        ...(resolvedAvatar !== undefined ? { avatarUrl: resolvedAvatar } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
      },
    });

    return {
      user: {
        ...updated,
        avatarUri: updated.avatarUrl,
      },
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

