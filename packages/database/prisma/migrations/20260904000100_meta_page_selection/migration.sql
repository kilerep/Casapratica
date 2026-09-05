ALTER TABLE "IntegrationAccount"
  ADD COLUMN "selectedPageId" TEXT,
  ADD COLUMN "selectedPageName" TEXT,
  ADD COLUMN "selectedPageCategory" TEXT,
  ADD COLUMN "selectedPageTasks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "selectedPageSelectedAt" TIMESTAMP(3),
  ADD COLUMN "pageTokenCiphertext" BYTEA,
  ADD COLUMN "pageTokenIv" BYTEA,
  ADD COLUMN "pageTokenAuthTag" BYTEA;
