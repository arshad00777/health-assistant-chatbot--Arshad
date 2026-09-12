// scripts/ingest.mjs
//
// Reads every .md file in data/kb/, splits it into paragraph-level chunks,
// embeds each chunk with OpenAI, and writes the result to data/vectorstore.json.
//
// Run this any time you add/edit files in data/kb/:
//   npm run ingest
//
// This is the "Document Ingestion" + "Text Processing" + "Vector Database"
// stage of the RAG pipeline. We use a flat JSON file instead of Pinecone/
// Chroma so the prototype has zero external services to set up — see the
// README for how to swap in a real vector DB later.

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

const KB_DIR = path.join(process.cwd(), "data", "kb");
const OUT_FILE = path.join(process.cwd(), "data", "vectorstore.json");
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const MAX_CHUNK_CHARS = 800;

function chunkMarkdown(text, sourceName) {
  // Split on markdown headings / blank lines, then group into ~MAX_CHUNK_CHARS chunks
  // so each chunk stays topically coherent (roughly one FAQ answer per chunk).
  const blocks = text
    .split(/\n(?=##\s)/g) // split before each "## Heading"
    .map((b) => b.trim())
    .filter(Boolean);

  const chunks = [];
  for (const block of blocks) {
    if (block.length <= MAX_CHUNK_CHARS) {
      chunks.push(block);
    } else {
      // Fallback: hard-wrap very long sections
      for (let i = 0; i < block.length; i += MAX_CHUNK_CHARS) {
        chunks.push(block.slice(i, i + MAX_CHUNK_CHARS));
      }
    }
  }

  return chunks.map((content, i) => ({
    id: `${sourceName}#${i}`,
    source: sourceName,
    text: content,
  }));
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error(
      "Missing OPENAI_API_KEY. Copy .env.example to .env and add your key first."
    );
    process.exit(1);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const files = (await fs.readdir(KB_DIR)).filter((f) => f.endsWith(".md"));
  if (files.length === 0) {
    console.error(`No .md files found in ${KB_DIR}`);
    process.exit(1);
  }

  let allChunks = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(KB_DIR, file), "utf-8");
    allChunks.push(...chunkMarkdown(raw, file));
  }

  console.log(`Embedding ${allChunks.length} chunks from ${files.length} file(s)...`);

  // Batch embeddings (OpenAI allows arrays of input strings per request)
  const BATCH_SIZE = 50;
  const records = [];
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    const res = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch.map((c) => c.text),
    });
    res.data.forEach((d, j) => {
      records.push({
        id: batch[j].id,
        source: batch[j].source,
        text: batch[j].text,
        embedding: d.embedding,
      });
    });
    console.log(`  embedded ${Math.min(i + BATCH_SIZE, allChunks.length)}/${allChunks.length}`);
  }

  await fs.writeFile(OUT_FILE, JSON.stringify(records, null, 2));
  console.log(`Wrote ${records.length} chunks to ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
