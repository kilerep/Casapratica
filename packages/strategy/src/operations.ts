import { createHash } from "node:crypto";
import {
  assertPublicationTransition,
  dailyOperationsPlanSchema,
  type CreativeRequest,
  type DailyOperationsPlan,
  type OperationalAlert,
  type OperationalAlertType,
  type PublicationStatus,
} from "@casapratica/domain";

export interface QueueItem {
  id: string;
  workspaceId: string;
  productId: string | null;
  productStatus: string | null;
  contentId: string;
  creativeAssetId: string | null;
  channel: "pinterest" | "facebook";
  status: PublicationStatus;
  scheduledFor: Date | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  attempts: number;
  integrationAccountId: string | null;
  capabilityAvailable: boolean;
  integrationConnected: boolean;
  priceDisplayed: boolean;
  priceFresh: boolean;
  creativeValid: boolean;
  affiliateUrl: string | null;
  destinationId: string | null;
  body: string;
  metadata: Readonly<Record<string, unknown>>;
}
export interface PublishResult {
  externalId: string;
  externalUrl: string | null;
  publishedAt: Date;
  metadata: Readonly<Record<string, unknown>>;
  commentAction?: "PUBLISHED" | "MANUAL_REQUIRED";
}
export interface PublicationProvider {
  publish(item: QueueItem, idempotencyKey: string): Promise<PublishResult>;
  reconcile(
    item: QueueItem,
    idempotencyKey: string,
  ): Promise<PublishResult | null>;
}
export interface OperationsProduct {
  id: string;
  channels: readonly QueueItem["channel"][];
}
export interface ContentPreparation {
  generateProduct(input: {
    workspaceId: string;
    productId: string;
    platforms: readonly QueueItem["channel"][];
    variants: number;
  }): Promise<{ id: string }>;
}
export interface CreativePreparation {
  request(
    workspaceId: string,
    productId: string,
    input: {
      contentId: string;
      platform: QueueItem["channel"];
      format: "PINTEREST_2_3" | "FACEBOOK_4_5";
      template: "PHOTO_FIRST";
      variantCount: number;
    },
  ): Promise<CreativeRequest>;
  render(request: CreativeRequest): Promise<{ status: string }>;
}
export interface SchedulerResult {
  status: "enqueued" | "scheduler_unavailable" | "already_enqueued";
  jobId: string | null;
  scheduledFor: Date;
}
export interface PublicationScheduler {
  schedule(input: {
    workspaceId: string;
    publicationQueueItemId: string;
    scheduledFor: Date;
  }): Promise<SchedulerResult>;
}
export class UnavailablePublicationScheduler implements PublicationScheduler {
  async schedule(input: { scheduledFor: Date }): Promise<SchedulerResult> {
    return {
      status: "scheduler_unavailable",
      jobId: null,
      scheduledFor: input.scheduledFor,
    };
  }
}
export interface OperationsRepository {
  listEligibleCandidates(
    workspaceId: string,
    date: Date,
  ): Promise<readonly QueueItem[]>;
  listEligibleProducts(
    workspaceId: string,
  ): Promise<readonly OperationsProduct[]>;
  findContentId(
    workspaceId: string,
    productId: string,
    channel: QueueItem["channel"],
  ): Promise<string | null>;
  findCreativeAssetId(
    workspaceId: string,
    contentId: string,
  ): Promise<string | null>;
  ensureQueueItem(
    workspaceId: string,
    productId: string,
    contentId: string,
    creativeAssetId: string,
    channel: QueueItem["channel"],
  ): Promise<QueueItem>;
  listScheduledItems(workspaceId: string): Promise<readonly QueueItem[]>;
  createDailyPlan(
    workspaceId: string,
    plan: DailyOperationsPlan,
  ): Promise<DailyOperationsPlan>;
  listQueue(workspaceId: string): Promise<readonly QueueItem[]>;
  getQueueItem(workspaceId: string, id: string): Promise<QueueItem | null>;
  updateQueueItem(
    workspaceId: string,
    id: string,
    input: {
      status: PublicationStatus;
      actorId?: string;
      scheduledFor?: Date | null;
      attempts?: number;
      lastError?: string | null;
    },
  ): Promise<QueueItem>;
  findPublicationByKey(
    workspaceId: string,
    key: string,
  ): Promise<PublishResult | null>;
  savePublication(
    workspaceId: string,
    item: QueueItem,
    key: string,
    result: PublishResult,
  ): Promise<void>;
  appendAudit(
    workspaceId: string,
    action: string,
    resourceId: string,
    actorId: string | null,
    metadata?: Readonly<Record<string, unknown>>,
  ): Promise<void>;
  createAlert(
    workspaceId: string,
    type: OperationalAlertType,
    message: string,
    provider?: string | null,
    accountId?: string | null,
  ): Promise<void>;
  listAlerts(workspaceId: string): Promise<readonly OperationalAlert[]>;
  consecutiveFailures(workspaceId: string, accountId: string): Promise<number>;
  circuitState(
    workspaceId: string,
    accountId: string,
  ): Promise<"CLOSED" | "OPEN" | "HALF_OPEN">;
  setCircuitState(
    workspaceId: string,
    accountId: string,
    state: "CLOSED" | "OPEN" | "HALF_OPEN",
  ): Promise<void>;
}
const validate = (item: QueueItem, requireApproval = true) => {
  if (
    requireApproval &&
    !["approved", "scheduled", "failed", "publishing"].includes(item.status)
  )
    throw new Error("approval_required");
  if (
    item.productId !== null &&
    (!item.productStatus ||
      !["approved", "active", "test"].includes(item.productStatus))
  )
    throw new Error("product_not_approved");
  if (!item.creativeAssetId || !item.creativeValid)
    throw new Error("creative_invalid");
  if (item.priceDisplayed && !item.priceFresh) throw new Error("price_stale");
  if (!item.integrationConnected) throw new Error("integration_disconnected");
  if (!item.capabilityAvailable) throw new Error("capability_missing");
  if (!item.destinationId) throw new Error("destination_missing");
};

