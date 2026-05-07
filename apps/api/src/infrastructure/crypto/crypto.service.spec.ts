import { randomBytes } from 'node:crypto';

import { CryptoService } from './crypto.service';

import type { ConfigService } from '@nestjs/config';


describe('CryptoService', () => {
  const buildService = (): CryptoService => {
    const config = {
      getOrThrow: jest.fn().mockReturnValue(randomBytes(32).toString('base64')),
    } as unknown as ConfigService;
    return new CryptoService(config);
  };

  it('шифрует и дешифрует обратно ту же строку', () => {
    const svc = buildService();
    const payload = svc.encrypt('secret medical data {"allergies":["latex"]}');
    const decrypted = svc.decrypt(payload);
    expect(decrypted).toBe('secret medical data {"allergies":["latex"]}');
  });

  it('генерирует разный iv на каждое шифрование одной и той же строки', () => {
    const svc = buildService();
    const a = svc.encrypt('same-input');
    const b = svc.encrypt('same-input');
    expect(a.iv).not.toEqual(b.iv);
    expect(a.cipherText).not.toEqual(b.cipherText);
  });

  it('устанавливает keyVersion=1 по умолчанию', () => {
    const svc = buildService();
    const payload = svc.encrypt('x');
    expect(payload.keyVersion).toBe(1);
  });

  it('бросает ошибку при попытке расшифровать повреждённый authTag', () => {
    const svc = buildService();
    const payload = svc.encrypt('hello');
    const tampered = {
      ...payload,
      authTag: Buffer.alloc(payload.authTag.length, 0),
    };
    expect(() => svc.decrypt(tampered)).toThrow();
  });

  it('hashSha256 возвращает стабильный hex для одинакового входа', () => {
    const svc = buildService();
    expect(svc.hashSha256('abc')).toBe(svc.hashSha256('abc'));
    expect(svc.hashSha256('abc')).not.toBe(svc.hashSha256('abcd'));
  });
});
