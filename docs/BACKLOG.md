# FINN AI — Backlog Mestre e Plano de Execução

Este documento formaliza o roteiro técnico detalhado do FINN AI, cobrindo as 11 fases (da Fase 0 à Fase 10), com dependências, critérios de aceitação e matriz de rastreabilidade.

---

## FASE 0 — Planejamento Arquitetural & Governança (Atual)
- [x] **0.1** Estruturar monorepositório com workspaces (`apps/web`, `apps/api`, `packages/database`, `packages/shared`, `packages/ui`, `packages/config`).
- [x] **0.2** Elaborar arquitetura técnica, fluxo de dados e separação em camadas em `docs/architecture/system-overview.md`.
- [x] **0.3** Documentar fluxos de usuário e governança familiar (individual vs. conjunta, convites, permissões granulares) em `docs/architecture/user-and-family-flows.md`.
- [x] **0.4** Especificar o modelo de dados PostgreSQL com mais de 35 entidades e precisão Decimal em `docs/database/schema-specification.md` e gerar `packages/database/prisma/schema.prisma`.
- [x] **0.5** Especificar integração Meu Pluggy, limitações da modalidade pessoal (5 contas/24h), retenção de `itemId` e interface `BankingProvider` em `docs/integrations/pluggy-integration.md`.
- [x] **0.6** Especificar o agente financeiro Gemini, esquemas de Function Calling, restrição de acesso e confirmação em 2 etapas em `docs/integrations/gemini-agent.md`.
- [x] **0.7** Elaborar plano de segurança, LGPD e minimização de dados em `docs/security/security-and-privacy.md`.
- [x] **0.8** Criar matriz de credenciais necessárias para etapas futuras em `docs/CREDENTIALS.md`.
- [x] **0.9** Validar checklist de planejamento antes de iniciar a Fase 1.

---

## FASE 1 — Fundação e Infraestrutura Base (Concluída)
- [x] **1.1** Configurar `package.json` raiz com workspaces (`apps/*`, `packages/*`).
- [x] **1.2** Configurar `packages/config` (tsconfig base, eslint, prettier).
- [x] **1.3** Configurar `packages/database` com Prisma ORM, script de migração e Prisma Client compilado com as 40 entidades.
- [x] **1.4** Inicializar `apps/api` com NestJS, validação global (`class-validator`), Swagger/OpenAPI (`/docs`), cookies seguros e configuração com `@nestjs/config`.
- [x] **1.5** Inicializar `apps/web` com Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide Icons e design fintech responsivo.
- [x] **1.6** Configurar `packages/shared` para compartilhamento de DTOs, Enums, Contratos e Tipos entre API e Frontend.
- [x] **1.7** Configurar `docker-compose.yml` para desenvolvimento local (PostgreSQL 16, Redis 7, MinIO).
- [x] **1.8** Implementar testes de conexão e health checks (`/api/v1/health` respondendo 200 OK).

---

## FASE 2 — Autenticação e Núcleo Familiar (Household) (Concluída)
- [x] **2.1** Módulo `auth`: Cadastro de usuário, hash de senha com BCrypt salt 12, login seguro, emissão de cookies `HttpOnly` seguros e tokens JWT.
- [x] **2.2** Módulo `users`: Perfil do usuário (`/api/v1/auth/me`), dados de sessão e vínculo familiar.
- [x] **2.3** Módulo `households`: Criação do núcleo familiar (`POST /api/v1/households`), geração de convites criptografados (SHA-256) com validade de 7 dias.
- [x] **2.4** Módulo `household_members`: Papéis de `OWNER`/`ADMIN` e `MEMBER`.
- [x] **2.5** Módulo `sharing_permissions`: Sistema de controle de acesso granular para contas bancárias e dados financeiros (`NONE`, `VIEW_ONLY`, `VIEW_AND_EDIT`).
- [x] **2.6** Telas no Frontend: Login (`/login`), Registro independente e via convite (`/register`), Gestão Familiar (`/household`) e Navbar integrada.
- [x] **2.7** Testes unitários e de integração de isolamento estrito de dados entre usuários aprovados em `tests/auth-isolation.spec.ts`.

---

