import { z } from "zod";
import { canUseTestPublishingProvider, loadFeatureFlags } from "@casapratica/config";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import {
  AIChatService,
  createCasaPraticaAgentSystem,
  loadAgentPrompts,
  OpenAIManagerRunner,
  registerContentOperationsTools,
  registerAnalyticsTools,
  registerContentTools,
  registerCreativeStudioTools,
  registerFacebookStrategyTools,
  registerPinterestStrategyTools,
  registerProductResearchTools,
  ToolRegistry,
} from "@casapratica/agents";
import {
  createPrismaClient,
  PrismaContentRepository,
  PrismaConversationSessionRepository,
  PrismaCreativeStudioRepository,
  PrismaFacebookStrategyRepository,
  PrismaIntegrationRepository,
  PrismaOAuthStateRepository,
  PrismaOperationsRepository,
  PrismaPinterestStrategyRepository,
  PrismaResearchRepository,
  PrismaTraceRepository,
  PrismaAnalyticsRepository,
} from "@casapratica/database";
import {
  FacebookPageProvider,
  FetchHttpClient,
  IntegrationProviderRegistry,
  IntegrationService,
  MercadoLivreProductProvider,
  PinterestBoardProvider,
  SharpImageCompositionProvider,
  createMercadoLivreProvider,
  createMetaProvider,
  createPinterestProvider,
} from "@casapratica/integrations";
import { TokenCipher, encryptionKeySchema } from "@casapratica/security";
import {
  ApprovalService,
  ContentEngine,
  CreativeStudioService,
  DailyOperationsService,
  FacebookStrategyEngine,
  PinterestStrategyEngine,
  ProductResearchService,
  PerformanceIntelligenceService,
  PublishingService,
  TestPublishingProvider,
} from "@casapratica/strategy";
import { buildApp } from "./app.js";
import { BullMqPublicationScheduler } from "./publication-scheduler.js";

const env = z
  .object({
    API_HOST: z.string().default("0.0.0.0"),
    API_PORT: z.coerce.number().int().positive().default(3001),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    INTEGRATION_MODE: z.enum(["TEST", "SANDBOX", "PRODUCTION"]).default("TEST"),
    REDIS_URL: z.string().url().optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    DEFAULT_WORKSPACE_ID: z.uuid().optional(),
    INTEGRATION_ENCRYPTION_KEY: z.string().optional(),
    PINTEREST_CLIENT_ID: z.string().optional(),
    PINTEREST_CLIENT_SECRET: z.string().optional(),
    PINTEREST_REDIRECT_URI: z
      .url()
      .default("http://localhost:3001/api/integrations/pinterest/callback"),
    META_CLIENT_ID: z.string().optional(),
    META_CLIENT_SECRET: z.string().optional(),
    META_GRAPH_API_VERSION: z.string().optional(),
    META_REDIRECT_URI: z
      .url()
      .default("http://localhost:3001/api/integrations/facebook/callback"),
    MERCADOLIVRE_CLIENT_ID: z.string().optional(),
    MERCADOLIVRE_CLIENT_SECRET: z.string().optional(),
    MERCADOLIVRE_REDIRECT_URI: z
      .url()
      .default("http://localhost:3001/api/integrations/mercadolivre/callback"),
  })
  .parse(process.env);
const prisma = createPrismaClient();
const flags=loadFeatureFlags(process.env);
let integrations: IntegrationService | undefined;
const tools = new ToolRegistry();
const content = env.DEFAULT_WORKSPACE_ID
  ? new ContentEngine(new PrismaContentRepository(prisma))
  : undefined;
let pinterest = env.DEFAULT_WORKSPACE_ID
  ? new PinterestStrategyEngine(new PrismaPinterestStrategyRepository(prisma))
  : undefined;
let facebook = env.DEFAULT_WORKSPACE_ID
  ? new FacebookStrategyEngine(new PrismaFacebookStrategyRepository(prisma))
  : undefined;
const creative = env.DEFAULT_WORKSPACE_ID
  ? new CreativeStudioService(
      new PrismaCreativeStudioRepository(prisma),
      new SharpImageCompositionProvider("var/creative-assets"),
    )
  : undefined;
const operationsRepository = env.DEFAULT_WORKSPACE_ID
  ? new PrismaOperationsRepository(prisma)
  : undefined;
const analytics=env.DEFAULT_WORKSPACE_ID?new PerformanceIntelligenceService(new PrismaAnalyticsRepository(prisma)):undefined;
const scheduler = env.REDIS_URL&&flags.ENABLE_SCHEDULED_PUBLISHING
  ? new BullMqPublicationScheduler(env.REDIS_URL)
  : undefined;
