import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export interface EncryptedData {
  encrypted: Buffer;
  iv: Buffer;
  tag: Buffer;
}

export function encrypt(plaintext: string, keyHex: string): EncryptedData {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { encrypted, iv, tag };
}

export function decrypt(data: EncryptedData, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, data.iv);
  decipher.setAuthTag(data.tag);
  return Buffer.concat([decipher.update(data.encrypted), decipher.final()]).toString('utf8');
}

export function encryptJson(obj: Record<string, string>, keyHex: string): EncryptedData {
  return encrypt(JSON.stringify(obj), keyHex);
}

export function decryptJson(data: EncryptedData, keyHex: string): Record<string, string> {
  return JSON.parse(decrypt(data, keyHex));
}
