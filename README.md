# SLASH — Unified Intelligence & Scrap-to-Business OS

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**SLASH (Repo Unifier)** turns fragmented websites, unfinished AI prototypes, GitHub repositories, OpenAPI specs, database schemas, and documentation into one connected **4-Zone Business Architecture** and a run-ready application bundle.

It unites two core intelligence engines—**URLMIND** (Web & URL Intelligence) and **Repo Intelligence** (Source Code & Manifest Analysis)—through a shared graph engine, Auto-Bridging Business OS grid, human-approved **SLASH AI Copilot**, and **4-Stage Launch Studio**.

---

## 3-Step Guided Flow

1. **1. Connect (`/` or `/<any-url>`)**
   - Paste any public website URL, GitHub shorthand (`vercel/ai`), API spec, YouTube/social URL, or import Wappalyzer/BuiltWith CSV stacks.
   - Automatically routes straight into Step 2 (**Build & Fix**), or prepend your SLASH domain before any public URL (e.g. `https://your-domain.com/github.com/vercel/ai`).
2. **2. Build & Fix (Business OS Grid + Swimlane Map + AI Copilot)**
   - **4-Zone Business Grid**: Organizes connected sources into `01 Frontend`, `02 Brain / AI`, `03 Data`, and `04 Auth & Payments`.
   - **Auto-Bridging Gap Detector**: Flags missing login, billing, shared vector memory, or workflow automation and lets you snap in **Verified Business Blocks** (`Clerk`, `Supabase`, `Stripe`, `Razorpay`, `pgvector`, `n8n`) in one click.
   - **Business Zone Swimlanes (`Architecture Map`)**: Interactive React Flow canvas grouped across 4 horizontal swimlanes with `+ Add` gap slots, a single consolidated `Filter` popover, and a `Code / Mermaid` view with `.mmd` / `.svg` / `.png` export.
   - **Human-Approved SLASH AI Copilot**: Grounded Q&A over observed graph evidence with explicit approval gates before adding edges or blocks.
3. **3. Launch (App Composer & Export Studio)**
   - **Stage 1 & 2**: Compatibility, auth scheme, and SPDX license conflict detection with explicit human approval (`Approve Plan & Generate Project`).
   - **Stage 3 & 4**: Generates API Gateway routes (`src/gateway/routes.json`, `src/app/api/gateway/[...slug]/route.ts`), `.env.bridge.example`, `docker-compose.yml`, an isolated `<iframe sandbox="allow-scripts">` preview, and downloadable `.zip` export.

---

## System Architecture

```mermaid
flowchart TD
  subgraph group_entry["1. User Entry & Routing"]
    node_landing["Smart Landing Input<br/>[components/UrlAnalyzerLanding.tsx]"]
    node_app["Workspace Controller<br/>[app/page.tsx]"]
    node_prefix["URL Prefix Redirect<br/>[app/[...target]/page.tsx]"]
  end

  subgraph group_extract["2. Source Extraction Engines"]
    node_analyze_api["URL Analysis API<br/>[app/api/analyze/route.ts]"]
    node_classifier["URL & Smart Input Classifier<br/>[lib/classifier.ts · lib/smartInput.ts]"]
    node_crawler["HTML, Jina Reader & oEmbed Crawler<br/>[lib/crawler.ts · lib/jina.ts]"]
    node_repo_api["Repository API<br/>[app/api/repo/analyze/route.ts]"]
    node_repo_analysis["GitHub Tree & Manifest Analyzer<br/>[lib/repo/analyzer.ts · lib/repo/parser.ts]"]
    node_connectors_api["Connector Ingest API<br/>[app/api/connectors/ingest/route.ts]"]
    node_connectors["OpenAPI, Prisma/SQL & Docs Connectors<br/>[lib/connectors/*]"]
  end

  subgraph group_intelligence["3. Shared Graph & Business OS"]
    node_unifier["Unified Graph & Conflict Unifier<br/>[lib/graph/unifier.ts]"]
    node_zones["4-Zone Classifier & Auto-Bridging<br/>[lib/business/zones.ts · lib/business/blocks.ts]"]
    node_swimlanes["Swimlane & Layered Layout<br/>[lib/graphLayout.ts]"]
    node_chat_api["Grounded Copilot Chat API<br/>[app/api/chat/route.ts]"]
    node_ai_router["Server-Side AI Router<br/>[lib/ai/router.ts · lib/gemini.ts]"]
  end

  subgraph group_workspace["4. Guided Workspace & Launch Studio"]
    node_grid["Business Grid + AI Copilot<br/>[components/BusinessGridPanel.tsx · AskUrlChat.tsx]"]
    node_map["React Flow Swimlanes & Mermaid SVG<br/>[components/ArchitectureMap.tsx]"]
    node_composer["4-Stage Composer & Export Studio<br/>[components/ComposerStudio.tsx · lib/composer/*]"]
    node_single["Single-Source Deep Inspector<br/>[IntelligenceWorkspace · RepoWorkspace]"]
  end

  subgraph group_security["5. Security, OAuth & Caching"]
    node_guard["SSRF Guard & Byte/Tree Caps<br/>[lib/security/urlGuard.ts · lib/repo/limits.ts]"]
    node_oauth["Encrypted GitHub OAuth Vault<br/>[lib/security/tokenVault.ts]"]
    node_cache["Normalized Cache (.cache/urlmind)<br/>[lib/cache.ts]"]
  end

  node_prefix --> node_app
  node_landing --> node_app
  node_app --> node_analyze_api
  node_app --> node_repo_api
  node_app --> node_connectors_api

  node_analyze_api --> node_classifier
  node_analyze_api --> node_crawler
  node_repo_api --> node_repo_analysis
  node_connectors_api --> node_connectors

  node_crawler --> node_guard
  node_repo_analysis --> node_guard
  node_repo_analysis --> node_oauth
  node_analyze_api --> node_cache
  node_repo_api --> node_cache

  node_analyze_api --> node_unifier
  node_repo_api --> node_unifier
  node_connectors_api --> node_unifier

  node_unifier --> node_zones
  node_unifier --> node_swimlanes
  node_unifier --> node_grid
  node_swimlanes --> node_map
  node_grid --> node_chat_api
  node_chat_api --> node_ai_router
  node_unifier --> node_composer
  node_app --> node_single

  classDef toneBlue fill:#eff6ff,stroke:#2563eb,color:#1e3a8a
  classDef toneEmerald fill:#ecfdf5,stroke:#059669,color:#064e3b
  classDef toneSlate fill:#f8fafc,stroke:#475569,color:#0f172a
  classDef toneAmber fill:#fffbeb,stroke:#d97706,color:#78350f

  class node_landing,node_app,node_prefix,node_grid,node_map,node_composer,node_single toneBlue
  class node_unifier,node_zones,node_swimlanes,node_chat_api,node_ai_router toneEmerald
  class node_analyze_api,node_classifier,node_crawler,node_repo_api,node_repo_analysis,node_connectors_api,node_connectors toneSlate
  class node_guard,node_oauth,node_cache toneAmber
```

