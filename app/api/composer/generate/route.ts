import { NextRequest, NextResponse } from 'next/server';
import { generateUnifiedProjectBundle } from '@/lib/composer/engine';
import type { CompositionPlan, UnifiedGraphProject } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      project?: UnifiedGraphProject;
      plan?: CompositionPlan;
    };

    if (!body?.project || !body?.plan) {
      return NextResponse.json(
        { error: 'Unified project and composition plan are required.' },
        { status: 400 },
      );
    }

    if (body.plan.approvalStatus !== 'approved') {
      return NextResponse.json(
        {
          error:
            'Human approval gate enforced: CompositionPlan must have approvalStatus === "approved" before code synthesis.',
        },
        { status: 403 },
      );
    }

    const bundle = generateUnifiedProjectBundle(body.project, body.plan);
    return NextResponse.json({ bundle });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Failed to generate unified project bundle.',
      },
      { status: 500 },
    );
  }
}
