'use client';

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CreditCard,
  Database,
  Layout,
  Plus,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import {
  findVerifiedBusinessBlock,
  VERIFIED_BUSINESS_BLOCKS,
} from '@/lib/business/blocks';
import {
  BUSINESS_ZONE_META,
  classifySourceBusinessZone,
  detectMissingBusinessGaps,
  groupNodesByBusinessZone,
} from '@/lib/business/zones';
import type { BusinessZone, UnifiedGraphProject } from '@/lib/types';

interface BusinessGridPanelProps {
  project: UnifiedGraphProject;
  onAddBusinessBlock: (blockId: string) => Promise<void> | void;
  isBusy?: boolean;
  compact?: boolean;
}

const ZONE_ORDER: BusinessZone[] = ['frontend', 'brain', 'data', 'operations'];

const ZONE_ICONS: Record<BusinessZone, typeof Layout> = {
  frontend: Layout,
  brain: Bot,
  data: Database,
  operations: ShieldCheck,
};

export default function BusinessGridPanel({
  project,
  onAddBusinessBlock,
  isBusy = false,
  compact = false,
}: BusinessGridPanelProps) {
  const gaps = detectMissingBusinessGaps(project);
  const groupedNodes = groupNodesByBusinessZone(project.nodes);
  const attachedBlockIds = new Set(
    (project.connectorArtifacts ?? [])
      .filter((c) => c.connectorId.startsWith('block:'))
      .map((c) => c.connectorId.replace('block:', '')),
  );

  return (
    <section
      aria-label="Business OS Zones and Auto-Bridging"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
            Business OS Grid &amp; Auto-Bridging
          </p>
          <h2 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            4-Zone Architecture &amp; Missing Block Detector
          </h2>
        </div>
        <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
          {ZONE_ORDER.filter((z) => groupedNodes[z].length > 0).length}/4 active zones ·{' '}
          {gaps.length} gap(s)
        </span>
      </div>

      {/* 4 Business Zones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ZONE_ORDER.map((zoneId) => {
          const meta = BUSINESS_ZONE_META[zoneId];
          const Icon = ZONE_ICONS[zoneId];
          const zoneNodes = groupedNodes[zoneId];
          const zoneSources = project.sources.filter(
            (s) => (s.businessZone ?? classifySourceBusinessZone(s)) === zoneId,
          );

          return (
            <div
              key={zoneId}
              data-testid={`business-zone-${zoneId}`}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon
                    className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {meta.order}
                  </span>
                  <h3 className="font-display text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {meta.shortLabel}
                  </h3>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                  {zoneNodes.length} {zoneNodes.length === 1 ? 'node' : 'nodes'}
                </span>
              </div>

              {!compact && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  {meta.role}
                </p>
              )}

              {zoneSources.length > 0 || zoneNodes.length > 0 ? (
                <ul className="space-y-1 pt-1 border-t border-slate-200/70 dark:border-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300">
                  {zoneSources.map((src) => (
                    <li key={src.id} className="truncate">
                      + {src.label}
                    </li>
                  ))}
                  {zoneSources.length === 0 &&
                    zoneNodes.slice(0, 3).map((n) => (
                      <li key={n.id} className="truncate text-slate-600 dark:text-slate-400">
                        · {n.label}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="pt-1 border-t border-slate-200/70 dark:border-slate-800 text-[11px] text-amber-700 dark:text-amber-400">
                  No dedicated module attached yet
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Auto-Bridging Missing Gaps */}
      <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
            {gaps.length > 0 ? (
              <AlertTriangle
                className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2
                className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
            )}
            <span>
              {gaps.length > 0
                ? `Auto-Bridging Detected ${gaps.length} Missing Business Link(s)`
                : 'All Core Business OS Capabilities Connected'}
            </span>
          </div>
        </div>

        {gaps.length > 0 && (
          <div
            className={
              compact
                ? 'space-y-2'
                : 'grid grid-cols-1 md:grid-cols-2 gap-2.5'
            }
          >
            {gaps.map((gap) => (
              <div
                key={gap.id}
                data-testid={`business-gap-${gap.missingCapability}`}
                className="p-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-2"
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                  <span className="text-amber-800 dark:text-amber-300 uppercase">
                    {gap.severity} · {BUSINESS_ZONE_META[gap.zone].shortLabel} Zone
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  {gap.title}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {gap.description}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {gap.recommendedBlockIds.map((blockId) => {
                    const tpl = findVerifiedBusinessBlock(blockId);
                    if (!tpl) return null;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        disabled={isBusy}
                        onClick={() => void onAddBusinessBlock(tpl.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md cursor-pointer"
                      >
                        <Plus className="w-3 h-3" aria-hidden="true" />
                        <span>Add {tpl.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Verified Business Blocks Marketplace */}
      {!compact && (
        <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Workflow
                className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"
                aria-hidden="true"
              />
              <span>Verified Business Blocks Marketplace</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              1-click modular adapters with zero hardcoded secrets
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {VERIFIED_BUSINESS_BLOCKS.map((block) => {
              const isAttached = attachedBlockIds.has(block.id);
              return (
                <div
                  key={block.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col justify-between gap-2.5"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span>
                        {block.vendor} · {BUSINESS_ZONE_META[block.zone].shortLabel}
                      </span>
                      <span>{block.licenseSpdx}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      {block.capability === 'payments' && (
                        <CreditCard
                          className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <span>{block.name}</span>
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {block.summary}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-800">
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                      {block.envVarsRequired[0]}
                    </span>
                    {isAttached ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Connected</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void onAddBusinessBlock(block.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:bg-white dark:hover:bg-slate-900 disabled:opacity-50 rounded-md cursor-pointer shrink-0"
                      >
                        <Plus className="w-3 h-3" aria-hidden="true" />
                        <span>Add Block</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
