import { NextResponse } from 'next/server';
import {
  getIframeCookieOptions,
  GITHUB_SESSION_COOKIE,
  GITHUB_STATE_COOKIE,
} from '@/lib/security/tokenVault';

export async function POST() {
  const res = NextResponse.json({ authenticated: false });
  const opts = { ...getIframeCookieOptions(0), maxAge: 0 };
  res.cookies.set(GITHUB_SESSION_COOKIE, '', opts);
  res.cookies.set(GITHUB_STATE_COOKIE, '', opts);
  return res;
}
