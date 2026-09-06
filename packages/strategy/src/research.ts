import { calculateCasaPraticaScore, type ProductStatus, type ScoreInput, type ScoreResult } from "@casapratica/domain";
import type { MarketplaceProduct, MarketplaceProductProvider } from "@casapratica/integrations";

export type Verdict = "APROVADO PARA REVISÃO" | "OPORTUNIDADE PARA REVISÃO" | "NÃO RECOMENDADO";
export interface OpportunityScore { score: number; factors: { trend: number | null; highlight: number | null; nicheAffinity: number; history: number | null; seasonality: number | null }; explanation: string }
export interface RankedCandidate { product: MarketplaceProduct; score: ScoreResult; opportunityScore?: OpportunityScore; verdict: Verdict; reasons: readonly string[]; comparisonGroup: string; comparisonConfidence: "limited" | "sufficient" }
export interface SavedResearchRun { id: string; workspaceId: string; date: Date; queries: readonly string[]; categories: readonly string[]; candidates: readonly RankedCandidate[]; recommended: number; opportunities: number; rejected: number; reasons: Readonly<Record<string, readonly string[]>>; durationMs: number; provider: string }
export interface ResearchRepository { save(run: Omit<SavedResearchRun, "id">): Promise<SavedResearchRun>; list(workspaceId: string): Promise<readonly SavedResearchRun[]>; getCandidate(workspaceId: string, externalId: string): Promise<RankedCandidate | null>; setProductStatus(workspaceId: string, externalId: string, status: ProductStatus, reason: string): Promise<void> }
export interface WinningProduct { name: string; conversions: number; clicks?: number }
export interface ResearchRequest { workspaceId: string; queries: readonly string[]; categories?: readonly string[]; categoryWeights?: Readonly<Record<string, number>>; winningProducts?: readonly WinningProduct[]; targetCandidates?: number; opportunityScores?: Readonly<Record<string, OpportunityScore>>; seedExternalIds?: readonly string[]; opportunityScoresByExternalId?: Readonly<Record<string, OpportunityScore>> }

export const deduplicateProducts = (products: readonly MarketplaceProduct[]) => [...new Map(products.map(product => [`${product.externalId}:${product.canonicalUrl}`, product])).values()];
const hasIdentity = (product: MarketplaceProduct) => product.externalId.length > 0 && product.name.length > 0 && product.canonicalUrl.length > 0;
const isAvailable = (product: MarketplaceProduct) => product.availability !== "unavailable" && product.availability !== "closed";
const scaledCount = (value: number | null, target: number) => value === null ? undefined : Math.min(100, value / target * 100);
const normalizeName = (name: string) => name.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(word => word.length > 2).slice(0, 3).sort().join("-");
export const comparableGroupFor = (product: MarketplaceProduct) => `${product.categoryExternalId ?? "unknown"}:${normalizeName(product.name) || product.externalId}`;

