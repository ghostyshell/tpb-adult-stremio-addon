/**
 * profileStore.ts
 * Save/load user config profiles in MongoDB (persistent), encrypted with AES-256-GCM.
 *
 * Storage key  = HMAC-SHA256(SESSION_SECRET, identifier) - opaque even with DB access.
 * Ciphertext   = aes-256-gcm(scrypt(identifier, SESSION_SECRET), data) as base64.
 * MongoDB      = shared `cache` collection via MongoCache('prof:v1:', 90 days).
 *
 * Requires MONGODB_URI. Returns 503-equivalent nulls when MongoDB is unavailable.
 */

import crypto from 'crypto';
import { MongoCache } from './mongoCache';

const SESSION_SECRET = (() => {
  const s = process.env.SESSION_SECRET || '';
  if (!s) return crypto.randomBytes(32).toString('hex'); // ephemeral fallback
  return s;
})();

const profileCache = new MongoCache('prof:v1:', 90 * 24 * 60 * 60);

function storageKey(identifier: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(identifier).digest('hex').slice(0, 32);
}

function encryptProfile(identifier: string, data: object): string {
  const key = crypto.scryptSync(identifier, SESSION_SECRET, 32);
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptProfile(identifier: string, ciphertext: string): object | null {
  try {
    const buf = Buffer.from(ciphertext, 'base64');
    const iv  = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const key = crypto.scryptSync(identifier, SESSION_SECRET, 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8'));
  } catch {
    return null;
  }
}

export function profilesAvailable(): boolean {
  // MongoCache degrades to no-ops when MONGODB_URI is unset; signal unavailability.
  return Boolean(process.env.MONGODB_URI);
}

export async function saveProfile(identifier: string, data: object): Promise<void> {
  await profileCache.set(storageKey(identifier), encryptProfile(identifier, data));
}

export async function loadProfile(identifier: string): Promise<object | null> {
  const raw = await profileCache.get(storageKey(identifier));
  if (typeof raw !== 'string') return null;
  return decryptProfile(identifier, raw);
}

export async function deleteProfile(identifier: string): Promise<void> {
  await profileCache.delete(storageKey(identifier));
}
