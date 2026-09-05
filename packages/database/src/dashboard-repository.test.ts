import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { PrismaDashboardRepository } from "./dashboard-repository.js";

describe("dashboard read model", () => {
  it("returns real aggregates and does not infer unavailable opportunities", async () => {
    const count = vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    const prisma = {
      product: { count },
      productResearchRun: { findFirst: vi.fn().mockResolvedValue(null) },
      publicationQueueItem: { groupBy: vi.fn().mockResolvedValue([{ status: "approved", _count: { _all: 4 } }]) },
      creativeAsset: { findMany: vi.fn().mockResolvedValue([{ id: "c1", kind: "composed_creative", status: "ready", storageKey: "private/file.png", createdAt: new Date(), metadata: { platform: "pinterest" } }]) },
    } as unknown as PrismaClient;
    const result = await new PrismaDashboardRepository(prisma).snapshot("w1");
    expect(result.products).toEqual({ awaitingReview: 2, approved: 3, opportunities: null, recentlyRejected: 1 });
    expect(result.queue).toMatchObject({ awaiting_approval: 0, approved: 4, scheduled: 0, failed: 0 });
    expect(result.creatives[0]).toMatchObject({ platform: "pinterest", previewUrl: null });
  });
});
