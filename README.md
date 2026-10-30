# FINN AI — Gerente Financeiro Familiar com Inteligência Artificial

> Sistema inteligente e seguro de gestão financeira familiar com inteligência artificial multimodal (Google Gemini), sincronização Open Finance (Meu Pluggy), importação documental (OFX, CSV, PDF, Comprovantes) e isolamento rigoroso de privacidade entre membros do casal.

---

## 🎯 Visão Geral do Produto

O **FINN AI** centraliza a vida financeira de uma família, permitindo que dois usuários (ex: casal) mantenham contas com titularidade individual e uma visão consolidada segura por meio da entidade **Household** (Núcleo Familiar).

### Principais Pilares:
1. **Privacidade e Governança Familiar por Design:** Pertencer à mesma família não dá acesso irrestrito às contas do cônjuge. O compartilhamento é seletivo e granular com auditoria completa.
2. **Open Finance Inteligente (Meu Pluggy):** Sincronização estruturada com bancos respeitando as limitações de contas pessoais (janela de 24h, 5 conexões), com deduplicação e idempotência.
3. **Agente Financeiro com Ferramentas (FINN Agent):** Alimentado pelo Google Gemini com Function Calling restrito a serviços do backend. O agente **nunca** executa SQL arbitrário e exige confirmação do usuário antes de efetuar mutações (rascunhos de metas, orçamentos, etc.).
4. **Precisão Financeira Estrita:** Todos os cálculos utilizam precisão decimal (`Prisma.Decimal`), sem aproximações de ponto flutuante.
5. **Infraestrutura Enxuta e Confiável:** Docker Compose para desenvolvimento e preparação completa para VPS Hostinger com EasyPanel.

---

## 🏗️ Estrutura do Monorepositório

```text
finn-ai/
├── apps/
│   ├── web/                     # Frontend Next.js (App Router, Tailwind CSS, TanStack Query)
│   └── api/                     # Backend NestJS (REST API, OpenAPI/Swagger, Auth, BullMQ)
├── packages/
│   ├── database/                # Prisma ORM, migrations, seed e client tipado
│   ├── shared/                  # DTOs, interfaces, constantes, tipos e contratos de validação
│   ├── ui/                      # Design system compartilhado e componentes acessíveis
│   └── config/                  # Configurações TypeScript, ESLint e Prettier
├── infrastructure/
│   ├── docker/                  # Dockerfiles otimizados multi-stage
│   └── easypanel/               # Templates e compose para deploy no EasyPanel/Hostinger
├── docs/                        # Documentação técnica profunda
│   ├── architecture/            # Arquitetura, fluxos de família e diagramas
│   ├── api/                     # Especificação de endpoints e OpenAPI
│   ├── database/                # Modelo de dados e dicionário de entidades
│   ├── integrations/            # Guias de integração: Pluggy & Gemini
│   ├── security/                # Políticas de segurança, LGPD e criptografia
│   ├── deployment/              # Guia operacional de deploy e backup
│   ├── BACKLOG.md               # Backlog de fases 0 a 10
│   └── CREDENTIALS.md           # Mapeamento de credenciais necessárias
├── scripts/                     # Scripts de automação, backup e restore
├── tests/                       # Testes E2E e suítes de validação integrada
├── .env.example                 # Modelo canônico de variáveis de ambiente
├── docker-compose.yml           # Orquestração local (Postgres, Redis, API, Web, MinIO)
└── README.md
```

---

## 🚀 Fases de Implementação (100% Concluídas)

- [x] **FASE 0 — Planejamento**: Arquitetura, modelo de dados (40 entidades), fluxos de casal, governança, backlog e contratos de interface.
- [x] **FASE 1 — Fundação**: Monorepo npm workspaces, inicialização de NestJS, Next.js 14, Prisma ORM e Docker Compose.
- [x] **FASE 2 — Autenticação e Família**: Cadastro, login com BCrypt (salt 12), JWT em cookies HttpOnly, Household, convites criptografados e permissões granulares.
- [x] **FASE 3 — Núcleo Financeiro**: Contas, cartões, faturas, transações, conciliação e cálculos monetários de alta precisão com `Prisma.Decimal`.
- [x] **FASE 4 — Dashboard**: Painéis individual e familiar consolidado, gráficos Recharts interativos, KPIs e mobile-first UX.
- [x] **FASE 5 — Importações**: Parser nativo de OFX e CSV com detecção inteligente de delimitador/moeda, idempotência com SHA-256 e categorização preditiva.
- [x] **FASE 6 — Integração Meu Pluggy**: Provedor Open Finance (`BankingProvider`), limite de 5 conexões, ciclo de ~24h, tokens cacheados e avisos de consentimento.
- [x] **FASE 7 — FINN Agent (Gemini)**: Agente financeiro com Function Calling via `@google/genai`, injeção estrita de `userId` (sem SQL arbitrário), aprovação de mutações em 2 etapas com cards de rascunho (`Draft`).
- [x] **FASE 8 — Metas e Orçamentos**: Metas conjuntas e individuais (`/goals`), acompanhamento de tetos de gastos (`/budgets`), simulações comparativas de juros compostos.
- [x] **FASE 9 — Segurança e LGPD**: Criptografia AES-256-GCM para tokens bancários, módulo de auditoria (`audit_logs`), sanitização de prompts contra injection, endpoints de exportação e purga em conformidade com LGPD Art. 18.
- [x] **FASE 10 — Deploy e Operação**: Multi-stage Dockerfiles (`api.Dockerfile`, `web.Dockerfile`), orquestração EasyPanel para VPS Hostinger, scripts operacionais de backup (`scripts/backup-db.sh`) com retenção de 30 dias e plano de restauração (`scripts/restore-db.sh`).

---

## 🧪 Qualidade de Código & Suíte de Testes Automatizados

O projeto conta com **7 suítes completas de testes automatizados (26 testes unitários e de integração)**, todas com status `PASS`:

1. `tests/auth-isolation.spec.ts` — Validação de isolamento entre cônjuges, hashes BCrypt e convites familiares.
2. `tests/financial-calculations.spec.ts` — Precisão decimal de balanços, limites de cartões e neutralização de transferências internas.
3. `tests/import-parsers.spec.ts` — Parsers OFX/CSV, chaves de idempotência SHA-256 e detecção de duplicidades.
4. `tests/pluggy-provider.spec.ts` — Ciclo de vida do conector Meu Pluggy, cache de chaves e tratamento de rate limits.
5. `tests/ai-agent.spec.ts` — Blindagem do FINN Agent, injeção de `userId`, impedimento de SQL arbitrário e protocolo de aprovação em 2 etapas.
6. `tests/goals-planning.spec.ts` — Simulações de juros compostos em 3 cenários (Conservador, Base, Otimista) e classificação de alertas orçamentários.
7. `tests/security-lgpd.spec.ts` — Criptografia AES-256-GCM com detecção de adulteração, sanitização de Prompt Injection e portabilidade LGPD.

```bash
# Executar todos os testes
npm test

# Executar build de produção
npm run build
```

---

## 📚 Documentação de Referência

Consulte a pasta `docs/` para obter detalhes aprofundados sobre cada componente da solução.

