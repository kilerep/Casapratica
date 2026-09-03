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
  registry.register({ name: "compare_products", description: "Compara somente candidatos pertencentes ao mesmo grupo comparável e registra o motivo do vencedor.", parameters: z.object({ externalIds: z.array(z.string().min(1)).min(2) }), externalAction: false, execute: ({ externalIds }) => service.compare(workspaceId, externalIds) });
  registry.register({ name: "calculate_product_score", description: "Retorna o score persistido com confiança e fatores ausentes explícitos.", parameters: z.object({ externalId: z.string().min(1) }), externalAction: false, execute: ({ externalId }) => service.calculateStored(workspaceId, externalId) });
  registry.register({ name: "list_research_runs", description: "Lista execuções de pesquisa persistidas do workspace.", parameters: z.object({}), externalAction: false, execute: () => service.listRuns(workspaceId) });
  registry.register({ name: "approve_product", description: "Aprova internamente um produto candidato com motivo explícito. Não publica conteúdo.", parameters: z.object({ externalId: z.string().min(1), reason: z.string().min(3) }), externalAction: false, execute: ({ externalId, reason }) => service.approve(workspaceId, externalId, reason) });
  registry.register({ name: "reject_product", description: "Rejeita internamente um produto candidato com motivo explícito.", parameters: z.object({ externalId: z.string().min(1), reason: z.string().min(3) }), externalAction: false, execute: ({ externalId, reason }) => service.reject(workspaceId, externalId, reason) });
}
