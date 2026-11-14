import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { normalizeAndValidateUrl } from '../classifier';

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
}

export function isPrivateOrReservedIp(rawIp: string): boolean {
  const ip = rawIp.trim().toLowerCase().replace(/^\[|\]$/g, '');
  const version = isIP(ip);
  if (version === 0) return true;

  if (version === 4) {
    const parts = ip.split('.').map((p) => Number(p));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b, c] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // Link-local & cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // IETF protocol / TEST-NET-1
    if (a === 198 && (b === 18 || b === 19)) return true; // Benchmark testing
    if (a >= 224) return true; // Multicast & reserved
    return false;
  }

  // IPv6 checks (including IPv4-mapped ::ffff:a.b.c.d)
  const cleanV6 = ip.split('%')[0];
  if (cleanV6 === '::' || cleanV6 === '::1') return true;
  if (cleanV6.startsWith('::ffff:')) {
    const mapped = cleanV6.slice('::ffff:'.length);
    if (isIP(mapped) === 4) {
      return isPrivateOrReservedIp(mapped);
    }
    return true;
  }
  if (
    cleanV6.startsWith('fc') ||
    cleanV6.startsWith('fd') || // ULA fc00::/7
    cleanV6.startsWith('fe8') ||
    cleanV6.startsWith('fe9') ||
    cleanV6.startsWith('fea') ||
    cleanV6.startsWith('feb') || // Link-local fe80::/10
    cleanV6.startsWith('ff') // Multicast
  ) {
    return true;
  }

  return false;
}

export async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  const check = normalizeAndValidateUrl(rawUrl);
  if (!check.valid || !check.normalizedUrl) {
    throw new Error(check.error || 'Blocked unsafe or invalid URL.');
  }

  const parsed = new URL(check.normalizedUrl);
  const host = parsed.hostname.replace(/^\[|\]$/g, '');

  if (isIP(host) !== 0) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error(
        `SSRF guard blocked direct private or reserved IP target (${host}).`,
      );
    }
    return parsed;
  }

  const records = await lookup(host, { all: true }).catch(() => []);
  for (const rec of records) {
    if (isPrivateOrReservedIp(rec.address)) {
      throw new Error(
        `SSRF guard blocked ${host} because it resolved to a private or reserved network address.`,
      );
    }
  }

  return parsed;
}

async function readBoundedBody(res: Response, maxBytes: number): Promise<Uint8Array> {
  const contentLengthHeader = res.headers.get('content-length');
  if (contentLengthHeader) {
    const declared = Number(contentLengthHeader);
    if (!Number.isNaN(declared) && declared > maxBytes) {
      throw new Error(
        `Response exceeded maximum allowed size limit (${Math.round(maxBytes / 1024)} KB).`,
      );
    }
  }

  if (!res.body) {
    return new Uint8Array();
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          throw new Error(
            `Response stream exceeded maximum allowed size limit (${Math.round(maxBytes / 1024)} KB).`,
          );
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

export async function safeFetchPublic(
  rawUrl: string,
  init: RequestInit = {},
  options: SafeFetchOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxRedirects = options.maxRedirects ?? 5;
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024; // 2 MB cap

  let currentUrl = (await assertSafePublicUrl(rawUrl)).toString();

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(currentUrl, {
        ...init,
        signal: controller.signal,
        redirect: 'manual',
      });
    } finally {
      clearTimeout(timer);
    }

    const isRedirect =
      res.status >= 300 && res.status < 400 && res.headers.has('location');
    if (isRedirect) {
      if (hop >= maxRedirects) {
        throw new Error(`Exceeded maximum redirect hops (${maxRedirects}).`);
      }
      const nextLocation = res.headers.get('location')!;
      const resolvedNext = new URL(nextLocation, currentUrl).toString();
      currentUrl = (await assertSafePublicUrl(resolvedNext)).toString();
      continue;
    }

    const boundedBytes = await readBoundedBody(res, maxBytes);
    const copyBuffer = new ArrayBuffer(boundedBytes.byteLength);
    new Uint8Array(copyBuffer).set(boundedBytes);
    return new Response(copyBuffer, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  }

  throw new Error('Failed to fetch public URL safely.');
}
