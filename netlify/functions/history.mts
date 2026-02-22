import type { Context } from "@netlify/functions";
import { neon } from "@netlify/neon";

export default async (req: Request, context: Context) => {
  const sql = neon();

  if (req.method === "GET") {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "Missing session_id parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const messages = await sql(
        "SELECT role, content, attachments, created_at FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC",
        [sessionId]
      );

      return new Response(JSON.stringify({ messages }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("History fetch error:", error);
      // Fallback without attachments column
      try {
        const messages = await sql(
          "SELECT role, content, created_at FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC",
          [sessionId]
        );
        return new Response(JSON.stringify({ messages }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (fallbackError) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch history" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "Missing session_id parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      await sql("DELETE FROM chat_messages WHERE session_id = $1", [sessionId]);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("History delete error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to clear history" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = {
  path: "/api/history",
};
