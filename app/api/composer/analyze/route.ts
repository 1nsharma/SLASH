import { NextRequest, NextResponse } from 'next/server';
import { analyzeCompositionPlan } from '@/lib/composer/engine';
import type { UnifiedGraphProject } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      project?: UnifiedGraphProject;
      goalPrompt?: string;
    };

    if (!body?.project || !body.project.sources?.length) {
      return NextResponse.json(
        { error: 'Connect at least one source to the Unified Graph before composing.' },
        { status: 400 },
      );
    }

    if (!body?.goalPrompt?.trim()) {
      return NextResponse.json(
        { error: 'Describe the target application or integration goal.' },
        { status: 400 },
      );
    }

    const plan = await analyzeCompositionPlan(body.project, body.goalPrompt);
    return NextResponse.json({ plan });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Failed to analyze composition plan.',
      },
      { status: 500 },
    );
  }
}
