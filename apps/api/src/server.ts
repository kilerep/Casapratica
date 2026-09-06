import {
  PinterestPilotService,
  pinterestReadiness,
} from "./pinterest-pilot.js";
import { FacebookPilotService } from "./facebook-pilot.js";
import { AssistedPublicationService } from "./assisted-publication.js";
import { resolveOperationalWorkspace } from "./operational-workspace.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  canUseTestPublishingProvider,
  applyLocalDevelopmentDefaults,
  loadFeatureFlags,
  resolveOperationalMode,
} from "@casapratica/config";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import {
  registerContentOperationsTools,
  registerAnalyticsTools,
  registerContentTools,
  registerCreativeStudioTools,
  registerFacebookStrategyTools,
  registerPinterestStrategyTools,
  registerProductResearchTools,
  ToolRegistry,
} from "@casapratica/agents/tool-registry";
import type { AIChatService } from "@casapratica/agents/chat-service";
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
  PrismaDashboardRepository,
  PrismaProductReviewRepository,
  PrismaMetaPageRepository,
  PrismaAssistedPublicationRepository,
  PrismaWorkspaceRepository,
  PrismaProductImportRepository,
} from "@casapratica/database";
import {
  FacebookPageProvider,
  FacebookPublishingProvider,
  FetchHttpClient,
  IntegrationProviderRegistry,
  IntegrationService,
  MercadoLivreProductProvider,
  MercadoLivreDiscoverySource,
  PublicWebProductDiscoverySource,
  PinterestBoardProvider,
  PinterestPinProvider,
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
  ProductDiscoveryService,
  PerformanceIntelligenceService,
  PublishingService,
  TestPublishingProvider,
} from "@casapratica/strategy";
import { buildApp } from "./app.js";
import { BullMqPublicationScheduler } from "./publication-scheduler.js";
import {
  ProductDiscoveryRoutingService,
  type DiscoveryChoice,
} from "./product-discovery-routing.js";
import { ProductImportService } from "./product-import.js";

const startupMemory = (stage: string) => {
  if (process.env.DEBUG_STARTUP_MEMORY !== "1") return;
  const memory = process.memoryUsage();
  const mb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;
  console.info(`[startup-memory] ${stage}`, {
    rss: mb(memory.rss),
    heapUsed: mb(memory.heapUsed),
    heapTotal: mb(memory.heapTotal),
    external: mb(memory.external),
    arrayBuffers: mb(memory.arrayBuffers),
  });
};

