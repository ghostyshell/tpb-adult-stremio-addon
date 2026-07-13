/**
 * profileStore.ts
 * Multi-slot config profiles in MongoDB, each slot AES-256-GCM encrypted.
 *
 * Storage key  = HMAC-SHA256(SESSION_SECRET, identifier) — opaque in the DB.
 * Stored value = JSON { [slotName]: base64(iv+tag+enc) }
 *                Slot configs encrypted individually with scrypt(identifier, SESSION_SECRET).
 * MongoDB      = shared `cache` collection via MongoCache('prof:v1:', 90 days).
 */

import crypto from 'crypto';
import { MongoCache } from './mongoCache';
import { getCollection } from './mongo';

let _ephemeralSecret: string | null = null;
let _warnedEphemeral = false;

function sessionSecret(): string {
  const s = process.env.SESSION_SECRET || '';
  if (s) return s;
  if (!_ephemeralSecret) {
    _ephemeralSecret = crypto.randomBytes(32).toString('hex');
    if (!_warnedEphemeral) {
      console.warn('[profile] SESSION_SECRET unset - saved profiles will not survive restart');
      _warnedEphemeral = true;
    }
  }
  return _ephemeralSecret;
}

const profileCache = new MongoCache('prof:v1:', 90 * 24 * 60 * 60);

export function normalizeProfileIdentifier(identifier: string): string {
  const trimmed = String(identifier || '').trim();
  // Email buckets are case-insensitive; legacy authKey identifiers must stay exact.
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  return trimmed;
}

function storageKey(identifier: string): string {
  return crypto.createHmac('sha256', sessionSecret()).update(normalizeProfileIdentifier(identifier)).digest('hex').slice(0, 32);
}

/** Pre-normalization email buckets keyed by the exact Stremio email string. */
function legacyStorageKey(identifier: string): string {
  return crypto.createHmac('sha256', sessionSecret()).update(String(identifier || '').trim()).digest('hex').slice(0, 32);
}

function scryptKey(identifier: string, legacyRaw = false): Buffer {
  const material = legacyRaw ? String(identifier || '').trim() : normalizeProfileIdentifier(identifier);
  return crypto.scryptSync(material, sessionSecret(), 32);
}

function encryptSlot(identifier: string, data: object): string {
  const id = normalizeProfileIdentifier(identifier);
  const key = scryptKey(id);
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

function decryptSlot(identifier: string, ciphertext: string, legacyRaw = false): object | null {
  try {
    const buf = Buffer.from(ciphertext, 'base64');
    const key = scryptKey(identifier, legacyRaw);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8'));
  } catch {
    return null;
  }
}

async function readSlots(identifier: string): Promise<Record<string, string>> {
  const raw = await profileCache.get(storageKey(identifier));
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, string>;
  return {};
}

async function readLegacySlots(rawIdentifier: string): Promise<Record<string, string>> {
  const raw = await profileCache.get(legacyStorageKey(rawIdentifier));
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, string>;
  return {};
}

async function writeSlots(identifier: string, slots: Record<string, string>): Promise<void> {
  await profileCache.set(storageKey(identifier), JSON.stringify(slots));
}

export function profilesConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

export async function profileStorageReady(): Promise<boolean> {
  if (!profilesConfigured()) return false;
  return (await getCollection()) != null;
}

export async function listProfileSlots(identifier: string): Promise<string[]> {
  return Object.keys(await readSlots(normalizeProfileIdentifier(identifier)));
}

export async function saveProfileSlot(identifier: string, slotName: string, data: object, overwrite = false): Promise<'ok' | 'duplicate'> {
  const id = normalizeProfileIdentifier(identifier);
  const slots = await readSlots(id);
  if (!overwrite && slotName in slots) return 'duplicate';
  slots[slotName] = encryptSlot(id, data);
  await writeSlots(id, slots);
  return 'ok';
}

export async function loadProfileSlot(identifier: string, slotName: string): Promise<object | null> {
  const id = normalizeProfileIdentifier(identifier);
  const slots = await readSlots(id);
  return slots[slotName] ? decryptSlot(id, slots[slotName]) : null;
}

export async function deleteProfileSlot(identifier: string, slotName: string): Promise<void> {
  const id = normalizeProfileIdentifier(identifier);
  const slots = await readSlots(id);
  delete slots[slotName];
  await writeSlots(id, slots);
}

export async function deleteProfile(identifier: string): Promise<void> {
  await profileCache.delete(storageKey(identifier));
}

/** Merge slots stored under a mixed-case email into the canonical lowercase bucket. */
export async function migrateEmailCasing(canonicalEmail: string, rawEmail?: string): Promise<number> {
  const target = normalizeProfileIdentifier(canonicalEmail);
  const raw = String(rawEmail || '').trim();
  if (!raw || !raw.includes('@') || normalizeProfileIdentifier(raw) !== target || raw === target) return 0;

  const targetSlots = await readSlots(target);
  const legacySlots = await readLegacySlots(raw);
  const legacyNames = Object.keys(legacySlots);
  if (!legacyNames.length) return 0;

  let count = 0;
  for (const slotName of legacyNames) {
    if (slotName in targetSlots) continue;
    const data = decryptSlot(raw, legacySlots[slotName], true);
    if (!data) continue;
    targetSlots[slotName] = encryptSlot(target, data);
    count++;
  }
  if (!count) return 0;

  await writeSlots(target, targetSlots);
  await profileCache.delete(legacyStorageKey(raw));
  console.log(`[profile] merged ${count} slot(s) from ${raw} into ${target}`);
  return count;
}

/** Re-key profiles saved under the legacy authKey identifier to email. */
export async function migrateLegacyProfile(email: string, legacyIdentifier: string): Promise<number> {
  const normalizedEmail = normalizeProfileIdentifier(email);
  const legacy = String(legacyIdentifier || '').trim();
  if (!normalizedEmail || !legacy || normalizedEmail === legacy) return 0;

  const targetSlots = await readSlots(normalizedEmail);
  const legacySlots = await readSlots(legacy);
  const slotNames = Object.keys(legacySlots);
  if (!slotNames.length) return 0;

  let count = 0;
  for (const slotName of slotNames) {
    if (slotName in targetSlots) continue;
    const data = decryptSlot(legacy, legacySlots[slotName]);
    if (!data) continue;
    targetSlots[slotName] = encryptSlot(normalizedEmail, data);
    delete legacySlots[slotName];
    count++;
  }
  if (!count) return 0;

  await writeSlots(normalizedEmail, targetSlots);
  if (Object.keys(legacySlots).length === 0) {
    await profileCache.delete(storageKey(legacy));
  } else {
    await writeSlots(legacy, legacySlots);
  }
  console.log(`[profile] migrated ${count} slot(s) to ${normalizedEmail}`);
  return count;
}
