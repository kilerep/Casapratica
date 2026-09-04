import { describe, expect, it, vi } from "vitest";
import {
  ApprovalService,
  DailyOperationsService,
  PublishingService,
  UnavailablePublicationScheduler,
  type OperationsRepository,
  type QueueItem,
} from "./operations.js";
const item = (changes: Partial<QueueItem> = {}): QueueItem => ({
  id: "q1",
  workspaceId: "w1",
  productId: "p1",
  productStatus: "approved",
  contentId: "c1",
  creativeAssetId: "a1",
  channel: "pinterest",
  status: "awaiting_approval",
  scheduledFor: null,
  approvedAt: null,
  approvedBy: null,
  attempts: 0,
  integrationAccountId: "i1",
  capabilityAvailable: true,
  integrationConnected: true,
  priceDisplayed: false,
  priceFresh: true,
  creativeValid: true,
  affiliateUrl: null,
  destinationId: "board1",
  body: "Conteúdo",
  metadata: {},
  ...changes,
});
const repository = (current = item()) =>
  ({
    listEligibleCandidates: vi.fn().mockResolvedValue([current]),
    listEligibleProducts: vi.fn().mockResolvedValue([]),
    findContentId: vi.fn().mockResolvedValue(null),
    findCreativeAssetId: vi.fn().mockResolvedValue(null),
    ensureQueueItem: vi.fn().mockResolvedValue(current),
    listScheduledItems: vi.fn().mockResolvedValue([]),
    createDailyPlan: vi.fn(async (_w, plan) => plan),
    listQueue: vi.fn().mockResolvedValue([current]),
    getQueueItem: vi.fn().mockResolvedValue(current),
    updateQueueItem: vi.fn(async (_w, _id, input) => ({
      ...current,
      ...input,
    })),
    findPublicationByKey: vi.fn().mockResolvedValue(null),
    savePublication: vi.fn(),
    appendAudit: vi.fn(),
    createAlert: vi.fn(),
    listAlerts: vi.fn().mockResolvedValue([]),
    consecutiveFailures: vi.fn().mockResolvedValue(1),
    circuitState: vi.fn().mockResolvedValue("CLOSED"),
    setCircuitState: vi.fn(),
  }) as unknown as OperationsRepository;