const dailyOperations = operationsRepository
    ? new DailyOperationsService(operationsRepository, content, creative)
    : undefined,
  approval = operationsRepository
    ? new ApprovalService(operationsRepository, scheduler)
    : undefined,
  publishing = operationsRepository
    ? new PublishingService(operationsRepository,canUseTestPublishingProvider(process.env)?{pinterest:new TestPublishingProvider(),facebook:new TestPublishingProvider()}:{})
    : undefined;
const operations =
  dailyOperations && approval && publishing && operationsRepository
    ? {
        run: (workspaceId: string, date: Date) =>
          dailyOperations.runDailyOperations(workspaceId, date),
        listQueue: (workspaceId: string) =>
          operationsRepository.listQueue(workspaceId),
        approve: (workspaceId: string, id: string, actorId: string) =>
          approval.approve(workspaceId, id, actorId),
        reject: (
          workspaceId: string,
          id: string,
          actorId: string,
          reason: string,
        ) => approval.reject(workspaceId, id, actorId, reason),
        approveBatch: (
          workspaceId: string,
          ids: readonly string[],
          actorId: string,
        ) => approval.approveBatch(workspaceId, ids, actorId),
        schedule: (
          workspaceId: string,
          id: string,
          actorId: string,
          at: Date,
        ) => approval.schedule(workspaceId, id, actorId, at),
        reconcileScheduled: (workspaceId: string) =>
          approval.reconcileScheduled(workspaceId),
        publishNow: (workspaceId: string, id: string, actorId: string) =>
          publishing.publishNow(workspaceId, id, actorId),
        cancel: (workspaceId: string, id: string, actorId: string) =>
          approval.cancel(workspaceId, id, actorId),
        retry: (workspaceId: string, id: string, actorId: string) =>
          publishing.retry(workspaceId, id, actorId),
        status: (workspaceId: string, id: string) =>
          operationsRepository.getQueueItem(workspaceId, id),
        alerts: (workspaceId: string) =>
          operationsRepository.listAlerts(workspaceId),
      }
    : undefined;
if (content && env.DEFAULT_WORKSPACE_ID)
  registerContentTools(tools, content, env.DEFAULT_WORKSPACE_ID);
if (env.INTEGRATION_ENCRYPTION_KEY && env.DEFAULT_WORKSPACE_ID) {
  const registry = new IntegrationProviderRegistry(),
    http = new FetchHttpClient();
  if (env.PINTEREST_CLIENT_ID && env.PINTEREST_CLIENT_SECRET)
    registry.register(
      createPinterestProvider(
        env.PINTEREST_CLIENT_ID,
        env.PINTEREST_CLIENT_SECRET,
        http,
        { realPublishingEnabled: flags.ENABLE_REAL_PINTEREST_PUBLISHING },
      ),
    );
  if (
    env.META_CLIENT_ID &&
    env.META_CLIENT_SECRET &&
    env.META_GRAPH_API_VERSION
  )
    registry.register(
      createMetaProvider(
        env.META_CLIENT_ID,
        env.META_CLIENT_SECRET,
        env.META_GRAPH_API_VERSION,
        http,
        { realPublishingEnabled: flags.ENABLE_REAL_FACEBOOK_PUBLISHING },
      ),
    );
  if (env.MERCADOLIVRE_CLIENT_ID && env.MERCADOLIVRE_CLIENT_SECRET)
    registry.register(
      createMercadoLivreProvider(
        env.MERCADOLIVRE_CLIENT_ID,
        env.MERCADOLIVRE_CLIENT_SECRET,
        http,
      ),
    );
  integrations = new IntegrationService(
    registry,
    new PrismaIntegrationRepository(prisma),
    new PrismaOAuthStateRepository(prisma),
    new TokenCipher(encryptionKeySchema.parse(env.INTEGRATION_ENCRYPTION_KEY)),
    {
      pinterest: env.PINTEREST_REDIRECT_URI,
      facebook: env.META_REDIRECT_URI,
      mercadolivre: env.MERCADOLIVRE_REDIRECT_URI,
    },
  );
  if (env.PINTEREST_CLIENT_ID && env.PINTEREST_CLIENT_SECRET)
    pinterest = new PinterestStrategyEngine(
      new PrismaPinterestStrategyRepository(prisma),
      new PinterestBoardProvider(http, () =>
        integrations!.accessToken(env.DEFAULT_WORKSPACE_ID!, "pinterest"),
      ),
    );
  if (
    env.META_CLIENT_ID &&
    env.META_CLIENT_SECRET &&
    env.META_GRAPH_API_VERSION
  )
    facebook = new FacebookStrategyEngine(
      new PrismaFacebookStrategyRepository(prisma),
      new FacebookPageProvider(env.META_GRAPH_API_VERSION, http, () =>
        integrations!.accessToken(env.DEFAULT_WORKSPACE_ID!, "facebook"),
      ),
    );
  if (env.MERCADOLIVRE_CLIENT_ID && env.MERCADOLIVRE_CLIENT_SECRET) {
    const productProvider = new MercadoLivreProductProvider(http, () =>
      integrations!.accessToken(env.DEFAULT_WORKSPACE_ID!, "mercadolivre"),
    );
    registerProductResearchTools(
      tools,
      new ProductResearchService(
        productProvider,
        new PrismaResearchRepository(prisma),
      ),
      env.DEFAULT_WORKSPACE_ID,
    );
  }
}
if (pinterest && env.DEFAULT_WORKSPACE_ID)
  registerPinterestStrategyTools(tools, pinterest, env.DEFAULT_WORKSPACE_ID);
