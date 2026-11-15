import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  decryptTokenPayload,
  GITHUB_SESSION_COOKIE,
  toPublicGitHubAuthStatus,
} from '@/lib/security/tokenVault';

export async function GET() {
  const cookieStore = await cookies();
  const sealed = cookieStore.get(GITHUB_SESSION_COOKIE)?.value;
  const session = decryptTokenPayload(sealed);
  return NextResponse.json(toPublicGitHubAuthStatus(session));
}
