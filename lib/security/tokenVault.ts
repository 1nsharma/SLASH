import crypto from 'node:crypto';

export const GITHUB_SESSION_COOKIE = 'slash_gh_session';
export const GITHUB_STATE_COOKIE = 'slash_gh_oauth_state';

export interface StoredGitHubSession {
  accessToken: string;
  login: string;
  avatarUrl?: string;
  scopes: string[];
  createdAt: string;
}

export interface PublicGitHubAuthStatus {
  configured: boolean;
  authenticated: boolean;
  login?: string;
  avatarUrl?: string;
  scopes?: string[];
  callbackUrl: string;
}

let ephemeralProcessSecret: string | null = null;

function getVaultKey(): Buffer {
  const raw =
    process.env.OAUTH_SESSION_SECRET?.trim() ||
    process.env.GITHUB_OAUTH_CLIENT_SECRET?.trim() ||
    process.env.GEMINI_API_KEY?.trim();

  if (raw) {
    return crypto.createHash('sha256').update(`slash-vault:${raw}`).digest();
  }

  if (!ephemeralProcessSecret) {
    ephemeralProcessSecret = crypto.randomBytes(32).toString('hex');
  }
  return crypto
    .createHash('sha256')
    .update(`slash-ephemeral:${ephemeralProcessSecret}`)
    .digest();
}

export function getAppBaseUrl(): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl && /^https?:\/\//i.test(envUrl)) {
    return envUrl.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

export function getGitHubCallbackUrl(): string {
  return `${getAppBaseUrl()}/api/auth/github/callback`;
}

export function isGitHubOAuthConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_OAUTH_CLIENT_ID?.trim() &&
      process.env.GITHUB_OAUTH_CLIENT_SECRET?.trim(),
  );
}

export function encryptTokenPayload(payload: StoredGitHubSession): string {
  const key = getVaultKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptTokenPayload(
  sealed: string | undefined | null,
): StoredGitHubSession | null {
  if (!sealed || typeof sealed !== 'string') return null;
  const parts = sealed.split('.');
  if (parts.length !== 3) return null;

  try {
    const [ivB64, tagB64, dataB64] = parts;
    const key = getVaultKey();
    const iv = Buffer.from(ivB64, 'base64url');
    const authTag = Buffer.from(tagB64, 'base64url');
    const encrypted = Buffer.from(dataB64, 'base64url');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');

    const parsed = JSON.parse(decrypted) as StoredGitHubSession;
    if (!parsed?.accessToken || !parsed?.login) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function createSignedOAuthState(): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const issuedAt = Date.now().toString(36);
  const data = `${nonce}.${issuedAt}`;
  const sig = crypto
    .createHmac('sha256', getVaultKey())
    .update(data)
    .digest('base64url');
  return `${data}.${sig}`;
}

export function verifySignedOAuthState(
  state: string | undefined | null,
  expectedStateCookie: string | undefined | null,
  maxAgeMs = 10 * 60 * 1000,
): boolean {
  if (!state || !expectedStateCookie) return false;
  if (state.length !== expectedStateCookie.length) return false;

  const a = Buffer.from(state);
  const b = Buffer.from(expectedStateCookie);
  if (!crypto.timingSafeEqual(a, b)) return false;

  const parts = state.split('.');
  if (parts.length !== 3) return false;
  const [nonce, issuedB36, sig] = parts;
  const data = `${nonce}.${issuedB36}`;
  const expectedSig = crypto
    .createHmac('sha256', getVaultKey())
    .update(data)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return false;
  }

  const issuedAt = parseInt(issuedB36, 36);
  if (Number.isNaN(issuedAt) || Date.now() - issuedAt > maxAgeMs) {
    return false;
  }

  return true;
}

export function getIframeCookieOptions(maxAgeSeconds = 60 * 60 * 8) {
  const appUrl = getAppBaseUrl();
  const isHttps = appUrl.startsWith('https://') || process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export function toPublicGitHubAuthStatus(
  session: StoredGitHubSession | null,
): PublicGitHubAuthStatus {
  return {
    configured: isGitHubOAuthConfigured(),
    authenticated: Boolean(session),
    login: session?.login,
    avatarUrl: session?.avatarUrl,
    scopes: session?.scopes,
    callbackUrl: getGitHubCallbackUrl(),
  };
}
