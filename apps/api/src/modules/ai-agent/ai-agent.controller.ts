import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiAgentService } from './ai-agent.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { IsNotEmpty, IsOptional, IsEnum, IsString } from 'class-validator';
import { FinancialScope } from '@finn-ai/shared';

export class ChatMessageDto {
  @IsNotEmpty({ message: 'Mensagem é obrigatória' })
  message!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsEnum(FinancialScope)
  scope?: FinancialScope = FinancialScope.HOUSEHOLD;
}

export class ConfirmDraftDto {
  @IsNotEmpty({ message: 'ID do rascunho é obrigatório' })
  draftId!: string;
}

@ApiTags('AI Agent')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiAgentController {
  constructor(private readonly aiAgentService: AiAgentService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Conversar com o Agente FINN com Function Calling' })
  async chat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChatMessageDto,
  ) {
    return this.aiAgentService.processUserMessage(
      user.id,
      dto.message,
      dto.conversationId,
      dto.scope,
    );
  }

  @Post('confirm-draft')
  @ApiOperation({ summary: 'Aprovar e efetivar rascunho de ação gerado pela IA (Protocolo de 2 Etapas)' })
  async confirmDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmDraftDto,
  ) {
    return this.aiAgentService.confirmDraft(user.id, dto.draftId);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Listar histórico de conversas do usuário com o FINN' })
  async listConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.aiAgentService.listConversas(user.id);
  }
}

