import { Prisma, type PrismaClient, type ProductStatus } from "@prisma/client";
const plain = (v: unknown) => JSON.parse(JSON.stringify(v));
export class PrismaProductReviewRepository {
  constructor(private readonly db: PrismaClient) {}
  async list(workspaceId: string) {
    const rows = await this.db.product.findMany({
      where: { workspaceId },
      include: {
        category: true,
        seller: true,
        scores: { orderBy: { calculatedAt: "desc" }, take: 1 },
        candidates: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { researchRun: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((p) => {
      const captured = (p.candidates[0]?.capturedData as any) ?? {};
      return {
        id: p.id,
        externalId: p.externalId,
        name: p.name,
        image: p.thumbnailUrl,
        category:
          p.category?.name ?? captured.product?.categoryExternalId ?? null,
        price: p.price === null ? null : Number(p.price),
        currency: p.currency,
        rating: p.rating === null ? null : Number(p.rating),
        reviewCount: p.reviewCount,
        salesCount: p.salesCount,
        seller: p.seller?.name ?? null,
        sellerReputation:
          p.seller?.reputation === null || p.seller?.reputation === undefined
            ? null
            : Number(p.seller.reputation),
        score: p.scores[0] ? Number(p.scores[0].score) : null,
        confidence: p.scores[0] ? Number(p.scores[0].confidence) : null,
        status: p.status,
        verdict: captured.verdict ?? null,
        reasons: captured.reasons ?? [],
        opportunityScore: captured.opportunityScore?.score ?? null,
        signals: {
          bestSeller: captured.product?.isBestSeller ?? null,
          officialStore: captured.product?.isOfficialStore ?? null,
          mercadoLider: captured.product?.isMercadoLider ?? null,
          freeShipping: captured.product?.freeShipping ?? null,
        },
        sourceUrl: captured.product?.canonicalUrl ?? p.canonicalUrl,
        source: p.candidates[0]?.researchRun.provider ?? null,
        observedAt:
          p.candidates[0]?.researchRun.completedAt ??
          p.candidates[0]?.createdAt ??
          null,
        researchDate:
          p.candidates[0]?.researchRun.completedAt ??
          p.candidates[0]?.createdAt ??
          null,
        researchId: p.candidates[0]?.researchRunId ?? null,
      };
    });
  }
  async detail(workspaceId: string, id: string) {
    const p = await this.db.product.findFirst({
      where: { workspaceId, id },
      include: {
        category: true,
        seller: true,
        scores: { orderBy: { calculatedAt: "desc" } },
        candidates: {
          orderBy: { createdAt: "desc" },
          include: {
            researchRun: {
              include: {
                comparisons: {
                  include: {
                    product: {
                      include: {
                        seller: true,
                        scores: { orderBy: { calculatedAt: "desc" }, take: 1 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        contents: {
          include: { creativeAssets: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!p) throw new Error("product_not_found");
    return plain(p);
  }
  async decide(
    workspaceId: string,
    id: string,
    status: Extract<ProductStatus, "approved" | "test" | "rejected">,
    actorId: string,
    comment: string | null,
  ) {
    const found = await this.db.product.findFirst({
      where: { workspaceId, id },
      select: { id: true },
    });
    if (!found) throw new Error("product_not_found");
    return this.db.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: { status },
      });
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorType: "owner",
          actorId,
          action: `product.review.${status}`,
          resourceType: "Product",
          resourceId: id,
          metadata: { comment, publicationApproved: false },
        },
      });
      return { id: product.id, status: product.status };
    });
  }
}
