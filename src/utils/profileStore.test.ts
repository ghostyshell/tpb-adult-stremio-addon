import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';

const mem = new Map<string, string>();

vi.mock('./mongoCache', () => ({
  MongoCache: class {
    prefix: string;
    constructor(prefix: string) {
      this.prefix = prefix;
    }
    async get(key: string) {
      const raw = mem.get(this.prefix + key);
      return raw === undefined ? undefined : JSON.parse(raw);
    }
    async set(key: string, value: unknown) {
      mem.set(this.prefix + key, JSON.stringify(value));
    }
    async delete(key: string) {
      mem.delete(this.prefix + key);
    }
  },
}));

function writeLegacyMixedCaseBucket(email: string, slotName: string, config: object) {
  const secret = process.env.SESSION_SECRET || '';
  const legacyKey = crypto.createHmac('sha256', secret).update(email).digest('hex').slice(0, 32);
  const key = crypto.scryptSync(email, secret, 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(config), 'utf8'), cipher.final()]);
  const ciphertext = Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
  mem.set(`prof:v1:${legacyKey}`, JSON.stringify(JSON.stringify({ [slotName]: ciphertext })));
}

describe('migrateEmailCasing', () => {
  beforeEach(() => {
    mem.clear();
    process.env.SESSION_SECRET = 'test-session-secret-fixed-value-32b';
  });

  it('merges slots from a mixed-case email bucket into lowercase', async () => {
    const { migrateEmailCasing, listProfileSlots, loadProfileSlot } = await import('./profileStore');

    const mixed = 'User@Example.com';
    const canonical = 'user@example.com';
    const config = { namePostfix: 'Main' };

    writeLegacyMixedCaseBucket(mixed, 'Main', config);
    expect(await listProfileSlots(canonical)).toEqual([]);

    const moved = await migrateEmailCasing(canonical, mixed);
    expect(moved).toBe(1);
    expect(await listProfileSlots(canonical)).toEqual(['Main']);
    expect(mem.has(`prof:v1:${crypto.createHmac('sha256', process.env.SESSION_SECRET!).update(mixed).digest('hex').slice(0, 32)}`)).toBe(false);
    expect(await loadProfileSlot(canonical, 'Main')).toEqual(config);
  });
});

describe('migrateLegacyProfile', () => {
  beforeEach(() => {
    mem.clear();
    process.env.SESSION_SECRET = 'test-session-secret-fixed-value-32b';
  });

  it('re-keys slots from authKey identifier to email', async () => {
    const { saveProfileSlot, migrateLegacyProfile, listProfileSlots, loadProfileSlot } = await import('./profileStore');

    const legacyKey = 'legacy-auth-key-abcdefghijklmnop';
    const email = 'ghostlesssshell@gmail.com';
    const config = { namePostfix: 'Stripchat', sources: ['stripchat'] };

    await saveProfileSlot(legacyKey, 'Stripchat', config);
    expect(await listProfileSlots(email)).toEqual([]);

    const moved = await migrateLegacyProfile(email, legacyKey);
    expect(moved).toBe(1);
    expect(await listProfileSlots(email)).toEqual(['Stripchat']);
    expect(await listProfileSlots(legacyKey)).toEqual([]);
    expect(await loadProfileSlot(email, 'Stripchat')).toEqual(config);
  });

  it('merges only slots missing from the email bucket', async () => {
    const { saveProfileSlot, migrateLegacyProfile, listProfileSlots } = await import('./profileStore');

    const legacyKey = 'legacy-auth-key-2';
    const email = 'user@example.com';
    await saveProfileSlot(email, 'Main', { foo: 1 });
    await saveProfileSlot(legacyKey, 'Old', { bar: 2 });
    await saveProfileSlot(legacyKey, 'Main', { baz: 3 });

    expect(await migrateLegacyProfile(email, legacyKey)).toBe(1);
    expect(await listProfileSlots(email)).toEqual(['Main', 'Old']);
    expect(await listProfileSlots(legacyKey)).toEqual(['Main']);
  });
});
