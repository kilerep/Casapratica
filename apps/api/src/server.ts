import { z } from "zod";
import { AIChatService, createCasaPraticaAgentSystem, loadAgentPrompts, OpenAIManagerRunner, ToolRegistry } from "@casapratica/agents";
import { createPrismaClient, PrismaConversationSessionRepository, PrismaIntegrationRepository, PrismaOAuthStateRepository, PrismaTraceRepository } from "@casapratica/database";
import { FetchHttpClient, IntegrationProviderRegistry, IntegrationService, createMercadoLivreProvider, createMetaProvider, createPinterestProvider } from "@casapratica/integrations";
import { TokenCipher, encryptionKeySchema } from "@casapratica/security";
import { buildApp } from "./app.js";

const env = z.object({ API_HOST: z.string().default("0.0.0.0"), API_PORT: z.coerce.number().int().positive().default(3001), OPENAI_API_KEY: z.string().min(1).optional(), DEFAULT_WORKSPACE_ID: z.uuid().optional(), INTEGRATION_ENCRYPTION_KEY: z.string().optional(), PINTEREST_CLIENT_ID: z.string().optional(), PINTEREST_CLIENT_SECRET: z.string().optional(), PINTEREST_REDIRECT_URI: z.url().default("http://localhost:3001/api/integrations/pinterest/callback"), META_CLIENT_ID: z.string().optional(), META_CLIENT_SECRET: z.string().optional(), META_GRAPH_API_VERSION: z.string().optional(), META_REDIRECT_URI: z.url().default("http://localhost:3001/api/integrations/facebook/callback"), MERCADOLIVRE_CLIENT_ID: z.string().optional(), MERCADOLIVRE_CLIENT_SECRET: z.string().optional(), MERCADOLIVRE_REDIRECT_URI: z.url().default("http://localhost:3001/api/integrations/mercadolivre/callback") }).parse(process.env);
const prisma = createPrismaClient();
let aiChat: AIChatService | undefined;
if (env.OPENAI_API_KEY && env.DEFAULT_WORKSPACE_ID) {
  const system = createCasaPraticaAgentSystem(await loadAgentPrompts(), new ToolRegistry());
  aiChat = new AIChatService(new PrismaConversationSessionRepository(prisma), new PrismaTraceRepository(prisma, env.DEFAULT_WORKSPACE_ID), new OpenAIManagerRunner(system.manager), env.DEFAULT_WORKSPACE_ID);
}
let integrations: IntegrationService | undefined;
if (env.INTEGRATION_ENCRYPTION_KEY && env.DEFAULT_WORKSPACE_ID) {
  const registry = new IntegrationProviderRegistry(), http = new FetchHttpClient();
  if (env.PINTEREST_CLIENT_ID && env.PINTEREST_CLIENT_SECRET) registry.register(createPinterestProvider(env.PINTEREST_CLIENT_ID, env.PINTEREST_CLIENT_SECRET, http));
  if (env.META_CLIENT_ID && env.META_CLIENT_SECRET && env.META_GRAPH_API_VERSION) registry.register(createMetaProvider(env.META_CLIENT_ID, env.META_CLIENT_SECRET, env.META_GRAPH_API_VERSION, http));
  if (env.MERCADOLIVRE_CLIENT_ID && env.MERCADOLIVRE_CLIENT_SECRET) registry.register(createMercadoLivreProvider(env.MERCADOLIVRE_CLIENT_ID, env.MERCADOLIVRE_CLIENT_SECRET, http));
  integrations = new IntegrationService(registry, new PrismaIntegrationRepository(prisma), new PrismaOAuthStateRepository(prisma), new TokenCipher(encryptionKeySchema.parse(env.INTEGRATION_ENCRYPTION_KEY)), { pinterest: env.PINTEREST_REDIRECT_URI, facebook: env.META_REDIRECT_URI, mercadolivre: env.MERCADOLIVRE_REDIRECT_URI });
}
const app = buildApp({ ...(aiChat ? { aiChat } : {}), ...(integrations ? { integrations } : {}), ...(env.DEFAULT_WORKSPACE_ID ? { workspaceId: env.DEFAULT_WORKSPACE_ID } : {}) });
try { await app.listen({ host: env.API_HOST, port: env.API_PORT }); }
catch (error) { app.log.error({ err: error }, "API failed to start"); process.exitCode = 1; }

async function shutdown(signal: string) { app.log.info({ signal }, "Shutting down API"); await app.close(); await prisma.$disconnect(); }
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { void shutdown(signal); });
