import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as tls from 'tls';
import * as net from 'net';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Envia o código de recuperação de senha de 6 dígitos com layout oficial do FINN.
   */
  async sendPasswordResetCode(params: {
    toEmail: string;
    fullName?: string;
    code: string;
    expiresInMinutes?: number;
  }): Promise<{ sent: boolean; provider: string }> {
    const firstName = (params.fullName || 'Usuário').trim().split(/\s+/)[0] || 'Usuário';
    const expires = params.expiresInMinutes || 15;

    const subject = `${params.code} é o seu código de recuperação FINN`;
    const text = [
      `Olá, ${firstName}!`,
      ``,
      `Recebemos uma solicitação para redefinir a senha da sua conta no FINN - Gestor Financeiro Inteligente.`,
      ``,
      `Seu código de verificação de 6 dígitos é: ${params.code}`,
      ``,
      `Este código é válido por ${expires} minutos.`,
      `Se você não solicitou a redefinição de senha, ignore este e-mail com segurança.`,
    ].join('\n');

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recuperação de Senha - FINN</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F1FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F4F1FB;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#FFFFFF;border-radius:24px;overflow:hidden;box-shadow:0 8px 28px rgba(76,29,149,0.08);">
          <!-- Cabeçalho Roxo FINN -->
          <tr>
            <td style="background:linear-gradient(135deg,#4C1D95 0%,#6D28D9 100%);padding:28px 32px;text-align:center;">
              <div style="font-size:24px;font-weight:800;color:#FFFFFF;letter-spacing:1.5px;">FINN</div>
              <div style="font-size:13px;color:#DDD6FE;margin-top:4px;font-weight:500;">Gestor Financeiro Inteligente</div>
            </td>
          </tr>

          <!-- Corpo -->
          <tr>
            <td style="padding:32px 28px;">
              <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#1E1B4B;">
                Olá, ${this.escapeHtml(firstName)}!
              </h1>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#4B5563;">
                Recebemos um pedido para redefinir a senha da sua conta no <strong>FINN</strong>. Digite o código de 6 dígitos abaixo no aplicativo para criar sua nova senha:
              </p>

              <!-- Caixa do Código OTP -->
              <div style="background-color:#F4F1FB;border:2px dashed #8B5CF6;border-radius:16px;padding:22px 16px;text-align:center;margin:0 0 24px 0;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#6D28D9;margin-bottom:8px;">
                  Código de Verificação
                </div>
                <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#4C1D95;font-family:'Courier New',Courier,monospace;">
                  ${this.escapeHtml(params.code)}
                </div>
              </div>

              <p style="margin:0 0 16px 0;font-size:13px;line-height:1.5;color:#6B7280;text-align:center;">
                ⏱️ Este código expira em <strong>${expires} minutos</strong>.
              </p>

              <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />

              <p style="margin:0;font-size:12px;line-height:1.5;color:#9CA3AF;text-align:center;">
                Se você não solicitou a redefinição de senha, nenhuma alteração será feita na sua conta. Nunca compartilhe este código com ninguém.
              </p>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="background-color:#F9FAFB;padding:16px 24px;text-align:center;border-top:1px solid #F3F4F6;">
              <span style="font-size:12px;color:#9CA3AF;">© ${new Date().getFullYear()} FINN — Gestor Financeiro Inteligente</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    return this.sendMail({
      to: params.toEmail,
      subject,
      html,
      text,
    });
  }

  /**
   * Envia e-mail usando Brevo HTTP API, Resend HTTP API ou SMTP nativo TLS (ex.: Gmail App Password).
   */
  async sendMail(options: SendMailOptions): Promise<{ sent: boolean; provider: string }> {
    const brevoKey = (process.env.BREVO_API_KEY || '').trim();
    const resendKey = (process.env.RESEND_API_KEY || '').trim();
    const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    const smtpPort = Number(process.env.SMTP_PORT || 465);
    const smtpUser = (process.env.SMTP_USER || '').trim();
    // Remove espaços caso a senha de app de 16 letras tenha sido colada com espaços
    const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
    const rawFrom = (process.env.SMTP_FROM || '').trim();

    const parsedFrom = this.parseFromAddress(
      rawFrom,
      smtpUser && !smtpUser.includes('seuemail@') ? smtpUser : 'no-reply@finnapp.com.br',
    );

    // 1. Tenta Brevo HTTP API se configurada
    if (brevoKey) {
      try {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': brevoKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            sender: { name: parsedFrom.name, email: parsedFrom.email },
            to: [{ email: options.to }],
            subject: options.subject,
            htmlContent: options.html,
            textContent: options.text || '',
          }),
        });
        if (res.ok) {
          this.logger.log(`E-mail enviado via Brevo API para ${options.to}`);
          return { sent: true, provider: 'brevo' };
        }
        const errBody = await res.text();
        this.logger.warn(`Falha Brevo API (${res.status}): ${errBody}`);
      } catch (e: any) {
        this.logger.warn(`Erro Brevo API: ${e?.message}`);
      }
    }

    // 2. Tenta Resend HTTP API se configurada
    if (resendKey) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${parsedFrom.name} <${parsedFrom.email}>`,
            to: [options.to],
            subject: options.subject,
            html: options.html,
            text: options.text || '',
          }),
        });
        if (res.ok) {
          this.logger.log(`E-mail enviado via Resend API para ${options.to}`);
          return { sent: true, provider: 'resend' };
        }
        const errBody = await res.text();
        this.logger.warn(`Falha Resend API (${res.status}): ${errBody}`);
      } catch (e: any) {
        this.logger.warn(`Erro Resend API: ${e?.message}`);
      }
    }

    // 3. Tenta SMTP (Gmail Senha de App / SMTP customizado)
    if (smtpUser && smtpPass && !smtpUser.includes('seuemail@')) {
      await this.sendViaSmtp({
        host: smtpHost,
        port: smtpPort,
        user: smtpUser,
        pass: smtpPass,
        fromName: parsedFrom.name,
        fromEmail:
          parsedFrom.email && !parsedFrom.email.includes('seuemail@')
            ? parsedFrom.email
            : smtpUser,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      this.logger.log(`E-mail enviado via SMTP (${smtpHost}:${smtpPort}) para ${options.to}`);
      return { sent: true, provider: 'smtp' };
    }

    if (smtpUser.includes('seuemail@')) {
      throw new Error(
        'O variável SMTP_USER no Easypanel ainda está como "seuemail@gmail.com". Substitua pelo seu e-mail real (ex: lucasg.nunes19@gmail.com) e reinicie a API.',
      );
    }

    throw new Error(
      'Serviço de e-mail não configurado no servidor. Defina SMTP_USER e SMTP_PASS no Easypanel.',
    );
  }

  /**
   * Cliente SMTP TLS nativo (compatível com Gmail porta 465 SSL/TLS e porta 587 STARTTLS) sem dependências externas.
   */
  private sendViaSmtp(params: {
    host: string;
    port: number;
    user: string;
    pass: string;
    fromName: string;
    fromEmail: string;
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutMs = 15000;
      let socket: tls.TLSSocket | net.Socket;
      let settled = false;

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        try {
          socket?.destroy();
        } catch {}
        reject(err);
      };

      const finish = () => {
        if (settled) return;
        settled = true;
        try {
          socket?.end();
        } catch {}
        resolve();
      };

      const attachProtocol = (activeSocket: tls.TLSSocket | net.Socket, isUpgradedTls = false) => {
        let buffer = '';
        let step = isUpgradedTls ? 1 : 0;

        const sendLine = (cmd: string) => {
          activeSocket.write(cmd + '\r\n');
        };

        const handleResponse = (code: number, fullText: string) => {
          if (code >= 400) {
            return fail(
              new Error(`Erro SMTP (${code}): ${fullText.replace(/\r?\n/g, ' ').trim()}`),
            );
          }

          if (step === 0) {
            // 220 Banner recebido -> envia EHLO
            step = 1;
            sendLine(`EHLO finn-api.local`);
          } else if (step === 1) {
            // Resposta do EHLO
            if (params.port === 587 && !isUpgradedTls && fullText.includes('STARTTLS')) {
              step = 99; // Aguardando 220 para upgrade TLS
              sendLine('STARTTLS');
              return;
            }
            step = 2;
            sendLine('AUTH LOGIN');
          } else if (step === 99) {
            // Faz upgrade do socket TCP para TLS
            activeSocket.removeAllListeners('data');
            const tlsSock = tls.connect(
              {
                socket: activeSocket as net.Socket,
                servername: params.host,
                rejectUnauthorized: false,
              },
              () => {
                socket = tlsSock;
                attachProtocol(tlsSock, true);
                tlsSock.write('EHLO finn-api.local\r\n');
              },
            );
            tlsSock.on('error', (err) => fail(err));
          } else if (step === 2) {
            // 334 VXNlcm5hbWU6
            step = 3;
            sendLine(Buffer.from(params.user, 'utf8').toString('base64'));
          } else if (step === 3) {
            // 334 UGFzc3dvcmQ6
            step = 4;
            sendLine(Buffer.from(params.pass, 'utf8').toString('base64'));
          } else if (step === 4) {
            // 235 Autenticado!
            step = 5;
            sendLine(`MAIL FROM:<${params.fromEmail}>`);
          } else if (step === 5) {
            // 250 MAIL FROM OK
            step = 6;
            sendLine(`RCPT TO:<${params.to}>`);
          } else if (step === 6) {
            // 250 RCPT TO OK
            step = 7;
            sendLine('DATA');
          } else if (step === 7) {
            // 354 End data with <CR><LF>.<CR><LF>
            step = 8;
            const encodedSubject = `=?UTF-8?B?${Buffer.from(params.subject, 'utf8').toString('base64')}?=`;
            const encodedFromName = `=?UTF-8?B?${Buffer.from(params.fromName, 'utf8').toString('base64')}?=`;
            const base64Html =
              Buffer.from(params.html, 'utf8')
                .toString('base64')
                .match(/.{1,76}/g)
                ?.join('\r\n') || '';

            const message = [
              `From: ${encodedFromName} <${params.fromEmail}>`,
              `To: <${params.to}>`,
              `Subject: ${encodedSubject}`,
              `Date: ${new Date().toUTCString()}`,
              `MIME-Version: 1.0`,
              `Content-Type: text/html; charset=UTF-8`,
              `Content-Transfer-Encoding: base64`,
              ``,
              base64Html,
              `.`,
            ].join('\r\n');

            sendLine(message);
          } else if (step === 8) {
            // 250 2.0.0 OK — mensagem aceita
            step = 9;
            sendLine('QUIT');
            finish();
          }
        };

        activeSocket.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf8');
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';

          let currentBlock: string[] = [];
          for (const line of lines) {
            if (!line) continue;
            currentBlock.push(line);
            // No protocolo SMTP, linhas intermediárias têm hífen após o código (ex: "250-...")
            // e a linha final tem espaço após os 3 dígitos (ex: "250 ...")
            if (/^\d{3}(\s|$)/.test(line)) {
              const code = parseInt(line.slice(0, 3), 10);
              const blockText = currentBlock.join('\n');
              currentBlock = [];
              handleResponse(code, blockText);
            }
          }
        });
      };

      if (params.port === 465) {
        socket = tls.connect({
          host: params.host,
          port: params.port,
          servername: params.host,
          rejectUnauthorized: false,
        });
      } else {
        socket = net.createConnection({
          host: params.host,
          port: params.port,
        });
      }

      socket.setTimeout(timeoutMs, () => {
        fail(new Error('Tempo limite esgotado ao conectar ao servidor SMTP.'));
      });

      socket.on('error', (err) => fail(err));
      attachProtocol(socket, false);
    });
  }

  private parseFromAddress(rawFrom: string, fallbackEmail: string): { name: string; email: string } {
    const cleaned = (rawFrom || '').replace(/^["']|["']$/g, '').trim();
    const match = cleaned.match(/^(.*?)<([^>]+)>$/);
    if (match) {
      return {
        name: match[1].replace(/^["']|["']$/g, '').trim() || 'FINN Assistente Financeiro',
        email: match[2].trim() || fallbackEmail,
      };
    }
    if (cleaned.includes('@')) {
      return {
        name: 'FINN Assistente Financeiro',
        email: cleaned,
      };
    }
    return {
      name: 'FINN Assistente Financeiro',
      email: fallbackEmail,
    };
  }

  private escapeHtml(str: string): string {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

