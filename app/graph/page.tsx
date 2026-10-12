'use client';

import React, { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false }) as React.ComponentType<Record<string, unknown>>;

interface GraphNode {
  id: string;
  label: string;
  type: string;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  label: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export default function GraphPage() {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<{ zoomToFit?: (duration: number, padding?: number) => void } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    function updateDimensions() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 800,
          height: containerRef.current.clientHeight || 600,
        });
      }
    }
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    async function loadGraphData() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/graph');
        if (!res.ok) throw new Error(`Graph API returned status ${res.status}`);
        const json = await res.json();
        const nodes: GraphNode[] = Array.isArray(json.nodes) ? json.nodes : [];
        const nodeIds = new Set(nodes.map((node) => String(node.id)));
        const links: GraphLink[] = Array.isArray(json.links)
          ? json.links
              .filter((link: GraphLink) => nodeIds.has(String(link.source)) && nodeIds.has(String(link.target)))
              .map((link: GraphLink) => ({ ...link, source: String(link.source), target: String(link.target) }))
          : [];
        setData({ nodes, links });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load graph data');
      } finally {
        setLoading(false);
      }
    }
    loadGraphData();
  }, []);

  useEffect(() => {
    if (!loading && data.nodes.length) {
      const timer = window.setTimeout(() => graphRef.current?.zoomToFit?.(700, 140), 700);
      return () => window.clearTimeout(timer);
    }
  }, [loading, data]);

  return (
    <div className="flex flex-col w-full h-screen bg-[#111318] text-slate-100">
      <header className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-[#191c22]">
        <div>
          <h1 className="text-xl font-bold">Memory Knowledge Graph</h1>
          <p className="text-xs text-slate-400">User to Memory Relationships — click a node for details</p>
        </div>
        <div className="text-sm text-slate-300">
          Nodes: <span className="text-sky-300 font-semibold">{data.nodes.length}</span> | Links:{' '}
          <span className="text-amber-300 font-semibold">{data.links.length}</span>
        </div>
      </header>

      <main ref={containerRef} className="relative flex-1 w-full h-full overflow-hidden">
        {loading && <div className="absolute inset-0 flex items-center justify-center bg-[#111318]/80 z-20"><span className="text-slate-200 animate-pulse text-sm font-medium">Loading graph data...</span></div>}
        {error && <div className="absolute inset-0 flex items-center justify-center z-20"><div className="bg-red-950/90 border border-red-700 px-5 py-4 rounded-lg text-red-200 max-w-md text-center"><p className="font-semibold mb-1">Failed to Load Graph</p><p className="text-xs text-red-300">{error}</p></div></div>}
        {!loading && !error && data.nodes.length === 0 && <div className="absolute inset-0 flex items-center justify-center z-10"><p className="text-slate-400 text-sm">No memory nodes or relationships found.</p></div>}

        <ForceGraph2D
          ref={graphRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={data}
          nodeId="id"
          nodeLabel={(node: GraphNode) => `${node.type}: ${node.label}`}
          nodeColor={(node: GraphNode) => node.type === 'User' ? '#38bdf8' : node.type === 'MemoryTest' ? '#e879f9' : '#f59e0b'}
          nodeRelSize={4.5}
          nodeCanvasObjectMode={() => 'after'}
          nodeCanvasObject={(node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
            if (globalScale < 1.8) return;
            const label = node.label.length > 26 ? node.label.slice(0, 23) + '...' : node.label;
            const fontSize = Math.max(2.5, Math.min(8, 10 / globalScale));
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.fillText(label, node.x || 0, (node.y || 0) + 9 / globalScale);
          }}
          linkColor={() => 'rgba(125, 211, 252, 0.95)'}
          linkWidth={() => 1.6}
          linkVisibility={() => true}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          linkDirectionalArrowColor={() => '#f8fafc'}
          linkCurvature={0.08}
          onNodeClick={(node: GraphNode) => setSelectedNode(node)}
          cooldownTicks={100}
          enableNodeDrag
          d3AlphaDecay={0.025}
          d3VelocityDecay={0.3}
        />

        {selectedNode && (
          <aside className="absolute bottom-5 right-5 z-10 w-72 rounded-xl border border-slate-600 bg-[#191c22]/95 p-4 shadow-xl">
            <button className="float-right text-slate-400 hover:text-white" onClick={() => setSelectedNode(null)} aria-label="Close node details">×</button>
            <p className="text-xs uppercase tracking-wider text-slate-400">{selectedNode.type}</p>
            <p className="mt-2 break-words text-sm text-white">{selectedNode.label}</p>
            <p className="mt-3 text-xs text-slate-400">Node ID: {selectedNode.id}</p>
          </aside>
        )}
      </main>
    </div>
  );
}
