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
  source: string;
  target: string;
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
  const containerRef = useRef<HTMLDivElement>(null);
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
        if (!res.ok) {
          throw new Error(`Graph API returned status ${res.status}`);
        }
        const json = await res.json();
        setData({
          nodes: json.nodes || [],
          links: json.links || [],
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load graph data');
      } finally {
        setLoading(false);
      }
    }

    loadGraphData();
  }, []);

  return (
    <div className="flex flex-col w-full h-screen bg-slate-950 text-slate-100">
      <header className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <div>
          <h1 className="text-xl font-bold">Memory Knowledge Graph</h1>
          <p className="text-xs text-slate-400">User to Memory Relationships</p>
        </div>
        <div className="text-sm text-slate-400">
          Nodes: <span className="text-sky-400 font-semibold">{data.nodes.length}</span> | Links:{' '}
          <span className="text-purple-400 font-semibold">{data.links.length}</span>
        </div>
      </header>

      <main ref={containerRef} className="relative flex-1 w-full h-full overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-20">
            <span className="text-slate-200 animate-pulse text-sm font-medium">
              Loading graph data...
            </span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="bg-red-950/90 border border-red-700 px-5 py-4 rounded-lg text-red-200 max-w-md text-center">
              <p className="font-semibold mb-1">Failed to Load Graph</p>
              <p className="text-xs text-red-300">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && data.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <p className="text-slate-400 text-sm">No memory nodes or relationships found.</p>
          </div>
        )}

        <ForceGraph2D
          width={dimensions.width}
          height={dimensions.height}
          graphData={data}
          nodeId="id"
          nodeLabel="label"
          nodeColor={(node: GraphNode) => (node.type === 'User' ? '#38bdf8' : '#c084fc')}
          nodeRelSize={6}
          linkColor={() => '#64748b'}
          linkWidth={2}
          linkDirectionalArrowLength={5}
          linkDirectionalArrowRelPos={1}
          linkDirectionalArrowColor={() => '#94a3b8'}
          linkCurvature={0.08}
        />
      </main>
    </div>
  );
}