ALTER TYPE "PublicationStatus" ADD VALUE IF NOT EXISTS 'rejected';
ALTER TABLE "PublicationQueueItem" ADD COLUMN "integrationAccountId" UUID, ADD COLUMN "destinationId" TEXT;
ALTER TABLE "Publication" ADD COLUMN "creativeAssetId" UUID, ADD COLUMN "integrationAccountId" UUID, ADD COLUMN "idempotencyKey" TEXT, ADD COLUMN "providerResponse" JSONB, ADD COLUMN "errorCode" TEXT, ADD COLUMN "errorMessage" TEXT;
UPDATE "Publication" SET "idempotencyKey" = 'legacy:' || "id" WHERE "idempotencyKey" IS NULL;
ALTER TABLE "Publication" ALTER COLUMN "idempotencyKey" SET NOT NULL;
CREATE UNIQUE INDEX "Publication_idempotencyKey_key" ON "Publication"("idempotencyKey");
ALTER TABLE "PublicationQueueItem" ADD CONSTRAINT "PublicationQueueItem_integrationAccountId_fkey" FOREIGN KEY ("integrationAccountId") REFERENCES "IntegrationAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_creativeAssetId_fkey" FOREIGN KEY ("creativeAssetId") REFERENCES "CreativeAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_integrationAccountId_fkey" FOREIGN KEY ("integrationAccountId") REFERENCES "IntegrationAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
