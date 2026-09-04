import { z } from "zod";
import { AIChatService, createCasaPraticaAgentSystem, loadAgentPrompts, OpenAIManagerRunner, registerContentTools, registerCreativeStudioTools, registerFacebookStrategyTools, registerPinterestStrategyTools, registerProductResearchTools, ToolRegistry } from "@casapratica/agents";
import { createPrismaClient, PrismaContentRepository, PrismaConversationSessionRepository, PrismaCreativeStudioRepository, PrismaFacebookStrategyRepository, PrismaIntegrationRepository, PrismaOAuthStateRepository, PrismaPinterestStrategyRepository, PrismaResearchRepository, PrismaTraceRepository } from "@casapratica/database";
import { FacebookPageProvider, FetchHttpClient, IntegrationProviderRegistry, IntegrationService, MercadoLivreProductProvider, PinterestBoardProvider, SharpImageCompositionProvider, createMercadoLivreProvider, createMetaProvider, createPinterestProvider } from "@casapratica/integrations";
import { TokenCipher, encryptionKeySchema } from "@casapratica/security";
import { ContentEngine, CreativeStudioService, FacebookStrategyEngine, PinterestStrategyEngine, ProductResearchService } from "@casapratica/strategy";
import { buildApp } from "./app.js";

const env = z.object({ API_HOST: z.string().default("0.0.0.0"), API_PORT: z.coerce.number().int().positive().default(3001), OPENAI_API_KEY: z.string().min(1).optional(), DEFAULT_WORKSPACE_ID: z.uuid().optional(), INTEGRATION_ENCRYPTION_KEY: z.string().optional(), PINTEREST_CLIENT_ID: z.string().optional(), PINTEREST_CLIENT_SECRET: z.string().optional(), PINTEREST_REDIRECT_URI: z.url().default("http://localhost:3001/api/integrations/pinterest/callback"), META_CLIENT_ID: z.string().optional(), META_CLIENT_SECRET: z.string().optional(), META_GRAPH_API_VERSION: z.string().optional(), META_REDIRECT_URI: z.url().default("http://localhost:3001/api/integrations/facebook/callback"), MERCADOLIVRE_CLIENT_ID: z.string().optional(), MERCADOLIVRE_CLIENT_SECRET: z.string().optional(), MERCADOLIVRE_REDIRECT_URI: z.url().default("http://localhost:3001/api/integrations/mercadolivre/callback") }).parse(process.env);
const prisma = createPrismaClient();
let integrations: IntegrationService | undefined;
const tools = new ToolRegistry();
const content = env.DEFAULT_WORKSPACE_ID ? new ContentEngine(new PrismaContentRepository(prisma)) : undefined;
let pinterest = env.DEFAULT_WORKSPACE_ID ? new PinterestStrategyEngine(new PrismaPinterestStrategyRepository(prisma)) : undefined;
let facebook = env.DEFAULT_WORKSPACE_ID ? new FacebookStrategyEngine(new PrismaFacebookStrategyRepository(prisma)) : undefined;
const creative = env.DEFAULT_WORKSPACE_ID ? new CreativeStudioService(new PrismaCreativeStudioRepository(prisma), new SharpImageCompositionProvider("var/creative-assets")) : undefined;
if (content && env.DEFAULT_WORKSPACE_ID) registerContentTools(tools, content, env.DEFAULT_WORKSPACE_ID);
if (env.INTEGRATION_ENCRYPTION_KEY && env.DEFAULT_WORKSPACE_ID) {
  const registry = new IntegrationProviderRegistry(), http = new FetchHttpClient();
  if (env.PINTEREST_CLIENT_ID && env.PINTEREST_CLIENT_SECRET) registry.register(createPinterestProvider(env.PINTEREST_CLIENT_ID, env.PINTEREST_CLIENT_SECRET, http));
  if (env.META_CLIENT_ID && env.META_CLIENT_SECRET && env.META_GRAPH_API_VERSION) registry.register(createMetaProvider(env.META_CLIENT_ID, env.META_CLIENT_SECRET, env.META_GRAPH_API_VERSION, http));
  if (env.MERCADOLIVRE_CLIENT_ID && env.MERCADOLIVRE_CLIENT_SECRET) registry.register(createMercadoLivreProvider(env.MERCADOLIVRE_CLIENT_ID, env.MERCADOLIVRE_CLIENT_SECRET, http));
  integrations = new IntegrationService(registry, new PrismaIntegrationRepository(prisma), new PrismaOAuthStateRepository(prisma), new TokenCipher(encryptionKeySchema.parse(env.INTEGRATION_ENCRYPTION_KEY)), { pinterest: env.PINTEREST_REDIRECT_URI, facebook: env.META_REDIRECT_URI, mercadolivre: env.MERCADOLIVRE_REDIRECT_URI });
  if (env.PINTEREST_CLIENT_ID && env.PINTEREST_CLIENT_SECRET) pinterest = new PinterestStrategyEngine(new PrismaPinterestStrategyRepository(prisma), new PinterestBoardProvider(http, () => integrations!.accessToken(env.DEFAULT_WORKSPACE_ID!, "pinterest")));
  if (env.META_CLIENT_ID && env.META_CLIENT_SECRET && env.META_GRAPH_API_VERSION) facebook = new FacebookStrategyEngine(new PrismaFacebookStrategyRepository(prisma), new FacebookPageProvider(env.META_GRAPH_API_VERSION, http, () => integrations!.accessToken(env.DEFAULT_WORKSPACE_ID!, "facebook")));
  if (env.MERCADOLIVRE_CLIENT_ID && env.MERCADOLIVRE_CLIENT_SECRET) {
    const productProvider = new MercadoLivreProductProvider(http, () => integrations!.accessToken(env.DEFAULT_WORKSPACE_ID!, "mercadolivre"));
    registerProductResearchTools(tools, new ProductResearchService(productProvider, new PrismaResearchRepository(prisma)), env.DEFAULT_WORKSPACE_ID);
  }
}
if (pinterest && env.DEFAULT_WORKSPACE_ID) registerPinterestStrategyTools(tools, pinterest, env.DEFAULT_WORKSPACE_ID);
if (facebook && env.DEFAULT_WORKSPACE_ID) registerFacebookStrategyTools(tools, facebook, env.DEFAULT_WORKSPACE_ID);
if (creative && env.DEFAULT_WORKSPACE_ID) registerCreativeStudioTools(tools, creative, env.DEFAULT_WORKSPACE_ID);
let aiChat: AIChatService | undefined;
if (env.OPENAI_API_KEY && env.DEFAULT_WORKSPACE_ID) { const system = createCasaPraticaAgentSystem(await loadAgentPrompts(), tools); aiChat = new AIChatService(new PrismaConversationSessionRepository(prisma), new PrismaTraceRepository(prisma, env.DEFAULT_WORKSPACE_ID), new OpenAIManagerRunner(system.manager), env.DEFAULT_WORKSPACE_ID); }
const app = buildApp({ ...(aiChat ? { aiChat } : {}), ...(integrations ? { integrations } : {}), ...(content ? { content } : {}), ...(pinterest ? { pinterest } : {}), ...(facebook ? { facebook } : {}), ...(creative ? { creative } : {}), ...(env.DEFAULT_WORKSPACE_ID ? { workspaceId: env.DEFAULT_WORKSPACE_ID } : {}) });
try { await app.listen({ host: env.API_HOST, port: env.API_PORT }); }
catch (error) { app.log.error({ err: error }, "API failed to start"); process.exitCode = 1; }

async function shutdown(signal: string) { app.log.info({ signal }, "Shutting down API"); await app.close(); await prisma.$disconnect(); }
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { void shutdown(signal); });
