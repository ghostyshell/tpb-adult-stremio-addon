import { stripchatKeyCache } from '../utils/cache';

const PKEY_CACHE_KEY = 'stripchat:pkey';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const HDR = { 'User-Agent': UA, 'Referer': 'https://stripchat.com/', 'Accept': 'application/json' };

interface PkeyResult {
  pkey: string;
}

let playwrightModule: any = null;
try {
  playwrightModule = require('@playwright/test');
} catch (_: any) {
  try {
    playwrightModule = require('playwright');
  } catch (_: any) {
    playwrightModule = null;
  }
}

async function liveGirls(): Promise<string[]> {
  const r = await fetch('https://stripchat.com/api/front/v2/models?limit=12&offset=0&primaryTag=girls', { headers: HDR });
  const d = await r.json() as any;
  const blocks: any[] = d.blocks || [];
  if (!blocks.length) return [];
  return (blocks[0].models || [])
    .filter((m: any) => m.status === 'public' && m.isLive)
    .map((m: any) => m.username as string);
}

async function extractPkeyViaBrowser(username: string): Promise<string | null> {
  if (!playwrightModule) return null;
  const { chromium } = playwrightModule;
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  });
  try {
    const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    let pkey: string | null = null;
    page.on('request', (req: any) => {
      if (pkey) return;
      const u = req.url();
      const m = u.match(/[?&]pkey=([A-Za-z0-9]{12,24})/);
      if (m) pkey = m[1];
    });
    await page.goto('https://stripchat.com/' + encodeURIComponent(username), { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('button,a,div')].find(b => /over 18/i.test((b.textContent || '').trim().slice(0, 20)));
      if (el) (el as HTMLElement).click();
    });
    for (let i = 0; i < 24 && !pkey; i++) await page.waitForTimeout(500);
    return pkey;
  } finally {
    await browser.close().catch(() => {});
  }
}

async function extractPkeyBrowserless(): Promise<string | null> {
  return null;
}

async function extractPkey(): Promise<string | null> {
  const browserless = await extractPkeyBrowserless();
  if (browserless) return browserless;

  const models = await liveGirls();
  for (const username of models.slice(0, 4)) {
    try {
      const pk = await extractPkeyViaBrowser(username);
      if (pk) {
        console.log('[stripchatKeys] pkey extracted via browser (model: ' + username + ')');
        return pk;
      }
    } catch (err: any) {
      console.warn('[stripchatKeys] browser extraction failed for ' + username + ': ' + err.message);
    }
  }
  return null;
}

async function getPkey(): Promise<string | null> {
  const cached: any = await stripchatKeyCache.get(PKEY_CACHE_KEY);
  if (cached && cached.pkey) return cached.pkey;

  const pkey = await extractPkey();
  if (pkey) {
    await stripchatKeyCache.set(PKEY_CACHE_KEY, { pkey } as PkeyResult);
  }
  return pkey;
}

async function invalidatePkey(): Promise<void> {
  await stripchatKeyCache.delete(PKEY_CACHE_KEY);
}

async function refreshPkey(): Promise<string | null> {
  await invalidatePkey();
  const pkey = await extractPkey();
  if (pkey) {
    await stripchatKeyCache.set(PKEY_CACHE_KEY, { pkey } as PkeyResult);
  }
  return pkey;
}

export { getPkey, extractPkey, invalidatePkey, refreshPkey };
