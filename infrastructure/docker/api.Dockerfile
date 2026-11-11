# Multi-stage Dockerfile para FINN AI Backend (NestJS)
# Produção otimizada com Alpine Linux e Node 20 LTS

FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências necessárias para compilação nativa
RUN apk add --no-cache libc6-compat python3 make g++

# Copiar manifestos de workspaces e lockfile
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/
COPY apps/mobile/package*.json ./apps/mobile/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/database/package*.json ./packages/database/
COPY packages/config/package*.json ./packages/config/

# Instalar todas as dependências
RUN npm ci

# Copiar código fonte
COPY tsconfig*.json ./
COPY packages ./packages
COPY apps/api ./apps/api

# Gerar Prisma Client
RUN npm run db:generate

# Compilar pacotes compartilhados e API
RUN npm run build --workspace=@finn-ai/shared
RUN npm run build --workspace=@finn-ai/database
RUN npm run build --workspace=@finn-ai/api

# ==========================================
# Estágio de Produção (Runner leve e seguro)
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Criar usuário não-root por segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 finn

# Instalar OpenSSL para o Prisma runtime
RUN apk add --no-cache openssl curl

# Copiar apenas os artefatos compilados e dependências de produção
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

USER finn

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/api/v1/health || exit 1

CMD ["node", "apps/api/dist/main.js"]

