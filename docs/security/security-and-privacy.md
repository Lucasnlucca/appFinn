# FINN AI — Segurança, Governança e Privacidade (LGPD)

## 1. Princípios de Segurança da Informação

O FINN AI gerencia dados financeiros sensíveis (saldos, despesas, extratos, hábitos de consumo). A segurança é tratada como requisito arquitetural primário através do modelo de **Segurança em Profundidade (Defense in Depth)**.

---

## 2. Criptografia e Proteção de Dados

### 2.1 Em Trânsito
- **HTTPS Obrigatório:** Todo o tráfego HTTP é redirecionado para TLS 1.3 em produção.
- **Cookies de Sessão Seguros:**
  - `HttpOnly: true` (inacessível para scripts frontend, prevenindo roubo via XSS).
  - `Secure: true` (transmitido exclusivamente em conexões HTTPS).
  - `SameSite: Lax` (mitigando ataques CSRF).

### 2.2 Em Repouso
- **Tokens e Segredos Sensíveis:**
  Tokens do Open Finance (Pluggy), segredos de autenticação e identificadores bancários críticos são criptografados no PostgreSQL usando algoritmo **AES-256-GCM** com vetor de inicialização (`IV`) aleatório por registro e tag de autenticação (`authTag`).
- **Hash de Senhas:**
  As senhas dos usuários nunca são armazenadas em texto plano. É utilizado **Argon2id** (ou BCrypt com fator de custo 12).

---

## 3. Conformidade com a LGPD (Lei 13.709/2018)

| Princípio LGPD | Implementação Técnica no FINN AI |
| :--- | :--- |
| **Finalidade e Necessidade** | Apenas dados indispensáveis à gestão orçamentária do casal são coletados. O sistema não coleta dados de geolocalização ou biometria. |
| **Transparência e Consentimento** | Tela de consentimentos explícitos onde o usuário visualiza detalhadamente quais serviços (Pluggy, Gemini) processam dados. |
| **Livre Acesso e Portabilidade** | Rota `/api/v1/users/me/export` para exportar todo o histórico financeiro do usuário em JSON/CSV estruturado. |
| **Direito de Eliminação** | Rota de encerramento de conta que purga registros pessoais e remove tokens bancários. Registros compartilhados com o cônjuge mantêm apenas a parte pertencente ao outro membro. |
| **Minimização no Envio à IA** | Ao enviar dados de transações para o Google Gemini, identificadores pessoais (como CPF, CNPJ e números de agência/conta) são mascarados. |

---

## 4. Prevenção de Vulnerabilidades Comuns

1. **Prompt Injection & Data Poisoning:**
   - Instruções do sistema (*System Prompts*) utilizam delimitadores estruturados.
   - Parâmetros passados para ferramentas de Function Calling são estritamente validados contra esquemas JSON.
   - O Gemini não possui acesso direto à execução de código, shell ou SQL.
2. **Upload Seguro de Arquivos:**
   - Validação de Magic Bytes (assinatura real do arquivo, não apenas a extensão).
   - Bloqueio de arquivos executáveis, macros ou scripts.
   - Nomes de arquivos são sanitizados e gerados com UUID aleatório.
3. **Rate Limiting:**
   - Proteção de endpoints de autenticação (limite de 5 tentativas incorretas por IP em 15 minutos).
   - Limite de chamadas do agente FINN por usuário/dia.

