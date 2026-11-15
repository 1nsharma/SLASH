'use client';

import { useRef, useState } from 'react';
import Markdown from 'react-markdown';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { transitionProposalStatus } from '@/lib/copilot';
import type {
  ChatMessage,
  CopilotActionProposal,
  RepoIntelligenceReport,
  UnifiedGraphProject,
  UrlIntelligenceReport,
} from '@/lib/types';

interface AskUrlChatProps {
  report?: UrlIntelligenceReport;
  repoReport?: RepoIntelligenceReport;
  unifiedProject?: UnifiedGraphProject;
  initialPrompt?: string | null;
  onApproveProposal?: (proposal: CopilotActionProposal) => Promise<void> | void;
}

export default function AskUrlChat({
  report,
  repoReport,
  unifiedProject,
  initialPrompt,
  onApproveProposal,
}: AskUrlChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(initialPrompt ?? '');
  const [isSending, setIsSending] = useState(false);
  const [executingProposalId, setExecutingProposalId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const idCounterRef = useRef(0);

  const activeLabel = unifiedProject
    ? unifiedProject.title
    : repoReport
      ? repoReport.fullName
      : report?.domain || 'Target';

  const nodeCount = unifiedProject
    ? unifiedProject.nodes.length
    : repoReport
      ? repoReport.nodes.length
      : report?.nodes.length || 0;

  const suggestedQuestions = unifiedProject
    ? Array.from(
        new Set([
          'Detect missing Business OS blocks (Auth, Payments, Memory, Automation) and propose fixes',
          'Connect Frontend to AI Brain and propose Stripe billing integration',
          ...unifiedProject.suggestedQuestions,
        ]),
      )
    : repoReport
      ? repoReport.suggestedQuestions
      : report?.suggestedQuestions || [];

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || isSending) return;

    idCounterRef.current += 1;
    const userMsg: ChatMessage = {
      id: `u-${idCounterRef.current}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setError(null);
    setIsSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report,
          repoReport,
          unifiedProject,
          messages,
          question: trimmed,
          includeProposals: true,
        }),
      });
      const data = (await res.json()) as {
        answer?: string;
        proposedActions?: CopilotActionProposal[];
        error?: string;
      };
      if (!res.ok || !data.answer) {
        throw new Error(data.error || 'Unable to answer right now.');
      }

      idCounterRef.current += 1;
      const assistantMsg: ChatMessage = {
        id: `a-${idCounterRef.current}`,
        role: 'assistant',
        content: data.answer,
        timestamp: new Date().toISOString(),
        proposedActions: data.proposedActions,
      };
      setMessages([...nextHistory, assistantMsg]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to reach the analysis assistant.',
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleProposalAction = async (
    messageId: string,
    proposal: CopilotActionProposal,
    decision: 'approved' | 'dismissed',
  ) => {
    if (proposal.status !== 'pending') return;

    if (decision === 'approved' && onApproveProposal) {
      setExecutingProposalId(proposal.id);
      setError(null);
      try {
        await onApproveProposal(proposal);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not execute approved action.',
        );
        setExecutingProposalId(null);
        return;
      }
      setExecutingProposalId(null);
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.proposedActions
          ? {
              ...m,
              proposedActions: transitionProposalStatus(
                m.proposedActions,
                proposal.id,
                decision,
              ),
            }
          : m,
      ),
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col min-h-[380px]">
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare
            className="w-4 h-4 text-blue-600 dark:text-blue-400"
            aria-hidden="true"
          />
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            SLASH AI Copilot
          </h2>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate max-w-md">
          Grounded in {activeLabel} ({nodeCount} nodes)
        </span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 p-5 space-y-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="py-3 max-w-xl mx-auto text-center space-y-3">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Interrogate extracted architecture, dependencies, routes, and
              relationships for <span className="font-mono">{activeLabel}</span>.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Answers cite observed evidence and flag inferences. Proposed
              integrations always require your explicit approval before running.
            </p>

            <div className="pt-2 flex flex-col gap-2 text-left">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void sendQuestion(q)}
                  className="px-4 py-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-lg transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              <div
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-2xl rounded-xl px-4 py-3 text-sm ${
                    msg.role === 'user'
                      ? 'bg-slate-900 dark:bg-blue-600 text-white'
                      : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>

              {msg.proposedActions && msg.proposedActions.length > 0 && (
                <div className="max-w-2xl space-y-2 pl-1">
                  {msg.proposedActions.map((proposal) => {
                    const isPending = proposal.status === 'pending';
                    const isApproved = proposal.status === 'approved';
                    const isBusy = executingProposalId === proposal.id;
                    return (
                      <div
                        key={proposal.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3.5 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <ShieldCheck
                              className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0"
                              aria-hidden="true"
                            />
                            <span className="text-xs font-semibold text-slate-900 dark:text-white">
                              {proposal.title}
                            </span>
                          </div>
                          <span
                            className={`text-[11px] font-medium ${
                              proposal.confidence === 'detected'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {proposal.confidence === 'detected'
                              ? 'Detected clue'
                              : 'Inferred proposal'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {proposal.description}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 break-words">
                          Target: {proposal.target} · Evidence: {proposal.evidence}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          {isPending ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void handleProposalAction(
                                    msg.id,
                                    proposal,
                                    'approved',
                                  )
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg cursor-pointer"
                              >
                                {isBusy ? (
                                  <Loader2
                                    className="w-3.5 h-3.5 animate-spin"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <CheckCircle2
                                    className="w-3.5 h-3.5"
                                    aria-hidden="true"
                                  />
                                )}
                                <span>Approve &amp; Execute</span>
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void handleProposalAction(
                                    msg.id,
                                    proposal,
                                    'dismissed',
                                  )
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Dismiss</span>
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                                isApproved
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {isApproved ? 'Approved & Executed' : 'Dismissed'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}

        {isSending && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            <span>Synthesizing grounded answer...</span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-3 py-2 rounded-lg"
          >
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendQuestion(input);
        }}
        className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center gap-2"
      >
        <label htmlFor="ask-url-input" className="sr-only">
          Ask a question
        </label>
        <input
          id="ask-url-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask SLASH Copilot about ${activeLabel}...`}
          disabled={isSending}
          className="flex-1 px-3.5 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Ask</span>
        </button>
      </form>
    </div>
  );
}
