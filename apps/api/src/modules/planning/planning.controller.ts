import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlanningService } from './planning.service';
import { SimulatePlanDto } from '@finn-ai/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Planning')
@Controller('planning')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @Post('simulate')
  @ApiOperation({ summary: 'Simular cenários de economia (Conservador, Base, Otimista)' })
  simulate(@Body() dto: SimulatePlanDto) {
    return this.planningService.simulateScenarios(dto);
  }
}

