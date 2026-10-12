import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { FalkorDB } from "falkordb";

function escapeCypherString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

async function persistMemoryToGraph(userId: string, memoryId: string, content: string) {
  try {
    const host = process.env.FALKORDB_HOST || 'localhost';
    const port = parseInt(process.env.FALKORDB_PORT || '6379', 10);
    const password = process.env.FALKORDB_PASSWORD || undefined;
    const graphName = process.env.FALKORDB_GRAPH_NAME || 'memory_agent';

    const client = await FalkorDB.connect({
      socket: { host, port },
      password,
    });
    const graph = client.selectGraph(graphName);

    const query = `
      MERGE (u:User { id: $userId })
      MERGE (m:Memory { id: $memoryId })
      SET m.content = $content, m.createdAt = timestamp()
      MERGE (u)-[r:HAS_MEMORY]->(m)
      RETURN u, r, m
    `;

    await graph.query(query, {
      params: { userId, memoryId, content },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[MEMORY] Failed to persist memory to FalkorDB:', message);
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  const host = process.env.FALKORDB_HOST;
  const port = Number(process.env.FALKORDB_PORT);
  const username = process.env.FALKORDB_USERNAME;
  const password = process.env.FALKORDB_PASSWORD;

  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is missing from .env.local." },
      { status: 500 }
    );
  }

  if (!host || !port || !username || !password) {
    return NextResponse.json(
      { error: "FalkorDB configuration is missing from .env.local." },
      { status: 500 }
    );
  }

  let db: Awaited<ReturnType<typeof FalkorDB.connect>> | undefined;

  try {
    const body = await request.json();

    if (
      typeof body.message !== "string" ||
      !body.message.trim()
    ) {
      return NextResponse.json(
        { error: "Please enter a message." },
        { status: 400 }
      );
    }

    const message = body.message.trim();

    // Connect to FalkorDB.
    db = await FalkorDB.connect({
      username,
      password,
      socket: {
        host,
        port,
        tls: false,
        connectTimeout: 10000,
      },
    });

    const graph = db.selectGraph("memory_agent");

    // Retrieve memories saved before this message.
    const previousResult = await graph.query(
      "MATCH (m:Memory {userId: 'default'}) " +
      "RETURN m.content AS content " +
      "ORDER BY m.createdAt DESC LIMIT 10"
    );

    const previousMemories = (Array.isArray(previousResult.data) ? previousResult.data : [])
      .map((row: unknown) => {
        if (typeof row !== "object" || row === null) return "";

        const content = (row as { content?: unknown }).content;
        return typeof content === "string" ? content : "";
      })
      .filter(Boolean)
      .reverse();

    // Save the user's new message as a persistent graph memory.
    const safeMessage = escapeCypherString(message);
    const timestamp = Date.now();

    await graph.query(
      `CREATE (:Memory {userId: 'default', content: '${safeMessage}', createdAt: ${timestamp}})`
    );

    // Ask Gemini to use the retrieved memories when relevant.
    const ai = new GoogleGenAI({ apiKey });

    const prompt = [
      "You are a helpful Graph Memory Agent.",
      "Use the saved memories below when they are relevant to the user's message.",
      "Do not claim to remember information that is not present in the memories or current conversation.",
      "If the user asks what you remember, summarize the relevant saved memories.",
      "",
      "Previously saved memories (oldest first):",
      previousMemories.length
        ? previousMemories.map((item, index) => `${index + 1}. ${item}`).join("\n")
        : "No previous memories have been saved yet.",
      "",
      "Current user message:",
      message,
    ].join("\n");

    
let result;

try {
  result = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
  });
} catch (error) {
  console.error("Primary Gemini model failed:", error);

  result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
  });
}


    return NextResponse.json({
      reply:
        result.text ||
        "I couldn't generate a response. Please try again.",
      memoriesUsed: previousMemories.length,
      memorySaved: true,
    });
  } catch (error) {
    console.error("Graph Memory chat failed:", error);

    return NextResponse.json(
      {
        error:
          "The chat request failed. Check the VS Code terminal for details.",
      },
      { status: 500 }
    );
  } finally {
    if (db) {
      try {
        await db.close();
      } catch (closeError) {
        console.error("FalkorDB close failed:", closeError);
      }
    }
  }
}