export function scoreCandidate(product: MarketplaceProduct, group: readonly MarketplaceProduct[]): ScoreResult {
  const priced = group.map(item => item.price).filter((value): value is number => value !== null);
  const median = priced.length ? [...priced].sort((a, b) => a - b)[Math.floor(priced.length / 2)] ?? null : null;
  const signals = [product.isBestSeller, product.isMercadoLider, product.isOfficialStore, product.freeShipping].filter(Boolean).length;
  const factors: ScoreInput = { demand: scaledCount(product.salesCount, 100), reviews: product.rating === null ? undefined : product.rating / 5 * 70 + Math.min(30, (product.reviewCount ?? 0) / 100 * 30), sellerReputation: product.sellerReputation ?? undefined, priceCompetitiveness: product.price === null || median === null || median === 0 ? undefined : Math.max(0, Math.min(100, 100 - Math.max(0, product.price - median) / median * 100)), listingQuality: product.images.length === 0 ? undefined : Math.min(100, product.images.length * 15 + signals * 10), commission: product.commission === null ? undefined : Math.min(100, product.commission), seasonality: undefined };
  return calculateCasaPraticaScore(factors);
}
const lacksEssentialTrust = (product: MarketplaceProduct) => product.sellerReputation === null && product.rating === null && product.salesCount === null;
const ratingAccepted = (product: MarketplaceProduct, group: readonly MarketplaceProduct[]) => { if (product.rating === null) return false; if (product.rating >= 4.7) return true; if (product.rating < 4.6) return false; const ratings = group.map(value => value.rating).filter((value): value is number => value !== null); return (product.reviewCount ?? 0) >= 50 && (ratings.length === 0 || product.rating >= Math.max(...ratings) - .1); };
export function verdictFor(product: MarketplaceProduct, score: ScoreResult, group: readonly MarketplaceProduct[]): Verdict {
  if (!hasIdentity(product) || !isAvailable(product) || lacksEssentialTrust(product) || score.score === null) return "NÃO RECOMENDADO";
  const lowData = (product.salesCount ?? 0) < 10 || (product.reviewCount ?? 0) < 10;
  if (lowData) return product.images.length > 0 && (product.sellerReputation ?? 0) >= 80 && (product.rating === null || product.rating >= 4.6) ? "OPORTUNIDADE PARA REVISÃO" : "NÃO RECOMENDADO";
  const highPriceAccepted = product.price === null || product.price <= 500 || ((product.salesCount ?? 0) >= 100 && (product.sellerReputation ?? 0) >= 80 && ratingAccepted(product, group));
  return score.score >= 70 && score.confidence >= .55 && ratingAccepted(product, group) && highPriceAccepted ? "APROVADO PARA REVISÃO" : score.score >= 55 && score.confidence >= .35 ? "OPORTUNIDADE PARA REVISÃO" : "NÃO RECOMENDADO";
}
const publicHttps = (value: string) => { try { const url = new URL(value); return url.protocol === "https:" && !/^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i.test(url.hostname); } catch { return false; } };
export function zoeVerdictFor(product: MarketplaceProduct, score: ScoreResult, group: readonly MarketplaceProduct[]): Verdict {
  const value = score.score, comparisonConfidence = group.length >= 3 ? "sufficient" : "limited", hasCoreFact = product.price !== null || product.rating !== null, hasContext = product.sellerName !== null || product.sellerReputation !== null || (product.salesCount ?? 0) >= 10 || (product.reviewCount ?? 0) >= 10, priceOutOfContext = product.price !== null && (product.price < 30 || product.price > 500) && !product.description?.trim(), inconsistentSales = product.salesCount !== null && product.salesEvidence !== "PUBLIC_VISIBLE_TEXT", criticalRisk = !hasIdentity(product) || !isAvailable(product) || !publicHttps(product.canonicalUrl) || priceOutOfContext || inconsistentSales || (!hasCoreFact && !hasContext);
  if (criticalRisk || value === null) return "NÃO RECOMENDADO";
  if (value >= 80 && score.confidence >= .6 && hasCoreFact && hasContext) return "APROVADO PARA REVISÃO";
  const importantDataMissing = product.missingFields.some(field => ["price", "rating", "reviewCount", "salesCount", "seller"].includes(field));
  if (value >= 70 && (score.confidence >= .35 || importantDataMissing || comparisonConfidence === "limited")) return "OPORTUNIDADE PARA REVISÃO";
  return "NÃO RECOMENDADO";
}
export function allocateCategoryTargets(categories: readonly string[], weights: Readonly<Record<string, number>>, target: number): Readonly<Record<string, number>> { if (!categories.length) return {}; const values = categories.map(category => ({ category, weight: Math.max(10, weights[category] ?? 100 / categories.length) })), total = values.reduce((sum, value) => sum + value.weight, 0), result = Object.fromEntries(values.map(value => [value.category, Math.max(1, Math.floor(target * value.weight / total))])) as Record<string, number>; while (Object.values(result).reduce((sum, value) => sum + value, 0) < target) result[values[0]!.category]!++; return result; }
export const generateWinnerQueries = (winners: readonly WinningProduct[]) => winners.filter(winner => winner.conversions > 0).map(winner => `produtos similares a ${winner.name}`);
const candidateOrder = (a: RankedCandidate, b: RankedCandidate) => { const rank: Record<Verdict, number> = { "APROVADO PARA REVISÃO": 2, "OPORTUNIDADE PARA REVISÃO": 1, "NÃO RECOMENDADO": 0 }, scoreGap = (b.score.score ?? -1) - (a.score.score ?? -1); if (rank[a.verdict] === rank[b.verdict] && Math.abs(scoreGap) <= 3 && a.product.price !== null && b.product.price !== null) return a.product.price - b.product.price; return rank[b.verdict] - rank[a.verdict] || scoreGap || (b.score.factorScores.listingQuality ?? -1) - (a.score.factorScores.listingQuality ?? -1); };