describe("content operations", () => {
  it("prepara o dia sem publicar, remove duplicados e respeita os tetos", async () => {
    const repo = repository();
    const plan = await new DailyOperationsService(repo).runDailyOperations(
      "w1",
      new Date(),
    );
    expect(plan.approvalsRequired).toBe(true);
    expect(plan.pinterestItems).toHaveLength(1);
    expect(plan.totalItems).toBe(1);
    expect(repo.createDailyPlan).toHaveBeenCalledOnce();
  });
  it("reutiliza conteúdo existente e cria apenas o criativo ausente sem publicar", async () => {
    const repo = repository();
    (repo.listEligibleCandidates as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([])
      .mockResolvedValue([item()]);
    (repo.listEligibleProducts as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "p1", channels: ["pinterest"] },
    ]);
    (repo.findContentId as ReturnType<typeof vi.fn>).mockResolvedValue("c1");
    (repo.findCreativeAssetId as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null)
      .mockResolvedValue("a1");
    const content = { generateProduct: vi.fn() },
      creative = {
        request: vi.fn().mockResolvedValue({}),
        render: vi.fn().mockResolvedValue({ status: "READY" }),
      };
    const plan = await new DailyOperationsService(
      repo,
      content,
      creative as never,
    ).runDailyOperations("w1");
    expect(content.generateProduct).not.toHaveBeenCalled();
    expect(creative.render).toHaveBeenCalledOnce();
    expect(repo.ensureQueueItem).toHaveBeenCalledOnce();
    expect(plan.summary.prepared).toBe(1);
    expect(plan.approvalsRequired).toBe(true);
  });
  it("cria conteúdo ausente pelo Content Engine e mantém awaiting approval", async () => {
    const repo = repository();
    (repo.listEligibleProducts as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "p1", channels: ["pinterest"] },
    ]);
    (repo.findCreativeAssetId as ReturnType<typeof vi.fn>).mockResolvedValue(
      "a1",
    );
    const content = {
        generateProduct: vi.fn().mockResolvedValue({ id: "generated-content" }),
      },
      creative = { request: vi.fn(), render: vi.fn() };
    await new DailyOperationsService(
      repo,
      content,
      creative as never,
    ).runDailyOperations("w1");
    expect(content.generateProduct).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "p1", platforms: ["pinterest"] }),
    );
    expect(repo.ensureQueueItem).toHaveBeenCalledWith(
      "w1",
      "p1",
      "generated-content",
      "a1",
      "pinterest",
    );
  });
  it("registra bloqueio isolado quando geração não é possível", async () => {
    const repo = repository();
    (repo.listEligibleProducts as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "p1", channels: ["facebook"] },
    ]);
    const content = {
        generateProduct: vi
          .fn()
          .mockRejectedValue(new Error("source_image_missing")),
      },
      creative = { request: vi.fn(), render: vi.fn() };
    const plan = await new DailyOperationsService(
      repo,
      content,
      creative as never,
    ).runDailyOperations("w1");
    expect(plan.summary.blocked).toBe(1);
    expect(plan.warnings[0]).toContain("source_image_missing");
    expect(repo.appendAudit).toHaveBeenCalledWith(
      "w1",
      "operations.preparation_blocked",
      "p1",
      null,
      expect.any(Object),
    );
  });
  it("aprova, rejeita, aprova lote, agenda e cancela com audit log", async () => {
    const repo = repository();
    const service = new ApprovalService(repo);
    await service.approve("w1", "q1", "u1");
    await service.approveBatch("w1", ["q1", "q1"], "u1");
    (repo.getQueueItem as ReturnType<typeof vi.fn>).mockResolvedValue(
      item({ status: "awaiting_approval" }),
    );
    await service.reject("w1", "q1", "u1", "copy");
    (repo.getQueueItem as ReturnType<typeof vi.fn>).mockResolvedValue(
      item({ status: "approved" }),
    );
    await service.schedule("w1", "q1", "u1", new Date(Date.now() + 60_000));
    await service.cancel("w1", "q1", "u1");
    expect(repo.appendAudit).toHaveBeenCalledTimes(5);
  });
  it("agenda no scheduler disponível e reporta indisponibilidade sem falso sucesso", async () => {
    const repo = repository(item({ status: "approved" })),
      scheduledFor = new Date(Date.now() + 60_000),
      scheduler = {
        schedule: vi
          .fn()
          .mockResolvedValue({
            status: "enqueued",
            jobId: "job-1",
            scheduledFor,
          }),
      };
    const result = await new ApprovalService(repo, scheduler).schedule(
      "w1",
      "q1",
      "u1",
      scheduledFor,
    );
    expect(scheduler.schedule).toHaveBeenCalledWith({
      workspaceId: "w1",
      publicationQueueItemId: "q1",
      scheduledFor,
    });
    expect(result.scheduler.status).toBe("enqueued");
    const unavailable = await new ApprovalService(
      repo,
      new UnavailablePublicationScheduler(),
    ).schedule("w1", "q1", "u1", scheduledFor);
    expect(unavailable.scheduler).toMatchObject({
      status: "scheduler_unavailable",
      jobId: null,
    });
  });
  it("reconcilia itens scheduled usando a mesma identidade", async () => {
    const scheduledFor = new Date(Date.now() + 60_000),
      repo = repository();
    (repo.listScheduledItems as ReturnType<typeof vi.fn>).mockResolvedValue([
      item({ status: "scheduled", scheduledFor }),
    ]);
    const scheduler = {
      schedule: vi
        .fn()
        .mockResolvedValue({
          status: "already_enqueued",
          jobId: "deterministic",
          scheduledFor,
        }),
    };
    await expect(
      new ApprovalService(repo, scheduler).reconcileScheduled("w1"),
    ).resolves.toEqual([
      expect.objectContaining({ status: "already_enqueued" }),
    ]);
    expect(scheduler.schedule).toHaveBeenCalledOnce();
  });
  it.each([
    [{ status: "awaiting_approval" }, "approval_required"],
    [{ capabilityAvailable: false, status: "approved" }, "capability_missing"],
    [
      { integrationConnected: false, status: "approved" },
      "integration_disconnected",
    ],
    [
      { priceDisplayed: true, priceFresh: false, status: "approved" },
      "price_stale",
    ],
    [{ creativeValid: false, status: "approved" }, "creative_invalid"],
  ])("bloqueia publicação insegura", async (changes, message) => {
    await expect(
      new PublishingService(
        repository(item(changes as Partial<QueueItem>)),
        {},
      ).publishNow("w1", "q1", "u1"),
    ).rejects.toThrow(message);
  });
  it("publica uma vez e reutiliza resultado pela idempotência", async () => {
    const repo = repository(item({ status: "approved" })),
      result = {
        externalId: "pin1",
        externalUrl: null,
        publishedAt: new Date(),
        metadata: {},
      },
      provider = {
        publish: vi.fn().mockResolvedValue(result),
        reconcile: vi.fn(),
      },
      service = new PublishingService(repo, { pinterest: provider });
    await expect(service.publishNow("w1", "q1", "u1")).resolves.toEqual(result);
    expect(provider.publish).toHaveBeenCalledOnce();
    expect(repo.savePublication).toHaveBeenCalledOnce();
  });
  it("mantém comentário Facebook como ação manual quando capability não existe", async () => {
    const repo = repository(
        item({
          channel: "facebook",
          status: "approved",
          destinationId: "page1",
        }),
      ),
      result = {
        externalId: "post1",
        externalUrl: null,
        publishedAt: new Date(),
        metadata: {},
        commentAction: "MANUAL_REQUIRED" as const,
      },
      provider = {
        publish: vi.fn().mockResolvedValue(result),
        reconcile: vi.fn(),
      };
    await expect(
      new PublishingService(repo, { facebook: provider }).publishNow(
        "w1",
        "q1",
        "u1",
      ),
    ).resolves.toMatchObject({ commentAction: "MANUAL_REQUIRED" });
  });
  it.each([0, 1])(
    "mantém circuito fechado nos retries controlados 1 e 2",
    async (attempts) => {
      const repo = repository(
        item({ status: attempts ? "failed" : "approved", attempts }),
      );
      (repo.consecutiveFailures as ReturnType<typeof vi.fn>).mockResolvedValue(
        attempts + 1,
      );
      const service = new PublishingService(repo, {
        pinterest: {
          publish: vi.fn().mockRejectedValue(new Error("temporary")),
          reconcile: vi.fn(),
        },
      });
      await expect(service.retry("w1", "q1", "u1")).rejects.toThrow(
        "temporary",
      );
      expect(repo.setCircuitState).not.toHaveBeenCalledWith("w1", "i1", "OPEN");
      expect(repo.createAlert).toHaveBeenCalledWith(
        "w1",
        "PUBLISHING_FAILURE",
        "temporary",
        "pinterest",
        "i1",
      );
    },
  );
  it("abre circuito e alerta na terceira falha", async () => {
    const repo = repository(item({ status: "approved", attempts: 2 }));
    (repo.consecutiveFailures as ReturnType<typeof vi.fn>).mockResolvedValue(3);
    const service = new PublishingService(repo, {
      pinterest: {
        publish: vi.fn().mockRejectedValue(new Error("timeout")),
        reconcile: vi.fn(),
      },
    });
    await expect(service.retry("w1", "q1", "u1")).rejects.toThrow("timeout");
    expect(repo.setCircuitState).toHaveBeenCalledWith("w1", "i1", "OPEN");
    expect(repo.createAlert).toHaveBeenCalledWith(
      "w1",
      "CIRCUIT_OPEN",
      expect.any(String),
      "pinterest",
      "i1",
    );
  });
  it("reconcilia item publishing sem reenviar cegamente", async () => {
    const repo = repository(item({ status: "publishing" })),
      result = {
        externalId: "post1",
        externalUrl: null,
        publishedAt: new Date(),
        metadata: {},
      },
      provider = {
        publish: vi.fn(),
        reconcile: vi.fn().mockResolvedValue(result),
      };
    await expect(
      new PublishingService(repo, { pinterest: provider }).publishNow(
        "w1",
        "q1",
        "u1",
      ),
    ).resolves.toEqual(result);
    expect(provider.publish).not.toHaveBeenCalled();
  });
});
