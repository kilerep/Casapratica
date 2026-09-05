import type { PrismaClient } from "@prisma/client";

export interface DashboardSnapshot {
  products: {
    awaitingReview: number;
    approved: number;
    opportunities: number | null;
    recentlyRejected: number;
  };
  queue: Record<"awaiting_approval" | "approved" | "scheduled" | "failed", number>;
  creatives: readonly {
    id: string;
    platform: string | null;
    status: string;
    previewUrl: string | null;
    createdAt: Date;
  }[];
}

export class PrismaDashboardRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async snapshot(workspaceId: string): Promise<DashboardSnapshot> {
    const rejectedSince = new Date(Date.now() - 30 * 86_400_000);
    const [awaitingReview, approved, recentlyRejected, latestResearch, queueRows, creativeRows] =
      await Promise.all([
        this.prisma.product.count({ where: { workspaceId, status: { in: ["candidate", "under_review"] } } }),
        this.prisma.product.count({ where: { workspaceId, status: { in: ["approved", "active", "test"] } } }),
        this.prisma.product.count({ where: { workspaceId, status: "rejected", updatedAt: { gte: rejectedSince } } }),
        this.prisma.productResearchRun.findFirst({ where: { workspaceId, status: "succeeded" }, orderBy: { completedAt: "desc" }, select: { opportunityCount: true } }),
        this.prisma.publicationQueueItem.groupBy({ by: ["status"], where: { workspaceId, status: { in: ["awaiting_approval", "approved", "scheduled", "failed"] } }, _count: { _all: true } }),
        this.prisma.creativeAsset.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, kind: true, status: true, storageKey: true, createdAt: true, metadata: true } }),
      ]);
    const queue = { awaiting_approval: 0, approved: 0, scheduled: 0, failed: 0 };
    for (const row of queueRows) {
      if (row.status in queue) queue[row.status as keyof typeof queue] = row._count._all;
    }
    return {
      products: { awaitingReview, approved, opportunities: latestResearch?.opportunityCount ?? null, recentlyRejected },
      queue,
      creatives: creativeRows.map((creative) => {
        const metadata = creative.metadata && typeof creative.metadata === "object" && !Array.isArray(creative.metadata) ? creative.metadata as Record<string, unknown> : {};
        const candidate = /^https?:\/\//.test(creative.storageKey) ? creative.storageKey : null;
        return { id: creative.id, platform: typeof metadata.platform === "string" ? metadata.platform : creative.kind || null, status: creative.status, previewUrl: candidate, createdAt: creative.createdAt };
      }),
    };
  }
}
