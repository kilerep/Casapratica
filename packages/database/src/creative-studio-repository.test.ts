import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { CreativeOutput, CreativeRequest } from "@casapratica/domain";
import { PrismaCreativeStudioRepository } from "./creative-studio-repository.js";

describe("PrismaCreativeStudioRepository", () => {
  it("carrega a imagem fonte real e limita os fatos confirmados a dois", async () => {
    const createdAt = new Date("2026-09-04T12:00:00Z");
    const client = { product: { findFirst: vi.fn().mockResolvedValue({ id: "p1", name: "Carrinho", marketplace: "mercadolivre", externalId: "MLB1", price: { toNumber: () => 58.38 }, lastCheckedAt: createdAt, contents: [{ id: "c1", creativeAssets: [{ storageKey: "fixture.svg", width: 1200, height: 1800, mimeType: "image/svg+xml", createdAt, metadata: { sourceUrl: "https://marketplace/item/image", assetSource: "MARKETPLACE_PRODUCT_IMAGE" } }] }] }) }, contentVariant: { findFirst: vi.fn().mockResolvedValue({ metadata: { productFacts: ["4 andares", "Com rodinhas", "não deve entrar"], priceDisplayRequested: true } }) } } as unknown as PrismaClient;
    const result = await new PrismaCreativeStudioRepository(client).getRequest("w1", "p1", { contentId: "c1", platform: "pinterest", format: "PINTEREST_2_3", template: "PHOTO_FIRST", variantCount: 1 });
    expect(result.confirmedFacts).toEqual(["4 andares", "Com rodinhas"]);
    expect(result.images[0]).toMatchObject({ imageUrl: "fixture.svg", sourceUrl: "https://marketplace/item/image", assetSource: "MARKETPLACE_PRODUCT_IMAGE" });
    expect(result.price).toBe(58.38);
  });

  it("persiste e lista CreativeAsset composto com dimensões e metadados", async () => {
    const create = vi.fn().mockResolvedValue({ id: "asset1" }), findMany = vi.fn().mockResolvedValue([{ id: "asset1" }]);
    const client = { creativeAsset: { create, findMany } } as unknown as PrismaClient;
    const repository = new PrismaCreativeStudioRepository(client);
    const request = { workspaceId: "w1", productId: "p1", contentId: "c1" } as CreativeRequest;
    const output = { status: "READY", metadata: { sourceImage: "fixture.svg", priceUsed: null } } as unknown as CreativeOutput;
    await repository.saveAsset("w1", request, { storageKey: "render.png", width: 1000, height: 1500, mimeType: "image/png" }, output);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ workspaceId: "w1", contentId: "c1", kind: "composed_creative", storageKey: "render.png", width: 1000, height: 1500, status: "ready" }) });
    await expect(repository.listAssets("w1", "p1")).resolves.toEqual([{ id: "asset1" }]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "w1", kind: "composed_creative", content: { productId: "p1" } } }));
  });
});
