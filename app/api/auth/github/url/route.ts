import { NextRequest, NextResponse } from 'next/server';
import {
  createSignedOAuthState,
  getGitHubCallbackUrl,
  getIframeCookieOptions,
  GITHUB_STATE_COOKIE,
  isGitHubOAuthConfigured,
} from '@/lib/security/tokenVault';

export async function GET(req: NextRequest) {
  const callbackUrl = getGitHubCallbackUrl();
  if (!isGitHubOAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          'GitHub OAuth is not configured on this server. Public GitHub URLs still work without login, or configure GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET.',
        callbackUrl,
      },
      { status: 400 },
    );
  }

  const includePrivate = req.nextUrl.searchParams.get('includePrivate') === '1';
  const scope = includePrivate ? 'read:user repo' : 'read:user public_repo';
  const state = createSignedOAuthState();

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_OAUTH_CLIENT_ID!.trim(),
    redirect_uri: callbackUrl,
    scope,
    state,
  });

  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  const res = NextResponse.json({ url: authUrl, callbackUrl, scope });
  res.cookies.set(GITHUB_STATE_COOKIE, state, getIframeCookieOptions(600));
  return res;
}