const loadEnvironmentIfPresent = (path: string) => {
  try {
    loadEnvFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
};
loadEnvironmentIfPresent(
  fileURLToPath(new URL("../../../.env", import.meta.url)),
);
loadEnvironmentIfPresent(
  fileURLToPath(new URL("../../../.env.local", import.meta.url)),
);
applyLocalDevelopmentDefaults(process.env);

const env = z
  .object({
    WEB_ORIGIN: z.url().default("http://localhost:3000"),
    API_HOST: z.string().default("0.0.0.0"),
    API_PORT: z.coerce.number().int().positive().default(3001),
    OAUTH_PUBLIC_HOST: z.hostname().optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
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
    META_LOGIN_CONFIGURATION_ID: z.string().min(1).optional(),
    META_REDIRECT_URI: z
      .url()
      .default("http://localhost:3001/api/integrations/facebook/callback"),
    MERCADOLIVRE_CLIENT_ID: z.string().optional(),
    MERCADOLIVRE_CLIENT_SECRET: z.string().optional(),
    MERCADOLIVRE_REDIRECT_URI: z
      .url()
      .default("http://localhost:3001/api/integrations/mercadolivre/callback"),
    PUBLIC_SITE_URL: z.url().optional(),
    NEXT_PUBLIC_CONTACT_EMAIL: z.string().email().optional(),
  })
  .parse(process.env);
startupMemory("BOOT 1 config");
const prisma = createPrismaClient();
const flags = loadFeatureFlags(process.env);
const mercadoLivreEnabled =
  (flags as typeof flags & { ENABLE_MERCADOLIVRE_INTEGRATION?: boolean })
    .ENABLE_MERCADOLIVRE_INTEGRATION ?? false;
const operationalMode = resolveOperationalMode(process.env);
const operationalWorkspace = await resolveOperationalWorkspace(
  new PrismaWorkspaceRepository(prisma),
  { configuredId: env.DEFAULT_WORKSPACE_ID, mode: operationalMode },
);
startupMemory("BOOT 2 database");
env.DEFAULT_WORKSPACE_ID = operationalWorkspace.id;
let integrations: IntegrationService | undefined;
let integrationRepository: PrismaIntegrationRepository | undefined;
let pinterestPilot: PinterestPilotService | undefined;
let facebookPilot: FacebookPilotService | undefined;
let productDiscovery:
  | {
      run(workspaceId: string, source?: DiscoveryChoice): Promise<unknown>;
      latest(workspaceId: string): Promise<unknown>;
      opportunities(workspaceId: string): Promise<unknown>;
    }
  | undefined;
let publicWebDiscovery: ProductDiscoveryService | undefined;
const tools = new ToolRegistry();
if (env.DEFAULT_WORKSPACE_ID) {
  const provider = new PublicWebProductDiscoverySource(
    new FetchHttpClient({ timeoutMs: 5_000, maxRetries: 1 }),
  );
  publicWebDiscovery = new ProductDiscoveryService(
    provider,
    new ProductResearchService(provider, new PrismaResearchRepository(prisma)),
  );
  productDiscovery = publicWebDiscovery;
}
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
const analytics = env.DEFAULT_WORKSPACE_ID
  ? new PerformanceIntelligenceService(new PrismaAnalyticsRepository(prisma))
  : undefined;
const dashboard = env.DEFAULT_WORKSPACE_ID
  ? new PrismaDashboardRepository(prisma)
  : undefined;
const productReview = env.DEFAULT_WORKSPACE_ID
  ? new PrismaProductReviewRepository(prisma)
  : undefined;
const productImport = env.DEFAULT_WORKSPACE_ID
  ? new ProductImportService(
      (provider) =>
        new ProductResearchService(
          provider,
          new PrismaResearchRepository(prisma),
        ),
      new PrismaProductImportRepository(prisma),
    )
  : undefined;
const assistedPublication = content
  ? new AssistedPublicationService(
      new PrismaAssistedPublicationRepository(prisma),
      content,
    )
  : undefined;
const scheduler =
  env.REDIS_URL && flags.ENABLE_SCHEDULED_PUBLISHING
    ? new BullMqPublicationScheduler(env.REDIS_URL)
    : undefined;
const dailyOperations = operationsRepository
    ? new DailyOperationsService(operationsRepository, content, creative)
    : undefined,
  approval = operationsRepository
    ? new ApprovalService(operationsRepository, scheduler)
    : undefined,
  publishing = operationsRepository
    ? new PublishingService(
        operationsRepository,
        canUseTestPublishingProvider(process.env)
          ? {
              pinterest: new TestPublishingProvider(),
              facebook: new TestPublishingProvider(),
            }
          : {},
      )
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
  if (
    flags.ENABLE_PINTEREST_PILOT &&
    env.PINTEREST_CLIENT_ID &&
    env.PINTEREST_CLIENT_SECRET
  )
    registry.register(
      createPinterestProvider(
        env.PINTEREST_CLIENT_ID,
        env.PINTEREST_CLIENT_SECRET,
        http,
        {
          pilotEnabled: flags.ENABLE_PINTEREST_PILOT,
          realPublishingEnabled: flags.ENABLE_REAL_PINTEREST_PUBLISHING,
        },
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
        {
          pilotEnabled: flags.ENABLE_META_PILOT,
          realPublishingEnabled: flags.ENABLE_REAL_FACEBOOK_PUBLISHING,
          ...(env.META_LOGIN_CONFIGURATION_ID
            ? { configurationId: env.META_LOGIN_CONFIGURATION_ID }
            : {}),
        },
      ),
    );
  if (
    mercadoLivreEnabled &&
    env.MERCADOLIVRE_CLIENT_ID &&
    env.MERCADOLIVRE_CLIENT_SECRET
  )
    registry.register(
      createMercadoLivreProvider(
        env.MERCADOLIVRE_CLIENT_ID,
        env.MERCADOLIVRE_CLIENT_SECRET,
        http,
      ),
    );
  integrationRepository = new PrismaIntegrationRepository(prisma);
  integrations = new IntegrationService(
    registry,
    integrationRepository,
    new PrismaOAuthStateRepository(prisma),
    new TokenCipher(encryptionKeySchema.parse(env.INTEGRATION_ENCRYPTION_KEY)),
    {
      pinterest: env.PINTEREST_REDIRECT_URI,
      facebook: env.META_REDIRECT_URI,
      mercadolivre: env.MERCADOLIVRE_REDIRECT_URI,
    },
  );
  if (
    flags.ENABLE_PINTEREST_PILOT &&
    env.PINTEREST_CLIENT_ID &&
    env.PINTEREST_CLIENT_SECRET
  )
    pinterest = new PinterestStrategyEngine(
      new PrismaPinterestStrategyRepository(prisma),
      new PinterestBoardProvider(http, () =>
        integrations!.accessToken(env.DEFAULT_WORKSPACE_ID!, "pinterest"),
      ),
    );
  if (
    flags.ENABLE_PINTEREST_PILOT &&
    registry.has("pinterest") &&
    operationsRepository
  ) {
    const token = () =>
      integrations!.accessToken(env.DEFAULT_WORKSPACE_ID!, "pinterest");
    pinterestPilot = new PinterestPilotService(
      operationsRepository,
      integrations,
      new PinterestBoardProvider(http, token),
      new PinterestPinProvider(
        http,
        token,
        () =>
          flags.ENABLE_PINTEREST_PILOT &&
          flags.ENABLE_REAL_PINTEREST_PUBLISHING,
      ),
      () => ({
        pilot: flags.ENABLE_PINTEREST_PILOT,
        publishing: flags.ENABLE_REAL_PINTEREST_PUBLISHING,
      }),
    );
  }
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
  if (
    flags.ENABLE_META_PILOT &&
    registry.has("facebook") &&
    operationsRepository
  ) {
    const pageRepository = new PrismaMetaPageRepository(
      prisma,
      new TokenCipher(
        encryptionKeySchema.parse(env.INTEGRATION_ENCRYPTION_KEY),
      ),
    );
    const pageProvider = new FacebookPageProvider(
      env.META_GRAPH_API_VERSION!,
      http,
      () => integrations!.accessToken(env.DEFAULT_WORKSPACE_ID!, "facebook"),
    );
    facebookPilot = new FacebookPilotService(
      Object.assign(operationsRepository, {
        selected: (w: string) => pageRepository.selected(w),
        select: (
          w: string,
          a: string,
          p: Parameters<typeof pageRepository.select>[2],
        ) => pageRepository.select(w, a, p),
        audit: (w: string, a: string, r: string, m?: Record<string, unknown>) =>
          pageRepository.audit(w, a, r, m),
      }),
      integrations,
      pageProvider,
      new FacebookPublishingProvider(
        env.META_GRAPH_API_VERSION!,
        http,
        () => pageRepository.pageToken(env.DEFAULT_WORKSPACE_ID!),
        () => flags.ENABLE_META_PILOT && flags.ENABLE_REAL_FACEBOOK_PUBLISHING,
      ),
      () => ({
        pilot: flags.ENABLE_META_PILOT,
        publishing: flags.ENABLE_REAL_FACEBOOK_PUBLISHING,
      }),
    );
  }
  if (
    mercadoLivreEnabled &&
    env.MERCADOLIVRE_CLIENT_ID &&
    env.MERCADOLIVRE_CLIENT_SECRET
  ) {
    const productProvider = new MercadoLivreProductProvider(http, () =>
      integrations!.accessToken(env.DEFAULT_WORKSPACE_ID!, "mercadolivre"),
    );
    const researchService = new ProductResearchService(
      productProvider,
      new PrismaResearchRepository(prisma),
    );
    const officialDiscovery = new ProductDiscoveryService(
      new MercadoLivreDiscoverySource(http, () =>
        integrations!.accessToken(env.DEFAULT_WORKSPACE_ID!, "mercadolivre"),
      ),
      researchService,
    );
    productDiscovery = new ProductDiscoveryRoutingService(
      publicWebDiscovery!,
      officialDiscovery,
    );
    registerProductResearchTools(
      tools,
      researchService,
      env.DEFAULT_WORKSPACE_ID,
    );
  }
}
startupMemory("BOOT 3 integrations");
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
if (analytics && env.DEFAULT_WORKSPACE_ID)
  registerAnalyticsTools(tools, analytics, env.DEFAULT_WORKSPACE_ID);
