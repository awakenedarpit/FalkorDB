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
  let client: Awaited<ReturnType<typeof FalkorDB.connect>> | undefined;

  try {
    const { searchParams } = new URL(req.url);
    // Chat currently stores memories with userId "default". Use that
    // convention unless the caller explicitly asks for another user.
    const userId = searchParams.get("userId") || "default";

    const host = process.env.FALKORDB_HOST;
    const port = Number(process.env.FALKORDB_PORT);
    const username = process.env.FALKORDB_USERNAME;
    const password = process.env.FALKORDB_PASSWORD;
    const graphName = process.env.FALKORDB_GRAPH_NAME || "memory_agent";

    if (!host || !Number.isFinite(port) || port <= 0 || !username || !password) {
      return NextResponse.json(
        { error: "FalkorDB configuration is missing or invalid." },
        { status: 500 }
      );
    }

    client = await FalkorDB.connect({
      username,
      password,
      socket: {
        host,
        port,
        tls: false,
        connectTimeout: 10000,
      },
    });

    const graph = client.selectGraph(graphName);

    // Support both shapes used by this project:
    // 1) chat-created flat (:Memory { userId, content, createdAt }) nodes
    // 2) connected (:User)-[:HAS_MEMORY]->(:Memory) nodes.
    // The first query is the active chat schema, so create visual User -> Memory
    // links in the response without requiring database relationships to exist.
    const result = await graph.query(
      `
        MATCH (m:Memory)
        WHERE m.userId = $userId
        RETURN $userId AS sourceId, 'User' AS sourceType,
               toString(id(m)) AS targetId, labels(m)[0] AS targetType,
               m.content AS content, 'HAS_MEMORY' AS relType
        ORDER BY m.createdAt ASC
      `,
      { params: { userId } }
    );

    const nodesMap = new Map<string, GraphNode>();
    const links: GraphLink[] = [];

    if (result && Array.isArray(result.data)) {
      for (const row of result.data as GraphRow[]) {
        const { sourceId, sourceType, targetId, targetType, content, relType } = row;

        if (sourceId !== undefined && sourceId !== null && !nodesMap.has(String(sourceId))) {
          nodesMap.set(String(sourceId), {
            id: String(sourceId),
            label: `User (${sourceId})`,
            type: sourceType || "User",
          });
        }

        if (targetId !== undefined && targetId !== null && !nodesMap.has(String(targetId))) {
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

        if (sourceId !== undefined && sourceId !== null && targetId !== undefined && targetId !== null) {
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[API/GRAPH] FalkorDB query failed:", errorMessage);
    return NextResponse.json(
      { error: "Failed to retrieve graph data" },
      { status: 500 }
    );
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error("[API/GRAPH] FalkorDB close failed:", closeError);
      }
    }
  }
}
