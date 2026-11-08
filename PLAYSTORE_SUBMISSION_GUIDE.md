# 🚀 Guia de Publicação na Google Play Store • FINN AI

Este documento contém o checklist completo, comandos de compilação e as respostas exatas para preencher o **Google Play Console** no dia em que você for publicar o **FINN AI**.

---

## 📌 1. Resumo do que já está pronto no projeto

- [x] **Package Name Único**: `com.finnai.app` configurado no `app.json`.
- [x] **Version Code e Version Name**: `versionCode: 1` e `version: 1.0.0` configurados.
- [x] **Ícone Adaptativo e Splash**: Ícone vetorial e tela de splash nativa Android configurados.
- [x] **Permissões Justificadas**: Microfone e Galeria de Fotos documentadas no `app.json`.
- [x] **Segurança contra Extração**: `allowBackup: false` configurado para proteção de dados financeiros.
- [x] **Exclusão de Conta e Dados (Diretriz Crítica Google Play)**: Botão nativo em *Perfil > Excluir Conta*.
- [x] **Política de Privacidade**: Arquivo `docs/privacy-policy.html` pronto e modal interno no app.
- [x] **Configuração EAS Build**: `eas.json` pronto para compilação `.aab` de produção.

---

## 🛠️ 2. Como gerar o arquivo `.aab` (Android App Bundle)

A Google Play não aceita mais arquivos `.apk` soltos; é obrigatório enviar o formato `.aab`.

### Passo a passo no terminal:
1. Instale a ferramenta oficial da Expo (se ainda não tiver):
   ```bash
   npm install -g eas-cli
   ```
2. Entre na sua conta Expo (crie uma gratuita em [expo.dev](https://expo.dev) se não tiver):
   ```bash
   npx eas login
   ```
3. Navegue até a pasta do aplicativo e dispare a compilação de produção:
   ```bash
   cd apps/mobile
   npx eas build -p android --profile production
   ```
4. Ao final da compilação na nuvem do Expo, você receberá um link no terminal para baixar o arquivo `.aab` assinado e pronto para envio.

---

## 🌐 3. URL Pública da Política de Privacidade (GitHub Pages)

O Google Play exige uma URL HTTPS pública. Como este repositório está no GitHub, você pode ativá-la com 2 cliques:
1. No GitHub, abra o repositório **appFinn**.
2. Vá em **Settings** > **Pages** (no menu lateral esquerdo).
3. Em **Branch**, selecione `main` e na pasta selecione `/docs` (ou `/root`).
4. Clique em **Save**.
5. Sua URL pública será:
   ```
   https://lucasnlucca.github.io/appFinn/privacy-policy.html
   ```
   *(Copie essa URL para o campo "Política de Privacidade" no Google Play Console).*

---

## 📝 4. Respostas para o Formulário do Google Play Console

Ao criar a ficha do app no Google Play Console, use as respostas abaixo:

### A. Acesso ao app (App Access)
- Selecione: **"Algumas funcionalidades são restritas (com login)"**.
- Forneça uma conta de teste para os revisores do Google:
  - *Instruções:* "Faça login com as credenciais abaixo para testar todas as funcionalidades do gestor financeiro."
  - *Usuário de Teste:* Informe um e-mail cadastrado (ex: `teste.revisor@finn.app`)
  - *Senha de Teste:* Informe a senha correspondente (ex: `FinnTeste@2026`)

### B. Anúncios (Ads)
- Selecione: **"Não, meu app não contém anúncios"**.

### C. Classificação de Conteúdo (Content Rating)
- Responda ao questionário:
  - Tipo de app: **Utilitário / Produtividade / Finanças**.
  - Violência, drogas, linguagem ofensiva: **Não** para todas.
  - Resultado esperado: **Livre / Classificação indicativa para todas as idades**.

### D. Público-alvo (Target Audience)
- Idade: Selecione **18 anos ou mais** (ou a partir de 13 anos).
- Apelo para crianças: **Não**.

### E. Recursos Financeiros (Financial Features)
- Selecione: **Gestão de Finanças Pessoais / Planejador de Orçamento (Personal Financial Management - PFM)**.
- O app concede empréstimos ou intermedia crédito pessoal? **Não**.

### F. Segurança dos Dados (Data Safety Form)
- O app coleta ou compartilha dados de usuários? **Sim**.
- Todos os dados coletados são criptografados em trânsito? **Sim** (HTTPS/TLS).
- O app oferece uma forma para os usuários solicitarem a exclusão de seus dados? **Sim** (via botão no Perfil e link de privacidade).
- **Dados Coletados:**
  1. *Informações Pessoais:* Nome e Endereço de e-mail (finalidade: funcionalidade do app e gerenciamento de contas).
  2. *Informações Financeiras:* Saldos e lançamentos financeiros inseridos pelo usuário (finalidade: funcionalidade do app / planejamento financeiro).
  3. *Áudio:* Gravações de voz gravadas no chat (finalidade: transcrição e identificação de lançamentos por IA).
  4. *Fotos e Vídeos:* Fotos da galeria se o usuário optar por trocar o avatar (finalidade: personalização da conta).

---

## 👥 5. Regra dos 20 Testadores (Atenção para Contas de Pessoa Física)

Se você criou uma conta de desenvolvedor Google Play de **Pessoa Física** após **novembro de 2023**:
1. O Google exige que você crie uma faixa de **Teste Fechado (Closed Testing)**.
2. Cadastre uma lista de e-mails de **pelo menos 20 pessoas**.
3. Essas 20 pessoas devem instalar o app e mantê-lo instalado por **14 dias consecutivos**.
4. Após os 14 dias, o painel do Google Play liberará o botão para **"Solicitar Acesso à Produção"**.
*(Dica: Se a sua conta for de **Empresa / Pessoa Jurídica (com CNPJ / D-U-N-S Number)**, essa regra de 20 testadores não existe e você pode publicar direto para produção).*
