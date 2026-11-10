import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService, NotificationPreferencePayload } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Notificações & Preferências (PostgreSQL)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar notificações do usuário salvas no PostgreSQL' })
  list(@CurrentUser() user: { id: string }, @Query('limit') limit?: string) {
    return this.notificationsService.listUserNotifications(
      user.id,
      limit ? parseInt(limit, 10) : 50
    );
  }

  @Post()
  @ApiOperation({ summary: 'Criar/sincronizar notificação no PostgreSQL com deduplicação' })
  create(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      id?: string;
      title: string;
      body?: string;
      message?: string;
      type?: string;
      category?: string;
      priority?: string;
      action?: any;
      dedupeKey?: string;
      meta?: any;
      read?: boolean;
      sendPush?: boolean;
    }
  ) {
    return this.notificationsService.createOrUpsertNotification(user.id, body);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar notificação individual como lida no PostgreSQL' })
  markRead(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user.id, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Marcar todas as notificações como lidas no PostgreSQL' })
  markAllRead(
    @CurrentUser() user: { id: string },
    @Body() body?: { ids?: string[] }
  ) {
    return this.notificationsService.markAllAsRead(user.id, body?.ids);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Obter preferências de notificação do usuário no PostgreSQL' })
  getPreferences(@CurrentUser() user: { id: string }) {
    return this.notificationsService.getPreferences(user.id);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Atualizar preferências de notificação do usuário no PostgreSQL' })
  updatePreferences(
    @CurrentUser() user: { id: string },
    @Body() body: NotificationPreferencePayload
  ) {
    return this.notificationsService.updatePreferences(user.id, body);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Atualizar parcialmente preferências de notificação no PostgreSQL' })
  patchPreferences(
    @CurrentUser() user: { id: string },
    @Body() body: NotificationPreferencePayload
  ) {
    return this.notificationsService.updatePreferences(user.id, body);
  }

  @Post('push-token')
  @ApiOperation({ summary: 'Registrar token de Push (Expo/FCM/APNs) do dispositivo no PostgreSQL' })
  registerPushToken(
    @CurrentUser() user: { id: string },
    @Body() body: { pushToken: string; platform?: string; deviceName?: string }
  ) {
    return this.notificationsService.registerPushToken(user.id, body);
  }
}
