import { z } from "zod";
import type { TraceRepository } from "./contracts.js";

export interface RegisteredTool<TSchema extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>> {
  readonly name: string;
  readonly description: string;
  readonly parameters: TSchema;
  readonly externalAction: boolean;
  execute(input: z.infer<TSchema>): Promise<unknown>;
}

export class ToolRegistry {
  readonly #tools = new Map<string, RegisteredTool>();
  constructor(private readonly traces?: TraceRepository) {}
  register<TSchema extends z.ZodObject<z.ZodRawShape>>(tool: RegisteredTool<TSchema>): void {
    if (this.#tools.has(tool.name)) throw new Error(`Tool already registered: ${tool.name}`);
    this.#tools.set(tool.name, tool);
  }
  get(name: string): RegisteredTool {
    const tool = this.#tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    return tool;
  }
  list(): readonly RegisteredTool[] { return [...this.#tools.values()]; }
  async execute(name: string, input: unknown, agent = "CasaPraticaManagerAgent"): Promise<unknown> {
    const registered = this.get(name);
    if (registered.externalAction) throw new Error(`approval_required:${name}`);
    const startedAt = performance.now();
    try {
      const result = await registered.execute(registered.parameters.parse(input));
      await this.traces?.append({ agent, tool: name, durationMs: performance.now() - startedAt, status: "succeeded", errorCode: null, usage: null });
      return result;
    } catch (error) {
      await this.traces?.append({ agent, tool: name, durationMs: performance.now() - startedAt, status: "failed", errorCode: error instanceof Error ? error.message : "unknown_error", usage: null });
      throw error;
    }
  }
}

export interface ProductQueryService { findFacts(productId: string): Promise<unknown> }
export interface PerformanceQueryService { diagnose(from: string, to: string): Promise<unknown> }
export function registerOperationalTools(registry: ToolRegistry, services: { products: ProductQueryService; performance: PerformanceQueryService }): void {
  registry.register({ name: "get_product_facts", description: "Read verified product facts through the application service.", parameters: z.object({ productId: z.string() }), externalAction: false, execute: ({ productId }) => services.products.findFacts(productId) });
  registry.register({ name: "get_performance_metrics", description: "Read persisted performance metrics through the application service.", parameters: z.object({ from: z.string(), to: z.string() }), externalAction: false, execute: ({ from, to }) => services.performance.diagnose(from, to) });
}

export interface ProductResearchToolService {
  research(input: { workspaceId: string; queries: readonly string[]; categories?: readonly string[]; targetCandidates?: number }): Promise<unknown>;
  getProductDetails(externalId: string): Promise<unknown>;
  compare(workspaceId: string, externalIds: readonly string[]): Promise<unknown>;
  calculateStored(workspaceId: string, externalId: string): Promise<unknown>;
  listRuns(workspaceId: string): Promise<unknown>;
  approve(workspaceId: string, externalId: string, reason: string): Promise<void>;
  reject(workspaceId: string, externalId: string, reason: string): Promise<void>;
}
export function registerProductResearchTools(registry: ToolRegistry, service: ProductResearchToolService, workspaceId: string): void {
  registry.register({ name: "search_products", description: "Pesquisa produtos reais no provider e executa normalização, deduplicação, elegibilidade, score e ranking. Para a pesquisa diária, solicite até 20 candidatos sem completar com itens inelegíveis.", parameters: z.object({ queries: z.array(z.string().min(1)).default([]), categories: z.array(z.string().min(1)).default([]), targetCandidates: z.number().int().min(1).max(20).default(20) }), externalAction: false, execute: input => service.research({ workspaceId, ...input }) });
  registry.register({ name: "get_product_details", description: "Obtém detalhes atuais de um produto no provider oficial.", parameters: z.object({ externalId: z.string().min(1) }), externalAction: false, execute: ({ externalId }) => service.getProductDetails(externalId) });
  registry.register({ name: "compare_products", description: "Compara pelo menos três candidatos equivalentes e registra o motivo do vencedor.", parameters: z.object({ externalIds: z.array(z.string().min(1)).min(3) }), externalAction: false, execute: ({ externalIds }) => service.compare(workspaceId, externalIds) });
  registry.register({ name: "calculate_product_score", description: "Retorna o score persistido com confiança e fatores ausentes explícitos.", parameters: z.object({ externalId: z.string().min(1) }), externalAction: false, execute: ({ externalId }) => service.calculateStored(workspaceId, externalId) });
  registry.register({ name: "list_research_runs", description: "Lista execuções de pesquisa persistidas do workspace.", parameters: z.object({}), externalAction: false, execute: () => service.listRuns(workspaceId) });
  registry.register({ name: "recommend_product", description: "Registra que o proprietário recomendou o produto para seguir ao fluxo de conteúdo. Não aprova publicação.", parameters: z.object({ externalId: z.string().min(1), reason: z.string().min(3) }), externalAction: false, execute: ({ externalId, reason }) => service.approve(workspaceId, externalId, reason) });
  registry.register({ name: "reject_product", description: "Rejeita internamente um produto candidato com motivo explícito.", parameters: z.object({ externalId: z.string().min(1), reason: z.string().min(3) }), externalAction: false, execute: ({ externalId, reason }) => service.reject(workspaceId, externalId, reason) });
}

type ContentToolAngle = "utility" | "problem_solution" | "space_saving" | "organization" | "price_opportunity" | "social_proof" | "comparison" | "seasonal" | "practicality" | "small_home";
export interface ContentToolService {
  generateProduct(input: { workspaceId: string; productId: string; platforms: readonly ("pinterest" | "facebook")[]; variants: number; angles?: readonly ContentToolAngle[] }): Promise<unknown>;
  generateUtility(input: { workspaceId: string; platform: "pinterest" | "facebook"; topic: string; angle?: ContentToolAngle; seasonalContext?: string | null }): Promise<unknown>;
  listProductContent(workspaceId: string, productId: string): Promise<unknown>;
  getContentHistory(workspaceId: string, productId?: string): Promise<unknown>;
  createVariant(workspaceId: string, contentId: string, variant: { platform: "pinterest" | "facebook"; title: string | null; body: string; metadata: Readonly<Record<string, unknown>> }): Promise<unknown>;
}
const contentAngle = z.enum(["utility", "problem_solution", "space_saving", "organization", "price_opportunity", "social_proof", "comparison", "seasonal", "practicality", "small_home"]);
export function registerContentTools(registry: ToolRegistry, service: ContentToolService, workspaceId: string): void {
  const generate = (platform: "pinterest" | "facebook") => ({ productId, variants, angles }: { productId: string; variants: number; angles: ContentToolAngle[] }) => service.generateProduct({ workspaceId, productId, platforms: [platform], variants, angles });
  const productParameters = z.object({ productId: z.string().min(1), variants: z.number().int().min(1).max(3).default(1), angles: z.array(contentAngle).default([]) });
  registry.register({ name: "generate_pinterest_content", description: "Gera Pins estruturados e distintos a partir de fatos confirmados.", parameters: productParameters, externalAction: false, execute: generate("pinterest") });
  registry.register({ name: "generate_facebook_content", description: "Gera conteúdo estruturado para Facebook; links de produto ficam em comentário por padrão.", parameters: productParameters, externalAction: false, execute: generate("facebook") });
  registry.register({ name: "generate_utility_content", description: "Gera conteúdo útil sem exigir produto ou link afiliado.", parameters: z.object({ platform: z.enum(["pinterest", "facebook"]), topic: z.string().min(3), angle: contentAngle.default("utility"), seasonalContext: z.string().nullable().default(null) }), externalAction: false, execute: input => service.generateUtility({ workspaceId, ...input }) });
  registry.register({ name: "list_product_content", description: "Lista histórico de conteúdo de um produto.", parameters: z.object({ productId: z.string().min(1) }), externalAction: false, execute: ({ productId }) => service.listProductContent(workspaceId, productId) });
  registry.register({ name: "create_content_variant", description: "Cria uma variante draft validada; nunca publica.", parameters: z.object({ contentId: z.string().min(1), platform: z.enum(["pinterest", "facebook"]), title: z.string().nullable(), body: z.string().min(20), metadata: z.record(z.string(), z.unknown()) }), externalAction: false, execute: ({ contentId, ...variant }) => service.createVariant(workspaceId, contentId, variant) });
  registry.register({ name: "get_content_history", description: "Consulta histórico recente para evitar repetição.", parameters: z.object({ productId: z.string().optional() }), externalAction: false, execute: ({ productId }) => service.getContentHistory(workspaceId, productId) });
}

export interface PinterestStrategyToolService { createWeeklyStrategy(workspaceId: string, start: Date, seasonalContext?: string | null): Promise<unknown>; createDailyPlan(workspaceId: string, date: Date, requestedPins?: number): Promise<unknown>; recommendBoard(input: { category?: string | null; keywords?: readonly string[]; content?: string }): unknown; generateKeywords(topic: string): unknown; preparePin(workspaceId: string, contentId: string): Promise<unknown>; listBoards(workspaceId: string): Promise<unknown>; getStrategy(workspaceId: string): Promise<unknown>; getContentHistory(workspaceId: string): Promise<unknown> }
export function registerPinterestStrategyTools(registry: ToolRegistry, service: PinterestStrategyToolService, workspaceId: string): void {
  registry.register({ name: "create_pinterest_strategy", description: "Cria estratégia semanal estruturada sem executar ações externas.", parameters: z.object({ start: z.coerce.date(), seasonalContext: z.string().nullable().optional() }), externalAction: false, execute: ({ start, seasonalContext }) => service.createWeeklyStrategy(workspaceId, start, seasonalContext) });
  registry.register({ name: "create_daily_pinterest_plan", description: "Cria plano diário com teto de 10 Pins, reduzido pela qualidade disponível.", parameters: z.object({ date: z.coerce.date(), requestedPins: z.number().int().min(1).max(10).default(10) }), externalAction: false, execute: ({ date, requestedPins }) => service.createDailyPlan(workspaceId, date, requestedPins) });
  registry.register({ name: "recommend_pinterest_board", description: "Recomenda board por categoria, keywords e intenção; não cria boards.", parameters: z.object({ category: z.string().nullable().optional(), keywords: z.array(z.string()).default([]), content: z.string().optional() }), externalAction: false, execute: async ({ category, keywords, content }) => service.recommendBoard({ keywords, ...(category !== undefined ? { category } : {}), ...(content !== undefined ? { content } : {}) }) });
  registry.register({ name: "generate_pinterest_keywords", description: "Gera cluster de keywords e intenção de busca estruturados.", parameters: z.object({ topic: z.string().min(2) }), externalAction: false, execute: async ({ topic }) => service.generateKeywords(topic) });
  registry.register({ name: "prepare_pinterest_pin", description: "Valida e prepara um Pin em awaiting_approval; não publica.", parameters: z.object({ contentId: z.string().min(1) }), externalAction: false, execute: ({ contentId }) => service.preparePin(workspaceId, contentId) });
  registry.register({ name: "list_pinterest_boards", description: "Lista boards reais somente quando OAuth e read_boards estiverem disponíveis.", parameters: z.object({}), externalAction: false, execute: () => service.listBoards(workspaceId) });
  registry.register({ name: "get_pinterest_strategy", description: "Obtém a estratégia Pinterest ativa.", parameters: z.object({}), externalAction: false, execute: () => service.getStrategy(workspaceId) });
  registry.register({ name: "get_pinterest_content_history", description: "Consulta conteúdo Pinterest para prevenir duplicação.", parameters: z.object({}), externalAction: false, execute: () => service.getContentHistory(workspaceId) });
}

export interface FacebookStrategyToolService { createWeeklyStrategy(workspaceId: string, start: Date, seasonalContext?: string | null): Promise<unknown>; createDailyPlan(workspaceId: string, date: Date, requestedPosts?: number): Promise<unknown>; preparePost(workspaceId: string, contentId: string): Promise<unknown>; prepareStoredComment(workspaceId: string, contentId: string): Promise<unknown>; evaluateStoredReuse(workspaceId: string, productId: string, proposedAngle?: ContentToolAngle): Promise<unknown>; getStrategy(workspaceId: string): Promise<unknown>; getContentHistory(workspaceId: string): Promise<unknown>; listPages(workspaceId: string): Promise<unknown> }
export function registerFacebookStrategyTools(registry: ToolRegistry, service: FacebookStrategyToolService, workspaceId: string): void {
  registry.register({ name: "create_facebook_strategy", description: "Cria estratégia semanal estruturada, com mix configurável e sem publicar.", parameters: z.object({ start: z.coerce.date(), seasonalContext: z.string().nullable().optional() }), externalAction: false, execute: ({ start, seasonalContext }) => service.createWeeklyStrategy(workspaceId, start, seasonalContext) });
  registry.register({ name: "create_daily_facebook_plan", description: "Cria plano diário de qualidade com teto de 20 posts, não uma meta.", parameters: z.object({ date: z.coerce.date(), requestedPosts: z.number().int().min(1).max(20).default(4) }), externalAction: false, execute: ({ date, requestedPosts }) => service.createDailyPlan(workspaceId, date, requestedPosts) });
  registry.register({ name: "prepare_facebook_post", description: "Valida e prepara post em awaiting_approval; nunca publica.", parameters: z.object({ contentId: z.string().min(1) }), externalAction: false, execute: ({ contentId }) => service.preparePost(workspaceId, contentId) });
  registry.register({ name: "prepare_facebook_comment", description: "Prepara o comentário afiliado para ação humana; não afirma publicação.", parameters: z.object({ contentId: z.string().min(1) }), externalAction: false, execute: ({ contentId }) => service.prepareStoredComment(workspaceId, contentId) });
  registry.register({ name: "evaluate_facebook_reuse", description: "Avalia histórico, duplicidade e nova razão editorial antes de reutilizar produto.", parameters: z.object({ productId: z.string().min(1), proposedAngle: contentAngle.optional() }), externalAction: false, execute: ({ productId, proposedAngle }) => service.evaluateStoredReuse(workspaceId, productId, proposedAngle) });
  registry.register({ name: "get_facebook_strategy", description: "Obtém a estratégia Facebook ativa e validada.", parameters: z.object({}), externalAction: false, execute: () => service.getStrategy(workspaceId) });
  registry.register({ name: "get_facebook_content_history", description: "Consulta histórico Facebook para evitar repetição.", parameters: z.object({}), externalAction: false, execute: () => service.getContentHistory(workspaceId) });
  registry.register({ name: "list_facebook_pages", description: "Lista páginas reais somente com OAuth e read_page disponíveis.", parameters: z.object({}), externalAction: false, execute: () => service.listPages(workspaceId) });
}
