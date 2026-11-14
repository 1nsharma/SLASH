import type {
  IntelligenceEdge,
  IntelligenceNode,
  RepoDiscoveredRoute,
  RepoManifestInfo,
  SitemapItem,
  TechItem,
} from '../types';

export interface ParsedGitHubTarget {
  owner: string;
  repo: string;
  normalizedUrl: string;
  fullName: string;
}

export function parseGitHubRepoUrl(rawInput: string): ParsedGitHubTarget | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  // Support shorthand owner/repo as well as full https://github.com/owner/repo
  const shorthandMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shorthandMatch) {
    const owner = shorthandMatch[1];
    const repo = shorthandMatch[2].replace(/\.git$/, '');
    return {
      owner,
      repo,
      fullName: `${owner}/${repo}`,
      normalizedUrl: `https://github.com/${owner}/${repo}`,
    };
  }

  try {
    const withScheme = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withScheme);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'github.com') return null;

    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length < 2) return null;

    const owner = segments[0];
    const repo = segments[1].replace(/\.git$/, '');
    if (!owner || !repo) return null;

    return {
      owner,
      repo,
      fullName: `${owner}/${repo}`,
      normalizedUrl: `https://github.com/${owner}/${repo}`,
    };
  } catch {
    return null;
  }
}

export function extractManifestDependencies(
  filePath: string,
  content: string,
): RepoManifestInfo | null {
  const baseName = filePath.split('/').pop()?.toLowerCase() || '';

  if (baseName === 'package.json') {
    try {
      const pkg = JSON.parse(content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        scripts?: Record<string, string>;
      };
      return {
        path: filePath,
        ecosystem: 'npm',
        dependencies: Object.keys(pkg.dependencies || {}).slice(0, 60),
        devDependencies: Object.keys(pkg.devDependencies || {}).slice(0, 40),
        scripts: Object.keys(pkg.scripts || {}).slice(0, 15),
      };
    } catch {
      return null;
    }
  }

  if (baseName === 'requirements.txt') {
    const deps = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && !line.startsWith('-'))
      .map((line) => line.split(/[=<>!~;\s\[]/)[0].trim())
      .filter(Boolean);
    return {
      path: filePath,
      ecosystem: 'python',
      dependencies: Array.from(new Set(deps)).slice(0, 60),
      devDependencies: [],
    };
  }

  if (baseName === 'pyproject.toml') {
    const deps: string[] = [];
    const depBlockMatch = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/m);
    if (depBlockMatch) {
      const items = depBlockMatch[1].match(/["']([^"']+)["']/g) || [];
      for (const item of items) {
        const clean = item
          .replace(/["']/g, '')
          .split(/[=<>!~;\s\[]/)[0]
          .trim();
        if (clean) deps.push(clean);
      }
    }
    return {
      path: filePath,
      ecosystem: 'python',
      dependencies: Array.from(new Set(deps)).slice(0, 60),
      devDependencies: [],
    };
  }

  if (baseName === 'go.mod') {
    const deps: string[] = [];
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        !trimmed ||
        trimmed.startsWith('module ') ||
        trimmed.startsWith('go ') ||
        trimmed.startsWith('require (') ||
        trimmed === ')' ||
        trimmed.startsWith('//')
      ) {
        continue;
      }
      const mod = trimmed.replace(/^require\s+/, '').split(/\s+/)[0];
      if (mod && mod.includes('/')) deps.push(mod);
    }
    return {
      path: filePath,
      ecosystem: 'go',
      dependencies: Array.from(new Set(deps)).slice(0, 60),
      devDependencies: [],
    };
  }

  if (baseName === 'cargo.toml') {
    const deps: string[] = [];
    const depSection = content.match(/\[dependencies\]([\s\S]*?)(\n\[|$)/);
    if (depSection) {
      for (const line of depSection[1].split(/\r?\n/)) {
        const m = line.trim().match(/^([a-zA-Z0-9_-]+)\s*=/);
        if (m) deps.push(m[1]);
      }
    }
    return {
      path: filePath,
      ecosystem: 'rust',
      dependencies: Array.from(new Set(deps)).slice(0, 60),
      devDependencies: [],
    };
  }

  return null;
}

export function detectRepoRoutesAndTech(
  treeEntries: Array<{ path: string; type: 'blob' | 'tree' }>,
  manifests: RepoManifestInfo[],
): {
  routes: RepoDiscoveredRoute[];
  techStack: TechItem[];
} {
  const routes: RepoDiscoveredRoute[] = [];
  const techMap = new Map<string, TechItem>();

  const addTech = (item: TechItem) => {
    if (!techMap.has(item.name.toLowerCase())) {
      techMap.set(item.name.toLowerCase(), item);
    }
  };

  for (const entry of treeEntries) {
    if (entry.type !== 'blob') continue;
    const p = entry.path;

    // Next.js App Router API routes
    const appApiMatch = p.match(/(?:^|\/)app\/(api\/.*)\/route\.(ts|tsx|js|mjs)$/);
    if (appApiMatch) {
      routes.push({
        path: p,
        routePattern: `/${appApiMatch[1]}`,
        framework: 'Next.js App Router',
        kind: 'api',
        confidence: 'detected',
        evidence: `Route handler file ${p}`,
      });
    }

    // Next.js App Router pages
    const appPageMatch = p.match(/(?:^|\/)app\/(.*)\/page\.(ts|tsx|js|jsx)$/);
    if (appPageMatch) {
      const cleaned = appPageMatch[1].replace(/^\/+/, '');
      routes.push({
        path: p,
        routePattern: `/${cleaned}`,
        framework: 'Next.js App Router',
        kind: 'page',
        confidence: 'detected',
        evidence: `Page route file ${p}`,
      });
    } else if (/(?:^|\/)app\/page\.(ts|tsx|js|jsx)$/.test(p)) {
      routes.push({
        path: p,
        routePattern: '/',
        framework: 'Next.js App Router',
        kind: 'page',
        confidence: 'detected',
        evidence: `Root page file ${p}`,
      });
    }

    // Next.js Pages API routes
    const pagesApiMatch = p.match(/(?:^|\/)pages\/(api\/.*)\.(ts|tsx|js)$/);
    if (pagesApiMatch) {
      routes.push({
        path: p,
        routePattern: `/${pagesApiMatch[1].replace(/\/index$/, '')}`,
        framework: 'Next.js Pages Router',
        kind: 'api',
        confidence: 'detected',
        evidence: `Pages API route ${p}`,
      });
    }

    // Express / FastAPI / Backend route modules
    if (
      /(?:^|\/)(routes|routers|endpoints|controllers)\/.*\.(ts|js|py|go|rs)$/.test(
        p,
      )
    ) {
      routes.push({
        path: p,
        routePattern: `/${p.replace(/\.(ts|js|py|go|rs)$/, '')}`,
        framework: p.endsWith('.py') ? 'Python Router' : 'Backend Route Module',
        kind: 'api',
        confidence: 'detected',
        evidence: `Route module ${p}`,
      });
    }

    // Infrastructure & Config Files
    if (/(?:^|\/)Dockerfile$/i.test(p)) {
      addTech({
        name: 'Docker',
        category: 'Infrastructure',
        confidence: 'detected',
        evidence: `Container file ${p}`,
      });
    }
    if (p.startsWith('.github/workflows/')) {
      addTech({
        name: 'GitHub Actions CI/CD',
        category: 'Infrastructure',
        confidence: 'detected',
        evidence: `Workflow file ${p}`,
      });
    }
    if (p.endsWith('tsconfig.json')) {
      addTech({
        name: 'TypeScript',
        category: 'Language / Runtime',
        confidence: 'detected',
        evidence: `TypeScript config ${p}`,
      });
    }
    if (p.endsWith('prisma/schema.prisma')) {
      addTech({
        name: 'Prisma ORM',
        category: 'API / Protocol',
        confidence: 'detected',
        evidence: `Prisma schema ${p}`,
      });
    }
    if (/drizzle\.config\.(ts|js|mjs)$/.test(p)) {
      addTech({
        name: 'Drizzle ORM',
        category: 'API / Protocol',
        confidence: 'detected',
        evidence: `Drizzle config ${p}`,
      });
    }
  }

  // Map known package dependencies to canonical TechItems
  const knownPackages: Array<{
    match: string;
    name: string;
    category: TechItem['category'];
  }> = [
    { match: 'next', name: 'Next.js', category: 'Framework' },
    { match: 'react', name: 'React', category: 'Framework' },
    { match: 'vue', name: 'Vue.js', category: 'Framework' },
    { match: 'svelte', name: 'Svelte', category: 'Framework' },
    { match: 'express', name: 'Express', category: 'Framework' },
    { match: 'fastify', name: 'Fastify', category: 'Framework' },
    { match: 'hono', name: 'Hono', category: 'Framework' },
    { match: 'fastapi', name: 'FastAPI', category: 'Framework' },
    { match: 'django', name: 'Django', category: 'Framework' },
    { match: 'flask', name: 'Flask', category: 'Framework' },
    { match: 'tailwindcss', name: 'Tailwind CSS', category: 'Styling' },
    { match: '@xyflow/react', name: 'React Flow', category: 'Graphics / Visualization' },
    { match: 'mermaid', name: 'Mermaid.js', category: 'Graphics / Visualization' },
    { match: 'three', name: 'Three.js', category: 'Graphics / Visualization' },
    { match: 'lucide-react', name: 'Lucide Icons', category: 'UI & Icons' },
    { match: '@google/genai', name: 'Google GenAI SDK', category: 'API / Protocol' },
    { match: 'openai', name: 'OpenAI SDK', category: 'API / Protocol' },
    { match: 'ai', name: 'Vercel AI SDK', category: 'API / Protocol' },
    { match: 'zod', name: 'Zod', category: 'API / Protocol' },
    { match: 'prisma', name: 'Prisma ORM', category: 'API / Protocol' },
    { match: 'drizzle-orm', name: 'Drizzle ORM', category: 'API / Protocol' },
    { match: 'firebase', name: 'Firebase', category: 'Infrastructure' },
    { match: 'posthog-js', name: 'PostHog', category: 'Analytics' },
    { match: 'vite', name: 'Vite', category: 'Bundler & Build' },
    { match: 'typescript', name: 'TypeScript', category: 'Language / Runtime' },
    { match: 'pydantic', name: 'Pydantic', category: 'API / Protocol' },
  ];

  for (const manifest of manifests) {
    const allDeps = new Set([
      ...manifest.dependencies.map((d) => d.toLowerCase()),
      ...manifest.devDependencies.map((d) => d.toLowerCase()),
    ]);

    for (const pkg of knownPackages) {
      if (allDeps.has(pkg.match)) {
        addTech({
          name: pkg.name,
          category: pkg.category,
          confidence: 'detected',
          evidence: `Declared in ${manifest.path} (${pkg.match})`,
        });
      }
    }
  }

  return {
    routes: routes.slice(0, 40),
    techStack: Array.from(techMap.values()),
  };
}

export function buildRepoDirectoryTree(
  treeEntries: Array<{ path: string; type: 'blob' | 'tree' }>,
  repoFullName: string,
): SitemapItem[] {
  const topGroups = new Map<string, string[]>();

  for (const entry of treeEntries) {
    const parts = entry.path.split('/');
    const top = parts[0];
    if (!top) continue;
    if (!topGroups.has(top)) topGroups.set(top, []);
    if (parts.length > 1) {
      const list = topGroups.get(top)!;
      if (list.length < 8) list.push(entry.path);
    }
  }

  const children: SitemapItem[] = Array.from(topGroups.entries())
    .slice(0, 14)
    .map(([top, nested], idx) => ({
      id: `dir-${idx + 1}`,
      title: top,
      path: `/${top}`,
      role:
        nested.length > 0
          ? `${nested.length}+ paths inside /${top}`
          : 'Root repository file',
      depth: 1,
      confidence: 'detected',
      children: nested.map((childPath, cIdx) => ({
        id: `dir-${idx + 1}-${cIdx + 1}`,
        title: childPath.split('/').slice(1).join('/'),
        path: `/${childPath}`,
        role: 'Repository path',
        depth: 2,
        confidence: 'detected',
      })),
    }));

  return [
    {
      id: 'repo-root',
      title: repoFullName,
      path: '/',
      role: `${treeEntries.length} inspected repository paths`,
      depth: 0,
      confidence: 'detected',
      children,
    },
  ];
}

export function buildDeterministicRepoGraph(params: {
  fullName: string;
  normalizedUrl: string;
  manifests: RepoManifestInfo[];
  routes: RepoDiscoveredRoute[];
  techStack: TechItem[];
  topDirs: string[];
}): { nodes: IntelligenceNode[]; edges: IntelligenceEdge[] } {
  const { fullName, normalizedUrl, manifests, routes, techStack, topDirs } =
    params;
  const nodes: IntelligenceNode[] = [];
  const edges: IntelligenceEdge[] = [];

  nodes.push({
    id: 'repo-entry',
    label: `${fullName} Root`,
    category: 'Repository Entry',
    layer: 'entry',
    description: `Source repository entry containing ${topDirs.slice(0, 6).join(', ') || 'root modules'}.`,
    confidence: 'detected',
    verificationStatus: 'verified',
    entityType: 'repository',
    evidence: `GitHub repository tree for ${fullName}`,
    urlOrPath: normalizedUrl,
    sourceEngine: 'repo',
    sourceLabel: fullName,
  });

  if (routes.length > 0) {
    const apiRoutes = routes.filter((r) => r.kind === 'api');
    const pageRoutes = routes.filter((r) => r.kind === 'page');

    if (pageRoutes.length > 0) {
      nodes.push({
        id: 'repo-pages',
        label: `UI Routes (${pageRoutes.length})`,
        category: 'Frontend Modules',
        layer: 'frontend',
        description: `Detected page modules: ${pageRoutes
          .slice(0, 4)
          .map((r) => r.routePattern)
          .join(', ')}.`,
        confidence: 'detected',
        verificationStatus: 'verified',
        entityType: 'file',
        evidence: pageRoutes[0].evidence,
        urlOrPath: pageRoutes[0].path,
        sourceEngine: 'repo',
        sourceLabel: fullName,
      });
      edges.push({
        id: 'e-entry-pages',
        source: 'repo-entry',
        target: 'repo-pages',
        label: 'exposes UI routes',
        relationshipType: 'navigation',
        semanticRelation: 'CONTAINS',
        confidence: 'detected',
        verificationStatus: 'verified',
        sourceEngine: 'repo',
      });
    }

    if (apiRoutes.length > 0) {
      nodes.push({
        id: 'repo-apis',
        label: `API Endpoints (${apiRoutes.length})`,
        category: 'Server Routes',
        layer: 'logic',
        description: `Detected API route handlers: ${apiRoutes
          .slice(0, 4)
          .map((r) => r.routePattern)
          .join(', ')}.`,
        confidence: 'detected',
        verificationStatus: 'verified',
        entityType: 'api',
        evidence: apiRoutes[0].evidence,
        urlOrPath: apiRoutes[0].path,
        sourceEngine: 'repo',
        sourceLabel: fullName,
      });
      edges.push({
        id: 'e-entry-apis',
        source: pageRoutes.length > 0 ? 'repo-pages' : 'repo-entry',
        target: 'repo-apis',
        label: 'invokes API handlers',
        relationshipType: 'dataflow',
        semanticRelation: pageRoutes.length > 0 ? 'CALLS' : 'CONTAINS',
        confidence: 'detected',
        verificationStatus: 'verified',
        sourceEngine: 'repo',
      });
    }
  }

  if (manifests.length > 0) {
    const totalDeps = manifests.reduce(
      (acc, m) => acc + m.dependencies.length,
      0,
    );
    nodes.push({
      id: 'repo-manifests',
      label: `Dependency Manifests (${manifests.length})`,
      category: 'Package Graph',
      layer: 'data',
      description: `${totalDeps} declared runtime dependencies across ${manifests.map((m) => m.path).join(', ')}.`,
      confidence: 'detected',
      verificationStatus: 'verified',
      entityType: 'package',
      evidence: `Parsed ${manifests.map((m) => m.path).join(', ')}`,
      urlOrPath: manifests[0].path,
      sourceEngine: 'repo',
      sourceLabel: fullName,
    });
    edges.push({
      id: 'e-logic-manifests',
      source: nodes.some((n) => n.id === 'repo-apis')
        ? 'repo-apis'
        : 'repo-entry',
      target: 'repo-manifests',
      label: 'resolves packages',
      relationshipType: 'dependency',
      semanticRelation: 'DEPENDS_ON',
      confidence: 'detected',
      verificationStatus: 'verified',
      sourceEngine: 'repo',
    });
  }

  const externalTech = techStack.filter(
    (t) =>
      t.category === 'API / Protocol' ||
      t.category === 'Infrastructure' ||
      t.category === 'Analytics',
  );
  if (externalTech.length > 0) {
    nodes.push({
      id: 'repo-integrations',
      label: externalTech
        .slice(0, 3)
        .map((t) => t.name)
        .join(', '),
      category: 'SDKs & Infrastructure',
      layer: 'external',
      description: `External SDKs & infrastructure detected in repo: ${externalTech.map((t) => t.name).join(', ')}.`,
      confidence: 'detected',
      verificationStatus: 'verified',
      entityType: 'integration',
      evidence: externalTech[0].evidence,
      sourceEngine: 'repo',
      sourceLabel: fullName,
    });
    edges.push({
      id: 'e-repo-external',
      source: nodes.some((n) => n.id === 'repo-apis')
        ? 'repo-apis'
        : 'repo-entry',
      target: 'repo-integrations',
      label: 'integrates with',
      relationshipType: 'dependency',
      semanticRelation: 'CONNECTS_TO',
      confidence: 'detected',
      verificationStatus: 'verified',
      sourceEngine: 'repo',
    });
  }

  return { nodes, edges };
}
