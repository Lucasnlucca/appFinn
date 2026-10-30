import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { SharingAccessLevel } from '@finn-ai/shared';

export class UpdateSharingDto {
  recipientUserId!: string;
  resourceType!: 'ACCOUNT' | 'CREDIT_CARD' | 'GOAL';
  resourceId!: string;
  accessLevel!: SharingAccessLevel;
}

@ApiTags('Permissions')
@Controller('permissions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post('share')
  @ApiOperation({ summary: 'Definir permissão de compartilhamento granular com cônjuge' })
  async updateSharing(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSharingDto,
  ) {
    return this.permissionsService.setSharingPermission(
      user.id,
      dto.recipientUserId,
      dto.resourceType,
      dto.resourceId,
      dto.accessLevel,
    );
  }
}

