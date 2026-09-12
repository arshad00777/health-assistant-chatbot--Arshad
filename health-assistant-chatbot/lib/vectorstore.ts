// lib/vectorstore.ts
//
// A minimal in-memory vector store. In the architecture diagram this stands
// in for Pinecone/Chroma/FAISS. It reads the flat file produced by
// `npm run ingest` and does cosine-similarity search in plain JS.
//
// Swap-in point: replace `search()` with a call to Pinecone/Chroma's query
// API and this is the only file the rest of the app depends on.

import fs from "node:fs/promises";
import path from "node:path";

export type VectorRecord = {
  id: string;
  source: string;
  text: string;
  embedding: number[];
};

let cache: VectorRecord[] | null = null;

async function loadStore(): Promise<VectorRecord[]> {
  if (cache) return cache;
  const filePath = path.join(process.cwd(), "data", "vectorstore.json");
  const raw = await fs.readFile(filePath, "utf-8");
  cache = JSON.parse(raw) as VectorRecord[];
  return cache;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function search(
  queryEmbedding: number[],
  topK = 4
): Promise<Array<VectorRecord & { score: number }>> {
  const store = await loadStore();
  if (store.length === 0) return [];

  return store
    .map((record) => ({ ...record, score: cosineSimilarity(queryEmbedding, record.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export async function storeSize(): Promise<number> {
  const store = await loadStore();
  return store.length;
}
