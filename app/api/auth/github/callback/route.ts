import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  encryptTokenPayload,
  getGitHubCallbackUrl,
  getIframeCookieOptions,
  GITHUB_SESSION_COOKIE,
  GITHUB_STATE_COOKIE,
  isGitHubOAuthConfigured,
  verifySignedOAuthState,
} from '@/lib/security/tokenVault';

function renderPopupResultHtml(payload: {
  ok: boolean;
  login?: string;
  error?: string;
}): NextResponse {
  const serialized = JSON.stringify({
    type: payload.ok ? 'GITHUB_OAUTH_SUCCESS' : 'GITHUB_OAUTH_ERROR',
    login: payload.login,
    error: payload.error,
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>SLASH GitHub Auth</title></head>
<body style="font-family: system-ui, sans-serif; padding: 24px; color: #0f172a;">
  <p>${payload.ok ? `Connected GitHub account @${payload.login}. This window will close automatically.` : `GitHub authentication could not complete: ${payload.error || 'Unknown error'}`}</p>
  <script>
    (function () {
      if (window.opener) {
        window.opener.postMessage(${serialized}, '*');
        window.close();
      } else {
        window.location.href = '/';
      }
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: payload.ok ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function GET(req: NextRequest) {
  if (!isGitHubOAuthConfigured()) {
    return renderPopupResultHtml({
      ok: false,
      error: 'GitHub OAuth credentials are not configured on the server.',
    });
  }

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const oauthError = req.nextUrl.searchParams.get('error_description');

  if (oauthError) {
    return renderPopupResultHtml({ ok: false, error: oauthError });
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GITHUB_STATE_COOKIE)?.value;
  if (!verifySignedOAuthState(state, expectedState)) {
    return renderPopupResultHtml({
      ok: false,
      error: 'OAuth state verification failed or expired. Please retry.',
    });
  }

  if (!code) {
    return renderPopupResultHtml({
      ok: false,
      error: 'Authorization code was not returned by GitHub.',
    });
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_OAUTH_CLIENT_ID!.trim(),
        client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET!.trim(),
        code,
        redirect_uri: getGitHubCallbackUrl(),
      }),
    });

    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      scope?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || !tokenJson.access_token) {
      return renderPopupResultHtml({
        ok: false,
        error: tokenJson.error_description || 'Failed to exchange OAuth code.',
      });
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${tokenJson.access_token}`,
        'User-Agent': 'SLASH-RepoUnifier/1.0',
      },
    });
    const userJson = (await userRes.json()) as {
      login?: string;
      avatar_url?: string;
    };

    const login = userJson.login || 'github-user';
    const sealed = encryptTokenPayload({
      accessToken: tokenJson.access_token,
      login,
      avatarUrl: userJson.avatar_url,
      scopes: (tokenJson.scope || '')
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      createdAt: new Date().toISOString(),
    });

    const res = renderPopupResultHtml({ ok: true, login });
    res.cookies.set(GITHUB_SESSION_COOKIE, sealed, getIframeCookieOptions());
    res.cookies.delete(GITHUB_STATE_COOKIE);
    return res;
  } catch (err) {
    return renderPopupResultHtml({
      ok: false,
      error: err instanceof Error ? err.message : 'Unexpected OAuth callback error.',
    });
  }
}
