// app/api/chat/route.ts
//
// POST /api/chat  { message: string, history?: ChatTurn[] }
// -> { answer: string, sources: Source[] }
//
// This route is the "Backend API (Node.js + Express)" box from the diagram,
// implemented as a Next.js Route Handler so the whole app can deploy as a
// single Vercel project (no separate Express server needed).

import { NextRequest, NextResponse } from "next/server";
import { runHealthAssistant, type ChatTurn } from "@/lib/graph";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = (body?.message ?? "").toString().trim();
    const history: ChatTurn[] = Array.isArray(body?.history) ? body.history : [];

    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }
    if (message.length > 2000) {
      return NextResponse.json(
        { error: "message is too long (max 2000 characters)" },
        { status: 400 }
      );
    }

    const { answer, sources } = await runHealthAssistant(message, history);

    return NextResponse.json({ answer, sources });
  } catch (err: any) {
    console.error("Chat API error:", err);
    const message =
      err?.message?.includes("OPENAI_API_KEY")
        ? err.message
        : "Something went wrong while generating a response. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
