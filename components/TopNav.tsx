'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type AppSection =
  | 'analyzer'
  | 'unified'
  | 'compare'
  | 'saved'
  | 'pipeline';

export type UnifiedFocusTab = 'build' | 'launch';

interface TopNavProps {
  activeSection: AppSection;
  unifiedFocus: UnifiedFocusTab;
  onSelectStep: (step: 'connect' | 'build' | 'launch') => void;
  onNavigateTool: (section: 'compare' | 'saved' | 'pipeline') => void;
  hasActiveWork: boolean;
  onPrimaryAction: () => void;
}

export default function TopNav({
  activeSection,
  unifiedFocus,
  onSelectStep,
  onNavigateTool,
  hasActiveWork,
  onPrimaryAction,
}: TopNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMoreOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [moreOpen]);

  const isConnectActive = activeSection === 'analyzer';
  const isBuildActive =
    activeSection === 'unified' && unifiedFocus === 'build';
  const isLaunchActive =
    activeSection === 'unified' && unifiedFocus === 'launch';
  const isMoreActive =
    activeSection === 'compare' ||
    activeSection === 'saved' ||
    activeSection === 'pipeline';

  const steps: Array<{
    id: 'connect' | 'build' | 'launch';
    label: string;
    active: boolean;
  }> = [
    { id: 'connect', label: '1. Connect', active: isConnectActive },
    { id: 'build', label: '2. Build & Fix', active: isBuildActive },
    { id: 'launch', label: '3. Launch', active: isLaunchActive },
  ];

  const toolItems: Array<{
    id: 'compare' | 'saved' | 'pipeline';
    label: string;
    hint: string;
  }> = [
    { id: 'compare', label: 'Compare URLs', hint: 'Side-by-side architecture diff' },
    { id: 'saved', label: 'Saved Maps', hint: 'Local project history & presets' },
    { id: 'pipeline', label: 'Architecture & Docker', hint: 'Self-hosting & API docs' },
  ];

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm">
      <div className="max-w-[1440px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectStep('connect');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          SLASH
        </a>

        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7"
        >
          {steps.map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={() => onSelectStep(step.id)}
              aria-current={step.active ? 'page' : undefined}
              className={`relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded ${
                step.active
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {step.label}
              {step.active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600 dark:bg-blue-500"
                />
              )}
            </button>
          ))}

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((prev) => !prev)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              className={`relative py-4 inline-flex items-center gap-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded ${
                isMoreActive
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <span>More</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  moreOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
              {isMoreActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600 dark:bg-blue-500"
                />
              )}
            </button>

            {moreOpen && (
              <div
                role="menu"
                aria-label="Additional tools"
                className="absolute left-0 top-full mt-1 w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg p-1.5 z-40"
              >
                {toolItems.map((item) => {
                  const active = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false);
                        onNavigateTool(item.id);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                        active
                          ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                          : 'text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      <p className="text-xs font-semibold">{item.label}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.hint}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
          >
            {hasActiveWork ? 'New Project' : 'Try Demo Business'}
          </button>
        </div>
      </div>
    </header>
  );
}
