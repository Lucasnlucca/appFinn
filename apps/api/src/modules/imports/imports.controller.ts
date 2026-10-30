import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ImportsService } from './imports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { IsNotEmpty, IsEnum, IsArray } from 'class-validator';

export class PreviewImportDto {
  @IsNotEmpty({ message: 'Conta bancária de destino é obrigatória' })
  accountId!: string;

  @IsNotEmpty({ message: 'Conteúdo do arquivo é obrigatório' })
  fileContent!: string;

  @IsEnum(['OFX', 'CSV'], { message: 'Formato deve ser OFX ou CSV' })
  fileFormat!: 'OFX' | 'CSV';

  @IsNotEmpty({ message: 'Nome do arquivo é obrigatório' })
  fileName!: string;
}

export class ConfirmImportDto {
  @IsNotEmpty({ message: 'Conta bancária de destino é obrigatória' })
  accountId!: string;

  @IsNotEmpty({ message: 'Nome do arquivo é obrigatório' })
  fileName!: string;

  @IsArray({ message: 'Linhas aprovadas são obrigatórias' })
  rows!: Array<{
    date: string;
    description: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    categoryId?: string;
    externalId?: string;
  }>;
}

@ApiTags('Imports')
@Controller('imports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('preview')
  @ApiOperation({ summary: 'Processar arquivo OFX ou CSV e retornar prévia com deduplicação' })
  async previewImport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PreviewImportDto,
  ) {
    return this.importsService.previewImport(
      user.id,
      dto.accountId,
      dto.fileContent,
      dto.fileFormat,
      dto.fileName,
    );
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Confirmar e gravar no banco as movimentações validadas' })
  async confirmImport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmImportDto,
  ) {
    return this.importsService.confirmImport(
      user.id,
      dto.accountId,
      dto.fileName,
      dto.rows,
    );
  }
}

