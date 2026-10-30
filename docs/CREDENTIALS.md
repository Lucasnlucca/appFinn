# FINN AI — Matriz de Credenciais e Serviços Externos

> **ATENÇÃO DE SEGURANÇA:** Este documento descreve as credenciais que serão requeridas nas fases subsequentes do FINN AI. **NENHUMA SENHA REAL, CHAVE BANCÁRIA, CPF OU CHAVE DE PRODUÇÃO DEVE SER COMITADA OU COMPARTILHADA NESTE REPOSITÓRIO.** Durante o desenvolvimento e homologação, são utilizados conectores sandbox e mocks locais.

---

## 1. Mapeamento de Credenciais por Fase

| Fase | Serviço | Finalidade | Como Obter | Variável no `.env` |
| :--- | :--- | :--- | :--- | :--- |
| **Fase 1-3** | **PostgreSQL Local** | Banco de dados principal | Docker Compose local | `DATABASE_URL` |
| **Fase 1-3** | **Redis Local** | Filas BullMQ e cache de IA | Docker Compose local | `REDIS_URL` |
| **Fase 2** | **Chaves de Criptografia** | Criptografia AES-256 e Sessão | Gerado localmente com OpenSSL | `SESSION_SECRET`, `ENCRYPTION_KEY` |
| **Fase 2** | **Serviço SMTP (Opcional)** | Convites para membros da família | Mailtrap / Resend / Brevo / SMTP Hostinger | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` |
| **Fase 5** | **Storage S3 (Opcional)** | Armazenamento de comprovantes | MinIO local (desenvolvimento) ou Hostinger S3 / Cloudflare R2 | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` |
| **Fase 6** | **Pluggy (Meu Pluggy)** | Conexão Open Finance com bancos | Dashboard oficial Pluggy (modo Sandbox ou Personal) | `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `PLUGGY_MODE=personal` |
| **Fase 7** | **Google Gemini** | Agente financeiro FINN e OCR | Google AI Studio (`ai.google.dev`) | `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.5-flash` |
| **Fase 10** | **Hostinger VPS & EasyPanel** | Deploy e orquestração de produção | Painel Hostinger VPS | Variáveis injetadas diretamente no EasyPanel |

---

## 2. Geração Segura das Chaves de Criptografia Internas

Para gerar chaves criptográficas fortes para o seu `.env`:

```bash
# Gerar SESSION_SECRET (mínimo 32 caracteres hexadecimais)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Gerar ENCRYPTION_KEY (exatamente 32 bytes / 64 caracteres hexadecimais para AES-256-GCM)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. Guia de Obtenção das Credenciais Pluggy (Meu Pluggy)

Para a **Fase 6**, o fluxo requer:
1. Acessar [meu.pluggy.ai](https://meu.pluggy.ai) ou [dashboard.pluggy.ai](https://dashboard.pluggy.ai).
2. Criar a conta de desenvolvedor/pessoal.
3. Obter o `Client ID` e o `Client Secret`.
4. Em modo `personal`, a sincronização ocorre a cada ~24 horas e tem limite de 5 instituições conectadas.
5. Os identificadores de conexão (`itemId`) devem ser cadastrados no painel do FINN AI após a autorização no Meu Pluggy, já que a rota `GET /v2/items` não é disponibilizada para contas da modalidade pessoal.

---

## 4. Guia de Obtenção da API Key do Google Gemini

Para a **Fase 7**:
1. Acessar [Google AI Studio](https://aistudio.google.com).
2. Criar uma API Key vinculada a um projeto Google Cloud ou de teste.
3. Atribuir ao `.env` como `GEMINI_API_KEY`.
4. O modelo padrão adotado pelo FINN AI é o `gemini-2.5-flash` (baixo custo, alto throughput e excelente suporte a Function Calling).

