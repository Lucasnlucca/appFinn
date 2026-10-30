import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Status de integridade do sistema e dos serviços' })
  @ApiResponse({ status: 200, description: 'Serviço operacional' })
  async checkHealth() {
    let dbStatus = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'disconnected';
    }

    return {
      status: 'ok',
      service: 'finn-ai-api',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      uptimeSeconds: process.uptime(),
      version: '1.0.0',
    };
  }
}

