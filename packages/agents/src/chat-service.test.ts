import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { AIChatService } from "./chat-service.js";
import type { ConversationSession, ConversationSessionRepository, TraceRecord } from "./contracts.js";

class SessionRepositoryMock implements ConversationSessionRepository {
  readonly sessions = new Map<string, ConversationSession>();
  async create(workspaceId: string) { const now = new Date(); const session = { id: randomUUID(), workspaceId, items: [], createdAt: now, updatedAt: now } satisfies ConversationSession; this.sessions.set(session.id, session); return session; }
  async findById(id: string) { return this.sessions.get(id) ?? null; }
  async append(id: string, items: ConversationSession["items"]) { const session = this.sessions.get(id); if (!session) throw new Error("missing"); this.sessions.set(id, { ...session, items: [...session.items, ...items], updatedAt: new Date() }); }
}

describe("persistent chat sessions with mocked OpenAI model boundary", () => {
  it("creates and resumes a session without a live model call", async () => {
    const sessions = new SessionRepositoryMock(); const traces: TraceRecord[] = [];
    const runner = { run: vi.fn(async () => ({ output: { message: "Resposta baseada nos dados disponíveis.", actions: [], approvalsRequired: [], references: [] }, usage: { inputTokens: 3, outputTokens: 7 } })) };
    const service = new AIChatService(sessions, { append: async (trace) => { traces.push(trace); } }, runner, randomUUID());
    const first = await service.chat({ message: "Analise o produto" });
    const second = await service.chat({ message: "Continue", sessionId: first.sessionId });
    expect(second.sessionId).toBe(first.sessionId); expect(sessions.sessions.get(first.sessionId)?.items).toHaveLength(4); expect(runner.run).toHaveBeenCalledTimes(2); expect(traces.every((trace) => trace.status === "succeeded")).toBe(true);
  });
  it("records model failures without storing an invented assistant answer", async () => {
    const sessions = new SessionRepositoryMock(); const traces: TraceRecord[] = [];
    const service = new AIChatService(sessions, { append: async (trace) => { traces.push(trace); } }, { run: async () => { throw new Error("mock_model_failure"); } }, randomUUID());
    await expect(service.chat({ message: "Pesquise" })).rejects.toThrow("mock_model_failure"); expect(traces[0]?.status).toBe("failed");
  });
});
