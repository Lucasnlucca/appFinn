import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { PrismaModule } from './modules/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { HouseholdsModule } from './modules/households/households.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { CreditCardsModule } from './modules/credit-cards/credit-cards.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ImportsModule } from './modules/imports/imports.module';
import { BankingModule } from './modules/banking/banking.module';
import { AiAgentModule } from './modules/ai-agent/ai-agent.module';
import { GoalsModule } from './modules/goals/goals.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { PlanningModule } from './modules/planning/planning.module';
import { AuditModule } from './modules/audit/audit.module';
import { PrivacyModule } from './modules/privacy/privacy.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['../../.env', '.env'],
    }),
    PrismaModule,
    AuditModule,
    PrivacyModule,
    HealthModule,
    AuthModule,
    HouseholdsModule,
    PermissionsModule,
    CategoriesModule,
    AccountsModule,
    CreditCardsModule,
    TransactionsModule,
    ReportsModule,
    ImportsModule,
    BankingModule,
    AiAgentModule,
    GoalsModule,
    BudgetsModule,
    PlanningModule,
  ],
})
export class AppModule {}
