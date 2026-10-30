import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BankingService } from './banking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { IsNotEmpty } from 'class-validator';

export class ConnectBankDto {
  @IsNotEmpty({ message: 'Nome da instituição financeira é obrigatório' })
  institutionName!: string;

  @IsNotEmpty({ message: 'Item ID do Meu Pluggy é obrigatório' })
  externalItemId!: string;
}

@ApiTags('Banking')
@Controller('banking')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BankingController {
  constructor(private readonly bankingService: BankingService) {}

  @Get('connections')
  @ApiOperation({ summary: 'Listar conexões bancárias e status Open Finance' })
  async listConnections(@CurrentUser() user: AuthenticatedUser) {
    return this.bankingService.listConnections(user.id);
  }

  @Post('connections')
  @ApiOperation({ summary: 'Conectar nova instituição bancária via Item ID do Meu Pluggy' })
  async createConnection(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConnectBankDto,
  ) {
    return this.bankingService.createConnection(
      user.id,
      dto.institutionName,
      dto.externalItemId,
    );
  }

  @Post('connections/:id/sync')
  @ApiOperation({ summary: 'Disparar sincronização manual da conexão bancária' })
  async syncConnection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') connectionId: string,
  ) {
    return this.bankingService.syncConnection(user.id, connectionId);
  }

  @Delete('connections/:id')
  @ApiOperation({ summary: 'Desvincular e revogar conexão bancária' })
  async disconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') connectionId: string,
  ) {
    return this.bankingService.disconnect(user.id, connectionId);
  }
}

