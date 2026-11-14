import { NextRequest, NextResponse } from 'next/server';
import { analyzeRepoPipeline } from '@/lib/repo/analyzer';

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

    const report = await analyzeRepoPipeline(body.repoUrl, {
      usePreset: Boolean(body.usePreset),
      forceRefresh: Boolean(body.forceRefresh),
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