if (facebook && env.DEFAULT_WORKSPACE_ID)
  registerFacebookStrategyTools(tools, facebook, env.DEFAULT_WORKSPACE_ID);
if (creative && env.DEFAULT_WORKSPACE_ID)
  registerCreativeStudioTools(tools, creative, env.DEFAULT_WORKSPACE_ID);
if (operations && env.DEFAULT_WORKSPACE_ID)
  registerContentOperationsTools(tools, {
    run: (date) => operations.run(env.DEFAULT_WORKSPACE_ID!, date),
    listQueue: () => operations.listQueue(env.DEFAULT_WORKSPACE_ID!),
    approve: (id, actorId) =>
      operations.approve(env.DEFAULT_WORKSPACE_ID!, id, actorId),
    reject: (id, actorId, reason) =>
      operations.reject(env.DEFAULT_WORKSPACE_ID!, id, actorId, reason),
    approveBatch: (ids, actorId) =>
      operations.approveBatch(env.DEFAULT_WORKSPACE_ID!, ids, actorId),
    schedule: (id, actorId, at) =>
      operations.schedule(env.DEFAULT_WORKSPACE_ID!, id, actorId, at),
    publishNow: (id, actorId) =>
      operations.publishNow(env.DEFAULT_WORKSPACE_ID!, id, actorId),
    cancel: (id, actorId) =>
      operations.cancel(env.DEFAULT_WORKSPACE_ID!, id, actorId),
    retry: (id, actorId) =>
      operations.retry(env.DEFAULT_WORKSPACE_ID!, id, actorId),
    status: (id) => operations.status(env.DEFAULT_WORKSPACE_ID!, id),
    alerts: () => operations.alerts(env.DEFAULT_WORKSPACE_ID!),
  });
if(analytics&&env.DEFAULT_WORKSPACE_ID) registerAnalyticsTools(tools,analytics,env.DEFAULT_WORKSPACE_ID);
let aiChat: AIChatService | undefined;
if (env.OPENAI_API_KEY && env.DEFAULT_WORKSPACE_ID) {
  const system = createCasaPraticaAgentSystem(await loadAgentPrompts(), tools);
  aiChat = new AIChatService(
    new PrismaConversationSessionRepository(prisma),
    new PrismaTraceRepository(prisma, env.DEFAULT_WORKSPACE_ID),
    new OpenAIManagerRunner(system.manager),
    env.DEFAULT_WORKSPACE_ID,
  );
}
const app = buildApp({
  ...(aiChat ? { aiChat } : {}),
  ...(integrations ? { integrations } : {}),
  ...(content ? { content } : {}),
  ...(pinterest ? { pinterest } : {}),
  ...(facebook ? { facebook } : {}),
  ...(creative ? { creative } : {}),
  ...(operations ? { operations } : {}),
  ...(analytics ? { analytics } : {}),
  readiness:async()=>{let database="unavailable",redis="not_configured",worker="not_configured";try{await prisma.$queryRaw`SELECT 1`;database="available"}catch{database="unavailable"}if(env.REDIS_URL){const connection=new Redis(env.REDIS_URL,{lazyConnect:true,maxRetriesPerRequest:1,connectTimeout:1000});try{await connection.connect();redis=await connection.ping()==="PONG"?"available":"unavailable";const queue=new Queue("casapratica",{connection});worker=(await queue.getWorkers()).length?"available":"degraded";await queue.close()}catch{redis="unavailable";worker="unavailable"}finally{connection.disconnect()}}const status=database!=="available"||redis==="unavailable"?"not_ready":worker==="degraded"?"degraded":"ready";return {status,database,redis,worker,integrations:{mercadolivre:"optional",pinterest:"optional",meta:"optional"}}},
  ...(env.DEFAULT_WORKSPACE_ID
    ? { workspaceId: env.DEFAULT_WORKSPACE_ID }
    : {}),
});
try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
} catch (error) {
  app.log.error({ err: error }, "API failed to start");
  process.exitCode = 1;
}

async function shutdown(signal: string) {
  app.log.info({ signal }, "Shutting down API");
  await app.close();
  if (scheduler) await scheduler.close();
  await prisma.$disconnect();
}
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void shutdown(signal);
  });
