import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  Min,
  IsBoolean,
  IsInt,
  Max,
} from 'class-validator';
import { FinancialScope, TransactionType, AccountType, TransactionStatus } from '../enums';

export class RegisterDto {
  @IsEmail({}, { message: 'Formato de e-mail inválido' })
  email!: string;

  @MinLength(8, { message: 'A senha deve conter no mínimo 8 caracteres' })
  password!: string;

  @IsNotEmpty({ message: 'Nome completo é obrigatório' })
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Formato de e-mail inválido' })
  email!: string;

  @IsNotEmpty({ message: 'Senha é obrigatória' })
  password!: string;
}

export class CreateHouseholdDto {
  @IsNotEmpty({ message: 'Nome da família é obrigatório' })
  name!: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class InviteMemberDto {
  @IsEmail({}, { message: 'E-mail do cônjuge/membro é inválido' })
  email!: string;
}

export class CreateAccountDto {
  @IsNotEmpty({ message: 'Nome da conta é obrigatório' })
  name!: string;

  @IsEnum(AccountType, { message: 'Tipo de conta inválido' })
  type!: AccountType;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  initialBalance?: number = 0;

  @IsOptional()
  @IsString()
  colorHex?: string;

  @IsOptional()
  @IsBoolean()
  isShared?: boolean = false;
}

export class CreateCreditCardDto {
  @IsNotEmpty({ message: 'Nome do cartão é obrigatório' })
  name!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLimit!: number;

  @IsInt()
  @Min(1)
  @Max(31)
  closingDay!: number;

  @IsInt()
  @Min(1)
  @Max(31)
  dueDay!: number;

  @IsOptional()
  @IsString()
  financialAccountId?: string;

  @IsOptional()
  @IsString()
  colorHex?: string;
}

export class CreateTransactionDto {
  @IsNotEmpty({ message: 'Descrição é obrigatória' })
  description!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor inválido' })
  @Min(0.01, { message: 'O valor mínimo é R$ 0,01' })
  amount!: number;

  @IsEnum(TransactionType, { message: 'Tipo de transação inválido' })
  type!: TransactionType;

  @IsNotEmpty({ message: 'Data é obrigatória' })
  date!: string; // ISO 8601

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  creditCardId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  isHouseholdShared?: boolean = false;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus = TransactionStatus.POSTED;
}

export class CreateTransferDto {
  @IsNotEmpty()
  sourceAccountId!: string;

  @IsNotEmpty()
  destinationAccountId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsNotEmpty()
  date!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isInternalHousehold?: boolean = false;
}

export class CreateCategoryDto {
  @IsNotEmpty({ message: 'Nome da categoria é obrigatório' })
  name!: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  colorHex?: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}

export class CreateGoalDto {
  @IsNotEmpty({ message: 'Título da meta é obrigatório' })
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1, { message: 'Valor alvo deve ser de no mínimo R$ 1,00' })
  targetAmount!: number;

  @IsNotEmpty({ message: 'Data limite é obrigatória' })
  targetDate!: string; // YYYY-MM-DD

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  plannedMonthly?: number;

  @IsOptional()
  @IsInt()
  priority?: number = 1;
}

export class GoalContributionDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'O valor mínimo de aporte é R$ 0,01' })
  amount!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SetBudgetDto {
  @IsNotEmpty({ message: 'Categoria é obrigatória' })
  categoryId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'O teto de gastos deve ser maior que zero' })
  amountLimit!: number;
}

export class SimulatePlanDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(100)
  targetAmount!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(10)
  monthlyContribution!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  horizonMonths?: number;
}

export class FinancialQueryDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsEnum(FinancialScope)
  scope?: FinancialScope = FinancialScope.PERSONAL;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
