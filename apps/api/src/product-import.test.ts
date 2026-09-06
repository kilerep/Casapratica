import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductResearchService } from "@casapratica/strategy";
import { buildApp } from "./app.js";
import { ProductImportService, validateZoeImport } from "./product-import.js";

const observed = "2026-09-06T12:00:00.000Z";
const product = (changes: Record<string, unknown> = {}) => ({ title: "Organizador de cozinha", productUrl: "https://loja.example/produtos/123", affiliateUrl: null, imageUrl: "https://loja.example/imagens/123.jpg", category: "cozinha", price: 79.9, currency: "BRL", rating: 4.8, reviewCount: 320, sales: 10000, salesEvidence: "PUBLIC_VISIBLE_TEXT", sellerName: "Loja Casa", sellerReputation: "98%", officialStore: true, mercadoLider: null, bestSeller: true, freeShipping: true, sourceObservedAt: observed, sourceNotes: "Dados públicos visíveis.", evidence: { price: "VISIBLE_PUBLIC_DATA", rating: "VISIBLE_PUBLIC_DATA", sales: "PUBLIC_VISIBLE_TEXT", seller: "VISIBLE_PUBLIC_DATA" }, ...changes });
const payload = (products: unknown[] = [product()]) => ({ schema: "casapratica_product_import_v1", generatedAt: observed, source: "ZOE_WEB_RESEARCH", products });
const now = () => new Date("2026-09-06T18:00:00.000Z");

describe("Zoe product import schema", () => {
  it("aceita payload v1 e marca campos ausentes", () => { expect(validateZoeImport(payload(), now()).valid).toBe(true); const sparse = validateZoeImport(payload([product({ price: null, rating: null, reviewCount: null, sales: null, salesEvidence: null, sellerName: null, sellerReputation: null, imageUrl: null, evidence: { price: null, rating: null, sales: null, seller: null } })]), now()); expect(sparse.products[0]).toMatchObject({ status: "VÁLIDO COM DADOS AUSENTES" }); });
  it.each([["schema errado", { ...payload(), schema: "outro" }], ["URL inválida", payload([product({ productUrl: "file:///tmp/item" })])], ["localhost", payload([product({ productUrl: "https://localhost/item" })])], ["rating inválido", payload([product({ rating: 6 })])], ["preço inválido", payload([product({ price: -1 })])], ["HTML", payload([product({ title: "<script>alert(1)</script>" })])]])("rejeita %s", (_label, value) => expect(validateZoeImport(value, now()).validCount).toBe(0));
  it("marca stale e remove confiança do preço na normalização", () => { const checked = validateZoeImport(payload([product({ sourceObservedAt: "2026-09-01T12:00:00.000Z" })]), now()); expect(checked.products[0]).toMatchObject({ freshness: "stale", status: "VÁLIDO COM DADOS AUSENTES" }); });
});

describe("ProductImportService", () => {
  it("deduplica, chama Product Research e audita sem payload", async () => { const research = { research: vi.fn().mockResolvedValue({ id: "run", recommended: 1, opportunities: 0, rejected: 0 }) }, audit = { countExisting: vi.fn().mockResolvedValue(1), audit: vi.fn() }, service = new ProductImportService(() => research as unknown as ProductResearchService, audit, now), input = payload([product(), product({ title: "Mesmo item" })]); const result = await service.commit("workspace", "operador", input); expect(research.research).toHaveBeenCalledOnce(); expect(result).toMatchObject({ received: 2, imported: 1, existingProducts: 1, newProducts: 0, recommended: 1 }); expect(audit.audit.mock.calls.map(call => call[1])).toEqual(["IMPORT_STARTED", "IMPORT_VALIDATED", "IMPORT_COMPLETED"]); expect(JSON.stringify(audit.audit.mock.calls)).not.toContain("affiliateUrl"); });
  it("rejeita pacote inválido sem chamar Research", async () => { const research = { research: vi.fn() }, audit = { countExisting: vi.fn(), audit: vi.fn() }, service = new ProductImportService(() => research as unknown as ProductResearchService, audit, now); await expect(service.commit("workspace", "operador", { schema: "errado" })).rejects.toThrow("invalid_product_import"); expect(research.research).not.toHaveBeenCalled(); expect(audit.audit.mock.calls.map(call => call[1])).toEqual(["IMPORT_STARTED", "IMPORT_REJECTED"]); });
});

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(() => Promise.all(apps.splice(0).map(app => app.close())));
describe("product import endpoints", () => {
  it("valida sem persistir, commita com origem e rejeita POST sem Origin", async () => { const service = { validate: vi.fn().mockReturnValue({ valid: true, products: [] }), commit: vi.fn().mockResolvedValue({ message: "Pesquisa importada" }) }, app = buildApp({ workspaceId: "workspace", productImport: service }); apps.push(app); expect((await app.inject({ method: "POST", url: "/api/product-import/validate", headers: { origin: "http://localhost:3000" }, payload: payload() })).statusCode).toBe(200); expect(service.commit).not.toHaveBeenCalled(); expect((await app.inject({ method: "POST", url: "/api/product-import/commit", payload: { actorId: "operador", payload: payload() } })).statusCode).toBe(403); expect((await app.inject({ method: "POST", url: "/api/product-import/commit", headers: { origin: "http://localhost:3000" }, payload: { actorId: "operador", payload: payload() } })).statusCode).toBe(200); expect(service.commit).toHaveBeenCalledWith("workspace", "operador", expect.any(Object)); });
});
