import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { FalkorDB } from "falkordb";
import {
  dedupeExtractedEntities,
  dedupeRelationships,
  resolveEntityIdentity,
} from "@/lib/identity";
import type { EntityType, KnownEntity } from "@/lib/identity";

const allowedTypes = new Set<EntityType>([
  "Person", "Project", "Team", "Skill", "Organization", "Preference", "Place", "Other",
]);
const allowedRelations = new Set([
  "BUILDS", "MEMBER_OF", "TEAMMATE_OF", "KNOWS", "WORKS_ON", "LIKES", "USES", "RELATED_TO",
  "HANDLES", "LEADS", "CREATED", "PART_OF", "STUDIES", "LOCATED_IN", "HAS_SKILL", "COLLABORATES_WITH",
]);

type ExtractedRelationInput = { from?: unknown; relation?: unknown; to?: unknown };

type EntityReference = { key: string; name: string; type: EntityType };

function relationType(value: string): string {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 40);
  return allowedRelations.has(normalized) ? normalized : "RELATED_TO";
}

function addReference(map: Map<string, EntityReference[]>, name: string, reference: EntityReference) {
  const key = name.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (!key) return;
  const current = map.get(key) || [];
  if (!current.some((item) => item.key === reference.key)) map.set(key, [...current, reference]);
}