---

## Local Development

```bash
npm install
cp .env.example .env.local
# Add GEMINI_API_KEY (and optional integrations) in .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Run the unit test suite and linter:

```bash
npx --yes tsx --test lib/urlmind.test.ts
npm run lint
npm run build
```

---

## Self-Hosting with Docker

Run the full self-hosted stack (`Next.js` app + `PostgreSQL 17 / pgvector / Apache AGE` + `Valkey`) via Docker Compose:

```bash
docker compose up -d
```

To also run the optional offline local LLM profile (`Ollama`):

```bash
docker compose --profile local-llm up -d
```

Or build the standalone container image:

```bash
docker build -t slash-app .
docker run -p 3000:3000 \
  -e GEMINI_API_KEY=your_gemini_api_key \
  -e CACHE_TTL_HOURS=24 \
  slash-app
```

---

## Environment Variables (Server-Only)

All credentials stay strictly server-side via environment variables and `/api/*` routes—never entered in browser UI or exposed in `NEXT_PUBLIC_*` variables.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | Yes (for AI) | — | Google Gemini API key used by server-side `/api/*` routes. |
| `APP_URL` | Recommended | `http://localhost:3000` | Public base URL for self-referential links and GitHub OAuth callbacks. |
| `GITHUB_TOKEN` | No | — | Optional GitHub PAT raising REST API rate limits for public Repo Intelligence scans. |
| `GITHUB_OAUTH_CLIENT_ID` | No | — | Enables read-only popup GitHub OAuth login for user-owned public/private repos. |
| `GITHUB_OAUTH_CLIENT_SECRET` | No | — | Server-only GitHub OAuth App secret used for code exchange. |
| `OAUTH_SESSION_SECRET` | No | Ephemeral dev key | 32+ char key for AES-256-GCM encrypted `HttpOnly` GitHub session cookies & HMAC state. |
| `META_OEMBED_TOKEN` | No | — | Meta App Access Token (`AppID\|AppSecret`) for Instagram Graph oEmbed previews. |
| `JINA_API_KEY` | No | — | Optional Jina Reader Bearer token raising rate limits for `r.jina.ai` markdown fallback. |
| `AI_PROVIDER` | No | `auto` | Server AI routing strategy (`auto` \| `gemini` \| `ollama` \| `deterministic`). |
| `OLLAMA_BASE_URL` | No | — | Local Ollama server endpoint (e.g. `http://ollama:11434`) for offline self-hosted AI. |
| `OLLAMA_MODEL` | No | `llama3.1:8b` | Default local Ollama model tag. |
| `OPENAI_API_KEY` | No | — | Optional server-side BYOK OpenAI credential. |
| `ANTHROPIC_API_KEY` | No | — | Optional server-side BYOK Anthropic credential. |
| `CACHE_TTL_HOURS` | No | `24` | Shared memory + `.cache/urlmind/` disk LRU cache retention in hours. |
| `URLMIND_CAMPAIGN_*` | No | — | Redirect destinations for `/out/[campaign]` (`COFFEE`, `AGENTS`, `SUPERINTELLIGENCE`, `STUDY`, `SPONSOR`). |

---

## License

MIT © 2026 [1nsharma](./LICENSE)


---

## 💼 Sponsorship, Support & Founder

Maintained by **Amit Sharma (@1nsharma)** from Kanpur, India.

- **Founder Email:** [amitsharma99976@gmail.com](mailto:amitsharma99976@gmail.com)
- **Direct UPI & Bank Transfer:** 393741171@upi\ • PhonePe / Google Pay / Paytm: 393741171- **GitHub Profile:** [github.com/1nsharma](https://github.com/1nsharma)
- **Organization Hub:** [github.com/1nsharma-labs](https://github.com/1nsharma-labs)
- **Support & Bounties:** [polar.sh/1nsharma-labs](https://polar.sh/1nsharma-labs) • [GitHub Sponsors](https://github.com/sponsors/1nsharma)
