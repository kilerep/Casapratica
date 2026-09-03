ALTER TABLE "IntegrationAccount" ADD COLUMN "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE TABLE "OAuthState" (
  "id" UUID NOT NULL,
  "stateHash" TEXT NOT NULL,
  "workspaceId" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "redirectUri" TEXT NOT NULL,
  "verifierCiphertext" BYTEA NOT NULL,
  "verifierIv" BYTEA NOT NULL,
  "verifierAuthTag" BYTEA NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumedAt" TIMESTAMP(3),
  CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OAuthState_stateHash_key" ON "OAuthState"("stateHash");
CREATE INDEX "OAuthState_workspaceId_provider_expiresAt_idx" ON "OAuthState"("workspaceId", "provider", "expiresAt");
ALTER TABLE "OAuthState" ADD CONSTRAINT "OAuthState_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
