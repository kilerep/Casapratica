import { createHash } from "node:crypto";
import { z } from "zod";
import type { MarketplaceProduct, MarketplaceProductProvider } from "@casapratica/integrations";
import type { ProductResearchService, SavedResearchRun } from "@casapratica/strategy";

const safeText = z.string().trim().min(1).max(2_000).refine(value => !/[<>]|javascript:/i.test(value), "unsafe_text");
const optionalText = safeText.nullable();
const publicHttps = z.url().refine(value => { const url = new URL(value); return url.protocol === "https:" && !/^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i.test(url.hostname); }, "public_https_required");
const evidenceSchema = z.object({ price: z.literal("VISIBLE_PUBLIC_DATA").nullable(), rating: z.literal("VISIBLE_PUBLIC_DATA").nullable(), sales: z.literal("PUBLIC_VISIBLE_TEXT").nullable(), seller: z.literal("VISIBLE_PUBLIC_DATA").nullable() }).strict();
export const zoeProductSchema = z.object({ title: safeText, productUrl: publicHttps, affiliateUrl: publicHttps.nullable(), imageUrl: publicHttps.nullable(), category: safeText.max(200), price: z.number().nonnegative().nullable(), currency: z.literal("BRL").default("BRL"), rating: z.number().min(0).max(5).nullable(), reviewCount: z.number().int().nonnegative().nullable(), sales: z.number().int().nonnegative().nullable(), salesEvidence: z.literal("PUBLIC_VISIBLE_TEXT").nullable(), sellerName: optionalText, sellerReputation: optionalText, officialStore: z.boolean().nullable(), mercadoLider: z.boolean().nullable(), bestSeller: z.boolean().nullable(), freeShipping: z.boolean().nullable(), sourceObservedAt: z.iso.datetime(), sourceNotes: optionalText, evidence: evidenceSchema }).strict();
export const zoeImportEnvelopeSchema = z.object({ schema: z.literal("casapratica_product_import_v1"), generatedAt: z.iso.datetime(), source: z.literal("ZOE_WEB_RESEARCH"), products: z.array(z.unknown()).max(50) }).strict();
export type ZoeProduct = z.infer<typeof zoeProductSchema>;
export type ZoeImportEnvelope = z.infer<typeof zoeImportEnvelopeSchema>;
export type Freshness = "fresh" | "aging" | "stale";
export interface ProductImportAuditRepository { countExisting(workspaceId: string, canonicalUrls: readonly string[]): Promise<number>; audit(workspaceId: string, action: "IMPORT_STARTED" | "IMPORT_VALIDATED" | "IMPORT_COMPLETED" | "IMPORT_REJECTED", actorId: string, fingerprint: string, metadata: Record<string, unknown>): Promise<void> }

