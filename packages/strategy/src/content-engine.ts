import { assertSafeContent, facebookContentSchema, pinterestContentSchema, utilityContentSchema, type ContentAngle, type FacebookContent, type PinterestContent, type UtilityContent } from "@casapratica/domain";

export interface ProductContentFacts { id: string; workspaceId: string; name: string; description: string | null; affiliateUrl: string | null; rating: number | null; reviewCount: number | null; currentPrice: number | null; priceCheckedAt: Date | null }
export interface ContentHistoryItem { id: string; productId: string | null; platform: "pinterest" | "facebook"; title: string | null; body: string; metadata: Readonly<Record<string, unknown>>; createdAt: Date }
export interface ContentVariantDraft { platform: "pinterest" | "facebook"; title: string | null; body: string; metadata: Readonly<Record<string, unknown>> }
export interface SavedContent { id: string; productId: string | null; status: "draft"; variants: readonly ContentHistoryItem[] }
export interface ContentRepository {
  getProductFacts(workspaceId: string, productId: string): Promise<ProductContentFacts | null>;
  listProductContent(workspaceId: string, productId: string): Promise<readonly ContentHistoryItem[]>;
  listRecentContent(workspaceId: string): Promise<readonly ContentHistoryItem[]>;
  create(workspaceId: string, productId: string | null, title: string, body: string, variants: readonly ContentVariantDraft[]): Promise<SavedContent>;
  createVariant(workspaceId: string, contentId: string, variant: ContentVariantDraft): Promise<ContentHistoryItem>;
}
export interface GenerateProductContentInput { workspaceId: string; productId: string; platforms: readonly ("pinterest" | "facebook")[]; variants: number; angles?: readonly ContentAngle[] }
export interface GenerateUtilityContentInput { workspaceId: string; platform: "pinterest" | "facebook"; topic: string; angle?: ContentAngle; seasonalContext?: string | null }

const ANGLES: readonly ContentAngle[] = ["organization", "space_saving", "practicality", "problem_solution", "small_home", "utility", "seasonal", "comparison", "social_proof", "price_opportunity"];
const angleText: Record<ContentAngle, string> = { utility: "utilidade no dia a dia", problem_solution: "uma necessidade comum da casa", space_saving: "aproveitamento de espaço", organization: "organização da rotina", price_opportunity: "uma opção que vale conferir", social_proof: "informações e avaliações disponíveis", comparison: "critérios para comparar opções", seasonal: "organização para a época", practicality: "praticidade na rotina", small_home: "soluções para espaços pequenos" };
const ctas = ["Confira os detalhes.", "Veja o preço atual.", "Clique para conferir.", "Veja mais informações."] as const;
const disclosure = (hasLink: boolean) => hasLink ? "A CasaPrática pode receber comissão por compras feitas pelo link de afiliado, sem custo adicional para você." : "Este conteúdo não contém link de afiliado; a CasaPrática não vende nem entrega produtos.";
const normalize = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const fingerprint = (title: string | null, body: string, angle: ContentAngle) => `${normalize(title ?? "")}:${normalize(body)}:${angle}`;
const metadata = (output: PinterestContent | FacebookContent | UtilityContent) => JSON.parse(JSON.stringify(output)) as Readonly<Record<string, unknown>>;