export class DailyOperationsService {
  constructor(
    private readonly repository: OperationsRepository,
    private readonly content?: ContentPreparation,
    private readonly creative?: CreativePreparation,
  ) {}
  async runDailyOperations(
    workspaceId: string,
    date = new Date(),
  ): Promise<DailyOperationsPlan> {
    const warnings: string[] = [];
    let prepared = 0,
      blocked = 0,
      skipped = 0;
    if (this.content && this.creative)
      for (const product of await this.repository.listEligibleProducts(
        workspaceId,
      ))
        for (const channel of product.channels) {
          try {
            let contentId = await this.repository.findContentId(
              workspaceId,
              product.id,
              channel,
            );
            if (!contentId)
              contentId = (
                await this.content.generateProduct({
                  workspaceId,
                  productId: product.id,
                  platforms: [channel],
                  variants: 1,
                })
              ).id;
            let creativeAssetId = await this.repository.findCreativeAssetId(
              workspaceId,
              contentId,
            );
            if (!creativeAssetId) {
              const request = await this.creative.request(
                workspaceId,
                product.id,
                {
                  contentId,
                  platform: channel,
                  format:
                    channel === "pinterest" ? "PINTEREST_2_3" : "FACEBOOK_4_5",
                  template: "PHOTO_FIRST",
                  variantCount: 1,
                },
              );
          const output = await this.creative.render(request);
              if (output.status !== "READY")
                throw new Error(`creative_${output.status.toLowerCase()}`);
              creativeAssetId = await this.repository.findCreativeAssetId(
                workspaceId,
                contentId,
              );
            }
            if (!creativeAssetId) throw new Error("creative_not_persisted");
            const before = await this.repository.listEligibleCandidates(
              workspaceId,
              date,
            );
            const existed = before.some(
              (item) =>
                item.productId === product.id &&
                item.channel === channel &&
                item.contentId === contentId,
            );
            await this.repository.ensureQueueItem(
              workspaceId,
              product.id,
              contentId,
              creativeAssetId,
              channel,
            );
            existed ? skipped++ : prepared++;
          } catch (error) {
            blocked++;
            const reason =
              error instanceof Error ? error.message : "preparation_failed";
            warnings.push(`${product.id}/${channel}: ${reason}`);
            await this.repository.appendAudit(
              workspaceId,
              "operations.preparation_blocked",
              product.id,
              null,
              { channel, reason },
            );
          }
        }
    const candidates = await this.repository.listEligibleCandidates(
        workspaceId,
        date,
      ),
      unique = new Map(
        candidates.map((item) => [`${item.channel}:${item.contentId}`, item]),
      );
    const eligible = [...unique.values()].filter(
      (item) =>
        item.productId === null ||
        ["approved", "active", "test"].includes(item.productStatus ?? ""),
    );
    skipped += candidates.length - unique.size + unique.size - eligible.length;
    const pinterest = eligible
        .filter((item) => item.channel === "pinterest" && item.creativeAssetId)
        .slice(0, 10),
      facebook = eligible
        .filter((item) => item.channel === "facebook" && item.creativeAssetId)
        .slice(0, 20);
    const map = (item: QueueItem) => ({
      platform: item.channel,
      productId: item.productId,
      contentId: item.contentId,
      creativeAssetId: item.creativeAssetId!,
      scheduledAt: item.scheduledFor,
      status: item.status,
      approvalStatus: "READY_FOR_REVIEW" as const,
      publicationQueueItemId: item.id,
      notes: [],
    });
    const plan = dailyOperationsPlanSchema.parse({
      date,
      goals: { confirmBeforePublish: true },
      pinterestItems: pinterest.filter((x) => x.productId).map(map),
      facebookItems: facebook.filter((x) => x.productId).map(map),
      utilityItems: [...pinterest, ...facebook]
        .filter((x) => !x.productId)
        .map(map),
      totalItems: pinterest.length + facebook.length,
      summary: {
        prepared,
        blocked,
        skipped,
        needsReview: pinterest.length + facebook.length,
      },
      warnings,
      approvalsRequired: true,
      reasoning:
        "Content Engine e Creative Studio preparam somente produtos revisados; todos os itens aguardam revisão humana e nenhuma publicação foi executada.",
    });
    return this.repository.createDailyPlan(workspaceId, plan);
  }
}