const canonicalUrl = (value: string) => { const url = new URL(value); for (const key of ["tracking_id", "position", "sid", "matt_tool", "matt_word", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) url.searchParams.delete(key); url.hash = ""; return url.toString(); };
const itemId = (url: string) => { const match = url.match(/(?:MLB-?|\/p\/MLB)(\d{6,})/i); return match?.[1] ? `MLB${match[1]}` : `ZOE-${createHash("sha256").update(url).digest("hex").slice(0, 24)}`; };
const freshness = (observedAt: string, now: Date): Freshness => { const age = now.getTime() - new Date(observedAt).getTime(); return age <= 24 * 60 * 60_000 ? "fresh" : age <= 72 * 60 * 60_000 ? "aging" : "stale"; };
const reputation = (value: string | null) => { if (!value || !/^\d+(?:[.,]\d+)?%?$/.test(value.trim())) return null; const parsed = Number(value.replace("%", "").replace(",", ".")); return parsed >= 0 && parsed <= 100 ? parsed : null; };
const fingerprintFor = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const missing = (product: ZoeProduct, state: Freshness) => [state === "stale" || product.price === null || product.evidence.price !== "VISIBLE_PUBLIC_DATA" ? "price" : null, product.rating === null || product.evidence.rating !== "VISIBLE_PUBLIC_DATA" ? "rating" : null, product.reviewCount === null ? "reviewCount" : null, product.sales === null || product.salesEvidence !== "PUBLIC_VISIBLE_TEXT" || product.evidence.sales !== "PUBLIC_VISIBLE_TEXT" ? "salesCount" : null, product.sellerName === null || product.evidence.seller !== "VISIBLE_PUBLIC_DATA" ? "seller" : null, product.imageUrl === null ? "images" : null].filter((value): value is string => value !== null);

export function validateZoeImport(input: unknown, now = new Date()) {
  const envelope = zoeImportEnvelopeSchema.safeParse(input);
  if (!envelope.success) return { valid: false as const, fingerprint: fingerprintFor(input), errors: envelope.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })), received: 0, validCount: 0, rejectedCount: 0, products: [] };
  const products = envelope.data.products.map((raw, index) => { const parsed = zoeProductSchema.safeParse(raw); if (!parsed.success) return { index, status: "REJEITADO" as const, reasons: parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`), product: null }; const state = freshness(parsed.data.sourceObservedAt, now), absent = missing(parsed.data, state); return { index, status: absent.length ? "VÁLIDO COM DADOS AUSENTES" as const : "VÁLIDO" as const, reasons: [...(state === "stale" ? ["Preço observado há mais de 72 horas não será usado como atual."] : []), ...(absent.length ? [`Dados ausentes: ${absent.join(", ")}.`] : [])], freshness: state, product: parsed.data }; });
  return { valid: true as const, fingerprint: fingerprintFor(envelope.data), generatedAt: envelope.data.generatedAt, received: products.length, validCount: products.filter(item => item.product).length, rejectedCount: products.filter(item => !item.product).length, products };
}
function normalize(product: ZoeProduct, now: Date): MarketplaceProduct {
  const url = canonicalUrl(product.productUrl), state = freshness(product.sourceObservedAt, now), absent = missing(product, state);
  const trustedPrice = state !== "stale" && product.evidence.price === "VISIBLE_PUBLIC_DATA" ? product.price : null, trustedRating = product.evidence.rating === "VISIBLE_PUBLIC_DATA" ? product.rating : null, trustedSeller = product.evidence.seller === "VISIBLE_PUBLIC_DATA" ? product.sellerName : null, sellerExternalId = trustedSeller ? `ZOESELLER-${createHash("sha256").update(trustedSeller.toLocaleLowerCase("pt-BR")).digest("hex").slice(0, 20)}` : null;
  return { externalId: itemId(url), name: product.title, description: product.sourceNotes, canonicalUrl: url, affiliateUrl: product.affiliateUrl, price: trustedPrice, currency: trustedPrice === null ? null : product.currency, categoryExternalId: product.category, rating: trustedRating, reviewCount: trustedRating === null ? null : product.reviewCount, salesCount: product.salesEvidence === "PUBLIC_VISIBLE_TEXT" && product.evidence.sales === "PUBLIC_VISIBLE_TEXT" ? product.sales : null, salesEvidence: product.salesEvidence === "PUBLIC_VISIBLE_TEXT" && product.evidence.sales === "PUBLIC_VISIBLE_TEXT" ? "PUBLIC_VISIBLE_TEXT" : null, sellerExternalId, sellerName: trustedSeller, sellerReputation: trustedSeller ? reputation(product.sellerReputation) : null, images: product.imageUrl ? [product.imageUrl] : [], availability: null, commission: null, freeShipping: product.freeShipping, isBestSeller: product.bestSeller, isMercadoLider: product.mercadoLider, isOfficialStore: product.officialStore, observedAt: new Date(product.sourceObservedAt), missingFields: absent, rawSourceReference: `ZOE_WEB_RESEARCH:${itemId(url)}#observedAt=${product.sourceObservedAt}` };
}
class ZoeImportProvider implements MarketplaceProductProvider {
  readonly marketplace = "ZOE_WEB_RESEARCH";
  constructor(private readonly products: readonly MarketplaceProduct[]) {}
  async searchProducts() { return this.products; }
  async getProduct(id: string) { return this.products.find(product => product.externalId === id) ?? null; }
  async getProducts(ids: readonly string[]) { const wanted = new Set(ids); return this.products.filter(product => wanted.has(product.externalId)); }
  async getSeller() { return null; }
  async getCategories() { return []; }
  async refreshProductData(id: string) { return this.getProduct(id); }
}
export class ProductImportService {
  constructor(private readonly researchFactory: (provider: MarketplaceProductProvider) => ProductResearchService, private readonly audit: ProductImportAuditRepository, private readonly now = () => new Date()) {}
  validate(input: unknown) { return validateZoeImport(input, this.now()); }
  async commit(workspaceId: string, actorId: string, input: unknown) {
    const checked = this.validate(input), fingerprint = checked.fingerprint;
    await this.audit.audit(workspaceId, "IMPORT_STARTED", actorId, fingerprint, { received: checked.received });
    if (!checked.valid || !checked.validCount) { await this.audit.audit(workspaceId, "IMPORT_REJECTED", actorId, fingerprint, { errors: checked.valid ? checked.rejectedCount : checked.errors.length }); throw new Error("invalid_product_import"); }
    await this.audit.audit(workspaceId, "IMPORT_VALIDATED", actorId, fingerprint, { received: checked.received, valid: checked.validCount, rejected: checked.rejectedCount, generatedAt: checked.generatedAt });
    const unique = [...new Map(checked.products.flatMap(item => item.product ? [[itemId(canonicalUrl(item.product.productUrl)), item.product] as const] : [])).values()], existing = await this.audit.countExisting(workspaceId, unique.map(product => canonicalUrl(product.productUrl))), normalized = unique.map(product => normalize(product, this.now())), runs: SavedResearchRun[] = [];
    for (let index = 0; index < normalized.length; index += 20) { const batch = normalized.slice(index, index + 20), research = this.researchFactory(new ZoeImportProvider(batch)); runs.push(await research.research({ workspaceId, queries: [`Importação Zoe ${fingerprint.slice(0, 8)} lote ${index / 20 + 1}`], categories: [...new Set(batch.map(product => product.categoryExternalId).filter((value): value is string => value !== null))], seedExternalIds: batch.map(product => product.externalId), targetCandidates: 20 })); }
    const counts = runs.reduce((sum, run) => ({ recommended: sum.recommended + run.recommended, opportunities: sum.opportunities + run.opportunities, rejected: sum.rejected + run.rejected }), { recommended: 0, opportunities: 0, rejected: 0 });
    const result = { status: "completed" as const, message: "Pesquisa importada", fingerprint, received: checked.received, valid: checked.validCount, rejectedItems: checked.rejectedCount, imported: normalized.length, newProducts: Math.max(0, normalized.length - existing), existingProducts: existing, ...counts, runIds: runs.map(run => run.id) };
    await this.audit.audit(workspaceId, "IMPORT_COMPLETED", actorId, fingerprint, result);
    return result;
  }
}
