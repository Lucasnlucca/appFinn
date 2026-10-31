-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "HouseholdRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'INVESTMENT', 'CASH', 'DIGITAL_WALLET', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('IDLE', 'RUNNING', 'SUCCESS', 'FAILED', 'CONSENT_EXPIRED');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('OPEN', 'CLOSED', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('OFX', 'CSV', 'PDF_STATEMENT', 'RECEIPT_IMAGE', 'AUDIO', 'OTHER');

-- CreateEnum
CREATE TYPE "SharingAccessLevel" AS ENUM ('NONE', 'VIEW_ONLY', 'VIEW_AND_EDIT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_members" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "HouseholdRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_invitations" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "invited_by_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "HouseholdRole" NOT NULL DEFAULT 'MEMBER',
    "token_hash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sharing_permissions" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "recipient_user_id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "access_level" "SharingAccessLevel" NOT NULL DEFAULT 'VIEW_ONLY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sharing_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'PLUGGY',
    "institution_name" TEXT NOT NULL,
    "institution_code" TEXT,
    "connector_id" TEXT,
    "status" "SyncStatus" NOT NULL DEFAULT 'IDLE',
    "consent_expires_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_connection_items" (
    "id" TEXT NOT NULL,
    "bank_connection_id" TEXT NOT NULL,
    "external_item_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPDATED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_connection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_sync_jobs" (
    "id" TEXT NOT NULL,
    "bank_connection_id" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "bank_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_sync_history" (
    "id" TEXT NOT NULL,
    "bank_connection_id" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "accounts_synced" INTEGER NOT NULL DEFAULT 0,
    "transactions_synced" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_sync_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bank_connection_id" TEXT,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL DEFAULT 'CHECKING',
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "current_balance" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "calculated_balance" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "account_number" TEXT,
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "color_hex" TEXT,
    "icon" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_cards" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "financial_account_id" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "credit_limit" DECIMAL(14,2) NOT NULL,
    "closing_day" INTEGER NOT NULL,
    "due_day" INTEGER NOT NULL,
    "color_hex" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_card_bills" (
    "id" TEXT NOT NULL,
    "credit_card_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "closing_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "status" "BillStatus" NOT NULL DEFAULT 'OPEN',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_card_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_categories" (
    "id" TEXT NOT NULL,
    "household_id" TEXT,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color_hex" TEXT,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT,
    "credit_card_id" TEXT,
    "credit_card_bill_id" TEXT,
    "category_id" TEXT,
    "installment_id" TEXT,
    "recurring_id" TEXT,
    "document_id" TEXT,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'POSTED',
    "amount" DECIMAL(14,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "competence_date" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "merchant_name" TEXT,
    "is_household_shared" BOOLEAN NOT NULL DEFAULT false,
    "idempotency_key" TEXT,
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color_hex" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_tag_links" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "transaction_tag_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_splits" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL,
    "source_transaction_id" TEXT NOT NULL,
    "destination_transaction_id" TEXT NOT NULL,
    "is_internal_household" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installments" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "total_parts" INTEGER NOT NULL,
    "current_part" INTEGER NOT NULL,
    "amount_per_part" DECIMAL(14,2) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_transactions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "frequency" TEXT NOT NULL,
    "day_of_month" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "amount_limit" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_periods" (
    "id" TEXT NOT NULL,
    "budget_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "spent_amount" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "alert_sent_at" TIMESTAMP(3),

    CONSTRAINT "budget_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "target_amount" DECIMAL(14,2) NOT NULL,
    "current_amount" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "target_date" TIMESTAMP(3) NOT NULL,
    "planned_monthly" DECIMAL(14,2),
    "status" "GoalStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_contributions" (
    "id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "goal_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_plans" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "horizon_months" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_scenarios" (
    "id" TEXT NOT NULL,
    "financial_plan_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projected_rate_pct" DECIMAL(5,2) NOT NULL,
    "projected_savings" DECIMAL(14,2) NOT NULL,
    "assumptions_json" JSONB NOT NULL,

    CONSTRAINT "financial_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL DEFAULT 'OTHER',
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_extractions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "raw_json" JSONB NOT NULL,
    "confidence" DECIMAL(5,2),
    "extracted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "imported_rows" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" TEXT NOT NULL,
    "import_batch_id" TEXT NOT NULL,
    "row_index" INTEGER NOT NULL,
    "raw_data" JSONB NOT NULL,
    "is_duplicate" BOOLEAN NOT NULL DEFAULT false,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "parsed_date" TIMESTAMP(3),
    "parsed_amount" DECIMAL(14,2),

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Nova conversa',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokens_used" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_tool_calls" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "args_json" JSONB NOT NULL,
    "result_json" JSONB,
    "status" TEXT NOT NULL DEFAULT 'EXECUTED',
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_tool_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_consents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "term_version" TEXT NOT NULL,
    "consent_type" TEXT NOT NULL,
    "has_granted" BOOLEAN NOT NULL DEFAULT true,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "key" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "household_members_household_id_user_id_key" ON "household_members"("household_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "household_invitations_token_hash_key" ON "household_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "household_invitations_email_idx" ON "household_invitations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sharing_permissions_owner_user_id_recipient_user_id_resourc_key" ON "sharing_permissions"("owner_user_id", "recipient_user_id", "resource_type", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_connection_items_bank_connection_id_external_item_id_key" ON "bank_connection_items"("bank_connection_id", "external_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_card_bills_credit_card_id_month_year_key" ON "credit_card_bills"("credit_card_id", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_idempotency_key_key" ON "transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "transactions_user_id_date_idx" ON "transactions"("user_id", "date");

-- CreateIndex
CREATE INDEX "transactions_account_id_idx" ON "transactions"("account_id");

-- CreateIndex
CREATE INDEX "transactions_credit_card_bill_id_idx" ON "transactions"("credit_card_bill_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_tags_name_key" ON "transaction_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_tag_links_transaction_id_tag_id_key" ON "transaction_tag_links"("transaction_id", "tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_source_transaction_id_key" ON "transfers"("source_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_destination_transaction_id_key" ON "transfers"("destination_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_household_id_category_id_key" ON "budgets"("household_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_periods_budget_id_month_year_key" ON "budget_periods"("budget_id", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "ai_preferences_user_id_key_key" ON "ai_preferences"("user_id", "key");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_invitations" ADD CONSTRAINT "household_invitations_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_invitations" ADD CONSTRAINT "household_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sharing_permissions" ADD CONSTRAINT "sharing_permissions_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sharing_permissions" ADD CONSTRAINT "sharing_permissions_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_connection_items" ADD CONSTRAINT "bank_connection_items_bank_connection_id_fkey" FOREIGN KEY ("bank_connection_id") REFERENCES "bank_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_sync_jobs" ADD CONSTRAINT "bank_sync_jobs_bank_connection_id_fkey" FOREIGN KEY ("bank_connection_id") REFERENCES "bank_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_sync_history" ADD CONSTRAINT "bank_sync_history_bank_connection_id_fkey" FOREIGN KEY ("bank_connection_id") REFERENCES "bank_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_bank_connection_id_fkey" FOREIGN KEY ("bank_connection_id") REFERENCES "bank_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_bills" ADD CONSTRAINT "credit_card_bills_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_categories" ADD CONSTRAINT "transaction_categories_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_categories" ADD CONSTRAINT "transaction_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "transaction_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "credit_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_credit_card_bill_id_fkey" FOREIGN KEY ("credit_card_bill_id") REFERENCES "credit_card_bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "transaction_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurring_id_fkey" FOREIGN KEY ("recurring_id") REFERENCES "recurring_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_tag_links" ADD CONSTRAINT "transaction_tag_links_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_tag_links" ADD CONSTRAINT "transaction_tag_links_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "transaction_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_source_transaction_id_fkey" FOREIGN KEY ("source_transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_destination_transaction_id_fkey" FOREIGN KEY ("destination_transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "transaction_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_periods" ADD CONSTRAINT "budget_periods_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_plans" ADD CONSTRAINT "financial_plans_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_scenarios" ADD CONSTRAINT "financial_scenarios_financial_plan_id_fkey" FOREIGN KEY ("financial_plan_id") REFERENCES "financial_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tool_calls" ADD CONSTRAINT "ai_tool_calls_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ai_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_preferences" ADD CONSTRAINT "ai_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ==============================================================================
-- DADOS INICIAIS DE SEED (CASAL LUCAS & VERONICA, CONTAS E CATEGORIAS)
-- ==============================================================================

-- 1. Criação do Casal (Usuários)
INSERT INTO "users" ("id", "email", "password_hash", "full_name", "created_at", "updated_at")
VALUES 
  ('usr-lucas-001', 'lucas@finn.app', '$2b$10$e8w.x7WbH1m0lS8k9D8Y7uQZp4xG5k7N3j1h2g3f4d5s6a7b8c', 'Lucas', NOW(), NOW()),
  ('usr-veronica-002', 'veronica@finn.app', '$2b$10$e8w.x7WbH1m0lS8k9D8Y7uQZp4xG5k7N3j1h2g3f4d5s6a7b8c', 'Veronica', NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- 2. Criação da Família / Household
INSERT INTO "households" ("id", "name", "currency", "created_at", "updated_at")
VALUES ('hsh-lucas-veronica', 'Família Lucas & Veronica', 'BRL', NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- 3. Membros da Família
INSERT INTO "household_members" ("id", "household_id", "user_id", "role", "joined_at")
VALUES 
  ('hsm-lucas-01', 'hsh-lucas-veronica', 'usr-lucas-001', 'OWNER', NOW()),
  ('hsm-veronica-02', 'hsh-lucas-veronica', 'usr-veronica-002', 'ADMIN', NOW())
ON CONFLICT ("id") DO NOTHING;

-- 4. Contas Bancárias Reais
INSERT INTO "financial_accounts" ("id", "user_id", "name", "type", "currency", "current_balance", "calculated_balance", "is_shared", "color_hex", "icon", "is_active", "created_at", "updated_at")
VALUES 
  ('acc-nubank-01', 'usr-lucas-001', 'Nubank Conta Digital', 'CHECKING', 'BRL', 18250.00, 18250.00, true, '#820AD1', 'wallet', true, NOW(), NOW()),
  ('acc-inter-02', 'usr-veronica-002', 'Banco Inter', 'CHECKING', 'BRL', 15528.15, 15528.15, true, '#FF7A00', 'wallet', true, NOW(), NOW()),
  ('acc-xp-03', 'usr-lucas-001', 'XP Investimentos', 'INVESTMENT', 'BRL', 38420.50, 38420.50, true, '#000000', 'trending-up', true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- 5. Categorias Padrão com Cores do Design
INSERT INTO "transaction_categories" ("id", "household_id", "name", "icon", "color_hex", "created_at")
VALUES 
  ('cat-moradia', 'hsh-lucas-veronica', 'Moradia & Contas', 'home', '#3B82F6', NOW()),
  ('cat-alimentacao', 'hsh-lucas-veronica', 'Alimentação & Mercado', 'restaurant', '#F97316', NOW()),
  ('cat-transporte', 'hsh-lucas-veronica', 'Transporte', 'car', '#8B5CF6', NOW()),
  ('cat-educacao', 'hsh-lucas-veronica', 'Educação', 'school', '#EC4899', NOW()),
  ('cat-lazer', 'hsh-lucas-veronica', 'Lazer & Restaurantes', 'game-controller', '#10B981', NOW()),
  ('cat-outros', 'hsh-lucas-veronica', 'Outros Gastos', 'grid', '#64748B', NOW())
ON CONFLICT ("id") DO NOTHING;
