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

    // Extract named people, projects, teams, skills and explicit relationships.
    // Raw memories are still saved even if structured extraction fails.
    let extractedEntities: Array<{ name: string; type: string }> = [];
    let extractedRelations: Array<{ from: string; relation: string; to: string }> = [];

    // Give extraction the existing graph vocabulary so short names and aliases
    // can resolve to an already-known person instead of creating duplicates.
    let knownEntities: Array<{ name: string; type: string }> = [];
    try {
      const knownResult = await graph.query(
        "MATCH (e:Entity) RETURN e.name AS name, e.type AS type LIMIT 300"
      );
      knownEntities = (Array.isArray(knownResult.data) ? knownResult.data : [])
        .map((row: unknown) => {
          if (!row || typeof row !== "object") return null;
          const item = row as { name?: unknown; type?: unknown };
          return typeof item.name === "string" && typeof item.type === "string"
            ? { name: item.name, type: item.type }
            : null;
        })
        .filter((item): item is { name: string; type: string } => item !== null);
    } catch (knownEntityError) {
      console.error("[GRAPH MEMORY] Could not load known entities:", knownEntityError);
    }

    try {
      const knownEntityContext = knownEntities.length
        ? knownEntities.map((entity) => `- ${entity.type}: ${entity.name}`).join("\n")
        : "No known entities yet.";
      const extraction = await ai.models.generateContent({
        model: "gemini-flash-lite-latest",
        contents: [
          "Extract knowledge from the user message as JSON only.",
          'Schema: {"entities":[{"name":"string","type":"Person|Project|Team|Skill|Organization|Preference|Place|Other"}],"relationships":[{"from":"entity name","relation":"UPPER_SNAKE_CASE","to":"entity name"}]}.',
          "Create separate Person entities for every named person, including introduced teammates. Include only facts explicit or strongly implied. Relationship endpoints must exactly match entity names. Never invent details. Return empty arrays if no facts.",
          "Identity resolution rules: when the user gives only a first name or nickname, reuse a known entity's full name if there is exactly one clear match. For example, if the known entities contain Person: Arpit Raj, then 'I'm Arpit' refers to Arpit Raj. Do not create a duplicate short-name person in that case. If multiple known people could match, do not guess; preserve the short name and avoid attaching uncertain personal facts.",
          "Known entities already in the graph:", knownEntityContext,
          "Message:", message,
        ].join("\n"),
      });
      const raw = (extraction.text || "").replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      const parsed = JSON.parse(raw) as {
        entities?: Array<{ name?: unknown; type?: unknown }>;
        relationships?: Array<{ from?: unknown; relation?: unknown; to?: unknown }>;
      };
      const allowedTypes = new Set(["Person", "Project", "Team", "Skill", "Organization", "Preference", "Place", "Other"]);
      extractedEntities = (Array.isArray(parsed.entities) ? parsed.entities : [])
        .filter((e) => typeof e.name === "string" && e.name.trim() && typeof e.type === "string")
        .map((e) => ({ name: (e.name as string).trim().slice(0, 120), type: allowedTypes.has(e.type as string) ? e.type as string : "Other" }))
        .slice(0, 30);

      // Deterministic fallback: resolve a short Person name to a unique existing
      // full name only when the first-name match is unambiguous.
      const normalizeName = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      const knownPeople = knownEntities.filter((entity) => entity.type === "Person");
      const resolveKnownPerson = (name: string, type: string) => {
        if (type !== "Person") return name;
        const normalized = normalizeName(name);
        const exact = knownPeople.find((person) => normalizeName(person.name) === normalized);
        if (exact) return exact.name;
        if (!normalized.includes(" ")) {
          const matches = knownPeople.filter((person) => normalizeName(person.name).split(" ")[0] === normalized);
          if (matches.length === 1) return matches[0].name;
        }
        return name;
      };
      extractedEntities = extractedEntities.map((entity) => ({
        ...entity,
        name: resolveKnownPerson(entity.name, entity.type),
      }));
      const canonical = (name: string) => extractedEntities.find((e) => e.name.toLowerCase() === name.toLowerCase())?.name
        || knownEntities.find((e) => e.name.toLowerCase() === name.toLowerCase())?.name
        || (() => {
          const normalized = normalizeName(name);
          if (!normalized.includes(" ")) {
            const matches = knownPeople.filter((person) => normalizeName(person.name).split(" ")[0] === normalized);
            if (matches.length === 1) return matches[0].name;
          }
          return undefined;
        })();
      extractedRelations = (Array.isArray(parsed.relationships) ? parsed.relationships : [])
        .filter((r) => typeof r.from === "string" && typeof r.to === "string" && typeof r.relation === "string" && canonical(r.from as string) && canonical(r.to as string))
        .map((r) => ({ from: canonical(r.from as string)!, to: canonical(r.to as string)!, relation: (r.relation as string).toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 40) || "RELATED_TO" }))
        .slice(0, 50);
      const keyFor = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 100);
      for (const entity of extractedEntities) {
        const entityLabel = new Set(["Person", "Project", "Team", "Skill", "Organization", "Preference", "Place", "Other"]).has(entity.type)
          ? entity.type
          : "Other";
        // Keep the common :Entity label for lookups, and add a domain label
        // (such as :Person or :Project) so FalkorDB's schema view is meaningful.
        await graph.query(
          `MERGE (e:Entity {key: $key}) SET e.name = $name, e.type = $type, e.updatedAt = timestamp() SET e:${entityLabel}`,
          { params: { key: keyFor(entity.name), name: entity.name, type: entity.type } }
        );
      }
      for (const relation of extractedRelations) {
        const safeRelationType = new Set([
          "BUILDS", "MEMBER_OF", "TEAMMATE_OF", "KNOWS", "WORKS_ON", "LIKES",
          "USES", "RELATED_TO", "HANDLES", "LEADS", "CREATED", "PART_OF",
          "STUDIES", "LOCATED_IN", "HAS_SKILL", "COLLABORATES_WITH"
        ]).has(relation.relation) ? relation.relation : "RELATED_TO";
        // Use an actual relationship type so FalkorDB can display the connection
        // as e.g. (:Person)-[:BUILDS]->(:Project), not a generic RELATION property.
        await graph.query(
          `MATCH (a:Entity {key: $fromKey}), (b:Entity {key: $toKey}) MERGE (a)-[r:${safeRelationType}]->(b) SET r.updatedAt = timestamp()`,
          { params: { fromKey: keyFor(relation.from), toKey: keyFor(relation.to) } }
        );
      }
    } catch (extractionError) {
      console.error("[GRAPH MEMORY] Structured extraction failed; raw memory is still saved:", extractionError);
    }


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
      entitiesCreated: extractedEntities.length,
      relationshipsCreated: extractedRelations.length,
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
