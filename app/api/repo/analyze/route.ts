import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { analyzeRepoPipeline } from '@/lib/repo/analyzer';
import {
  decryptTokenPayload,
  GITHUB_SESSION_COOKIE,
} from '@/lib/security/tokenVault';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      repoUrl?: string;
      usePreset?: boolean;
      forceRefresh?: boolean;
    };

    if (!body?.repoUrl || typeof body.repoUrl !== 'string') {
      return NextResponse.json(
        { error: 'Please provide a GitHub repository URL or owner/repo slug.' },
        { status: 400 },
      );
    }

    let githubAccessToken: string | undefined;
    try {
      const cookieStore = await cookies();
      const sealed = cookieStore.get(GITHUB_SESSION_COOKIE)?.value;
      const session = decryptTokenPayload(sealed);
      githubAccessToken = session?.accessToken;
    } catch {
      // Request context outside Next cookies (e.g., direct unit test invocation)
    }

    const report = await analyzeRepoPipeline(body.repoUrl, {
      usePreset: Boolean(body.usePreset),
      forceRefresh: Boolean(body.forceRefresh),
      githubAccessToken,
    });

    return NextResponse.json({ repoReport: report, report });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Unexpected error analyzing repository.';
    const status = message.toLowerCase().includes('valid') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
