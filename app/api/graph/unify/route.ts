import { NextRequest, NextResponse } from 'next/server';
import { analyzeUrlPipeline } from '@/lib/analyzer';
import { getGeminiClient } from '@/lib/gemini';
import { unifyIntelligenceSources } from '@/lib/graph/unifier';
import { analyzeRepoPipeline } from '@/lib/repo/analyzer';
import type {
  RepoIntelligenceReport,
  UrlIntelligenceReport,
} from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      title?: string;
      urls?: string[];
      repoUrls?: string[];
      urlReports?: UrlIntelligenceReport[];
      repoReports?: RepoIntelligenceReport[];
      usePreset?: boolean;
    };

    const existingUrlReports = [...(body.urlReports ?? [])];
    const existingRepoReports = [...(body.repoReports ?? [])];

    const newUrlReports = await Promise.all(
      (body.urls ?? [])
        .filter((u) => typeof u === 'string' && u.trim().length > 0)
        .map((u) =>
          analyzeUrlPipeline(u.trim(), { usePreset: Boolean(body.usePreset) }),
        ),
    );

    const newRepoReports = await Promise.all(
      (body.repoUrls ?? [])
        .filter((r) => typeof r === 'string' && r.trim().length > 0)
        .map((r) =>
          analyzeRepoPipeline(r.trim(), { usePreset: Boolean(body.usePreset) }),
        ),
    );

    const allUrlReports = [...existingUrlReports, ...newUrlReports];
    const allRepoReports = [...existingRepoReports, ...newRepoReports];

    if (allUrlReports.length === 0 && allRepoReports.length === 0) {
      return NextResponse.json(
        { error: 'Provide at least one URL or repository to unify.' },
        { status: 400 },
      );
    }

    const preliminary = unifyIntelligenceSources({
      urlReports: allUrlReports,
      repoReports: allRepoReports,
      title: body.title,
    });

    let aiSynthesis = preliminary.summary;
    try {
      const ai = getGeminiClient();
      const res = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Summarize the unified digital architecture across these connected resources in 2 concise paragraphs, citing only observed shared technologies, routes, and boundaries:\n${JSON.stringify(
          {
            sources: preliminary.sources,
            sharedTech: preliminary.sharedTech,
            crossLinks: preliminary.edges
              .filter((e) => e.sourceEngine === 'unified')
              .map((e) => ({
                label: e.label,
                confidence: e.confidence,
                evidence: e.evidence,
              })),
          },
          null,
          2,
        )}`,
      });
      if (res.text) {
        aiSynthesis = res.text;
      }
    } catch {
      // Deterministic summary remains intact if Gemini is unavailable
    }

    const project = {
      ...preliminary,
      aiSynthesis,
    };

    return NextResponse.json({ project });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to unify intelligence graph.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
