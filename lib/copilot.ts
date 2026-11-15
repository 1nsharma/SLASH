import type {
  BusinessZone,
  CopilotActionProposal,
  CopilotActionType,
} from './types';

export function normalizeCopilotProposals(
  rawProposals: Array<{
    id?: string;
    type?: string;
    title?: string;
    description?: string;
    target?: string;
    rationale?: string;
    confidence?: string;
    evidence?: string;
    sourceNodeId?: string;
    targetNodeId?: string;
    edgeLabel?: string;
    relationshipType?: string;
    blockId?: string;
    businessZone?: string;
  }> = [],
): CopilotActionProposal[] {
  const validTypes = new Set<CopilotActionType>([
    'analyze_and_link_url',
    'analyze_and_link_repo',
    'add_verified_edge',
    'add_business_block',
    'fill_business_gap',
    'export_blueprint',
  ]);

  const validRelTypes = new Set([
    'navigation',
    'dependency',
    'dataflow',
    'auth',
    'reference',
  ]);

  const validZones = new Set<BusinessZone>([
    'frontend',
    'brain',
    'data',
    'operations',
  ]);

  return rawProposals
    .filter((p) => p && p.title && p.target)
    .slice(0, 4)
    .map((p, idx) => {
      const safeType: CopilotActionType = validTypes.has(
        p.type as CopilotActionType,
      )
        ? (p.type as CopilotActionType)
        : 'export_blueprint';

      const hasEdgePayload = Boolean(p.sourceNodeId && p.targetNodeId);
      const hasBlockPayload = Boolean(p.blockId || p.businessZone);

      return {
        id: p.id || `proposal-${Date.now()}-${idx + 1}`,
        type: safeType,
        title: p.title!,
        description: p.description || p.rationale || '',
        target: p.target!,
        rationale:
          p.rationale || 'Suggested from analyzed intelligence evidence.',
        confidence: p.confidence === 'detected' ? 'detected' : 'inferred',
        evidence:
          p.evidence || 'Derived from inspected nodes and relationships.',
        // Always enforce explicit human approval before execution
        status: 'pending',
        payload:
          hasEdgePayload || hasBlockPayload
            ? {
                ...(hasEdgePayload
                  ? {
                      sourceNodeId: p.sourceNodeId,
                      targetNodeId: p.targetNodeId,
                      edgeLabel: p.edgeLabel || 'links to',
                      relationshipType: validRelTypes.has(
                        p.relationshipType || '',
                      )
                        ? (p.relationshipType as
                            | 'navigation'
                            | 'dependency'
                            | 'dataflow'
                            | 'auth'
                            | 'reference')
                        : 'reference',
                    }
                  : {}),
                ...(p.blockId ? { blockId: p.blockId } : {}),
                ...(p.businessZone &&
                validZones.has(p.businessZone as BusinessZone)
                  ? { businessZone: p.businessZone as BusinessZone }
                  : {}),
              }
            : undefined,
      };
    });
}

export function transitionProposalStatus(
  proposals: CopilotActionProposal[],
  proposalId: string,
  nextStatus: 'approved' | 'dismissed',
): CopilotActionProposal[] {
  return proposals.map((item) =>
    item.id === proposalId && item.status === 'pending'
      ? { ...item, status: nextStatus }
      : item,
  );
}
