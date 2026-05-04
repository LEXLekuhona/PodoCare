import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EncryptedPayload {
  cipherText: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyVersion: number;
}

/**
 * Сервис симметричного шифрования для чувствительных данных
 * (например, ClientMedicalCard).
 *
 * Алгоритм: AES-256-GCM.
 * Ключ: DATA_ENCRYPTION_KEY из env (base64, ≥32 байта).
 * При ротации ключей используй key_version в БД и поддерживай несколько ключей.
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;
  private readonly keyVersion = 1;
  private readonly algorithm = 'aes-256-gcm' as const;

  constructor(config: ConfigService) {
    const rawKey = config.getOrThrow<string>('DATA_ENCRYPTION_KEY');
    const keyBuf = Buffer.from(rawKey, 'base64');
    if (keyBuf.length < 32) {
      this.key = createHash('sha256').update(rawKey).digest();
    } else {
      this.key = keyBuf.subarray(0, 32);
    }
  }

  encrypt(plain: string): EncryptedPayload {
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    const cipherText = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return { cipherText, iv, authTag, keyVersion: this.keyVersion };
  }

  decrypt(payload: EncryptedPayload): string {
    const decipher = createDecipheriv(this.algorithm, this.key, payload.iv);
    decipher.setAuthTag(payload.authTag);
    const plain = Buffer.concat([
      decipher.update(payload.cipherText),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  }

  hashSha256(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }
}
