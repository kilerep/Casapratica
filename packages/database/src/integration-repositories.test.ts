import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  PrismaIntegrationRepository,
  PrismaOAuthStateRepository,
} from "./integration-repositories.js";
describe("integration persistence", () => {
  it("reads disconnected account after removing tokens, preserving identity", async () => {
    const row = {
      id: "i",
      workspaceId: "w",
      provider: "pinterest",
      externalAccountId: "123",
      status: "disconnected",
      accessTokenCiphertext: null,
      accessTokenIv: null,
      accessTokenAuthTag: null,
      refreshTokenCiphertext: null,
      refreshTokenIv: null,
      refreshTokenAuthTag: null,
      tokenExpiresAt: null,
      scopes: ["boards:read"],
    };
    const prisma = {
      integrationAccount: { findFirst: vi.fn(async () => row) },
    } as unknown as PrismaClient;
    expect(
      await new PrismaIntegrationRepository(prisma).find("w", "pinterest"),
    ).toMatchObject({
      id: "i",
      externalAccountId: "123",
      status: "disconnected",
      accessToken: null,
      expiresAt: null,
    });
  });
  it("disconnect clears credentials without deleting account or publications", async () => {
    const update = vi.fn(async () => ({})),
      capabilities = vi.fn(async () => ({}));
    const prisma = {
      integrationAccount: { update },
      integrationCapability: { updateMany: capabilities },
      $transaction: vi.fn(async (values: Promise<unknown>[]) =>
        Promise.all(values),
      ),
    } as unknown as PrismaClient;
    await new PrismaIntegrationRepository(prisma).disconnect("i");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "i" },
        data: expect.objectContaining({
          status: "disconnected",
          accessTokenCiphertext: null,
          refreshTokenCiphertext: null,
        }),
      }),
    );
    expect(capabilities).toHaveBeenCalledOnce();
  });
  it("atomically grants only one concurrent state consumer", async () => {
    let consumed = false;
    const tx = {
      oAuthState: {
        findUnique: vi.fn(async () => ({
          id: "s",
          workspaceId: "w",
          provider: "pinterest",
          redirectUri: "http://localhost/callback",
          consumedAt: null,
          expiresAt: new Date(Date.now() + 60000),
          verifierCiphertext: Buffer.from("v"),
          verifierIv: Buffer.from("i"),
          verifierAuthTag: Buffer.from("t"),
        })),
        updateMany: vi.fn(async () => {
          if (consumed) return { count: 0 };
          consumed = true;
          return { count: 1 };
        }),
      },
    };
    const prisma = {
      $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
    } as unknown as PrismaClient;
    const repository = new PrismaOAuthStateRepository(prisma);
    const results = await Promise.all([
      repository.consume("hash"),
      repository.consume("hash"),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(tx.oAuthState.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          consumedAt: null,
          expiresAt: { gt: expect.any(Date) },
        }),
      }),
    );
  });
});
