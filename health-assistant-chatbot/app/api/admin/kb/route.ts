// app/api/admin/kb/route.ts
//
// GET  /api/admin/kb  -> list of knowledge-base files + how many chunks are indexed
// POST /api/admin/kb  { question: string, answer: string } -> appends a new FAQ
//
// NOTE on Vercel: serverless functions have a read-only filesystem except for
// /tmp, and /tmp is wiped between invocations/instances. So on Vercel this
// POST endpoint writes to /tmp for demo purposes only — it will NOT persist
// or show up for other users. For a real admin panel, replace the file
// writes here with calls to a database (see README "What to extend first").

import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { storeSize } from "@/lib/vectorstore";

const KB_DIR = path.join(process.cwd(), "data", "kb");
const isVercel = !!process.env.VERCEL;
const WRITABLE_DIR = isVercel ? "/tmp/kb" : KB_DIR;

export async function GET() {
  try {
    const files = (await fs.readdir(KB_DIR)).filter((f) => f.endsWith(".md"));
    const indexedChunks = await storeSize();
    return NextResponse.json({
      files,
      indexedChunks,
      writableOnThisDeployment: true,
      note: isVercel
        ? "Running on Vercel: new FAQs are saved to /tmp for this demo and are NOT permanent. Wire up a database to persist them."
        : "Running locally: new FAQs are saved to data/kb/custom.md. Run `npm run ingest` afterwards to index them.",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not read knowledge base" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const question = (body?.question ?? "").toString().trim();
    const answer = (body?.answer ?? "").toString().trim();

    if (!question || !answer) {
      return NextResponse.json({ error: "question and answer are required" }, { status: 400 });
    }

    await fs.mkdir(WRITABLE_DIR, { recursive: true });
    const filePath = path.join(WRITABLE_DIR, "custom.md");

    let existing = "";
    try {
      existing = await fs.readFile(filePath, "utf-8");
    } catch {
      existing = "# Custom FAQs (added via Admin Panel)\n";
    }

    const entry = `\n## ${question}\n\n${answer}\n`;
    await fs.writeFile(filePath, existing + entry);

    return NextResponse.json({
      ok: true,
      persisted: !isVercel,
      message: isVercel
        ? "Saved temporarily to /tmp. This will disappear on the next deployment/cold start — connect a database to make it permanent."
        : "Saved to data/kb/custom.md. Run `npm run ingest` to add it to the searchable knowledge base.",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not save FAQ" }, { status: 500 });
  }
}
