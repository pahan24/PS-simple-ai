import type { Context } from "@netlify/functions";
import OpenAI from "openai";
import { neon } from "@netlify/neon";

const openai = new OpenAI();

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { message, session_id, attachments } = await req.json();

    if ((!message || typeof message !== "string") && (!attachments || attachments.length === 0)) {
      return new Response(
        JSON.stringify({ error: "Missing message or attachments" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const sql = neon();

    // Build attachment metadata for storage (without full dataUrls for large images)
    const attachmentMeta = (attachments || []).map((att: any) => ({
      type: att.type,
      name: att.name,
      dataUrl: att.type === "image" ? att.dataUrl : undefined,
    }));

    // Save user message to database
    if (session_id) {
      try {
        await sql(
          "INSERT INTO chat_messages (session_id, role, content, attachments) VALUES ($1, $2, $3, $4)",
          [session_id, "user", message || "", JSON.stringify(attachmentMeta)]
        );
      } catch (dbError) {
        console.error("Failed to save user message:", dbError);
        // Try without attachments column (table might not have it yet)
        try {
          await sql(
            "INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)",
            [session_id, "user", message || ""]
          );
        } catch (e) {
          console.error("Fallback insert also failed:", e);
        }
      }
    }

    // Load recent conversation history for context
    let conversationHistory: { role: string; content: string }[] = [];
    if (session_id) {
      try {
        const rows = await sql(
          "SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT 20",
          [session_id]
        );
        conversationHistory = rows.reverse().map((row: any) => ({
          role: row.role === "bot" ? "assistant" : "user",
          content: row.content,
        }));
      } catch (dbError) {
        console.error("Failed to load history:", dbError);
      }
    }

    // Build the messages array for OpenAI
    const messages: any[] = [
      { role: "system", content: "You are a helpful AI assistant called Pahan AI. You can analyze images and documents that users share with you." },
    ];

    // Add conversation history (excluding the latest user message since we'll build it below)
    if (conversationHistory.length > 1) {
      messages.push(...conversationHistory.slice(0, -1));
    }

    // Build the current user message with potential multi-modal content
    const hasImages = attachments && attachments.some((att: any) => att.type === "image" && att.dataUrl);
    const hasDocuments = attachments && attachments.some((att: any) => att.type === "document");

    if (hasImages) {
      // Use vision-capable content format
      const contentParts: any[] = [];

      // Add text part
      let textPart = message || "";

      // Add document text content inline
      if (hasDocuments) {
        const docTexts = attachments
          .filter((att: any) => att.type === "document")
          .map((att: any) => {
            if (att.textContent) {
              return `\n\n--- Document: ${att.name} ---\n${att.textContent.substring(0, 10000)}`;
            }
            return `\n\n[Document attached: ${att.name}]`;
          })
          .join("");
        textPart += docTexts;
      }

      if (textPart) {
        contentParts.push({ type: "text", text: textPart });
      }

      // Add image parts
      attachments
        .filter((att: any) => att.type === "image" && att.dataUrl)
        .forEach((att: any) => {
          contentParts.push({
            type: "image_url",
            image_url: { url: att.dataUrl },
          });
        });

      messages.push({ role: "user", content: contentParts });
    } else if (hasDocuments) {
      // Text-only with document content
      let fullText = message || "";
      const docTexts = attachments
        .filter((att: any) => att.type === "document")
        .map((att: any) => {
          if (att.textContent) {
            return `\n\n--- Document: ${att.name} ---\n${att.textContent.substring(0, 10000)}`;
          }
          return `\n\n[Document attached: ${att.name}]`;
        })
        .join("");
      fullText += docTexts;
      messages.push({ role: "user", content: fullText });
    } else {
      // Plain text message (no attachments)
      messages.push({ role: "user", content: message });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 2048,
    });

    const reply = completion.choices[0].message.content;

    // Save bot reply to database
    if (session_id && reply) {
      try {
        await sql(
          "INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)",
          [session_id, "bot", reply]
        );
      } catch (dbError) {
        console.error("Failed to save bot reply:", dbError);
      }
    }

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get AI response" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config = {
  path: "/api/chat",
};
