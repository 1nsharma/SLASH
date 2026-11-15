import { NextRequest, NextResponse } from 'next/server';
import { ingestConnectorSource } from '@/lib/connectors';
import type { ConnectorSourceKind } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      kind?: ConnectorSourceKind;
      label?: string;
      urlOrLocator?: string;
      rawContent?: string;
      usePreset?: boolean;
    };

    if (!body?.kind) {
      return NextResponse.json(
        { error: 'Connector kind is required.' },
        { status: 400 },
      );
    }

    const artifact = await ingestConnectorSource({
      kind: body.kind,
      label: body.label,
      urlOrLocator: body.urlOrLocator,
      rawContent: body.rawContent,
      usePreset: Boolean(body.usePreset),
    });

    return NextResponse.json({ artifact });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to ingest connector source.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
