
import { NextResponse } from "next/server";
import { FalkorDB } from "falkordb";


export async function GET() {
  let db: Awaited<ReturnType<typeof FalkorDB.connect>> | undefined;

  try {
    const host = process.env.FALKORDB_HOST;
    const port = Number(process.env.FALKORDB_PORT);
    const username = process.env.FALKORDB_USERNAME;
    const password = process.env.FALKORDB_PASSWORD;

    if (!host || !port || !username || !password) {
      return NextResponse.json(
        { error: "FalkorDB environment variables are missing." },
        { status: 500 }
      );
    }

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

    await graph.query(
      "CREATE (:MemoryTest {id: 'connection-test', message: 'Graph write and read works'})"
    );

    const result = await graph.query(
      "MATCH (m:MemoryTest {id: 'connection-test'}) RETURN m.message AS message"
    );

    return NextResponse.json({
      success: true,
      message: "FalkorDB graph write and read succeeded.",
      result: result.data,
    });
  } catch (error) {
    console.error("FalkorDB graph test failed:", error);

    return NextResponse.json(
      { error: "Graph test failed. Check the server terminal." },
      { status: 500 }
    );
  } finally {
    if (db) {
      await db.close();
    }
  }
}
