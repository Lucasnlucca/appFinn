import { Controller, Get, Post, Body, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { RealtimeService, DbChangeEvent } from './realtime.service';

@ApiTags('Realtime Stream (SSE)')
@Controller('stream')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  @Get()
  @ApiOperation({
    summary:
      'Stream Server-Sent Events (SSE) em tempo real conectado ao PostgreSQL LISTEN db_changes',
  })
  streamEvents(@Req() req: Request, @Res() res: Response) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const clientId = crypto.randomUUID();
    this.realtimeService.addSseClient(clientId, res);

    res.write(
      `data: ${JSON.stringify({
        table: 'system',
        action: 'CONNECTED',
        data: { clientId, channel: 'db_changes' },
        timestamp: Date.now(),
      })}\n\n`,
    );

    req.on('close', () => {
      try {
        res.end();
      } catch {
        // ignore
      }
    });
  }

  @Post('emit')
  @ApiOperation({
    summary: 'Emite notificação realtime imediata para clientes conectados',
  })
  emitChange(@Body() body: Partial<DbChangeEvent>) {
    this.realtimeService.broadcastChange({
      table: body?.table || 'manual',
      action: body?.action || 'UPDATE',
      data: body?.data || null,
      timestamp: Date.now(),
    });
    return { ok: true };
  }
}
