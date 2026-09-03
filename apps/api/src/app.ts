import Fastify from "fastify";
import { chatRequestSchema, type AIChatService } from "@casapratica/agents";
import type { IntegrationService, ProviderName } from "@casapratica/integrations";

export function buildApp(options: { aiChat?: Pick<AIChatService, "chat">; integrations?: Pick<IntegrationService, "list" | "status" | "connect" | "callback" | "validate" | "disconnect">; workspaceId?: string } = {}) {
  const app = Fastify({ logger: true });
  app.get("/health", async () => ({ status: "ok" as const }));
  app.post("/api/ai/chat", async (request, reply) => {
    const input = chatRequestSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: "invalid_request", details: input.error.issues });
    if (!options.aiChat) return reply.code(503).send({ error: "ai_not_configured" });
    try { return await options.aiChat.chat(input.data); }
    catch (error) { request.log.error({ errorCode: error instanceof Error ? error.message : "unknown_error" }, "AI chat failed"); return reply.code(422).send({ error: error instanceof Error ? error.message : "ai_chat_failed" }); }
  });
  const provider = (value: string): ProviderName => { if (!["pinterest", "facebook", "mercadolivre"].includes(value)) throw new Error("unknown_provider"); return value as ProviderName; };
  app.get("/api/integrations", async (_request, reply) => options.integrations && options.workspaceId ? options.integrations.list(options.workspaceId) : reply.code(503).send({ error: "integrations_not_configured" }));
  app.get<{ Params: { provider: string } }>("/api/integrations/:provider/status", async (request, reply) => options.integrations && options.workspaceId ? options.integrations.status(options.workspaceId, provider(request.params.provider)) : reply.code(503).send({ error: "integrations_not_configured" }));
  app.get<{ Params: { provider: string }; Querystring: { test?: string } }>("/api/integrations/:provider/connect", async (request, reply) => { if (!options.integrations || !options.workspaceId) return reply.code(503).send({ error: "integrations_not_configured" }); if (request.query.test === "true") return options.integrations.validate(options.workspaceId, provider(request.params.provider)); return reply.redirect(await options.integrations.connect(options.workspaceId, provider(request.params.provider))); });
  app.get<{ Params: { provider: string }; Querystring: { code?: string; state?: string } }>("/api/integrations/:provider/callback", async (request, reply) => { if (!options.integrations || !request.query.code || !request.query.state) return reply.code(400).send({ error: "invalid_callback" }); return options.integrations.callback(provider(request.params.provider), request.query.code, request.query.state); });
  app.post<{ Params: { provider: string } }>("/api/integrations/:provider/disconnect", async (request, reply) => { if (!options.integrations || !options.workspaceId) return reply.code(503).send({ error: "integrations_not_configured" }); await options.integrations.disconnect(options.workspaceId, provider(request.params.provider)); return reply.code(204).send(); });
  return app;
}