## FASE 3 — Núcleo Financeiro (Contas, Cartões e Transações) (Concluída)
- [x] **3.1** Módulo `financial_accounts`: Contas correntes, poupanças, carteiras manuais e investimentos, com saldo informado vs. saldo conciliado em `Decimal`.
- [x] **3.2** Módulo `credit_cards` e `credit_card_bills`: Cartões de crédito, limites, datas de fechamento e vencimento de faturas, faturas abertas e cálculo de limite disponível.
- [x] **3.3** Módulo `transactions`: Receitas, despesas, transferências internas, categorias hierárquicas e tags.
- [x] **3.4** Precisão decimal obrigatória (`Prisma.Decimal` e `Decimal.js` estrito sem perda de centavos por ponto flutuante).
- [x] **3.5** Módulo `categories`: Categorias financeiras hierárquicas com ícones e cores, com seed de categorias padrão da família.
- [x] **3.6** Módulo `transfers`: Algoritmo de conciliação de transferências com neutralização de repasses entre o casal (`isInternalHousehold: true`), eliminando duplicação de renda familiar nos relatórios consolidados.
- [x] **3.7** Frontend: Páginas de Contas (`/accounts`), Cartões de Crédito (`/cards`) e Extrato de Movimentações (`/transactions`) com modal de lançamento rápido e filtros por escopo.
- [x] **3.8** Testes unitários de cálculos monetários e neutralização contábil aprovados em `tests/financial-calculations.spec.ts`.

---

## FASE 4 — Dashboards Financeiros (Individual e Familiar) (Concluída)
- [x] **4.1** Endpoint consolidado de métricas financeiras (`/api/v1/reports/summary`) com patrimônio líquido, receitas, despesas e taxa de poupança com filtros dinâmicos de escopo (`PERSONAL` vs `HOUSEHOLD`).
- [x] **4.2** Regra estrita de consolidação: Exclusão de transferências internas do cálculo de receitas e despesas familiares para evitar duplicação contábil.
- [x] **4.3** Dashboard Individual: Visão focada exclusivamente nas contas e cartões próprios do usuário logado.
- [x] **4.4** Dashboard Familiar: Visão agregada das contas e movimentações autorizadas de ambos os membros do casal.
- [x] **4.5** Gráficos interativos com Recharts: Fluxo de caixa mensal dos últimos 6 meses (`BarChart`) e distribuição percentual de despesas por categoria (`PieChart`/Donut).
- [x] **4.6** Alertas de vencimento de faturas de cartão de crédito e contas com vencimento nos próximos 15 dias (`/api/v1/reports/upcoming`).

---

## FASE 5 — Importação Manual Inteligente (OFX, CSV, PDF, OCR) (Concluída)
- [x] **5.1** Pipeline de upload seguro e validação de extensão e tipo MIME para arquivos bancários.
- [x] **5.2** Parser nativo de arquivos OFX (Open Financial Exchange) com extração de datas (`DTPOSTED`), valores (`TRNAMT`), identificadores (`FITID`) e memorandos (`MEMO`/`NAME`).
- [x] **5.3** Parser configurável de extratos bancários em formato CSV (suporte a delimitadores `,` e `;`, datas brasileiras e valores com formatação monetária).
- [x] **5.4** Módulo de Deduplicação Inteligente com hash idempotente (`sha256`) e identificação de lançamentos já existentes.
- [x] **5.5** Sugestão automática de categorias financeiras baseada em regras semânticas de palavras-chave.
- [x] **5.6** Tela de Pré-Visualização e Confirmação de Importação (`/imports`): o usuário revisa cada linha, visualiza duplicatas sinalizadas e confirma a inserção gravando em lote com atualização do saldo da conta.
- [x] **5.7** Testes unitários dos parsers OFX e CSV aprovados em `tests/import-parsers.spec.ts`.

---

## FASE 6 — Integração Bancária Open Finance (Meu Pluggy) (Concluída)
- [x] **6.1** Implementar interface desacoplada `BankingProvider` em `packages/shared` e implementação concreta `PluggyBankingProvider`.
- [x] **6.2** Fluxo de autenticação oficial Pluggy (`POST /auth`) com caching em memória de chave temporária `X-API-KEY` (com renovação preventiva).
- [x] **6.3** Registro manual seguro do `externalItemId` para a modalidade pessoal do Meu Pluggy (devido à ausência documentada de `GET /v2/items` no plano gratuito).
- [x] **6.4** Validação de limite estrito de até 5 instituições simultâneas conectadas conforme as regras documentadas do serviço.
- [x] **6.5** Sincronização incremental assíncrona com deduplicação de transações via chave idempotente SHA-256 e gravação de histórico de auditoria em `bank_sync_history`.
- [x] **6.6** Monitoramento de validade do consentimento (`consentExpiresAt`) com aviso no dashboard.
- [x] **6.7** Tela de Conexões Bancárias (`/connections`): painel de instituições conectadas, modal passo a passo do Meu Pluggy, botão de sincronização manual e botão de desvinculação com revogação.
- [x] **6.8** Testes unitários do provedor Pluggy aprovados em `tests/pluggy-provider.spec.ts`.

