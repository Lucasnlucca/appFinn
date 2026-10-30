import { Module } from '@nestjs/common';
import { BankingService } from './banking.service';
import { BankingController } from './banking.controller';
import { PluggyBankingProvider } from './providers/pluggy.provider';

@Module({
  controllers: [BankingController],
  providers: [BankingService, PluggyBankingProvider],
  exports: [BankingService, PluggyBankingProvider],
})
export class BankingModule {}

