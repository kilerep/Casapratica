import { Prisma, type PrismaClient } from "@prisma/client";

export class PrismaProductImportRepository {
  constructor(private readonly prisma: PrismaClient) {}
  countExisting(workspaceId: string, canonicalUrls: readonly string[]) {
    return this.prisma.product.count({ where: { workspaceId, canonicalUrl: { in: [...canonicalUrls] } } });
  }
  async audit(workspaceId: string, action: "IMPORT_STARTED" | "IMPORT_VALIDATED" | "IMPORT_COMPLETED" | "IMPORT_REJECTED", actorId: string, fingerprint: string, metadata: Record<string, unknown>) {
    await this.prisma.auditLog.create({ data: { workspaceId, actorType: "owner", actorId, action, resourceType: "ProductImport", resourceId: fingerprint, metadata: JSON.parse(JSON.stringify({ source: "ZOE_WEB_RESEARCH", fingerprint, ...metadata })) as Prisma.InputJsonValue } });
  }
}
