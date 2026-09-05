import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  DailyOperationsPlan,
  OperationalAlert,
  OperationalAlertType,
  PublicationStatus,
} from "@casapratica/domain";
import type {
  OperationsRepository,
  PublishResult,
  QueueItem,
} from "@casapratica/strategy";

const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const object = (
  value: Prisma.JsonValue | null | undefined,
): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const status = (value: string) => value as PublicationStatus;
export class PrismaOperationsRepository implements OperationsRepository {
  constructor(private readonly prisma: PrismaClient) {}
  private include() {
    return {
      content: { include: { product: true, variants: true } },
      creativeAsset: true,
      integrationAccount: { include: { capabilities: true } },
    } as const;
  }
  private map(
    row: Awaited<
      ReturnType<PrismaClient["publicationQueueItem"]["findFirst"]>
    > &
      Record<string, unknown>,
  ): QueueItem {
    const content = row.content as {
        product: { status: string } | null;
        variants: Array<{
          id: string;
          channel: string;
          title: string | null;
          body: string;
          metadata: Prisma.JsonValue | null;
        }>;
      },
      creative = row.creativeAsset as {
        id: string;
        status: string;
        storageKey: string;
        mimeType: string;
        metadata: Prisma.JsonValue | null;
      } | null,
      account = row.integrationAccount as {
        id: string;
        status: string;
        capabilities: Array<{ capability: string; status: string }>;
      } | null,
      variant =
        content.variants.find((v) => v.id === row.contentVariantId) ??
        content.variants.find((v) => v.channel === row.channel),
      metadata = object(variant?.metadata),
      creativeMetadata = object(creative?.metadata);
    return {
      id: String(row.id),
      workspaceId: String(row.workspaceId),
      productId: row.productId as string | null,
      productStatus: content.product?.status ?? null,
      contentId: String(row.contentId),
      creativeAssetId: creative?.id ?? null,
      channel: row.channel as "pinterest" | "facebook",
      status: status(String(row.status)),
      scheduledFor: row.scheduledFor as Date | null,
      approvedAt: row.approvedAt as Date | null,
      approvedBy: row.approvedBy as string | null,
      attempts: Number(row.attempts),
      integrationAccountId: account?.id ?? null,
      capabilityAvailable: Boolean(
        account?.capabilities.some(
          (x) =>
            x.capability ===
              (row.channel === "pinterest" ? "create_pin" : "create_post") &&
            x.status === "available",
        ),
      ),
      integrationConnected: account?.status === "connected",
      priceDisplayed: Boolean(metadata.priceDisplayRequested),
      priceFresh:
        creativeMetadata.priceUsed === null ||
        creativeMetadata.priceUsed === undefined ||
        !creativeMetadata.priceCheckedAt ||
        Date.now() -
          new Date(String(creativeMetadata.priceCheckedAt)).getTime() <=
          86_400_000,
      creativeValid: creative?.status === "ready",
      affiliateUrl:
        typeof metadata.affiliateUrl === "string"
          ? metadata.affiliateUrl
          : null,
      destinationId: row.destinationId as string | null,
      body: variant?.body ?? "",
      metadata: {
        ...metadata,
        title: variant?.title ?? null,
        creativeUrl: creative?.storageKey ?? null,
        creativeMimeType: creative?.mimeType ?? null,
      },
    };
  }
  async rows(workspaceId: string) {
    return this.prisma.publicationQueueItem.findMany({
      where: { workspaceId },
      include: this.include(),
      orderBy: { createdAt: "desc" },
    });
  }
  async listEligibleCandidates(workspaceId: string, _date: Date) {
    return (await this.rows(workspaceId))
      .filter((x) => ["draft", "awaiting_approval"].includes(x.status))
      .map((x) =>
        this.map(
          x as unknown as Awaited<
            ReturnType<PrismaClient["publicationQueueItem"]["findFirst"]>
          > &
            Record<string, unknown>,
        ),
      );
  }
  async listEligibleProducts(workspaceId: string) {
    const products = await this.prisma.product.findMany({
      where: { workspaceId, status: { in: ["approved", "active", "test"] } },
      select: { id: true },
    });
    return products.map((product) => ({
      id: product.id,
      channels: ["pinterest", "facebook"] as const,
    }));
  }
  async findContentId(
    workspaceId: string,
    productId: string,
    channel: QueueItem["channel"],
  ) {
    const value = await this.prisma.content.findFirst({
      where: {
        workspaceId,
        productId,
        status: { in: ["draft", "ready"] },
        variants: { some: { channel } },
      },
      orderBy: { createdAt: "desc" },
    });
    return value?.id ?? null;
  }
  async findCreativeAssetId(workspaceId: string, contentId: string) {
    const value = await this.prisma.creativeAsset.findFirst({
      where: {
        workspaceId,
        contentId,
        kind: "composed_creative",
        status: "ready",
      },
      orderBy: { createdAt: "desc" },
    });
    return value?.id ?? null;
  }
  async ensureQueueItem(
    workspaceId: string,
    productId: string,
    contentId: string,
    creativeAssetId: string,
    channel: QueueItem["channel"],
  ) {
    const existing = await this.prisma.publicationQueueItem.findFirst({
      where: {
        workspaceId,
        productId,
        contentId,
        channel,
        status: { in: ["draft", "awaiting_approval", "approved", "scheduled"] },
      },
      include: this.include(),
    });
    if (existing)
      return this.map(
        existing as unknown as Awaited<
          ReturnType<PrismaClient["publicationQueueItem"]["findFirst"]>
        > &
          Record<string, unknown>,
      );
    const variant = await this.prisma.contentVariant.findFirst({
      where: { contentId, channel },
      orderBy: { createdAt: "desc" },
    });
    if (!variant) throw new Error("content_variant_not_found");
    const account = await this.prisma.integrationAccount.findFirst({
      where: { workspaceId, provider: channel, status: "connected" },
      orderBy: { updatedAt: "desc" },
    });
    const created = await this.prisma.publicationQueueItem.create({
      data: {
        workspaceId,
        productId,
        contentId,
        contentVariantId: variant.id,
        creativeAssetId,
        integrationAccountId: account?.id ?? null,
        channel,
        status: "awaiting_approval",
      },
      include: this.include(),
    });
    return this.map(
      created as unknown as Awaited<
        ReturnType<PrismaClient["publicationQueueItem"]["findFirst"]>
      > &
        Record<string, unknown>,
    );
  }
  async listScheduledItems(workspaceId: string) {
    const values = await this.prisma.publicationQueueItem.findMany({
      where: { workspaceId, status: "scheduled", scheduledFor: { not: null } },
      include: this.include(),
      orderBy: { scheduledFor: "asc" },
    });
    return values.map((value) =>
      this.map(
        value as unknown as Awaited<
          ReturnType<PrismaClient["publicationQueueItem"]["findFirst"]>
        > &
          Record<string, unknown>,
      ),
    );
  }
  async createDailyPlan(workspaceId: string, plan: DailyOperationsPlan) {
    const day = new Date(plan.date);
    day.setUTCHours(0, 0, 0, 0);
    await this.prisma.dailyPlan.upsert({
      where: { workspaceId_planDate: { workspaceId, planDate: day } },
      create: {
        workspaceId,
        planDate: day,
        goals: json(plan),
        status: "draft",
      },
      update: { goals: json(plan) },
    });
    return plan;
  }
  async listQueue(workspaceId: string) {
    return (await this.rows(workspaceId)).map((x) =>
      this.map(
        x as unknown as Awaited<
          ReturnType<PrismaClient["publicationQueueItem"]["findFirst"]>
        > &
          Record<string, unknown>,
      ),
    );
  }
  async getQueueItem(workspaceId: string, id: string) {
    const row = await this.prisma.publicationQueueItem.findFirst({
      where: { id, workspaceId },
      include: this.include(),
    });
    return row
      ? this.map(
          row as unknown as Awaited<
            ReturnType<PrismaClient["publicationQueueItem"]["findFirst"]>
          > &
            Record<string, unknown>,
        )
      : null;
  }
  async updateQueueItem(
    workspaceId: string,
    id: string,
    input: {
      status: PublicationStatus;
      actorId?: string;
      scheduledFor?: Date | null;
      attempts?: number;
      lastError?: string | null;
    },
  ) {
    await this.prisma.publicationQueueItem.updateMany({
      where: { id, workspaceId },
      data: {
        status: input.status,
        ...(input.actorId
          ? {
              approvedBy: input.actorId,
              ...(input.status === "approved"
                ? { approvedAt: new Date() }
                : {}),
            }
          : {}),
        ...(input.scheduledFor !== undefined
          ? { scheduledFor: input.scheduledFor }
          : {}),
        ...(input.attempts !== undefined ? { attempts: input.attempts } : {}),
        ...(input.lastError !== undefined
          ? { lastError: input.lastError }
          : {}),
      },
    });
    return (await this.getQueueItem(workspaceId, id))!;
  }
  async findPublicationByKey(workspaceId: string, key: string) {
    const row = await this.prisma.publication.findFirst({
      where: { workspaceId, idempotencyKey: key, status: "published" },
    });
    return row?.externalId && row.publishedAt
      ? {
          externalId: row.externalId,
          externalUrl: row.externalUrl,
          publishedAt: row.publishedAt,
          metadata: object(row.providerResponse),
        }
      : null;
  }
  async selectPinterestBoard(
    workspaceId: string,
    id: string,
    boardId: string,
    accountId: string,
  ) {
    const result = await this.prisma.publicationQueueItem.updateMany({
      where: {
        workspaceId,
        id,
        channel: "pinterest",
        status: { in: ["draft", "awaiting_approval", "approved"] },
        attempts: 0,
      },
      data: {
        destinationId: boardId,
        integrationAccountId: accountId,
        status: "awaiting_approval",
        approvedAt: null,
        approvedBy: null,
      },
    });
    if (result.count !== 1) throw new Error("board_change_blocked");
    await this.appendAudit(workspaceId, "pinterest.board_selected", id, null, {
      boardId,
      accountId,
    });
  }
  async reservePinterestPublication(
    workspaceId: string,
    item: QueueItem,
    key: string,
  ) {
    try {
      await this.prisma.publication.create({
        data: {
          workspaceId,
          queueItemId: item.id,
          productId: item.productId,
          contentId: item.contentId,
          creativeAssetId: item.creativeAssetId,
          integrationAccountId: item.integrationAccountId,
          channel: "pinterest",
          status: "publishing",
          idempotencyKey: key,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new Error("reconciliation_required");
      throw error;
    }
  }
  async reserveFacebookPublication(workspaceId:string,item:QueueItem,key:string){try{await this.prisma.publication.create({data:{workspaceId,queueItemId:item.id,productId:item.productId,contentId:item.contentId,creativeAssetId:item.creativeAssetId,integrationAccountId:item.integrationAccountId,channel:"facebook",status:"publishing",idempotencyKey:key}})}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002")throw new Error("reconciliation_required");throw error}}
  async savePublication(
    workspaceId: string,
    item: QueueItem,
    key: string,
    result: PublishResult,
  ) {
    await this.prisma.publication.upsert({
      where: { idempotencyKey: key },
      create: {
        workspaceId,
        queueItemId: item.id,
        productId: item.productId,
        contentId: item.contentId,
        creativeAssetId: item.creativeAssetId,
        integrationAccountId: item.integrationAccountId,
        channel: item.channel,
        status: "published",
        externalId: result.externalId,
        externalUrl: result.externalUrl,
        publishedAt: result.publishedAt,
        idempotencyKey: key,
        providerResponse: json(result.metadata),
      },
      update: {
        status: "published",
        externalId: result.externalId,
        externalUrl: result.externalUrl,
        publishedAt: result.publishedAt,
        providerResponse: json(result.metadata),
        errorCode: null,
        errorMessage: null,
      },
    });
  }
  async appendAudit(
    workspaceId: string,
    action: string,
    resourceId: string,
    actorId: string | null,
    metadata: Readonly<Record<string, unknown>> = {},
  ) {
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        actorType: actorId ? "user" : "system",
        actorId,
        action,
        resourceType: "PublicationQueueItem",
        resourceId,
        metadata: json(metadata),
      },
    });
  }
  async createAlert(
    workspaceId: string,
    type: OperationalAlertType,
    message: string,
    provider: string | null = null,
    accountId: string | null = null,
  ) {
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        actorType: "system",
        action: "operational.alert",
        resourceType: "OperationalAlert",
        metadata: json({ type, message, provider, accountId }),
      },
    });
  }
  async listAlerts(workspaceId: string): Promise<readonly OperationalAlert[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { workspaceId, action: "operational.alert" },
      orderBy: { occurredAt: "desc" },
    });
    return rows.map((row) => {
      const data = object(row.metadata);
      return {
        id: row.id,
        type: data.type as OperationalAlertType,
        message: String(data.message),
        provider: typeof data.provider === "string" ? data.provider : null,
        accountId: typeof data.accountId === "string" ? data.accountId : null,
        createdAt: row.occurredAt,
      };
    });
  }
  async consecutiveFailures(workspaceId: string, accountId: string) {
    const row = await this.prisma.publicationQueueItem.findFirst({
      where: { workspaceId, integrationAccountId: accountId },
      orderBy: { updatedAt: "desc" },
    });
    return row?.attempts ?? 0;
  }
  async circuitState(_workspaceId: string, accountId: string) {
    const row = await this.prisma.integrationCapability.findUnique({
      where: {
        integrationAccountId_capability: {
          integrationAccountId: accountId,
          capability: "publishing_circuit",
        },
      },
    });
    const state = object(row?.details).state;
    return state === "OPEN" || state === "HALF_OPEN" ? state : "CLOSED";
  }
  async setCircuitState(
    _workspaceId: string,
    accountId: string,
    state: "CLOSED" | "OPEN" | "HALF_OPEN",
  ) {
    await this.prisma.integrationCapability.upsert({
      where: {
        integrationAccountId_capability: {
          integrationAccountId: accountId,
          capability: "publishing_circuit",
        },
      },
      create: {
        integrationAccountId: accountId,
        capability: "publishing_circuit",
        status: state === "CLOSED" ? "available" : "unavailable",
        checkedAt: new Date(),
        details: { state },
      },
      update: {
        status: state === "CLOSED" ? "available" : "unavailable",
        checkedAt: new Date(),
        details: { state },
      },
    });
  }
}
