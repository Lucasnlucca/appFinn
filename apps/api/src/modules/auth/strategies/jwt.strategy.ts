import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1. Extração prioritária via Cookie HttpOnly
        (request: Request) => {
          if (request && request.cookies && request.cookies.finn_token) {
            return request.cookies.finn_token;
          }
          return null;
        },
        // 2. Extração via Authorization Header (Bearer)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret', 'default-jwt-access-secret-32-chars-min'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        householdMemberships: {
          select: {
            householdId: true,
            role: true,
          },
          take: 1,
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuário inativo ou sessão inválida');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      activeHouseholdId: user.householdMemberships[0]?.householdId || null,
      householdRole: user.householdMemberships[0]?.role || null,
    };
  }
}