export class ContentEngine {
  constructor(private readonly repository: ContentRepository) {}
  async generateProduct(input: GenerateProductContentInput): Promise<SavedContent> {
    if (input.variants < 1 || input.variants > 3) throw new Error("variants_must_be_between_1_and_3");
    const product = await this.repository.getProductFacts(input.workspaceId, input.productId);
    if (!product) throw new Error("product_not_found");
    const history = await this.repository.listProductContent(input.workspaceId, input.productId);
    const used = new Set(history.map(item => fingerprint(item.title, item.body, item.metadata.contentAngle as ContentAngle)));
    const requested = input.angles?.length ? input.angles : ANGLES;
    const drafts: ContentVariantDraft[] = [];
    for (const platform of [...new Set(input.platforms)]) {
      let created = 0;
      for (const angle of [...requested, ...ANGLES]) {
        if (created >= input.variants) break;
        const draft = platform === "pinterest" ? this.pinterest(product, angle, created) : this.facebook(product, angle, created);
        if (used.has(fingerprint(draft.title, draft.body, angle))) continue;
        used.add(fingerprint(draft.title, draft.body, angle)); drafts.push(draft); created++;
      }
      if (created < input.variants) throw new Error("insufficient_distinct_content_variants");
    }
    return this.repository.create(input.workspaceId, product.id, drafts[0]?.title ?? product.name, drafts[0]?.body ?? product.name, drafts);
  }
  async generateUtility(input: GenerateUtilityContentInput): Promise<SavedContent> {
    const angle = input.angle ?? "utility", seasonalContext = input.seasonalContext ?? null;
    const parsed = utilityContentSchema.parse({ platform: input.platform, title: `${input.topic}: guia prático`, body: `${input.topic} começa com passos simples: observe o espaço, defina prioridades e organize uma área por vez. Adapte as ideias à realidade da sua casa.`, cta: "Salve para consultar depois.", contentPillar: seasonalContext ? "seasonal" : "utility", contentAngle: angle, visualBrief: `Checklist visual sobre ${input.topic}, com composição clara e sem preços.`, keywords: input.topic.split(/\s+/).filter(Boolean), seasonalContext, linkPlacement: "NONE" });
    assertSafeContent(parsed.title, parsed.body, parsed.cta);
    const history = await this.repository.listRecentContent(input.workspaceId), body = parsed.body;
    if (history.some(item => fingerprint(item.title, item.body, angle) === fingerprint(parsed.title, body, angle))) throw new Error("duplicate_content");
    return this.repository.create(input.workspaceId, null, parsed.title, body, [{ platform: input.platform, title: parsed.title, body, metadata: metadata(parsed) }]);
  }
  listProductContent(workspaceId: string, productId: string) { return this.repository.listProductContent(workspaceId, productId); }
  getContentHistory(workspaceId: string, productId?: string) { return productId ? this.repository.listProductContent(workspaceId, productId) : this.repository.listRecentContent(workspaceId); }
  createVariant(workspaceId: string, contentId: string, variant: ContentVariantDraft) { assertSafeContent(variant.title ?? "", variant.body); return this.repository.createVariant(workspaceId, contentId, variant); }
  private pinterest(product: ProductContentFacts, angle: ContentAngle, index: number): ContentVariantDraft {
    const social = product.rating !== null && product.reviewCount !== null ? ` Avaliação confirmada de ${product.rating.toFixed(1)} em ${product.reviewCount} opiniões na consulta.` : "";
    const parsed = pinterestContentSchema.parse({ title: `${product.name}: ${angleText[angle]}`, description: `Para quem busca ${angleText[angle]}, vale conhecer os detalhes de ${product.name}.${social} Confira medidas, condições e informações atuais na página do produto.`, cta: ctas[index % ctas.length], keywords: [product.name, "casa prática", angleText[angle]], keywordCluster: angle, boardSuggestion: angle === "small_home" ? "Casa pequena e funcional" : "Ideias práticas para casa", contentAngle: angle, visualBrief: `Imagem do produto em contexto de ${angleText[angle]}, sem preço e sem promessas não confirmadas.`, affiliateDisclosure: disclosure(Boolean(product.affiliateUrl)) });
    assertSafeContent(parsed.title, parsed.description, parsed.cta); return { platform: "pinterest", title: parsed.title, body: parsed.description, metadata: metadata(parsed) };
  }
  private facebook(product: ProductContentFacts, angle: ContentAngle, index: number): ContentVariantDraft {
    const hasLink = Boolean(product.affiliateUrl), linkPlacement = hasLink ? "COMMENT" : "NONE";
    const copy = `Quando o assunto é ${angleText[angle]}, encontrar informações claras ajuda na escolha. ${product.name} é uma opção para conhecer e comparar com a sua necessidade. ${ctas[index % ctas.length]}`;
    const parsed = facebookContentSchema.parse({ copy, cta: ctas[index % ctas.length], contentPillar: "product", contentAngle: angle, visualBrief: `Cena conversacional sobre ${angleText[angle]}, destacando o produto sem inserir preço.`, affiliateDisclosure: disclosure(hasLink), linkPlacement, comment: product.affiliateUrl ? { body: "Confira informações, condições e preço atual no link:", affiliateUrl: product.affiliateUrl, affiliateDisclosure: disclosure(true) } : null });
    assertSafeContent(parsed.copy, parsed.cta, parsed.comment?.body ?? ""); return { platform: "facebook", title: null, body: parsed.copy, metadata: metadata(parsed) };
  }
}
