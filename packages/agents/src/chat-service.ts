import { chatRequestSchema, chatResponseSchema, type ChatRequest, type ChatResponse, type ConversationSessionRepository, type TraceRepository } from "./contracts.js";
import { validateInput, validateOutput } from "./guardrails.js";
import type { ManagerRunner } from "./agent-system.js";

export class AIChatService {
  constructor(private readonly sessions: ConversationSessionRepository, private readonly traces: TraceRepository, private readonly runner: ManagerRunner, private readonly workspaceId: string) {}
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const input = chatRequestSchema.parse(request);
    const guardrail = validateInput(input.message);
    if (!guardrail.allowed) throw new Error(guardrail.code ?? "input_rejected");
    const session = input.sessionId ? await this.sessions.findById(input.sessionId) : await this.sessions.create(this.workspaceId);
    if (!session || session.workspaceId !== this.workspaceId) throw new Error("session_not_found");
    const startedAt = performance.now();
    try {
      const run = await this.runner.run(input.message, session.items);
      const outputGuardrail = validateOutput(run.output.message);
      if (!outputGuardrail.allowed) throw new Error(outputGuardrail.code ?? "output_rejected");
      await this.sessions.append(session.id, [{ role: "user", content: input.message, createdAt: new Date() }, { role: "assistant", content: run.output.message, createdAt: new Date() }]);
      await this.traces.append({ agent: "CasaPraticaManagerAgent", tool: null, durationMs: performance.now() - startedAt, status: "succeeded", errorCode: null, usage: run.usage });
      return chatResponseSchema.parse({ ...run.output, sessionId: session.id, approvalsRequired: [...guardrail.approvalsRequired, ...run.output.approvalsRequired] });
    } catch (error) {
      await this.traces.append({ agent: "CasaPraticaManagerAgent", tool: null, durationMs: performance.now() - startedAt, status: "failed", errorCode: error instanceof Error ? error.message : "unknown_error", usage: null });
      throw error;
    }
  }
}
