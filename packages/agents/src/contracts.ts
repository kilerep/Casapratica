import { z } from "zod";

export const chatRequestSchema = z.object({ message: z.string().trim().min(1).max(10_000), sessionId: z.uuid().optional() });
export const chatResponseSchema = z.object({
  message: z.string(), sessionId: z.uuid(),
  actions: z.array(z.object({ type: z.string(), status: z.enum(["completed", "failed", "proposed"]), description: z.string() })),
  approvalsRequired: z.array(z.object({ action: z.string(), reason: z.string() })),
  references: z.array(z.object({ type: z.string(), id: z.string(), label: z.string().nullable() })),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;

export interface ConversationItem { readonly role: "user" | "assistant"; readonly content: string; readonly createdAt: Date }
export interface ConversationSession { readonly id: string; readonly workspaceId: string; readonly items: readonly ConversationItem[]; readonly createdAt: Date; readonly updatedAt: Date }
export interface ConversationSessionRepository {
  findById(id: string): Promise<ConversationSession | null>;
  create(workspaceId: string): Promise<ConversationSession>;
  append(sessionId: string, items: readonly ConversationItem[]): Promise<void>;
}
export interface TraceRecord { readonly agent: string; readonly tool: string | null; readonly durationMs: number; readonly status: "succeeded" | "failed"; readonly errorCode: string | null; readonly usage: { readonly inputTokens?: number; readonly outputTokens?: number; readonly costUsd?: number } | null }
export interface TraceRepository { append(record: TraceRecord): Promise<void> }
