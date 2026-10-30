import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const rawKey = process.env.ENCRYPTION_KEY || 'finn-ai-default-encryption-key-for-development-32chars!';
    this.key = crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Criptografa texto usando AES-256-GCM com IV aleatório de 12 bytes.
   * Retorna no formato seguro: iv:authTag:ciphertext
   */
  encrypt(text: string): string {
    if (!text) return '';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Descriptografa texto verificando integridade através da authTag.
   * Lança erro se adulterado ou chave inválida.
   */
  decrypt(encryptedPayload: string): string {
    if (!encryptedPayload) return '';
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
      throw new Error('Payload criptografado em formato inválido. Esperado iv:authTag:ciphertext');
    }

    const [ivHex, authTagHex, encryptedText] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

