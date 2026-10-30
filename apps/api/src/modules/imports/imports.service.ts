import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Decimal } from '@finn-ai/database';

export interface ParsedTransactionRow {
  externalId?: string;
  date: Date;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  isDuplicate: boolean;
  suggestedCategoryId?: string;
  suggestedCategoryName?: string;
}

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Processa arquivo OFX ou CSV e retorna a prévia com validação de duplicidade
   */
  async previewImport(
    userId: string,
    accountId: string,
    fileContent: string,
    fileFormat: 'OFX' | 'CSV',
    fileName: string,
  ): Promise<{ fileName: string; rows: ParsedTransactionRow[]; totalRows: number; duplicateRows: number }> {
    const account = await this.prisma.financialAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Conta bancária selecionada não foi encontrada');
    }

    let parsedRows: Array<{ externalId?: string; date: Date; description: string; amount: number; type: 'INCOME' | 'EXPENSE' }> = [];

    if (fileFormat === 'OFX') {
      parsedRows = this.parseOfx(fileContent);
    } else if (fileFormat === 'CSV') {
      parsedRows = this.parseCsv(fileContent);
    } else {
      throw new BadRequestException('Formato de arquivo não suportado. Utilize OFX ou CSV.');
    }

    if (parsedRows.length === 0) {
      throw new BadRequestException('Nenhuma movimentação válida encontrada no arquivo fornecido');
    }

    // Carrega categorias existentes para auto-sugestão
    const categories = await this.prisma.transactionCategory.findMany();

    // Deduplicação: verifica se a movimentação já existe no banco
    let duplicateCount = 0;
    const enrichedRows: ParsedTransactionRow[] = [];

    for (const row of parsedRows) {
      const dateStr = row.date.toISOString().split('T')[0];
      const amountDecimal = new Decimal(row.amount);
      const idempotencyKey = crypto
        .createHash('sha256')
        .update(`${accountId}:${row.externalId || row.description}:${amountDecimal.toFixed(2)}:${dateStr}`)
        .digest('hex');

      const existingTx = await this.prisma.transaction.findFirst({
        where: {
          accountId,
          OR: [
            { idempotencyKey },
            {
              amount: amountDecimal,
              date: {
                gte: new Date(row.date.getFullYear(), row.date.getMonth(), row.date.getDate(), 0, 0, 0),
                lte: new Date(row.date.getFullYear(), row.date.getMonth(), row.date.getDate(), 23, 59, 59),
              },
              description: { contains: row.description.substring(0, 15) },
            },
          ],
        },
      });

      const isDuplicate = !!existingTx;
      if (isDuplicate) duplicateCount++;

      // Sugestão de categoria
      const suggestedCat = this.suggestCategory(row.description, categories);

      enrichedRows.push({
        ...row,
        isDuplicate,
        suggestedCategoryId: suggestedCat?.id,
        suggestedCategoryName: suggestedCat?.name,
      });
    }

    return {
      fileName,
      rows: enrichedRows,
      totalRows: enrichedRows.length,
      duplicateRows: duplicateCount,
    };
  }

  /**
   * Confirma e persiste as linhas aprovadas pelo usuário
   */
  async confirmImport(
    userId: string,
    accountId: string,
    fileName: string,
    rows: Array<{
      date: string;
      description: string;
      amount: number;
      type: 'INCOME' | 'EXPENSE';
      categoryId?: string;
      externalId?: string;
    }>,
  ) {
    const account = await this.prisma.financialAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Conta bancária não encontrada');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Registra o lote de importação
      const batch = await tx.importBatch.create({
        data: {
          userId,
          fileName,
          format: fileName.endsWith('.ofx') ? 'OFX' : 'CSV',
          totalRows: rows.length,
          importedRows: rows.length,
        },
      });

      let netBalanceChange = new Decimal(0);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const dateObj = new Date(row.date);
        const dateStr = dateObj.toISOString().split('T')[0];
        const amountDecimal = new Decimal(row.amount);

        const idempotencyKey = crypto
          .createHash('sha256')
          .update(`${accountId}:${row.externalId || row.description}:${amountDecimal.toFixed(2)}:${dateStr}`)
          .digest('hex');

        // Cria a transação confirmada
        await tx.transaction.create({
          data: {
            userId,
            accountId,
            type: row.type,
            amount: amountDecimal,
            date: dateObj,
            description: row.description,
            categoryId: row.categoryId || null,
            idempotencyKey,
            externalId: row.externalId || null,
            status: 'POSTED',
          },
        });

        // Registra linha do lote
        await tx.importRow.create({
          data: {
            importBatchId: batch.id,
            rowIndex: i + 1,
            rawData: row,
            isApproved: true,
            parsedDate: dateObj,
            parsedAmount: amountDecimal,
          },
        });

        const change = row.type === 'INCOME' ? amountDecimal : amountDecimal.negated();
        netBalanceChange = netBalanceChange.plus(change);
      }

      // Atualiza o saldo da conta com precisão Decimal
      await tx.financialAccount.update({
        where: { id: accountId },
        data: {
          currentBalance: { increment: netBalanceChange },
          calculatedBalance: { increment: netBalanceChange },
        },
      });

      return {
        batchId: batch.id,
        importedCount: rows.length,
        netBalanceChange: Number(netBalanceChange),
      };
    });
  }

  /**
   * Parser nativo e robusto de extratos OFX (Open Financial Exchange)
   */
  public parseOfx(content: string) {
    const transactions: Array<{ externalId?: string; date: Date; description: string; amount: number; type: 'INCOME' | 'EXPENSE' }> = [];

    // Localiza blocos <STMTTRN>...</STMTTRN>
    const stmttrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;

    while ((match = stmttrnRegex.exec(content)) !== null) {
      const block = match[1];

      const typeMatch = /<TRNTYPE>([^\r\n<]+)/i.exec(block);
      const dateMatch = /<DTPOSTED>([0-9]{8})/i.exec(block);
      const amountMatch = /<TRNAMT>([^\r\n<]+)/i.exec(block);
      const fitidMatch = /<FITID>([^\r\n<]+)/i.exec(block);
      const memoMatch = /<MEMO>([^\r\n<]+)/i.exec(block);
      const nameMatch = /<NAME>([^\r\n<]+)/i.exec(block);

      if (dateMatch && amountMatch) {
        const rawDate = dateMatch[1];
        const year = parseInt(rawDate.substring(0, 4), 10);
        const month = parseInt(rawDate.substring(4, 6), 10) - 1;
        const day = parseInt(rawDate.substring(6, 8), 10);
        const date = new Date(year, month, day, 12, 0, 0);

        const rawAmount = parseFloat(amountMatch[1].replace(',', '.').trim());
        const absAmount = Math.abs(rawAmount);
        const isIncome = rawAmount > 0;

        const description = (nameMatch ? nameMatch[1] : memoMatch ? memoMatch[1] : 'Movimentação OFX').trim();
        const externalId = fitidMatch ? fitidMatch[1].trim() : undefined;

        transactions.push({
          externalId,
          date,
          description,
          amount: absAmount,
          type: isIncome ? 'INCOME' : 'EXPENSE',
        });
      }
    }

    return transactions;
  }

  /**
   * Parser flexível de arquivos CSV com suporte a padrões bancários brasileiros
   */
  public parseCsv(content: string) {
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) return [];

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(delimiter).map((h) => h.toLowerCase().replace(/["']/g, '').trim());

    // Identifica índices das colunas
    const dateIdx = headers.findIndex((h) => h.includes('data') || h.includes('date'));
    const descIdx = headers.findIndex((h) => h.includes('descri') || h.includes('hist') || h.includes('memo') || h.includes('estabelecimento') || h.includes('titulo'));
    const amountIdx = headers.findIndex((h) => h.includes('valor') || h.includes('amount') || h.includes('total'));

    if (dateIdx === -1 || amountIdx === -1) {
      throw new BadRequestException('O CSV deve conter colunas com cabeçalhos de Data e Valor');
    }

    const transactions: Array<{ externalId?: string; date: Date; description: string; amount: number; type: 'INCOME' | 'EXPENSE' }> = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map((c) => c.replace(/["']/g, '').trim());
      if (cols.length <= Math.max(dateIdx, amountIdx)) continue;

      const rawDate = cols[dateIdx];
      const rawDesc = descIdx !== -1 && cols[descIdx] ? cols[descIdx] : `Transação Linha ${i}`;
      const rawAmountStr = cols[amountIdx];

      // Parse de Data: suporta DD/MM/YYYY ou YYYY-MM-DD
      let date: Date | null = null;
      if (rawDate.includes('/')) {
        const parts = rawDate.split('/');
        if (parts.length === 3) {
          date = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10), 12, 0, 0);
        }
      } else if (rawDate.includes('-')) {
        date = new Date(`${rawDate}T12:00:00Z`);
      }

      // Parse de Valor: suporta -1.250,50 ou -1250.50
      let cleanAmount = rawAmountStr.replace('R$', '').replace(/\s/g, '');
      if (cleanAmount.includes(',') && cleanAmount.includes('.')) {
        cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.');
      } else if (cleanAmount.includes(',')) {
        cleanAmount = cleanAmount.replace(',', '.');
      }

      const numAmount = parseFloat(cleanAmount);

      if (date && !isNaN(date.getTime()) && !isNaN(numAmount)) {
        transactions.push({
          date,
          description: rawDesc,
          amount: Math.abs(numAmount),
          type: numAmount >= 0 ? 'INCOME' : 'EXPENSE',
        });
      }
    }

    return transactions;
  }

  /**
   * Sugestão inteligente de categoria com base em palavras-chave
   */
  private suggestCategory(description: string, categories: Array<{ id: string; name: string }>) {
    const descLower = description.toLowerCase();

    const rules: Array<{ keywords: string[]; categoryMatch: string }> = [
      { keywords: ['supermercado', 'mercado', 'pao de acucar', 'carrefour', 'extra', 'hortifruti', 'atacad', 'acougue'], categoryMatch: 'Alimentação' },
      { keywords: ['uber', '99app', 'posto', 'gasolina', 'combustivel', 'ipva', 'estacionamento', 'pedagio'], categoryMatch: 'Transporte' },
      { keywords: ['aluguel', 'condominio', 'enel', 'sabesp', 'luz', 'energia', 'agua', 'iptu', 'gas'], categoryMatch: 'Moradia' },
      { keywords: ['farmacia', 'droga', 'hospital', 'medico', 'consulta', 'laboratorio', 'dentista'], categoryMatch: 'Saúde' },
      { keywords: ['restaurante', 'bar', 'ifood', 'padaria', 'lanche', 'cinema', 'show', 'viagem'], categoryMatch: 'Lazer' },
      { keywords: ['salario', 'ted recebida', 'pix recebido', 'rendimento', 'pro-labore'], categoryMatch: 'Salário' },
    ];

    for (const rule of rules) {
      if (rule.keywords.some((k) => descLower.includes(k))) {
        const found = categories.find((c) => c.name.toLowerCase().includes(rule.categoryMatch.toLowerCase()));
        if (found) return found;
      }
    }

    return null;
  }
}