export class ProductResearchService {
  constructor(private readonly provider: MarketplaceProductProvider, private readonly repository: ResearchRepository) {}
  async research(request: ResearchRequest) {
    const started = performance.now(), target = Math.min(request.targetCandidates ?? 20, 20), categories = request.categories ?? [], categoryTargets = allocateCategoryTargets(categories, request.categoryWeights ?? {}, target);
    const queries = [...new Set([...generateQueries(request.queries, categories), ...generateWinnerQueries(request.winningProducts ?? [])])];
    const [searchedBatches, seeded] = await Promise.all([
      Promise.all(queries.map(query => { const category = categories.find(value => query.includes(value)); return this.provider.searchProducts({ query, limit: category ? categoryTargets[category] ?? 1 : Math.max(1, Math.ceil(target / Math.max(queries.length, 1))) }); })),
      this.provider.getProducts && request.seedExternalIds?.length ? this.provider.getProducts([...new Set(request.seedExternalIds)].slice(0, 20)) : Promise.resolve([]),
    ]);
    const opportunityByProduct = new Map<string, OpportunityScore>();
    Object.entries(request.opportunityScoresByExternalId??{}).forEach(([externalId,score])=>opportunityByProduct.set(externalId,score));
    searchedBatches.forEach((batch,index)=>{const opportunity=request.opportunityScores?.[queries[index]!];if(opportunity)batch.forEach(product=>opportunityByProduct.set(product.externalId,opportunity))});
    let products = deduplicateProducts([...seeded, ...searchedBatches.flat()]).filter(product => hasIdentity(product) && isAvailable(product)).slice(0, target);
    if (this.provider.getSellers) {
      const sellerIds = [...new Set(products.flatMap(product => product.sellerExternalId ? [product.sellerExternalId] : []))];
      const sellers = new Map((await this.provider.getSellers(sellerIds)).map(seller => [seller.externalId, seller]));
      products = products.map(product => { const seller = product.sellerExternalId ? sellers.get(product.sellerExternalId) : undefined; return seller ? { ...product, sellerName: seller.name ?? product.sellerName, sellerReputation: seller.reputation ?? product.sellerReputation } : product; });
    }
    const groups = products.reduce<Map<string, MarketplaceProduct[]>>((map, product) => { const key = comparableGroupFor(product); map.set(key, [...(map.get(key) ?? []), product]); return map; }, new Map());
    const candidates = products.map(product => { const comparisonGroup = comparableGroupFor(product), group = groups.get(comparisonGroup) ?? [product], comparisonConfidence = group.length >= 3 ? "sufficient" as const : "limited" as const, score = scoreCandidate(product, group), verdict = this.provider.marketplace === "ZOE_WEB_RESEARCH" ? zoeVerdictFor(product, score, group) : verdictFor(product, score, group), opportunityScore = opportunityByProduct.get(product.externalId); const reasons = [score.explanation, product.price !== null && (product.price < 30 || product.price > 500) ? "Preço fora da faixa preferencial de R$30 a R$500; avaliado pelo contexto, sem rejeição automática." : "Preço dentro da faixa preferencial ou ausente.", comparisonConfidence === "sufficient" ? `Comparado com ${group.length} anúncios equivalentes.` : `Somente ${group.length} anúncio(s) equivalente(s) disponível(is); confiança da comparação limitada.`, product.missingFields.length ? `Dados ausentes: ${product.missingFields.join(", ")}.` : "Campos essenciais disponíveis."]; return { product, score, ...(opportunityScore ? { opportunityScore } : {}), verdict, reasons, comparisonGroup, comparisonConfidence }; }).sort(candidateOrder);
    const counts = { recommended: candidates.filter(value => value.verdict === "APROVADO PARA REVISÃO").length, opportunities: candidates.filter(value => value.verdict === "OPORTUNIDADE PARA REVISÃO").length, rejected: candidates.filter(value => value.verdict === "NÃO RECOMENDADO").length };
    return this.repository.save({ workspaceId: request.workspaceId, date: new Date(), queries, categories, candidates, ...counts, reasons: Object.fromEntries(candidates.map(value => [value.product.externalId, value.reasons])), durationMs: Math.round(performance.now() - started), provider: this.provider.marketplace });
  }
  getProductDetails(externalId: string) { return this.provider.getProduct(externalId); }
  async compare(workspaceId: string, externalIds: readonly string[]) { if (externalIds.length < 3) throw new Error("minimum_three_comparable_products_required"); const candidates = (await Promise.all(externalIds.map(id => this.repository.getCandidate(workspaceId, id)))).filter((value): value is RankedCandidate => value !== null); if (candidates.length < 3) throw new Error("minimum_three_comparable_products_required"); if (new Set(candidates.map(value => value.comparisonGroup)).size > 1) throw new Error("products_not_comparable"); const ranked = [...candidates].sort(candidateOrder); return { considered: ranked.map(value => value.product.externalId), winner: ranked[0] ?? null, reason: `Melhor produto entre ${ranked.length} anúncios equivalentes; em qualidade comparável, o menor preço prevalece.` }; }
  calculate(product: MarketplaceProduct, group: readonly MarketplaceProduct[] = [product]) { return scoreCandidate(product, group); }
  async calculateStored(workspaceId: string, externalId: string) { const candidate = await this.repository.getCandidate(workspaceId, externalId); if (!candidate) throw new Error("product_candidate_not_found"); return candidate.score; }
  listRuns(workspaceId: string) { return this.repository.list(workspaceId); }
  approve(workspaceId: string, externalId: string, reason: string) { return this.repository.setProductStatus(workspaceId, externalId, "under_review", reason); }
  reject(workspaceId: string, externalId: string, reason: string) { return this.repository.setProductStatus(workspaceId, externalId, "rejected", reason); }
}
export function generateQueries(queries: readonly string[], categories: readonly string[]): readonly string[] { const clean = queries.map(value => value.trim()).filter(Boolean); if (clean.length) return [...new Set(clean)]; const generated = categories.map(category => `melhores produtos para ${category}`).filter(Boolean); return generated.length ? generated : ["produtos úteis para casa"]; }
