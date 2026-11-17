import 'server-only';

import { createCipheriv, randomBytes } from 'node:crypto';

function encryptionKey() {
  const value = process.env.PAYMENT_PROFILE_ENCRYPTION_KEY;
  if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error('Payment profile encryption is not configured');
  }
  return Buffer.from(value, 'hex');
}

export function encryptBankAccountNumber(accountNumber: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(accountNumber, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}
