'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import {
  CheckCircle2,
  Filter,
  HelpCircle,
  MessageSquare,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  BUSINESS_ZONE_META,
  classifyNodeBusinessZone,
} from '@/lib/business/zones';
import {
  computeBusinessZoneSwimlanePositions,
  computeLayeredGraphPositions,
} from '@/lib/graphLayout';
import type {
  BusinessZone,
  EvidenceConfidence,
  IntelligenceEngineSource,
  IntelligenceNode,
  NodeLayer,
  UrlIntelligenceReport,
} from '@/lib/types';
import MermaidDiagram from './MermaidDiagram';

interface ArchitectureMapProps {
  report: UrlIntelligenceReport;
  onAskAboutNode: (node: IntelligenceNode) => void;
  onQuickAddZone?: (zone: BusinessZone) => void;
  isDark?: boolean;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

type CustomNodeData = {
  node: IntelligenceNode;
  isSelected: boolean;
};

type SwimlaneHeaderData = {
  zone: BusinessZone;
  order: string;
  title: string;
  count: number;
};

type EmptyZoneSlotData = {
  zone: BusinessZone;
  title: string;
  onAdd?: (zone: BusinessZone) => void;
};

const LAYER_LABELS: Record<NodeLayer | 'all', string> = {
  all: 'All Layers',
  entry: 'Entry',
  frontend: 'Frontend / UI',
  logic: 'Core Logic / API',
  data: 'Data / Assets',
  external: 'External',
};

function ArchitectureNodeCard({ data }: NodeProps<Node<CustomNodeData>>) {
  const { node, isSelected } = data;
  const isDetected = node.confidence === 'detected';

  return (
    <div
      className={`w-[224px] rounded-xl border bg-white dark:bg-slate-900 px-3 py-2.5 text-left transition-shadow ${
        isSelected
          ? 'border-blue-600 ring-2 ring-blue-600/20 shadow-md'
          : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 shadow-sm'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-slate-400 dark:!bg-slate-500 !border-0"
      />
      <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
        <span className="font-medium text-slate-500 dark:text-slate-400 truncate">
          {node.category}
        </span>
        <span
          className={`inline-flex items-center gap-1 font-medium shrink-0 ${
            isDetected
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-amber-700 dark:text-amber-400'
          }`}
        >
          {isDetected ? (
            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
          ) : (
            <HelpCircle className="w-3 h-3" aria-hidden="true" />
          )}
          <span>{isDetected ? 'Detected' : 'Inferred'}</span>
        </span>
      </div>
      <p className="font-display text-sm font-semibold text-slate-900 dark:text-white leading-snug line-clamp-2">
        {node.label}
      </p>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
        {node.description}
      </p>
      {(node.sourceLabel || node.businessZone) && (
        <p className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
          {node.sourceEngine === 'repo'
            ? 'Repo'
            : node.sourceEngine === 'connector'
              ? 'Block'
              : 'Web'}
          {node.sourceLabel ? ` · ${node.sourceLabel}` : ''}
        </p>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-blue-600 !border-0"
      />
    </div>
  );
}

function SwimlaneHeaderCard({ data }: NodeProps<Node<SwimlaneHeaderData>>) {
  return (
    <div className="w-[224px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 flex items-center justify-between gap-2 select-none">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400">
          {data.order}
        </span>
        <span className="font-display text-xs font-bold text-slate-900 dark:text-white truncate">
          {data.title}
        </span>
      </div>
      <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
        {data.count}
      </span>
    </div>
  );
}

function EmptyZoneSlotCard({ data }: NodeProps<Node<EmptyZoneSlotData>>) {
  return (
    <button
      type="button"
      onClick={() => data.onAdd?.(data.zone)}
      className="w-[224px] rounded-xl border-2 border-dashed border-blue-400/70 dark:border-blue-500/60 bg-blue-50/40 dark:bg-blue-950/25 hover:bg-blue-50 dark:hover:bg-blue-950/45 px-3.5 py-4 text-left transition-colors cursor-pointer shadow-sm"
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-300">
        <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Add {data.title}</span>
      </div>
      <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
        No module connected in this zone yet. Click to bridge a ready block.
      </p>
    </button>
  );
}

const nodeTypes = {
  architectureNode: ArchitectureNodeCard,
  swimlaneHeader: SwimlaneHeaderCard,
  emptyZoneSlot: EmptyZoneSlotCard,
};

export default function ArchitectureMap({
  report,
  onAskAboutNode,
  onQuickAddZone,
  isDark = false,
  onRegenerate,
  isRegenerating = false,
}: ArchitectureMapProps) {
  const [mapMode, setMapMode] = useState<'flow' | 'mermaid'>('flow');
  const [layoutMode, setLayoutMode] = useState<'swimlanes' | 'layers'>(
    'swimlanes',
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [zoneFilter, setZoneFilter] = useState<BusinessZone | 'all'>('all');
  const [layerFilter, setLayerFilter] = useState<NodeLayer | 'all'>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<
    EvidenceConfidence | 'all'
  >('all');
  const [engineFilter, setEngineFilter] = useState<
    IntelligenceEngineSource | 'all'
  >('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    report.nodes[0]?.id ?? null,
  );
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(event.target as globalThis.Node | null)
      ) {
        setFilterOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFilterOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [filterOpen]);

  const hasMultipleEngines = useMemo(() => {
    const engines = new Set(
      report.nodes.map((n) => n.sourceEngine).filter(Boolean),
    );
    return engines.size > 1;
  }, [report.nodes]);

  const activeFilterCount =
    (zoneFilter !== 'all' ? 1 : 0) +
    (layerFilter !== 'all' ? 1 : 0) +
    (confidenceFilter !== 'all' ? 1 : 0) +
    (engineFilter !== 'all' ? 1 : 0) +
    (searchTerm.trim() ? 1 : 0);

  const filteredNodes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return report.nodes.filter((node) => {
      const nodeZone = node.businessZone ?? classifyNodeBusinessZone(node);
      if (zoneFilter !== 'all' && nodeZone !== zoneFilter) return false;
      if (layerFilter !== 'all' && node.layer !== layerFilter) return false;
      if (confidenceFilter !== 'all' && node.confidence !== confidenceFilter)
        return false;
      if (engineFilter !== 'all' && node.sourceEngine !== engineFilter)
        return false;
      if (
        q &&
        !node.label.toLowerCase().includes(q) &&
        !node.category.toLowerCase().includes(q) &&
        !node.description.toLowerCase().includes(q) &&
        !(node.sourceLabel || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [
    report.nodes,
    zoneFilter,
    layerFilter,
    confidenceFilter,
    engineFilter,
    searchTerm,
  ]);

  const filteredNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes],
  );

  const filteredEdges = useMemo(
    () =>
      report.edges.filter(
        (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target),
      ),
    [report.edges, filteredNodeIds],
  );

  const flowNodes: Node<
    CustomNodeData | SwimlaneHeaderData | EmptyZoneSlotData
  >[] = useMemo(() => {
    if (layoutMode === 'layers') {
      const positioned = computeLayeredGraphPositions(
        filteredNodes,
        filteredEdges,
      );
      return positioned.map((pos) => ({
        id: pos.id,
        type: 'architectureNode',
        position: { x: pos.x, y: pos.y },
        data: {
          node: pos.node,
          isSelected: pos.id === selectedNodeId,
        },
      }));
    }

    const { positioned, columns, emptyZones } =
      computeBusinessZoneSwimlanePositions(filteredNodes, filteredEdges);

    const headerNodes: Node<SwimlaneHeaderData>[] = columns.map((col) => {
      const meta = BUSINESS_ZONE_META[col.zone];
      return {
        id: `lane-header-${col.zone}`,
        type: 'swimlaneHeader',
        position: { x: col.x, y: 20 },
        draggable: false,
        selectable: false,
        focusable: false,
        data: {
          zone: col.zone,
          order: meta.order,
          title:
            col.zone === 'operations' ? 'Auth & Payments' : meta.shortLabel,
          count: col.nodeCount,
        },
      };
    });

    const entityNodes: Node<CustomNodeData>[] = positioned.map((pos) => ({
      id: pos.id,
      type: 'architectureNode',
      position: { x: pos.x, y: pos.y },
      data: {
        node: pos.node,
        isSelected: pos.id === selectedNodeId,
      },
    }));

    const emptySlotNodes: Node<EmptyZoneSlotData>[] =
      activeFilterCount === 0
        ? emptyZones.map((zone) => {
            const col = columns.find((c) => c.zone === zone);
            const meta = BUSINESS_ZONE_META[zone];
            return {
              id: `lane-empty-${zone}`,
              type: 'emptyZoneSlot',
              position: { x: col?.x ?? 24, y: 92 },
              draggable: false,
              selectable: false,
              data: {
                zone,
                title:
                  zone === 'operations' ? 'Auth & Payments' : meta.shortLabel,
                onAdd: onQuickAddZone,
              },
            };
          })
        : [];

    return [...headerNodes, ...entityNodes, ...emptySlotNodes];
  }, [
    layoutMode,
    filteredNodes,
    filteredEdges,
    selectedNodeId,
    activeFilterCount,
    onQuickAddZone,
  ]);

  const flowEdges: Edge[] = useMemo(() => {
    return filteredEdges.map((edge) => {
      const isHighlighted =
        selectedNodeId &&
        (edge.source === selectedNodeId || edge.target === selectedNodeId);
      const isUnified = edge.sourceEngine === 'unified';
      const isInferred = edge.confidence === 'inferred';
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        animated: Boolean(isHighlighted || isUnified),
        style: {
          stroke: isHighlighted
            ? '#2563EB'
            : isUnified
              ? '#059669'
              : isInferred
                ? '#D97706'
                : '#64748B',
          strokeWidth: isHighlighted || isUnified ? 2.2 : 1.5,
          strokeDasharray: isInferred ? '5 4' : undefined,
        },
        labelStyle: {
          fontSize: 11,
          fontWeight: 500,
          fill: isHighlighted ? '#1D4ED8' : isUnified ? '#047857' : '#475569',
        },
        labelBgStyle: {
          fill: '#FFFFFF',
          fillOpacity: 0.9,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isHighlighted
            ? '#2563EB'
            : isUnified
              ? '#059669'
              : isInferred
                ? '#D97706'
                : '#64748B',
        },
      };
    });
  }, [filteredEdges, selectedNodeId]);

  const selectedNode = useMemo(
    () => report.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [report.nodes, selectedNodeId],
  );

  const connectedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return report.edges.filter(
      (e) => e.source === selectedNode.id || e.target === selectedNode.id,
    );
  }, [report.edges, selectedNode]);

  const detectedCount = report.nodes.filter(
    (n) => n.confidence === 'detected',
  ).length;
  const inferredCount = report.nodes.length - detectedCount;

  const resetAllFilters = () => {
    setZoneFilter('all');
    setLayerFilter('all');
    setConfidenceFilter('all');
    setEngineFilter('all');
    setSearchTerm('');
  };

  return (
    <div className="space-y-4">
      {/* Minimal 2-Control Toolbar + Single Filter Popover */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
        <div
          role="group"
          aria-label="Diagram view mode"
          className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg"
        >
          <button
            type="button"
            onClick={() => setMapMode('flow')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mapMode === 'flow'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Visual Grid
          </button>
          <button
            type="button"
            onClick={() => setMapMode('mermaid')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mapMode === 'mermaid'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Code / Mermaid
          </button>
        </div>

        {mapMode === 'flow' && (
          <div ref={filterPopoverRef} className="relative flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {filteredNodes.length} of {report.nodes.length} components
            </span>
            <button
              type="button"
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                activeFilterCount > 0 || filterOpen
                  ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Filter className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </span>
            </button>

            {filterOpen && (
              <div
                role="dialog"
                aria-label="Filter architecture map"
                className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg p-4 space-y-3 z-40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    Map Filters &amp; Layout
                  </p>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Reset all
                    </button>
                  )}
                </div>

                {/* Search */}
                <div className="relative">
                  <label htmlFor="map-node-search" className="sr-only">
                    Search map nodes
                  </label>
                  <Search
                    className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    id="map-node-search"
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search component name or zone..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {/* Layout Grouping */}
                <div>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Canvas Grouping
                  </p>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setLayoutMode('swimlanes')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                        layoutMode === 'swimlanes'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Business Zones
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayoutMode('layers')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                        layoutMode === 'layers'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Tech Layers
                    </button>
                  </div>
                </div>

                {/* Confidence */}
                <div>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Verification Level
                  </p>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {(
                      [
                        { id: 'all', label: `All (${report.nodes.length})` },
                        { id: 'detected', label: `Detected (${detectedCount})` },
                        { id: 'inferred', label: `Inferred (${inferredCount})` },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setConfidenceFilter(tab.id)}
                        className={`px-2 py-1 text-[11px] font-medium rounded-md cursor-pointer truncate ${
                          confidenceFilter === tab.id
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Zone + Layer + Engine selects */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="map-zone-select"
                      className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                    >
                      Business Zone
                    </label>
                    <select
                      id="map-zone-select"
                      value={zoneFilter}
                      onChange={(e) =>
                        setZoneFilter(e.target.value as BusinessZone | 'all')
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                    >
                      <option value="all">All 4 Zones</option>
                      <option value="frontend">01 · Frontend</option>
                      <option value="brain">02 · AI Brain</option>
                      <option value="data">03 · Database</option>
                      <option value="operations">04 · Auth &amp; Payments</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="map-layer-select"
                      className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                    >
                      Architecture Layer
                    </label>
                    <select
                      id="map-layer-select"
                      value={layerFilter}
                      onChange={(e) =>
                        setLayerFilter(e.target.value as NodeLayer | 'all')
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                    >
                      {Object.entries(LAYER_LABELS).map(([val, lbl]) => (
                        <option key={val} value={val}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {hasMultipleEngines && (
                  <div>
                    <label
                      htmlFor="map-engine-select"
                      className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                    >
                      Source Type
                    </label>
                    <select
                      id="map-engine-select"
                      value={engineFilter}
                      onChange={(e) =>
                        setEngineFilter(
                          e.target.value as IntelligenceEngineSource | 'all',
                        )
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                    >
                      <option value="all">All Sources</option>
                      <option value="urlmind">Website / Docs</option>
                      <option value="repo">GitHub Repository</option>
                      <option value="connector">Business Blocks &amp; Schemas</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {mapMode === 'mermaid' ? (
        <MermaidDiagram
          report={report}
          isDark={isDark}
          onRegenerate={onRegenerate}
          isRegenerating={isRegenerating}
        />
      ) : (
        /* Main Split: Business Zone Swimlanes Canvas + Node Inspector */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
          <div
            data-testid="architecture-map-canvas"
            data-node-count={filteredNodes.length}
            data-selected-node={selectedNode?.id ?? ''}
            className="xl:col-span-8 h-[560px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden relative"
          >
            {filteredNodes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  No components match your active filters.
                </p>
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="mt-3 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  Reset Map Filters
                </button>
              </div>
            ) : (
              <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                nodeTypes={nodeTypes}
                onNodeClick={(_, node) => {
                  if (node.type === 'architectureNode') {
                    setSelectedNodeId(node.id);
                  }
                }}
                fitView
                fitViewOptions={{ padding: 0.14 }}
                minZoom={0.45}
                maxZoom={1.6}
              >
                <Background gap={20} size={1} color="#CBD5E1" />
                <Controls showInteractive={false} />
                <MiniMap
                  pannable
                  zoomable
                  nodeStrokeWidth={2}
                  style={{ width: 120, height: 80 }}
                  className="!rounded-lg !border !border-slate-200 dark:!border-slate-800"
                />
              </ReactFlow>
            )}
          </div>

          {/* Node Inspector Panel */}
          <aside
            aria-label="Node inspector"
            className="xl:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  Component Details
                </h3>
                {selectedNode && (
                  <button
                    type="button"
                    aria-label="Clear selected node"
                    onClick={() => setSelectedNodeId(null)}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="mt-3">
                <label
                  htmlFor="inspector-node-select"
                  className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
                >
                  Select component
                </label>
                <select
                  id="inspector-node-select"
                  value={selectedNodeId ?? ''}
                  onChange={(e) => setSelectedNodeId(e.target.value || null)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Select a component...</option>
                  {report.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label} ({n.confidence})
                    </option>
                  ))}
                </select>
              </div>

              {selectedNode ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span>{LAYER_LABELS[selectedNode.layer]}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        {
                          BUSINESS_ZONE_META[
                            selectedNode.businessZone ??
                              classifyNodeBusinessZone(selectedNode)
                          ].shortLabel
                        }{' '}
                        Zone
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {selectedNode.confidence === 'detected'
                          ? 'Detected'
                          : 'Inferred'}
                      </span>
                    </div>
                    <h4 className="mt-1 font-display text-base font-semibold text-slate-900 dark:text-white">
                      {selectedNode.label}
                    </h4>
                    <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {selectedNode.description}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1.5">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Evidence
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-mono leading-relaxed break-words">
                      {selectedNode.evidence}
                    </p>
                    {selectedNode.urlOrPath && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-mono truncate">
                        Path: {selectedNode.urlOrPath}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Connections ({connectedEdges.length})
                    </p>
                    {connectedEdges.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No direct connections recorded for this component.
                      </p>
                    ) : (
                      <ul className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {connectedEdges.map((edge) => {
                          const isOutgoing = edge.source === selectedNode.id;
                          const otherId = isOutgoing ? edge.target : edge.source;
                          const otherNode = report.nodes.find(
                            (n) => n.id === otherId,
                          );
                          return (
                            <li key={edge.id}>
                              <button
                                type="button"
                                onClick={() => setSelectedNodeId(otherId)}
                                className="w-full text-left px-2.5 py-1.5 text-xs rounded-md border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                <span className="text-slate-500 dark:text-slate-400">
                                  {isOutgoing ? '→' : '←'} {edge.label}:{' '}
                                </span>
                                <span className="font-medium text-slate-900 dark:text-white">
                                  {otherNode?.label || otherId}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400 py-8">
                  Click any card on the visual grid or pick a component above to
                  inspect its evidence and links.
                </div>
              )}
            </div>

            {selectedNode && (
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onAskAboutNode(selectedNode)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 rounded-lg transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Ask AI about {selectedNode.label}</span>
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
