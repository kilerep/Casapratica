import { describe, expect, it } from "vitest";
import { productSchema } from "./product.js";
import { scoreInputSchema } from "./score.js";

const validProduct = {
  id: "33d8fe92-b39e-4c69-9072-635fc96e0576", workspaceId: "f4840534-bd30-4791-8bd8-8a132f479571", marketplace: "mercado_livre", externalId: "MLB123",
  name: "Organizador", description: null, categoryId: null, canonicalUrl: "https://example.com/product", affiliateUrl: null, price: null, currency: null,
  rating: null, reviewCount: null, salesCount: null, sellerId: null, availability: null, thumbnailUrl: null, status: "candidate" as const,
  firstSeenAt: new Date("2026-01-01"), lastCheckedAt: null, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
};

describe("domain validation", () => {
  it("accepts unknown external product facts as null", () => { expect(productSchema.parse(validProduct).price).toBeNull(); });
  it("rejects a price without currency", () => { expect(() => productSchema.parse({ ...validProduct, price: 10 })).toThrow(); });
  it("rejects negative external counters", () => { expect(() => productSchema.parse({ ...validProduct, reviewCount: -1 })).toThrow(); });
  it("rejects factor scores outside 0-100", () => { expect(() => scoreInputSchema.parse({ demand: 101 })).toThrow(); });
});
