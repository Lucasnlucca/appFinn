# FINN AI — Guia de Deploy, Infraestrutura VPS Hostinger & EasyPanel

## 1. Visão Geral da Infraestrutura de Produção

O FINN AI é projetado para operar com baixo custo e alta eficiência em uma **VPS Hostinger** gerenciada com **EasyPanel**.

### Topologia de Serviços Conteinerizados:
1. `finn-web`: Next.js 15 Standalone (porta interna 3000).
2. `finn-api`: NestJS API REST (porta interna 4000).
3. `finn-worker`: BullMQ Worker em Node.js (processamento assíncrono).
4. `finn-postgres`: PostgreSQL 16 com volume persistente montado em `/var/lib/postgresql/data`.
5. `finn-redis`: Redis 7 Alpine com persistência AOF para cache e filas.
6. `finn-storage`: Compatível com S3 (MinIO ou S3 gerenciado Hostinger/Cloudflare R2).

---

## 2. Requisitos de Recursos Mínimos (VPS Hostinger)

- **CPU:** 2 vCPUs (KVM 2 ou superior recomendado).
- **RAM:** 4 GB RAM (mínimo recomendado para rodar Next.js SSR + NestJS + Postgres + Redis).
- **Disco:** 40 GB NVMe SSD.
- **Sistema Operacional:** Ubuntu 22.04 / 24.04 LTS com Docker e EasyPanel pré-instalados.

---

## 3. Configuração no EasyPanel

O EasyPanel organiza os serviços através de projetos e contêineres Docker gerenciados com proxy reverso automático (Traefik) e emissão de certificados SSL gratuitos via Let's Encrypt.

### 3.1 Passos de Configuração do Projeto no EasyPanel:
1. Acesse o EasyPanel da sua VPS (`https://seu-ip:3000`).
2. Crie um novo projeto chamado `finn-ai`.
3. Adicione o serviço **PostgreSQL**:
   - Imagem: `postgres:16-alpine`
   - Volume persistente: `postgres-data` -> `/var/lib/postgresql/data`
   - Variáveis: `POSTGRES_DB=finn_ai`, `POSTGRES_USER=finn_user`, `POSTGRES_PASSWORD=...`
4. Adicione o serviço **Redis**:
   - Imagem: `redis:7-alpine`
   - Volume persistente: `redis-data` -> `/data`
5. Adicione a **API (NestJS)**:
   - Origem: Repositório Git (branch `main`), apontando para o Dockerfile `infrastructure/docker/api.Dockerfile`.
   - Porta: `4000`
   - Domínio: `api.seudominio.com.br`
   - Variáveis de ambiente: Conforme `.env.example`.
6. Adicione o **Frontend (Next.js)**:
   - Origem: Repositório Git (branch `main`), apontando para o Dockerfile `infrastructure/docker/web.Dockerfile`.
   - Porta: `3000`
   - Domínio: `app.seudominio.com.br`
   - Variáveis: `NEXT_PUBLIC_API_URL=https://api.seudominio.com.br`

---

## 4. Rotina de Backup Automatizado do PostgreSQL

Para garantir a salvaguarda dos dados financeiros, o script operacional `scripts/backup-db.sh` realiza o dump consistente, compactado e opcionalmente criptografado via GPG:

```bash
# Execução manual ou via crontab diário (ex: às 03:00 da manhã)
0 3 * * * /opt/finn-ai/scripts/backup-db.sh >> /var/log/finn-backup.log 2>&1
```

- **Retenção:** Política automática de expiração e deleção de dumps com mais de 30 dias.
- **Armazenamento:** Local seguro montado em volume `/backups`, replicável para S3 / Cloudflare R2.

---

## 5. Procedimento de Restauração (Disaster Recovery)

Em caso de falha de servidor, restauração de ponto no tempo ou migração de VPS:

```bash
# Executa a restauração com confirmação de segurança obrigatória:
./scripts/restore-db.sh /backups/finn_ai_db_20261030_030000.sql.gz
```

---

## 6. Procedimento de Deploy e Rollback Contínuo

### Deploy:
1. Faça push para a branch `main` no GitHub.
2. No EasyPanel, o Webhook aciona a reconstrução dos contêineres `api` e `web`.
3. O healthcheck do Traefik aguarda `HTTP 200` em `/api/v1/health` antes de direcionar o tráfego de produção (Zero-Downtime Deployment).

### Rollback:
1. No painel de histórico do EasyPanel, selecione o commit anterior e clique em **Redeploy**.
2. Ou via terminal: `git checkout <commit_hash> && docker compose -f infrastructure/easypanel/easypanel-compose.yml up -d --build`.

