// lib/graph.ts
//
// This is the "LangGraph (Workflow / Agent)" box from the architecture
// diagram. It orchestrates a small multi-step flow:
//
//   START -> retrieve -> generate -> END
//
// retrieve: embeds the user's question, searches the vector store, and
//           decides whether there's enough relevant context to ground an
//           answer (this is the "Decides when to retrieve" behavior).
// generate: calls the LLM with the retrieved context (or a fallback
//           "I don't have grounded info" instruction if nothing relevant
//           was found) and returns the answer plus the sources used.
//
// Extend this graph by adding more nodes (e.g. a "safety_check" node, a
// "tool_call" node for a BMI/dose calculator, or a "clarify" node that
// loops back and asks the user a follow-up question before generating).

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { embedText, getOpenAIClient, CHAT_MODEL } from "./openai";
import { search, storeSize } from "./vectorstore";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type Source = { source: string; snippet: string; score: number };

const RELEVANCE_THRESHOLD = 0.72; // cosine similarity cutoff for "grounded enough"

const SYSTEM_PROMPT = `You are a health information assistant. You provide general,
educational health information only — you are not a doctor and you do not diagnose,
prescribe, or replace professional medical care.

Rules:
- Base your answer primarily on the CONTEXT provided below, when it's relevant.
- If the context does not cover the question, say so plainly and give brief,
  cautious general knowledge instead of inventing specifics.
- Always keep a warm, clear, non-alarming tone.
- For anything that sounds urgent or severe, clearly recommend seeking prompt
  medical care or emergency services.
- End your answer with a short "Next steps" line when relevant.
- Never claim certainty about an individual's diagnosis.`;

const StateAnnotation = Annotation.Root({
  question: Annotation<string>,
  history: Annotation<ChatTurn[]>,
  context: Annotation<string>,
  sources: Annotation<Source[]>,
  answer: Annotation<string>,
});

type GraphState = typeof StateAnnotation.State;

async function retrieveNode(state: GraphState): Promise<Partial<GraphState>> {
  const total = await storeSize();
  if (total === 0) {
    return { context: "", sources: [] };
  }

  const queryEmbedding = await embedText(state.question);
  const results = await search(queryEmbedding, 4);
  const relevant = results.filter((r) => r.score >= RELEVANCE_THRESHOLD);

  const context = relevant.map((r) => `Source: ${r.source}\n${r.text}`).join("\n\n---\n\n");
  const sources: Source[] = relevant.map((r) => ({
    source: r.source,
    snippet: r.text.slice(0, 160) + (r.text.length > 160 ? "…" : ""),
    score: Number(r.score.toFixed(3)),
  }));

  return { context, sources };
}

async function generateNode(state: GraphState): Promise<Partial<GraphState>> {
  const openai = getOpenAIClient();

  const contextBlock = state.context
    ? `CONTEXT:\n${state.context}`
    : "CONTEXT: (no closely matching information was found in the knowledge base)";

  const recentHistory = (state.history || []).slice(-6); // keep last few turns

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "system" as const, content: contextBlock },
    ...recentHistory.map((t) => ({ role: t.role, content: t.content })),
    { role: "user" as const, content: state.question },
  ];

  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: messages as any,
    temperature: 0.4,
  });

  const answer =
    completion.choices[0]?.message?.content?.trim() ||
    "Sorry, I wasn't able to generate a response. Please try rephrasing your question.";

  return { answer };
}

const workflow = new StateGraph(StateAnnotation)
  .addNode("retrieve", retrieveNode)
  .addNode("generate", generateNode)
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "generate")
  .addEdge("generate", END);

const compiledGraph = workflow.compile();

export async function runHealthAssistant(question: string, history: ChatTurn[] = []) {
  const result = await compiledGraph.invoke({ question, history });
  return {
    answer: result.answer,
    sources: result.sources || [],
  };
}