function referenceFor(map: Map<string, EntityReference[]>, name: string): EntityReference | undefined {
  const key = name.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const matches = map.get(key) || [];
  return matches.length === 1 ? matches[0] : undefined;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  const host = process.env.FALKORDB_HOST;
  const port = Number(process.env.FALKORDB_PORT);
  const username = process.env.FALKORDB_USERNAME;
  const password = process.env.FALKORDB_PASSWORD;
  const graphName = process.env.FALKORDB_GRAPH_NAME || "memory_agent";
  const userId = "default";

  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY is missing from .env.local." }, { status: 500 });
  if (!host || !port || !username || !password) return NextResponse.json({ error: "FalkorDB configuration is missing from .env.local." }, { status: 500 });

  let db: Awaited<ReturnType<typeof FalkorDB.connect>> | undefined;
  try {
    const body = await request.json();
    if (typeof body.message !== "string" || !body.message.trim()) return NextResponse.json({ error: "Please enter a message." }, { status: 400 });
    const message = body.message.trim();

    db = await FalkorDB.connect({ username, password, socket: { host, port, tls: false, connectTimeout: 10000 } });
    const graph = db.selectGraph(graphName);
    const previousResult = await graph.query(
      "MATCH (m:Memory) WHERE m.userId = $userId RETURN m.content AS content ORDER BY m.createdAt DESC LIMIT 10",
      { params: { userId } },
    );
    const previousMemories = (Array.isArray(previousResult.data) ? previousResult.data : [])
      .map((row: unknown) => row && typeof row === "object" && typeof (row as { content?: unknown }).content === "string" ? (row as { content: string }).content : "")
      .filter(Boolean)
      .reverse();

    await graph.query(
      "CREATE (:Memory {userId: $userId, content: $content, createdAt: $createdAt})",
      { params: { userId, content: message, createdAt: Date.now() } },
    );

    const ai = new GoogleGenAI({ apiKey });
    let processedEntities: EntityReference[] = [];
    let processedRelations: Array<{ from: string; relation: string; to: string }> = [];

    try {
      const knownResult = await graph.query(
        "MATCH (e:Entity) RETURN e.key AS key, e.name AS name, e.type AS type, e.aliases AS aliases LIMIT 500",
      );
      const knownEntities: KnownEntity[] = (Array.isArray(knownResult.data) ? knownResult.data : [])
        .map((row: unknown): KnownEntity | null => {
          if (!row || typeof row !== "object") return null;
          const item = row as { key?: unknown; name?: unknown; type?: unknown; aliases?: unknown };
          if (typeof item.key !== "string" || typeof item.name !== "string" || typeof item.type !== "string" || !allowedTypes.has(item.type as EntityType)) return null;
          const aliases = Array.isArray(item.aliases) ? item.aliases.filter((alias): alias is string => typeof alias === "string") : [];
          return { key: item.key, name: item.name, type: item.type as EntityType, aliases };
        })
        .filter((item): item is KnownEntity => item !== null);
      const knownEntityContext = knownEntities.length
        ? knownEntities.map((entity) => `- ${entity.type}: ${entity.name}${entity.aliases?.length ? ` (aliases: ${entity.aliases.join(", ")})` : ""}`).join("\n")
        : "No known entities yet.";

      const extraction = await ai.models.generateContent({
        model: "gemini-flash-lite-latest",
        contents: [
          "Extract knowledge from the user message as JSON only.",
          'Schema: {"entities":[{"name":"string","type":"Person|Project|Team|Skill|Organization|Preference|Place|Other","aliases":["string"]}],"relationships":[{"from":"entity name","relation":"UPPER_SNAKE_CASE","to":"entity name"}]}.',
          "Create separate Person entities for every named person, including introduced teammates. Include only explicit or strongly implied facts. Never invent details. Add aliases only when the message explicitly identifies a nickname or short form for the same entity.",
          "Identity rules: reuse a known entity only for an exact name, declared alias, or a unique short Person name. If multiple known people match a short name, do not guess and do not attach relationships or personal facts to that ambiguous name.",
          "Known entities already in the graph:", knownEntityContext, "Message:", message,
        ].join("\n"),
      });
      const raw = (extraction.text || "").replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      const parsed = JSON.parse(raw) as { entities?: Array<{ name?: unknown; type?: unknown; aliases?: unknown }>; relationships?: ExtractedRelationInput[] };
      const extracted = dedupeExtractedEntities((Array.isArray(parsed.entities) ? parsed.entities : [])
        .filter((entity): entity is { name: string; type: EntityType; aliases?: string[] } => typeof entity.name === "string" && Boolean(entity.name.trim()) && typeof entity.type === "string" && allowedTypes.has(entity.type as EntityType))
        .map((entity) => ({ name: entity.name.trim().slice(0, 120), type: entity.type, aliases: Array.isArray(entity.aliases) ? entity.aliases.filter((alias): alias is string => typeof alias === "string").map((alias) => alias.trim().slice(0, 80)).filter(Boolean).slice(0, 10) : [] })));

      const entitiesByKey = new Map<string, EntityReference>();
      const skippedAmbiguous = new Set<string>();
      for (const entity of extracted) {
        const match = resolveEntityIdentity(entity.name, entity.type, knownEntities);
        if (match.status === "ambiguous") {
          skippedAmbiguous.add(entity.name);
          continue;
        }
        const reference: EntityReference = match.status === "new"
          ? { key: match.key, name: entity.name, type: entity.type }
          : { key: match.entity.key, name: match.entity.name, type: match.entity.type };
        const existing = entitiesByKey.get(reference.key);
        entitiesByKey.set(reference.key, existing || reference);
      }
      processedEntities = Array.from(entitiesByKey.values());

      const references = new Map<string, EntityReference[]>();
      for (const entity of knownEntities) {
        const reference = { key: entity.key, name: entity.name, type: entity.type };
        addReference(references, entity.name, reference);
        for (const alias of entity.aliases || []) addReference(references, alias, reference);
      }
      for (const entity of extracted) {
        const match = resolveEntityIdentity(entity.name, entity.type, knownEntities);
        if (match.status === "ambiguous" || skippedAmbiguous.has(entity.name)) continue;
        const reference = entitiesByKey.get(match.status === "new" ? match.key : match.entity.key);
        if (!reference) continue;
        addReference(references, entity.name, reference);
        for (const alias of entity.aliases || []) addReference(references, alias, reference);
        addReference(references, reference.name, reference);
      }

      const relationInputs = dedupeRelationships((Array.isArray(parsed.relationships) ? parsed.relationships : [])
        .filter((relation): relation is { from: string; relation: string; to: string } => typeof relation.from === "string" && typeof relation.to === "string" && typeof relation.relation === "string")
        .map((relation) => ({ from: relation.from.trim(), relation: relationType(relation.relation), to: relation.to.trim() })));
      const relationshipKeys = new Set<string>();
      processedRelations = relationInputs.flatMap((relation) => {
        const from = referenceFor(references, relation.from);
        const to = referenceFor(references, relation.to);
        if (!from || !to) return [];
        const key = `${from.key}|${relation.relation}|${to.key}`;
        if (relationshipKeys.has(key)) return [];
        relationshipKeys.add(key);
        return [{ from: from.key, relation: relation.relation, to: to.key }];
      });

      for (const entity of processedEntities) {
        const input = extracted.find((candidate) => {
          const match = resolveEntityIdentity(candidate.name, candidate.type, knownEntities);
          return match.status !== "ambiguous" && (match.status === "new" ? match.key : match.entity.key) === entity.key;
        });
        const known = knownEntities.find((candidate) => candidate.key === entity.key);
        const aliases = Array.from(new Set([...(known?.aliases || []), ...(input?.aliases || [])].filter((alias) => alias.toLocaleLowerCase() !== entity.name.toLocaleLowerCase())));
        const entityLabel = entity.type;
        await graph.query(
          `MERGE (e:Entity {key: $key}) SET e.name = $name, e.type = $type, e.aliases = $aliases, e.updatedAt = timestamp() SET e:${entityLabel}`,
          { params: { key: entity.key, name: entity.name, type: entity.type, aliases } },
        );
      }
      for (const relation of processedRelations) {
        await graph.query(
          `MATCH (a:Entity {key: $fromKey}), (b:Entity {key: $toKey}) MERGE (a)-[r:${relation.relation}]->(b) SET r.updatedAt = timestamp()`,
          { params: { fromKey: relation.from, toKey: relation.to } },
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
      "", "Previously saved memories (oldest first):",
      previousMemories.length ? previousMemories.map((item, index) => `${index + 1}. ${item}`).join("\n") : "No previous memories have been saved yet.",
      "", "Current user message:", message,
    ].join("\n");
    let result;
    try {
      result = await ai.models.generateContent({ model: "gemini-3.5-flash", contents: prompt });
    } catch (error) {
      console.error("Primary Gemini model failed:", error);
      result = await ai.models.generateContent({ model: "gemini-flash-lite-latest", contents: prompt });
    }
    return NextResponse.json({ reply: result.text || "I couldn't generate a response. Please try again.", memoriesUsed: previousMemories.length, memorySaved: true, entitiesCreated: processedEntities.length, relationshipsCreated: processedRelations.length });
  } catch (error) {
    console.error("Graph Memory chat failed:", error);
    return NextResponse.json({ error: "The chat request failed. Check the VS Code terminal for details." }, { status: 500 });
  } finally {
    if (db) {
      try { await db.close(); } catch (closeError) { console.error("FalkorDB close failed:", closeError); }
    }
  }
}
