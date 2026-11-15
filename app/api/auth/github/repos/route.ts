import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  decryptTokenPayload,
  GITHUB_SESSION_COOKIE,
} from '@/lib/security/tokenVault';

export async function GET() {
  const cookieStore = await cookies();
  const sealed = cookieStore.get(GITHUB_SESSION_COOKIE)?.value;
  const session = decryptTokenPayload(sealed);

  if (!session) {
    return NextResponse.json(
      { error: 'Connect GitHub via OAuth to browse your private and owned repositories.' },
      { status: 401 },
    );
  }

  try {
    const res = await fetch(
      'https://api.github.com/user/repos?sort=updated&per_page=25&affiliation=owner,collaborator',
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${session.accessToken}`,
          'User-Agent': 'SLASH-RepoUnifier/1.0',
        },
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `GitHub returned HTTP ${res.status} while listing repositories.` },
        { status: res.status },
      );
    }

    const raw = (await res.json()) as Array<{
      id: number;
      full_name: string;
      html_url: string;
      private: boolean;
      language: string | null;
      description: string | null;
      license?: { spdx_id?: string } | null;
    }>;

    const repos = raw.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      url: r.html_url,
      isPrivate: Boolean(r.private),
      language: r.language || 'Unknown',
      description: r.description || '',
      licenseSpdx:
        r.license?.spdx_id && r.license.spdx_id !== 'NOASSERTION'
          ? r.license.spdx_id
          : undefined,
    }));

    return NextResponse.json({ repos, login: session.login });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Failed to load GitHub repositories.',
      },
      { status: 500 },
    );
  }
}
