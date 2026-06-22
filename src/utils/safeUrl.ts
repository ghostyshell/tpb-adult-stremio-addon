/**
 * safeUrl.js
 *
 * Server-side URL validation to mitigate SSRF. Any URL the addon fetches on
 * behalf of a decoded item ID or user-supplied config must pass through here.
 *
 * Allows public HTTP(S) URLs and blocks:
 *   - non-http(s) protocols
 *   - URLs with embedded credentials
 *   - localhost / loopback hostnames
 *   - private/reserved/link-local/multicast IP literals
 *   - known cloud metadata endpoints (169.254.169.254, metadata.*, etc.)
 *   - bare IP literals in general (they are rarely legitimate for torrent/indexer URLs)
 *
 * This is intentionally a deny-list for private/reserved ranges, not a strict
 * domain allow-list, because the addon legitimately needs to fetch torrents and
 * cover images from a wide variety of public indexers and image hosts.
 */


import { URL } from 'url';

// Cloud / container metadata endpoints that must never be reachable.
const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
  '169.254.169.254.nip.io',
]);
const BLOCKED_HOST_PATTERNS = [
  /^metadata(\.[a-z0-9-]+)?\.internal$/i,
  /^169-254-169-254\./i,
];

const BLOCKED_IP_LITERALS = new Set([
  '169.254.169.254', // IMDS / cloud metadata
]);

/**
 * Parse an IPv4 address into its numeric octets. Returns null if not a valid
 * dotted-decimal IPv4 literal.
 */
function parseIPv4(ip: string) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p: string) => parseInt(p, 10));
  if (nums.some((n: number) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return nums;
}

function isPrivateIPv4(ip: string) {
  const n = parseIPv4(ip);
  if (!n) return false;
  const [a, b, c, d] = n;
  // 0.0.0.0/8
  if (a === 0) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 127.0.0.0/8 loopback
  if (a === 127) return true;
  // 169.254.0.0/16 link-local
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 192.0.0.0/24
  if (a === 192 && b === 0 && c === 0) return true;
  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 documentation
  if ((a === 192 && b === 0 && c === 2) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113)) return true;
  // 224.0.0.0/4 multicast
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 reserved
  if (a >= 240) return true;
  // 100.64.0.0/10 CGNAT
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/**
 * Very conservative IPv6 check. We block all IPv6 literals because public
 * indexers/image hosts use hostnames, and IPv6 literals are a common SSRF
 * bypass path. Strips brackets if present.
 */
function isBlockedIPv6(host: string) {
  const h = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (!h.includes(':')) return false;
  // Link-local: fe80::/10
  if (/^fe[89ab][0-9a-f]?/i.test(h)) return true;
  // Loopback ::1
  if (h === '::1' || h === '1') return true;
  // :: / unspecified
  if (h === '::' || h === '') return true; // h==='' unreachable: new URL('http://[]/') throws
  // Multicast ff00::/8
  if (/^ff[0-9a-f]{2}:/i.test(h)) return true;
  // Unique local fc00::/7
  if (/^fc[0-9a-f]:/i.test(h) || /^fd[0-9a-f]{2}:/i.test(h)) return true;
  return true; // block any other IPv6 literal by default
}

function isBlockedHost(hostname: string) {
  const h = hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(h)) return true;
  if (BLOCKED_HOST_PATTERNS.some((p) => p.test(h))) return true;
  if (BLOCKED_IP_LITERALS.has(h)) return true;
  if (isPrivateIPv4(h)) return true;
  if (isBlockedIPv6(h)) return true;
  return false;
}

/**
 * Validate that a URL is safe for the server to fetch.
 * @param {string} url
 * @returns {{ ok: true, url: string } | { ok: false, reason: string }}
 */
function isSafeUrl(url: string) {
  const raw = String(url || '').trim();
  if (!raw) return { ok: false, reason: 'empty url' };

  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_: any) {
    return { ok: false, reason: 'invalid url' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'only http/https allowed' };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'embedded credentials not allowed' };
  }

  const hostname = parsed.hostname;
  /* v8 ignore next 3 -- http/https URLs always have a non-empty host in WHATWG URL; guard is defensive */
  if (!hostname) {
    return { ok: false, reason: 'missing hostname' };
  }

  if (isBlockedHost(hostname)) {
    return { ok: false, reason: 'host points to private/reserved/metadata endpoint' };
  }

  return { ok: true, url: raw };
}

/**
 * Convenience: throws when unsafe, otherwise returns the original URL.
 */
function assertSafeUrl(url: string) {
  const result = isSafeUrl(url);
  if (!result.ok) throw new Error(`Unsafe URL: ${result.reason}`);
  return result.url;
}

export { isSafeUrl, assertSafeUrl };
