import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { RegisterDto, LoginDto } from '@finn-ai/shared';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async onModuleInit() {
    await this.ensureDatabaseSchema();
    await this.ensurePasswordResetTable();
  }

  /**
   * Garante a evolução do schema no PostgreSQL existente:
   * - Torna users.password_hash anulável (DROP NOT NULL)
   * - Adiciona email_verified, terms_accepted_at, terms_accepted_version
   * - Cria a tabela auth_identities para vincular OAuth sub de provedores
   */
  private async ensureDatabaseSchema() {
    try {
      // 1. Torna password_hash anulável para contas criadas via Google/Social
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
      `);
    } catch (e: any) {
      // Já pode estar anulável ou tabela ainda sendo migrada
    }

    try {
      // 2. Colunas de verificação de e-mail e termos LGPD
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
      `);
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMPTZ;
      `);
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_accepted_version" VARCHAR(32);
      `);
    } catch (e: any) {
      this.logger.warn(`Aviso ao atualizar colunas users: ${e?.message}`);
    }

    try {
      // 3. Tabela auth_identities
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "auth_identities" (
          "id" UUID NOT NULL DEFAULT gen_random_uuid(),
          "user_id" UUID NOT NULL,
          "provider" VARCHAR(32) NOT NULL,
          "provider_sub" VARCHAR(255) NOT NULL,
          "email" VARCHAR(255) NOT NULL,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "auth_identities_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id")
            ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "auth_identities_provider_sub_unique"
            UNIQUE ("provider", "provider_sub")
        );
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "idx_auth_identities_user_id" ON "auth_identities"("user_id");
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "idx_auth_identities_email" ON "auth_identities"("email");
      `);
      this.logger.log('Tabela PostgreSQL [auth_identities] verificada/criada com sucesso.');
    } catch (e: any) {
      this.logger.warn(`Aviso ao verificar auth_identities: ${e?.message}`);
    }
  }

  /**
   * Cria automaticamente a tabela de tokens de recuperação de senha no PostgreSQL existente.
   */
  private async ensurePasswordResetTable() {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
          "id" UUID NOT NULL DEFAULT gen_random_uuid(),
          "user_id" UUID NOT NULL,
          "email" VARCHAR(255) NOT NULL,
          "code_hash" VARCHAR(128) NOT NULL,
          "expires_at" TIMESTAMPTZ NOT NULL,
          "used_at" TIMESTAMPTZ,
          "attempts" INTEGER NOT NULL DEFAULT 0,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "password_reset_tokens_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id")
            ON DELETE CASCADE ON UPDATE CASCADE
        );
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "idx_password_reset_email_created"
          ON "password_reset_tokens"("email", "created_at" DESC);
      `);
      this.logger.log('Tabela PostgreSQL [password_reset_tokens] verificada/criada com sucesso.');
    } catch (err: any) {
      this.logger.warn(`Aviso ao verificar tabela password_reset_tokens: ${err?.message}`);
    }
  }

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

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Esta conta foi criada com o Google. Por favor, entre usando o botão "Continuar com Google" ou use a recuperação de senha para definir uma senha.',
      );
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
   * Autenticação e Cadastro Oficial com Google via ID Token Criptográfico (ETAPA 2).
   * Valida obrigatoriamente assinatura, expiração, audience, issuer e email_verified = true.
   * Não aceita e-mail ou nome enviados pelo app: todos os dados vêm do token criptografado.
   */
  async authenticateGoogle(body: { idToken?: string; termsAcceptedVersion?: string }) {
    const idToken = (body?.idToken || '').trim();
    if (!idToken) {
      throw new BadRequestException('ID token do Google não informado.');
    }

    const expectedClientId =
      this.configService.get<string>('GOOGLE_WEB_CLIENT_ID') ||
      process.env.GOOGLE_WEB_CLIENT_ID ||
      '';

    let payload: any;
    try {
      const client = new OAuth2Client(expectedClientId || undefined);
      const ticket = await client.verifyIdToken({
        idToken,
        audience: expectedClientId || undefined,
      });
      payload = ticket.getPayload();
    } catch (err: any) {
      this.logger.error(`Falha ao verificar idToken Google: ${err?.message}`);
      throw new UnauthorizedException(
        `Token do Google inválido ou não autorizado: ${err?.message || 'Verifique o GOOGLE_WEB_CLIENT_ID'}`,
      );
    }

    if (!payload) {
      throw new UnauthorizedException('Não foi possível obter os dados do token do Google.');
    }

    // 1. Validações estritas de segurança
    const issuer = payload.iss;
    if (issuer !== 'accounts.google.com' && issuer !== 'https://accounts.google.com') {
      throw new UnauthorizedException('Emissor (iss) do token do Google inválido.');
    }

    if (expectedClientId && payload.aud !== expectedClientId) {
      throw new UnauthorizedException('Audiência (aud) do token não corresponde ao cliente configurado.');
    }

    if (!payload.email_verified) {
      throw new UnauthorizedException('O endereço de e-mail do Google precisa estar verificado.');
    }

    const sub = String(payload.sub || '').trim();
    const verifiedEmail = String(payload.email || '').toLowerCase().trim();
    const verifiedName = String(payload.name || payload.given_name || 'Usuário Google').trim();
    const verifiedPicture = payload.picture || null;

    if (!sub || !verifiedEmail) {
      throw new UnauthorizedException('Identificador de usuário do Google inválido.');
    }

    // Garante que a estrutura de banco e auth_identities esteja pronta
    await this.ensureDatabaseSchema();

    try {
      // 2. Transação atômica no PostgreSQL com 3 casos obrigatórios
      const result = await this.prisma.$transaction(async (tx) => {
        // Caso 1: Identidade (google, sub) já existe na auth_identities -> Login direto
        const identityRows: any[] = await tx.$queryRawUnsafe(
          `SELECT "id", "user_id", "email" FROM "auth_identities" WHERE "provider" = $1 AND "provider_sub" = $2 LIMIT 1`,
          'google',
          sub,
        );

        let targetUserId: string | null = null;
        let isNewUser = false;

        if (identityRows && identityRows.length > 0) {
          targetUserId = identityRows[0].user_id;
        } else {
          // Caso 2: Identidade ainda não existe para este sub, mas o e-mail já pertence a usuário existente
          const existingUser = await tx.user.findUnique({
            where: { email: verifiedEmail },
            select: { id: true, avatarUrl: true },
          });

          if (existingUser) {
            targetUserId = existingUser.id;
            // Vincula a identidade Google ao usuário existente
            await tx.$executeRawUnsafe(
              `INSERT INTO "auth_identities" ("user_id", "provider", "provider_sub", "email")
               VALUES ($1::uuid, $2, $3, $4)
               ON CONFLICT ("provider", "provider_sub") DO NOTHING`,
              targetUserId,
              'google',
              sub,
              verifiedEmail,
            );
            // Atualiza avatar se não tiver e marca email como verificado
            await tx.$executeRawUnsafe(
              `UPDATE "users" SET "email_verified" = true ${verifiedPicture && !existingUser.avatarUrl ? ', "avatar_url" = $2' : ''} WHERE "id" = $1::uuid`,
              ...(verifiedPicture && !existingUser.avatarUrl ? [targetUserId, verifiedPicture] : [targetUserId]),
            );
          } else {
            // Caso 3: Não existe usuário nem identidade -> Cria novo usuário com password_hash nulo
            isNewUser = true;
            const termsVersion = (body?.termsAcceptedVersion || '1.0').trim();

            const createdRows: any[] = await tx.$queryRawUnsafe(
              `INSERT INTO "users" ("id", "email", "password_hash", "full_name", "avatar_url", "email_verified", "terms_accepted_at", "terms_accepted_version", "created_at", "updated_at")
               VALUES (gen_random_uuid(), $1, NULL, $2, $3, true, NOW(), $4, NOW(), NOW())
               RETURNING "id"`,
              verifiedEmail,
              verifiedName,
              verifiedPicture,
              termsVersion,
            );

            targetUserId = createdRows[0]?.id;

            await tx.$executeRawUnsafe(
              `INSERT INTO "auth_identities" ("user_id", "provider", "provider_sub", "email")
               VALUES ($1::uuid, $2, $3, $4)`,
              targetUserId,
              'google',
              sub,
              verifiedEmail,
            );
          }
        }

        // Busca dados completos do usuário
        if (!targetUserId) {
          throw new UnauthorizedException('Erro ao vincular usuário.');
        }

        const user = await tx.user.findUnique({
          where: { id: targetUserId },
          include: {
            householdMemberships: {
              include: { household: true },
            },
          },
        });

        if (!user || !user.isActive) {
          throw new UnauthorizedException('Esta conta está desativada ou não foi encontrada.');
        }

        return { user, isNewUser };
      });

      const token = await this.generateToken(result.user.id, result.user.email);

      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          avatarUrl: result.user.avatarUrl || null,
          activeHousehold: result.user.householdMemberships[0]?.household || null,
          roleInHousehold: result.user.householdMemberships[0]?.role || null,
        },
        token,
        isNewUser: result.isNewUser,
      };
    } catch (dbErr: any) {
      this.logger.error(`Erro ao autenticar com o Google no banco: ${dbErr?.message}`);
      throw new BadRequestException(`Erro no banco de dados ao salvar autenticação Google: ${dbErr?.message}`);
    }
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

  /**
   * 1. Solicita a recuperação de senha por e-mail (gera código OTP de 6 dígitos válido por 15 min).
   */
  async requestPasswordReset(rawEmail?: string) {
    const cleanEmail = (rawEmail || '').toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new BadRequestException('Informe um endereço de e-mail válido.');
    }

    await this.ensurePasswordResetTable();

    const user = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true, email: true, fullName: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException(
        'Não encontramos nenhuma conta ativa cadastrada com este e-mail.',
      );
    }

    // Invalida códigos anteriores ainda não utilizados para este usuário
    await this.prisma.$executeRawUnsafe(
      `UPDATE "password_reset_tokens" SET "used_at" = NOW() WHERE "user_id" = $1::uuid AND "used_at" IS NULL`,
      user.id,
    );

    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "password_reset_tokens" ("user_id", "email", "code_hash", "expires_at")
       VALUES ($1::uuid, $2, $3, NOW() + INTERVAL '15 minutes')`,
      user.id,
      cleanEmail,
      codeHash,
    );

    try {
      await this.emailService.sendPasswordResetCode({
        toEmail: cleanEmail,
        fullName: user.fullName,
        code,
        expiresInMinutes: 15,
      });
    } catch (mailErr: any) {
      this.logger.error(`Falha no envio de e-mail: ${mailErr?.message}`);
      throw new BadRequestException(
        `Erro ao enviar o e-mail: ${mailErr?.message || 'Verifique as configurações SMTP no servidor.'}`,
      );
    }

    return {
      success: true,
      email: cleanEmail,
      expiresInMinutes: 15,
      message: `Enviamos um código de 6 dígitos para ${cleanEmail}.`,
    };
  }

  /**
   * 2. Valida o código de 6 dígitos enviado por e-mail antes de redefinir a senha.
   */
  async verifyPasswordResetCode(rawEmail?: string, rawCode?: string) {
    const cleanEmail = (rawEmail || '').toLowerCase().trim();
    const cleanCode = String(rawCode || '').replace(/\D+/g, '').trim();

    if (!cleanEmail || cleanCode.length !== 6) {
      throw new BadRequestException('Informe o e-mail e o código de 6 dígitos enviado.');
    }

    await this.ensurePasswordResetTable();

    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT "id", "user_id", "code_hash", "expires_at", "used_at", "attempts"
       FROM "password_reset_tokens"
       WHERE "email" = $1 AND "used_at" IS NULL
       ORDER BY "created_at" DESC
       LIMIT 1`,
      cleanEmail,
    );

    const tokenRecord = rows?.[0];
    if (!tokenRecord) {
      throw new BadRequestException(
        'Nenhum código ativo encontrado para este e-mail. Solicite um novo código.',
      );
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      throw new BadRequestException('Este código expirou. Solicite um novo código de 6 dígitos.');
    }

    if (Number(tokenRecord.attempts || 0) >= 5) {
      throw new BadRequestException(
        'Número máximo de tentativas excedido. Solicite um novo código.',
      );
    }

    const inputHash = crypto.createHash('sha256').update(cleanCode).digest('hex');
    if (inputHash !== tokenRecord.code_hash) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "password_reset_tokens" SET "attempts" = "attempts" + 1 WHERE "id" = $1::uuid`,
        tokenRecord.id,
      );
      throw new BadRequestException(
        'Código inválido. Verifique os 6 dígitos enviados para o seu e-mail.',
      );
    }

    return {
      valid: true,
      tokenId: tokenRecord.id,
      userId: tokenRecord.user_id,
      message: 'Código verificado com sucesso.',
    };
  }

  /**
   * 3. Redefine a senha no PostgreSQL validando o código de 6 dígitos e retorna sessão autenticada.
   */
  async resetPasswordWithCode(body: {
    email?: string;
    code?: string;
    newPassword?: string;
  }) {
    const cleanEmail = (body?.email || '').toLowerCase().trim();
    const cleanCode = String(body?.code || '').replace(/\D+/g, '').trim();
    const newPassword = String(body?.newPassword || '');

    if (newPassword.length < 6) {
      throw new BadRequestException('A nova senha deve ter pelo menos 6 caracteres.');
    }

    const verification = await this.verifyPasswordResetCode(cleanEmail, cleanCode);

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    const updatedUser = await this.prisma.user.update({
      where: { id: verification.userId },
      data: { passwordHash },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
      },
    });

    await this.prisma.$executeRawUnsafe(
      `UPDATE "password_reset_tokens" SET "used_at" = NOW() WHERE "id" = $1::uuid`,
      verification.tokenId,
    );

    const token = await this.generateToken(updatedUser.id, updatedUser.email);

    return {
      success: true,
      message: 'Sua senha foi redefinida com sucesso!',
      user: updatedUser,
      token,
    };
  }

  /**
   * Atualiza a senha do usuário já autenticado no aplicativo.
   */
  async changePassword(userId: string, newPassword?: string) {
    const cleanPass = String(newPassword || '');
    if (cleanPass.length < 6) {
      throw new BadRequestException('A nova senha deve ter pelo menos 6 caracteres.');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(cleanPass, salt);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return {
      success: true,
      message: 'Senha atualizada com sucesso!',
    };
  }

  private async generateToken(userId: string, email: string): Promise<string> {
    const payload = { sub: userId, email };
    return this.jwtService.signAsync(payload);
  }
}