export class ApprovalService {
  constructor(
    private readonly repository: OperationsRepository,
    private readonly scheduler: PublicationScheduler = new UnavailablePublicationScheduler(),
  ) {}
  async approve(workspaceId: string, id: string, actorId: string) {
    const item = await this.required(workspaceId, id);
    assertPublicationTransition(item.status, "approved");
    validate({ ...item, status: "approved" }, false);
    const saved = await this.repository.updateQueueItem(workspaceId, id, {
      status: "approved",
      actorId,
    });
    await this.repository.appendAudit(
      workspaceId,
      "publication.approved",
      id,
      actorId,
    );
    return saved;
  }
  async reject(
    workspaceId: string,
    id: string,
    actorId: string,
    reason: string,
  ) {
    const item = await this.required(workspaceId, id);
    assertPublicationTransition(item.status, "rejected");
    const saved = await this.repository.updateQueueItem(workspaceId, id, {
      status: "rejected",
      actorId,
      lastError: reason,
    });
    await this.repository.appendAudit(
      workspaceId,
      "publication.rejected",
      id,
      actorId,
      { reason },
    );
    return saved;
  }
  async approveBatch(
    workspaceId: string,
    ids: readonly string[],
    actorId: string,
  ) {
    const results = [];
    for (const id of [...new Set(ids)])
      results.push(await this.approve(workspaceId, id, actorId));
    return results;
  }
  async schedule(
    workspaceId: string,
    id: string,
    actorId: string,
    scheduledFor: Date,
  ) {
    const item = await this.required(workspaceId, id);
    if (scheduledFor <= new Date()) throw new Error("schedule_must_be_future");
    assertPublicationTransition(item.status, "scheduled");
    const saved = await this.repository.updateQueueItem(workspaceId, id, {
      status: "scheduled",
      actorId,
      scheduledFor,
    });
    const scheduler = await this.scheduler.schedule({
      workspaceId,
      publicationQueueItemId: id,
      scheduledFor,
    });
    await this.repository.appendAudit(
      workspaceId,
      "publication.scheduled",
      id,
      actorId,
      {
        scheduledFor: scheduledFor.toISOString(),
        schedulerStatus: scheduler.status,
        jobId: scheduler.jobId,
      },
    );
    return { item: saved, scheduler };
  }
  async reconcileScheduled(workspaceId: string) {
    const results: SchedulerResult[] = [];
    for (const item of await this.repository.listScheduledItems(workspaceId))
      if (item.scheduledFor)
        results.push(
          await this.scheduler.schedule({
            workspaceId,
            publicationQueueItemId: item.id,
            scheduledFor: item.scheduledFor,
          }),
        );
    return results;
  }
  async cancel(workspaceId: string, id: string, actorId: string) {
    const item = await this.required(workspaceId, id);
    assertPublicationTransition(item.status, "cancelled");
    const saved = await this.repository.updateQueueItem(workspaceId, id, {
      status: "cancelled",
      actorId,
    });
    await this.repository.appendAudit(
      workspaceId,
      "publication.cancelled",
      id,
      actorId,
    );
    return saved;
  }
  private async required(workspaceId: string, id: string) {
    const item = await this.repository.getQueueItem(workspaceId, id);
    if (!item) throw new Error("publication_item_not_found");
    return item;
  }
}

