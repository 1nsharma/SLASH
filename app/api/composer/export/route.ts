import { NextRequest, NextResponse } from 'next/server';
import { createZipArchive } from '@/lib/composer/zip';
import {
  generateUnifiedBlueprintJson,
  generateUnifiedMermaidDiagram,
} from '@/lib/graph/blueprintExport';
import type { UnifiedGraphProject, VirtualProjectBundle } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      project?: UnifiedGraphProject;
      bundle?: VirtualProjectBundle;
    };

    if (!body?.bundle || !body.bundle.files?.length) {
      return NextResponse.json(
        { error: 'Generate an approved project bundle before exporting.' },
        { status: 400 },
      );
    }

    const entries = body.bundle.files.map((f) => ({
      path: f.path,
      content: f.content,
    }));

    if (body.project) {
      entries.push({
        path: 'slash-blueprint.json',
        content: generateUnifiedBlueprintJson(body.project),
      });
      entries.push({
        path: 'architecture.mmd',
        content: generateUnifiedMermaidDiagram(body.project),
      });
    }

    const zipBytes = createZipArchive(entries);
    const filename = `${body.bundle.projectName || 'slash-composed-app'}.zip`;

    const copy = new Uint8Array(zipBytes.byteLength);
    copy.set(zipBytes);
    return new NextResponse(copy.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Failed to export project ZIP.',
      },
      { status: 500 },
    );
  }
}
