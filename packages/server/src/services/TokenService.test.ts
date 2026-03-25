import { describe, it, expect } from 'vitest';
import { TokenService } from './TokenService';
import { Pool } from 'pg';
import { randomBytes } from 'crypto';

// Dummy pool — DB methods are not called in encryption-only tests
const dummyPool = {} as Pool;

function hexKey(): string {
  return randomBytes(32).toString('hex');
}

function base64Key(): string {
  return randomBytes(32).toString('base64');
}

describe('TokenService', () => {
  describe('parseKey', () => {
    it('accepts a 64-char hex string', () => {
      const key = hexKey();
      const buf = TokenService.parseKey(key);
      expect(buf.length).toBe(32);
    });

    it('accepts a base64 string encoding 32 bytes', () => {
      const key = base64Key();
      const buf = TokenService.parseKey(key);
      expect(buf.length).toBe(32);
    });

    it('throws for an invalid key', () => {
      expect(() => TokenService.parseKey('too-short')).toThrow('TOKEN_ENCRYPTION_KEY');
    });
  });

  describe('encrypt / decrypt round-trip', () => {
    it('round-trips a simple token', () => {
      const svc = new TokenService(dummyPool, hexKey());
      const token = 'ghp_abc123XYZ';
      const encrypted = svc.encrypt(token);
      expect(encrypted).not.toBe(token);
      expect(svc.decrypt(encrypted)).toBe(token);
    });

    it('round-trips an empty string', () => {
      const svc = new TokenService(dummyPool, hexKey());
      const encrypted = svc.encrypt('');
      expect(svc.decrypt(encrypted)).toBe('');
    });

    it('round-trips unicode content', () => {
      const svc = new TokenService(dummyPool, hexKey());
      const token = 'tökën-with-émojis-🔑';
      expect(svc.decrypt(svc.encrypt(token))).toBe(token);
    });

    it('produces different ciphertext for the same plaintext (random IV)', () => {
      const svc = new TokenService(dummyPool, hexKey());
      const token = 'same-token';
      const a = svc.encrypt(token);
      const b = svc.encrypt(token);
      expect(a).not.toBe(b);
      // Both decrypt to the same value
      expect(svc.decrypt(a)).toBe(token);
      expect(svc.decrypt(b)).toBe(token);
    });

    it('fails to decrypt with a different key', () => {
      const svc1 = new TokenService(dummyPool, hexKey());
      const svc2 = new TokenService(dummyPool, hexKey());
      const encrypted = svc1.encrypt('secret');
      expect(() => svc2.decrypt(encrypted)).toThrow();
    });

    it('works with a base64 key', () => {
      const svc = new TokenService(dummyPool, base64Key());
      const token = 'base64-key-token';
      expect(svc.decrypt(svc.encrypt(token))).toBe(token);
    });
  });
});