let aiChat: AIChatService | undefined;
if (env.OPENAI_API_KEY && env.DEFAULT_WORKSPACE_ID) {
  const [
    { AIChatService },
    { createCasaPraticaAgentSystem, OpenAIManagerRunner },
    { loadAgentPrompts },
  ] = await Promise.all([
    import("@casapratica/agents/chat-service"),
    import("@casapratica/agents/agent-system"),
    import("@casapratica/agents/load-prompts"),
  ]);
  const system = createCasaPraticaAgentSystem(await loadAgentPrompts(), tools);
  aiChat = new AIChatService(
    new PrismaConversationSessionRepository(prisma),
    new PrismaTraceRepository(prisma, env.DEFAULT_WORKSPACE_ID),
    new OpenAIManagerRunner(system.manager),
    env.DEFAULT_WORKSPACE_ID,
  );
}
startupMemory("BOOT 4 services");
const app = buildApp({
  webOrigin: env.WEB_ORIGIN,
  ...(env.OAUTH_PUBLIC_HOST ? { publicOAuthHost: env.OAUTH_PUBLIC_HOST } : {}),
  mercadoLivreEnabled,
  ...(productImport ? { productImport } : {}),
  ...(pinterestPilot ? { pinterestPilot } : {}),
  ...(facebookPilot ? { facebookPilot } : {}),
  ...(env.META_CLIENT_SECRET && integrationRepository
    ? {
        metaCompliance: {
          handle: async (signedRequest: string) => {
            const [encodedSignature, payloadPart] = signedRequest.split(".");
            if (!encodedSignature || !payloadPart)
              throw new Error("invalid_signed_request");
            const decode = (value: string) =>
                Buffer.from(
                  value.replace(/-/g, "+").replace(/_/g, "/"),
                  "base64",
                ),
              actual = decode(encodedSignature),
              expected = createHmac("sha256", env.META_CLIENT_SECRET!)
                .update(payloadPart)
                .digest();
            if (
              actual.length !== expected.length ||
              !timingSafeEqual(actual, expected)
            )
              throw new Error("invalid_signed_request");
            const payload = JSON.parse(
              decode(payloadPart).toString("utf8"),
            ) as { algorithm?: string; user_id?: string };
            if (
              payload.algorithm?.toUpperCase() !== "HMAC-SHA256" ||
              !payload.user_id
            )
              throw new Error("invalid_signed_request");
            await integrationRepository!.disconnectByExternalIdentity(
              "facebook",
              payload.user_id,
            );
            return {
              confirmationCode: createHmac("sha256", env.META_CLIENT_SECRET!)
                .update(`deletion:${payload.user_id}`)
                .digest("hex")
                .slice(0, 32),
            };
          },
        },
      }
    : {}),
  ...(aiChat ? { aiChat } : {}),
  ...(integrations ? { integrations } : {}),
  ...(content ? { content } : {}),
  ...(pinterest ? { pinterest } : {}),
  ...(facebook ? { facebook } : {}),
  ...(creative ? { creative } : {}),
  ...(operations ? { operations } : {}),
  ...(analytics ? { analytics } : {}),
  ...(dashboard ? { dashboard } : {}),
  ...(productReview ? { productReview } : {}),
  ...(assistedPublication ? { assistedPublication } : {}),
  ...(productDiscovery ? { productDiscovery } : {}),
  settingsOverview: {
    overview: async () => {
      const readiness = await getReadiness();
      const accounts =
        integrations && env.DEFAULT_WORKSPACE_ID
          ? await integrations.list(env.DEFAULT_WORKSPACE_ID)
          : [];
      const byProvider = new Map(
        accounts.map((account) => [account.provider, account]),
      );
      const configured = {
        pinterest: Boolean(
          env.PINTEREST_CLIENT_ID && env.PINTEREST_CLIENT_SECRET,
        ),
        facebook: Boolean(
          env.META_CLIENT_ID &&
          env.META_CLIENT_SECRET &&
          env.META_GRAPH_API_VERSION,
        ),
        mercadolivre: Boolean(
          env.MERCADOLIVRE_CLIENT_ID && env.MERCADOLIVRE_CLIENT_SECRET,
        ),
      };
      const integration = (
        provider: "pinterest" | "facebook" | "mercadolivre",
      ) => {
        const account = byProvider.get(provider);
        return {
          provider,
          configured: configured[provider],
          connected: account?.status === "connected",
          status:
            (provider === "pinterest" && !flags.ENABLE_PINTEREST_PILOT) ||
            (provider === "facebook" && !flags.ENABLE_META_PILOT)
              ? "pilot_disabled"
              : (account?.status ??
                (configured[provider] ? "disconnected" : "not_configured")),
          capabilities: account?.capabilities ?? {},
          scopes: account?.scopes ?? [],
          lastError:
            account?.status === "error"
              ? "Falha de conexão. Reconecte a integração."
              : null,
          action: configured[provider] ? "/integrations" : null,
        };
      };
      const alerts =
        operations && env.DEFAULT_WORKSPACE_ID
          ? await operations.alerts(env.DEFAULT_WORKSPACE_ID)
          : [];
      return {
        mode: env.NODE_ENV === "development" ? "LOCAL" : env.INTEGRATION_MODE,
        readiness,
        system: {
          api: "available",
          postgresql: readiness.database,
          redis: readiness.redis,
          worker: readiness.worker,
          queue:
            readiness.redis === "available" ? "available" : readiness.redis,
          creativeStudio: creative ? "available" : "not_configured",
          analytics: analytics ? "available" : "not_configured",
        },
        integrations: [
          integration("pinterest"),
          integration("facebook"),
          integration("mercadolivre"),
        ],
        publicSite: env.PUBLIC_SITE_URL
          ? {
              url: env.PUBLIC_SITE_URL,
              privacy: new URL("/privacidade", env.PUBLIC_SITE_URL).toString(),
              terms: new URL("/termos", env.PUBLIC_SITE_URL).toString(),
            }
          : null,
        contactEmail: env.NEXT_PUBLIC_CONTACT_EMAIL ?? null,
        flags: {
          pinterestPilot: flags.ENABLE_PINTEREST_PILOT,
          metaPilot: flags.ENABLE_META_PILOT,
          pinterestRealPublishing: flags.ENABLE_REAL_PINTEREST_PUBLISHING,
          facebookRealPublishing: flags.ENABLE_REAL_FACEBOOK_PUBLISHING,
          autopilot: flags.ENABLE_AUTOPILOT,
          realMetricsImport: flags.ENABLE_REAL_METRICS_IMPORT,
          testPublishingProvider: canUseTestPublishingProvider(process.env),
        },
        alerts,
      };
    },
  },
  readiness: async () => {
    return getReadiness();
  },
  ...(env.DEFAULT_WORKSPACE_ID
    ? { workspaceId: env.DEFAULT_WORKSPACE_ID }
    : {}),
});
startupMemory("BOOT 5 routes");
async function getReadiness() {
  let database = "unavailable",
    redis = "not_configured",
    worker = "not_configured";
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "available";
  } catch {
    database = "unavailable";
  }
  if (env.REDIS_URL) {
    const connection = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
    });
    try {
      await connection.connect();
      redis =
        (await connection.ping()) === "PONG" ? "available" : "unavailable";
      const queue = new Queue("casapratica", { connection });
      worker = (await queue.getWorkers()).length ? "available" : "degraded";
      await queue.close();
    } catch {
      redis = "unavailable";
      worker = "unavailable";
    } finally {
      connection.disconnect();
    }
  }
  const status: "ready" | "degraded" | "not_ready" =
    database !== "available" || redis === "unavailable"
      ? "not_ready"
      : worker === "degraded"
        ? "degraded"
        : "ready";
  return {
    status,
    database,
    redis,
    worker,
    integrations: {
      mercadolivre: "optional",
      pinterest: await pinterestReadiness(
        flags.ENABLE_PINTEREST_PILOT,
        integrations,
        env.DEFAULT_WORKSPACE_ID,
      ),
      meta: !flags.ENABLE_META_PILOT
        ? "pilot_disabled"
        : ((await integrations?.status(env.DEFAULT_WORKSPACE_ID!, "facebook"))
            ?.status ?? "not_configured"),
    },
    externalPublishing: (flags.ENABLE_REAL_PINTEREST_PUBLISHING ||
    flags.ENABLE_REAL_FACEBOOK_PUBLISHING
      ? "enabled"
      : "disabled") as "enabled" | "disabled",
  };
}
try {
  await app.listen({
    host: flags.ENABLE_PINTEREST_PILOT ? "127.0.0.1" : env.API_HOST,
    port: env.API_PORT,
  });
  startupMemory("BOOT READY");
} catch (error) {
  app.log.error({ err: error }, "API failed to start");
  throw error;
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
