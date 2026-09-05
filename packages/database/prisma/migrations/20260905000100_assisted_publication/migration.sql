CREATE TABLE "AssistedPublicationPack" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "platform" TEXT NOT NULL,
  "image" TEXT,
  "title" TEXT,
  "body" TEXT NOT NULL,
  "destinationUrl" TEXT NOT NULL,
  "affiliateUrl" TEXT,
  "boardSuggestion" TEXT,
  "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "manualSteps" JSONB NOT NULL,
  "contentFingerprint" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'READY',
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "manuallyPublishedAt" TIMESTAMP(3),
  "manuallyPublishedBy" TEXT,
  CONSTRAINT "AssistedPublicationPack_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AssistedPublicationPack_workspaceId_generatedAt_idx" ON "AssistedPublicationPack"("workspaceId", "generatedAt");
CREATE INDEX "AssistedPublicationPack_workspaceId_productId_platform_idx" ON "AssistedPublicationPack"("workspaceId", "productId", "platform");
ALTER TABLE "AssistedPublicationPack" ADD CONSTRAINT "AssistedPublicationPack_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistedPublicationPack" ADD CONSTRAINT "AssistedPublicationPack_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
