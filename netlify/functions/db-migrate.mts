import type { Context } from "@netlify/functions";
import { neon } from "@netlify/neon";

export default async (req: Request, context: Context) => {
  const sql = neon();

  try {
    await sql(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'bot')),
        content TEXT NOT NULL,
        attachments TEXT DEFAULT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await sql(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session
      ON chat_messages (session_id, created_at)
    `);

    // Add attachments column if table already existed without it
    try {
      await sql(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachments TEXT DEFAULT NULL`);
    } catch (e) {
      // Column may already exist, ignore
    }

    return new Response(JSON.stringify({ success: true, message: "Migration complete" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Migration error:", error);
    return new Response(
      JSON.stringify({ error: "Migration failed", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config = {
  path: "/api/db-migrate",
};
