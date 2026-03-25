import { Pool } from 'pg';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export class TokenService {
  private readonly pool: Pool;
  private readonly encryptionKey: Buffer;

  constructor(pool: Pool, encryptionKey: string) {
    this.pool = pool;
    this.encryptionKey = TokenService.parseKey(encryptionKey);
  }

  /**
   * Parse a 32-byte encryption key from hex (64 chars) or base64 string.
   */
  static parseKey(key: string): Buffer {
    // Try hex first (64 hex chars = 32 bytes)
    if (/^[0-9a-fA-F]{64}$/.test(key)) {
      return Buffer.from(key, 'hex');
    }
    // Try base64
    const buf = Buffer.from(key, 'base64');
    if (buf.length === 32) {
      return buf;
    }
    throw new Error(
      'TOKEN_ENCRYPTION_KEY must be 32 bytes encoded as hex (64 chars) or base64.',
    );
  }

  /**
   * Encrypt a plaintext token. Returns a string: base64(iv + ciphertext + authTag).
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Pack: iv (12) + ciphertext (variable) + authTag (16)
    const packed = Buffer.concat([iv, encrypted, authTag]);
    return packed.toString('base64');
  }

  /**
   * Decrypt a token previously encrypted with `encrypt`.
   */
  decrypt(encryptedToken: string): string {
    const packed = Buffer.from(encryptedToken, 'base64');
    const iv = packed.subarray(0, IV_LENGTH);
    const authTag = packed.subarray(packed.length - AUTH_TAG_LENGTH);
    const ciphertext = packed.subarray(IV_LENGTH, packed.length - AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * Encrypt and upsert an access token for the given provider.
   */
  async storeToken(provider: 'github' | 'azure_devops', token: string): Promise<void> {
    const encryptedToken = this.encrypt(token);
    await this.pool.query(
      `INSERT INTO access_tokens (provider, encrypted_token, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (provider) DO UPDATE
         SET encrypted_token = EXCLUDED.encrypted_token,
             updated_at = NOW()`,
      [provider, encryptedToken],
    );
  }

  /**
   * Retrieve and decrypt the access token for the given provider.
   * Returns null if no token is stored.
   */
  async getToken(provider: 'github' | 'azure_devops'): Promise<string | null> {
    const result = await this.pool.query(
      `SELECT encrypted_token FROM access_tokens WHERE provider = $1`,
      [provider],
    );
    if (result.rows.length === 0) return null;
    return this.decrypt(result.rows[0].encrypted_token);
  }

  /**
   * List configured providers with their configuration timestamps.
   * Does not expose token values.
   */
  async getConfiguredProviders(): Promise<Array<{ provider: string; configuredAt: Date }>> {
    const result = await this.pool.query(
      `SELECT provider, updated_at FROM access_tokens ORDER BY provider`,
    );
    return result.rows.map((row) => ({
      provider: row.provider,
      configuredAt: new Date(row.updated_at),
    }));
  }
}
