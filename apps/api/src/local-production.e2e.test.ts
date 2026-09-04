import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, PrismaAnalyticsRepository, PrismaContentRepository, PrismaCreativeStudioRepository, PrismaOperationsRepository } from "@casapratica/database";
import { SharpImageCompositionProvider } from "@casapratica/integrations";
import { ApprovalService, ContentEngine, CreativeStudioService, DailyOperationsService, PerformanceIntelligenceService, PublishingService, TestPublishingProvider } from "../../../packages/strategy/src/index.js";
import { BullMqPublicationScheduler } from "./publication-scheduler.js";
import { processScheduledPublication } from "../../worker/src/publication-job.js";

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
const enabled = Boolean(databaseUrl && redisUrl && process.env.ENABLE_TEST_PUBLISHING_PROVIDER === "true");
const run = enabled ? describe : describe.skip;

run("local production path", () => {
  const prisma = createPrismaClient();
  const token = randomUUID();
  const slug = `e2e-${token}`;
  const outputRoot = resolve("var/e2e-creative-assets", token);
  let workspaceId = "";

  beforeAll(async () => {
    workspaceId = (await prisma.workspace.create({ data: { name: "E2E local", slug } })).id;
  });

  afterAll(async () => {
    if (workspaceId) await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.$disconnect();
    await rm(outputRoot, { recursive: true, force: true });
  });

  it("runs Content Engine -> Sharp -> approval -> BullMQ worker -> fake provider -> analytics exactly once", async () => {
    const now = new Date();
    const product = await prisma.product.create({ data: { workspaceId, marketplace: "fixture", externalId: token, name: "Organizador E2E", description: "Organizador com quatro compartimentos", canonicalUrl: "http://localhost.invalid/product", affiliateUrl: "http://localhost.invalid/affiliate", price: 59.9, currency: "BRL", status: "test", firstSeenAt: now, lastCheckedAt: now } });
    const content = await new ContentEngine(new PrismaContentRepository(prisma)).generateProduct({ workspaceId, productId: product.id, platforms: ["pinterest"], variants: 1 });
    await prisma.creativeAsset.create({ data: { workspaceId, contentId: content.id, kind: "product_source", storageKey: resolve("packages/integrations/src/image/fixtures/product.svg"), mimeType: "image/svg+xml", width: 1200, height: 1800, status: "ready", metadata: { sourceProvider: "fixture", assetSource: "MARKETPLACE_PRODUCT_IMAGE", usageStatus: "UNKNOWN", productVisible: true, focusScore: 0.9, lightingScore: 0.9, visualNoiseScore: 0.1, overlaySpaceScore: 0.8 } } });
    await prisma.integrationAccount.create({ data: { workspaceId, provider: "pinterest", externalAccountId: `fake-${token}`, status: "connected", scopes: ["pins:write"], capabilities: { create: { capability: "create_pin", status: "available", checkedAt: now } } } });
    const operations = new PrismaOperationsRepository(prisma);
    const creative = new CreativeStudioService(new PrismaCreativeStudioRepository(prisma), new SharpImageCompositionProvider(outputRoot));
    const plan = await new DailyOperationsService(operations, new ContentEngine(new PrismaContentRepository(prisma)), creative).runDailyOperations(workspaceId, now);
    const queueItemId = plan.pinterestItems[0]?.publicationQueueItemId;
    expect(queueItemId).toBeTruthy();
    await prisma.publicationQueueItem.update({ where: { id: queueItemId! }, data: { destinationId: "fake-board" } });

    const scheduler = new BullMqPublicationScheduler(redisUrl!);
    const approval = new ApprovalService(operations, scheduler);
    await approval.approve(workspaceId, queueItemId!, "e2e-user");
    const scheduledFor = new Date(Date.now() + 750);
    expect((await approval.schedule(workspaceId, queueItemId!, "e2e-user", scheduledFor)).scheduler.status).toBe("enqueued");
    expect((await approval.reconcileScheduled(workspaceId))[0]?.status).toBe("already_enqueued");

    const redis = new Redis(redisUrl!, { maxRetriesPerRequest: null });
    const publishing = new PublishingService(operations, { pinterest: new TestPublishingProvider() });
    const worker = new Worker("casapratica", (job) => processScheduledPublication(job.data, publishing), { connection: redis });
    try {
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        if ((await prisma.publication.count({ where: { queueItemId: queueItemId! } })) === 1) break;
        await new Promise((resolveWait) => setTimeout(resolveWait, 100));
      }
      expect(await prisma.publication.count({ where: { queueItemId: queueItemId! } })).toBe(1);
      await publishing.publishNow(workspaceId, queueItemId!, "double-click");
      expect(await prisma.publication.count({ where: { queueItemId: queueItemId! } })).toBe(1);
    } finally {
      await worker.close();
      await redis.quit();
      await scheduler.close();
    }

    const publication = await prisma.publication.findUniqueOrThrow({ where: { queueItemId: queueItemId! } });
    await prisma.metricSnapshot.create({ data: { workspaceId, publicationId: publication.id, productId: product.id, source: "pinterest", observedAt: now, impressions: 1000, clicks: 50, saves: 20 } });
    await prisma.conversion.create({ data: { workspaceId, publicationId: publication.id, productId: product.id, source: "fixture", externalId: token, occurredAt: now, amount: 59.9, commission: 5.99, currency: "BRL" } });
    const analytics = await new PerformanceIntelligenceService(new PrismaAnalyticsRepository(prisma)).overview(workspaceId, { start: new Date(now.getTime() - 1000), end: new Date(now.getTime() + 1000) });
    expect(analytics.metrics.impressions).toBe(1000);
    expect(analytics.conversionRecords).toBe(1);
    expect(publication.externalId).toMatch(/^local-/);
    expect(publication.providerResponse).toMatchObject({ provider: "test", local: true });
  }, 30_000);
});



