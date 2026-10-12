export const DEFAULT_GRAPH_NAME = "memory_agent";
export const DEFAULT_USER_ID = "default";

export type GraphQueryParam = null | string | number | boolean | { [key: string]: GraphQueryParam } | GraphQueryParam[];
export type GraphQueryOptions = { params?: Record<string, GraphQueryParam> };
export type GraphQueryRunner = {
  query: (cypher: string, options?: GraphQueryOptions) => Promise<{ data?: unknown[] }>;
};

export type FalkorConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  graphName: string;
};

export type MemoryWrite = {
  memoryId: string;
  userId: string;
  content: string;
  createdAt: number;
  source: "chat" | "diagnostic";
};

export type EntityWrite = {
  key: string;
  name: string;
  type: string;
  aliases: string[];
  userId: string;
  updatedAt: number;
};

export type RelationshipWrite = {
  fromKey: string;
  toKey: string;
  relation: string;
  memoryId: string;
  userId: string;
  observedAt: number;
};

export function getFalkorConfig(
  env: Record<string, string | undefined>,
): FalkorConfig | null {
  const host = env.FALKORDB_HOST;
  const port = Number(env.FALKORDB_PORT);
  const username = env.FALKORDB_USERNAME;
  const password = env.FALKORDB_PASSWORD;
  if (!host || !Number.isFinite(port) || port <= 0 || !username || !password) return null;
  return {
    host,
    port,
    username,
    password,
    graphName: env.FALKORDB_GRAPH_NAME || DEFAULT_GRAPH_NAME,
  };
}

export function normalizeUserId(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_USER_ID;
  const normalized = value.trim();
  if (!normalized || normalized.length > 120 || !/^[\p{L}\p{N}._:-]+$/u.test(normalized)) return DEFAULT_USER_ID;
  return normalized;
}

export function scopeEntityKey(userId: string, key: string): string {
  return `${userId}::${key}`;
}

export async function readRecentMemories(graph: GraphQueryRunner, userId: string, limit = 10): Promise<string[]> {
  const result = await graph.query(
    "MATCH (m:Memory) WHERE m.userId = $userId RETURN m.content AS content ORDER BY m.createdAt DESC LIMIT $limit",
    { params: { userId, limit } },
  );
  return (Array.isArray(result.data) ? result.data : [])
    .map((row: unknown) => row && typeof row === "object" && typeof (row as { content?: unknown }).content === "string" ? (row as { content: string }).content : "")
    .filter(Boolean)
    .reverse();
}

export async function writeMemory(graph: GraphQueryRunner, memory: MemoryWrite): Promise<void> {
  await graph.query(
    `MERGE (u:User {id: $userId})
     CREATE (m:Memory {id: $memoryId, userId: $userId, content: $content, source: $source, createdAt: $createdAt, updatedAt: $createdAt})
     MERGE (u)-[:HAS_MEMORY]->(m)`,
    { params: memory },
  );
}

export async function writeEntity(graph: GraphQueryRunner, entity: EntityWrite): Promise<void> {
  await graph.query(
    `MERGE (e:Entity {key: $key})
     SET e.name = $name, e.type = $type, e.aliases = $aliases, e.ownerUserId = $userId, e.updatedAt = $updatedAt`,
    { params: entity },
  );
}

export async function linkMemoryToEntity(graph: GraphQueryRunner, memoryId: string, entityKey: string, userId: string, observedAt: number): Promise<void> {
  await graph.query(
    `MATCH (m:Memory {id: $memoryId, userId: $userId}), (e:Entity {key: $entityKey, ownerUserId: $userId})
     MERGE (m)-[r:MENTIONS]->(e)
     SET r.observedAt = $observedAt, r.sourceMemoryId = $memoryId, r.sourceUserId = $userId`,
    { params: { memoryId, entityKey, userId, observedAt } },
  );
}

export async function writeRelationship(graph: GraphQueryRunner, relationship: RelationshipWrite): Promise<void> {
  await graph.query(
    `MATCH (a:Entity {key: $fromKey, ownerUserId: $userId}), (b:Entity {key: $toKey, ownerUserId: $userId})
     MERGE (a)-[r:${relationship.relation}]->(b)
     SET r.updatedAt = $observedAt, r.sourceMemoryId = $memoryId, r.sourceUserId = $userId`,
    { params: relationship },
  );
}
