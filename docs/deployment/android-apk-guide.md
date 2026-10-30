# FINN AI — Guia de Geração e Instalação do APK Android

Este documento explica como gerar e instalar o arquivo `.apk` do **FINN AI** no seu celular Android.

---

## 📱 Visão Geral do App Nativo

O FINN AI foi encapsulado utilizando **Capacitor 7** para criar um app Android completo:
- **ID do App:** `com.finnai.app`
- **Nome Exibido:** `FINN AI`
- **Ícone e Splash Screen:** Suporte nativo completo.
- **Estrutura Nativa:** Localizada na pasta `/android` do monorepositório.

---

## 🚀 Método 1: Geração Automática do APK via GitHub Actions (Recomendado)

Você **não precisa instalar Android Studio, Java JDK ou Android SDK no seu computador**. O GitHub compila o APK na nuvem de forma gratuita em ~3 minutos.

### Passo a Passo:

1. **Envie o código para o seu repositório no GitHub:**
   ```bash
   git add .
   git commit -m "feat: adicionar projeto nativo Android e workflow de APK"
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git push -u origin main
   ```

2. **Acesse a aba Actions no GitHub:**
   - Acesse: `https://github.com/SEU_USUARIO/SEU_REPOSITORIO/actions`
   - O fluxo **Build Android APK (FINN AI)** será iniciado automaticamente (ou você pode clicar em **Run workflow**).

3. **Baixe o arquivo `.apk` pronto:**
   - Quando o workflow finalizar (ícone verde de sucesso), role até a seção **Artifacts** na parte inferior da página.
   - Clique em **`finn-ai-app-debug.apk`** para baixar o arquivo zipado com o APK dentro.

4. **Instale no celular:**
   - Descompacte o arquivo e transfira o `app-debug.apk` para o seu celular (via WhatsApp, Google Drive, cabo USB ou Telegram).
   - No celular, toque no arquivo `.apk` e clique em **Instalar** (permita "Instalar apps de fontes desconhecidas" caso seja solicitado pelo Android).

---

## 💻 Método 2: Compilação Local no seu Computador (Se você tiver Android Studio)

Se você preferir compilar localmente na sua máquina:

1. **Instale o Android Studio e Java JDK 17:**
   - Baixe em: [developer.android.com/studio](https://developer.android.com/studio)

2. **Gere os arquivos estáticos e sincronize:**
   ```bash
   # No diretório raiz do projeto finn-ai:
   $env:NEXT_EXPORT="true"
   npm run build --workspace=@finn-ai/web
   npx cap sync android
   ```

3. **Abra o projeto no Android Studio:**
   ```bash
   npx cap open android
   ```
   - No Android Studio, vá em **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
   - O APK final será gerado em: `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 🔄 Conectando o App à sua API de Produção

Para que o APK acesse sua API hospedada na Hostinger VPS (EasyPanel):
1. No arquivo `capacitor.config.ts`, você pode definir `server.url` apontando para seu domínio web:
   ```ts
   // Exemplo:
   server: {
     url: 'https://app.seudominio.com.br',
     cleartext: true
   }
   ```
2. Ou configurar a variável `NEXT_PUBLIC_API_URL=https://api.seudominio.com.br` antes de gerar a compilação estática.

