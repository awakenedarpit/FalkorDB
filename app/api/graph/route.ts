import { NextRequest, NextResponse } from "next/server";
import { FalkorDB } from "falkordb";

interface GraphRow {
  sourceId?: string | number;
  sourceType?: string;
  targetId?: string | number;
  targetType?: string;
  content?: string;
  relType?: string;
}

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    const graphName = process.env.FALKORDB_GRAPH_NAME || "memory_agent";
    const url = process.env.FALKORDB_URL;
    const host = process.env.FALKORDB_HOST || "localhost";
    const port = parseInt(process.env.FALKORDB_PORT || "6379", 10);
    const password = process.env.FALKORDB_PASSWORD || undefined;

    let client;
    if (url) {
      client = await FalkorDB.connect({ url });
    } else {
      client = await FalkorDB.connect({
        socket: { host, port },
        ...(password ? { password } : {}),
      });
    }
    const graph = client.selectGraph(graphName);

    const query = userId
      ? `
        MATCH (u:User { id: $userId })-[r:HAS_MEMORY]->(m:Memory)
        RETURN u.id AS sourceId, labels(u)[0] AS sourceType,
               m.id AS targetId, labels(m)[0] AS targetType,
               m.content AS content, type(r) AS relType
      `
      : `
        MATCH (u:User)-[r:HAS_MEMORY]->(m:Memory)
        RETURN u.id AS sourceId, labels(u)[0] AS sourceType,
               m.id AS targetId, labels(m)[0] AS targetType,
               m.content AS content, type(r) AS relType
      `;

    const result = await graph.query(query, {
      params: { userId: userId || "" },
    });

    const nodesMap = new Map<string, GraphNode>();
    const links: GraphLink[] = [];

    if (result && Array.isArray(result.data)) {
      for (const row of result.data as GraphRow[]) {
        const {
          sourceId,
          sourceType,
          targetId,
          targetType,
          content,
          relType,
        } = row;

        if (sourceId && !nodesMap.has(String(sourceId))) {
          nodesMap.set(String(sourceId), {
            id: String(sourceId),
            label: `User (${sourceId})`,
            type: sourceType || "User",
          });
        }

        if (targetId && !nodesMap.has(String(targetId))) {
          nodesMap.set(String(targetId), {
            id: String(targetId),
            label: content
              ? content.length > 35
                ? `${content.substring(0, 32)}...`
                : content
              : `Memory (${targetId})`,
            type: targetType || "Memory",
          });
        }

        if (sourceId && targetId) {
          links.push({
            source: String(sourceId),
            target: String(targetId),
            label: relType || "HAS_MEMORY",
          });
        }
      }
    }

    return NextResponse.json({
      nodes: Array.from(nodesMap.values()),
      links,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("[API/GRAPH] FalkorDB query failed:", errorMessage);
    return NextResponse.json(
      { error: "Failed to retrieve graph data" },
      { status: 500 }
    );
  }
}