---

## FASE 7 — Agente Financeiro FINN (Google Gemini) (Concluída)
- [x] **7.1** Configuração do SDK oficial `@google/genai` (v2.32.0) integrado ao NestJS com autenticação segura.
- [x] **7.2** Catálogo de ferramentas declaradas via JSON Schema com Function Calling:
  - `getFinancialSummary(scope)`: patrimônio líquido, receitas, despesas e taxa de poupança.
  - `getSpendingByCategory(scope)`: gastos agrupados por categoria.
  - `getTransactions(limit, scope)`: movimentações financeiras recentes.
  - `simulateSavingsPlan(targetAmount, monthlyDeposit)`: simulação de prazos para objetivos financeiros.
  - `createGoalDraft(...)`: proposta de meta financeira sem gravação direta.
- [x] **7.3** Validador estrito de contexto: O backend injeta o `userId` autenticado, garantindo isolamento total e **proibição absoluta de execução de SQL arbitrário**.
- [x] **7.4** Protocolo de Confirmação em 2 Etapas: Ações de escrita geram rascunhos com `draftId` exibidos em um Card de Aprovação com botões **[Aprovar Meta]** e **[Descartar]**.
- [x] **7.5** Interface de Chat no Frontend (`/assistant`): Conversa em tempo real, renderização de rascunhos interativos de aprovação e botões de atalho rápido.
- [x] **7.6** Testes unitários do agente aprovados em `tests/ai-agent.spec.ts`.

---

## FASE 8 — Metas, Orçamentos e Planejamento
- [x] **8.1** Módulo `budgets`: Orçamentos mensais por categoria, com alertas de consumo (50%, 80%, 100%).
- [x] **8.2** Módulo `goals`: Metas de economia (reserva, imóvel, viagem) com aportes manuais e automáticos.
- [x] **8.3** Módulo `financial_scenarios`: Simulações de juros compostos, prazos comparativos (Conservador, Moderado, Otimista) e antecipações.
- [x] **8.4** Recomendações proativas do FINN baseadas na evolução das metas do casal e aportes mensais sugeridos.
- [x] **8.5** Interface visual para acompanhamento de barras de progresso, gestão de orçamentos e simulações interativas (`/goals` e `/budgets`).
- [x] **8.6** Testes unitários do módulo de metas e planejamento aprovados em `tests/goals-planning.spec.ts`.

---

## FASE 9 — Segurança, Privacidade e LGPD
- [x] **9.1** Criptografia de tokens bancários e dados sensíveis em repouso no PostgreSQL via AES-256-GCM (`CryptoService` com IV aleatório e authTag).
- [x] **9.2** Módulo de Auditoria (`audit_logs`): Registro estruturado de exportações, alterações de privacidade e logins.
- [x] **9.3** Mecanismo de exportação de dados do titular (`GET /privacy/export`) conforme LGPD Art. 18 (II e V - Portabilidade).
- [x] **9.4** Mecanismo de exclusão de conta e purga definitiva (`DELETE /privacy/purge`) com transação em cascata (LGPD Art. 18, VI).
- [x] **9.5** Sanitização rigorosa de prompts contra Prompt Injection e redação automática de tokens/secrets (`sanitizer.ts`).
- [x] **9.6** Testes automatizados de segurança, criptografia, sanitização e LGPD aprovados em `tests/security-lgpd.spec.ts`.

---

## FASE 10 — Deploy, Produção & VPS Hostinger (EasyPanel)
- [x] **10.1** Dockerfile multi-stage otimizado para `apps/api` (`infrastructure/docker/api.Dockerfile`) e `apps/web` (`infrastructure/docker/web.Dockerfile`).
- [x] **10.2** Configuração do EasyPanel (Hostinger VPS) com serviços conteinerizados (`infrastructure/easypanel/easypanel-compose.yml`).
- [x] **10.3** Configuração de certificados SSL/HTTPS automáticos via Traefik/EasyPanel e healthchecks HTTP.
- [x] **10.4** Configuração de volumes persistentes para PostgreSQL 16, Redis 7 e storage local.
- [x] **10.5** Scripts operacionais de backup automatizado do PostgreSQL (`scripts/backup-db.sh`) com compressão e retenção de 30 dias.
- [x] **10.6** Procedimento documentado de restauração (`scripts/restore-db.sh`) e contingência em `docs/deployment/easypanel-docker.md`.
- [x] **10.7** Documentação completa de deploy, credenciais (`docs/CREDENTIALS.md`) e manual operacional no README.md.