export class PublishingService {
  constructor(
    private readonly repository: OperationsRepository,
    private readonly providers: Readonly<
      Partial<Record<QueueItem["channel"], PublicationProvider>>
    >,
  ) {}
  async publishNow(
    workspaceId: string,
    id: string,
    actorId: string,
  ): Promise<PublishResult> {
    const item = await this.repository.getQueueItem(workspaceId, id);
    if (!item) throw new Error("publication_item_not_found");
    validate(item);
    const accountId = item.integrationAccountId!;
    if ((await this.repository.circuitState(workspaceId, accountId)) === "OPEN")
      throw new Error("circuit_open");
    const provider = this.providers[item.channel];
    if (!provider) throw new Error("blocked_by_integration");
    const key = createHash("sha256")
      .update(`${workspaceId}:${id}:${item.contentId}:${item.creativeAssetId}`)
      .digest("hex");
    const existing = await this.repository.findPublicationByKey(
      workspaceId,
      key,
    );
    if (existing) return existing;
    if (item.status === "publishing") {
      const reconciled = await provider.reconcile(item, key);
      if (reconciled) return reconciled;
      throw new Error("reconciliation_required");
    }
    await this.repository.updateQueueItem(workspaceId, id, {
      status: "publishing",
      attempts: item.attempts + 1,
    });
    await this.repository.appendAudit(
      workspaceId,
      "publication.attempted",
      id,
      actorId,
      { idempotencyKey: key },
    );
    try {
      const result = await provider.publish(item, key);
      await this.repository.savePublication(workspaceId, item, key, result);
      await this.repository.updateQueueItem(workspaceId, id, {
        status: "published",
        lastError: null,
      });
      await this.repository.setCircuitState(workspaceId, accountId, "CLOSED");
      await this.repository.appendAudit(
        workspaceId,
        "publication.succeeded",
        id,
        actorId,
        { externalId: result.externalId },
      );
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "publishing_failed";
      await this.repository.updateQueueItem(workspaceId, id, {
        status: "failed",
        attempts: item.attempts + 1,
        lastError: message,
      });
      const failures = await this.repository.consecutiveFailures(
        workspaceId,
        accountId,
      );
      if (failures >= 3) {
        await this.repository.setCircuitState(workspaceId, accountId, "OPEN");
        await this.repository.createAlert(
          workspaceId,
          "CIRCUIT_OPEN",
          "Circuito aberto após três falhas consecutivas.",
          item.channel,
          accountId,
        );
      } else
        await this.repository.createAlert(
          workspaceId,
          "PUBLISHING_FAILURE",
          message,
          item.channel,
          accountId,
        );
      await this.repository.appendAudit(
        workspaceId,
        "publication.failed",
        id,
        actorId,
        { errorCode: message, attempt: item.attempts + 1 },
      );
      throw error;
    }
  }
  retry(workspaceId: string, id: string, actorId: string) {
    return this.publishNow(workspaceId, id, actorId);
  }
}
