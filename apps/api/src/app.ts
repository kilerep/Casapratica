import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import type { CreativeRequest } from "@casapratica/domain";
import { chatRequestSchema, type AIChatService } from "@casapratica/agents";
import type {
  IntegrationService,
  ProviderName,
} from "@casapratica/integrations";
import { contentAngleSchema, contentPlatformSchema } from "@casapratica/domain";
import { z } from "zod";

interface ContentApiService {
  generateProduct(input: {
    workspaceId: string;
    productId: string;
    platforms: readonly ("pinterest" | "facebook")[];
    variants: number;
    angles?: readonly (
      | "utility"
      | "problem_solution"
      | "space_saving"
      | "organization"
      | "price_opportunity"
      | "social_proof"
      | "comparison"
      | "seasonal"
      | "practicality"
      | "small_home"
    )[];
  }): Promise<unknown>;
  generateUtility(input: {
    workspaceId: string;
    platform: "pinterest" | "facebook";
    topic: string;
    angle?:
      | "utility"
      | "problem_solution"
      | "space_saving"
      | "organization"
      | "price_opportunity"
      | "social_proof"
      | "comparison"
      | "seasonal"
      | "practicality"
      | "small_home";
    seasonalContext?: string | null;
  }): Promise<unknown>;
}
interface PinterestApiService {
  createWeeklyStrategy(
    workspaceId: string,
    start: Date,
    seasonalContext?: string | null,
  ): Promise<unknown>;
  createDailyPlan(
    workspaceId: string,
    date: Date,
    requestedPins?: number,
  ): Promise<unknown>;
  preparePin(workspaceId: string, contentId: string): Promise<unknown>;
  getStrategy(workspaceId: string): Promise<unknown>;
  recommendBoard(input: {
    category?: string | null;
    keywords?: readonly string[];
    content?: string;
  }): unknown;
}
interface FacebookApiService {
  createWeeklyStrategy(
    workspaceId: string,
    start: Date,
    seasonalContext?: string | null,
  ): Promise<unknown>;
  createDailyPlan(
    workspaceId: string,
    date: Date,
    requestedPosts?: number,
  ): Promise<unknown>;
  preparePost(workspaceId: string, contentId: string): Promise<unknown>;
  evaluateStoredReuse(
    workspaceId: string,
    productId: string,
    proposedAngle?: z.infer<typeof contentAngleSchema>,
  ): Promise<unknown>;
  getStrategy(workspaceId: string): Promise<unknown>;
  getContentHistory(workspaceId: string): Promise<unknown>;
}
interface CreativeApiService {
  request(
    workspaceId: string,
    productId: string,
    input: {
      contentId: string;
      platform: "pinterest" | "facebook";
      format: CreativeRequest["format"];
      template: CreativeRequest["template"];
      variantCount: number;
    },
  ): Promise<CreativeRequest>;
  analyze(request: CreativeRequest): unknown;
  preview(request: CreativeRequest): Promise<unknown>;
  render(request: CreativeRequest): Promise<unknown>;
  variants(request: CreativeRequest): unknown;
  getProductCreatives(workspaceId: string, productId: string): Promise<unknown>;
}
interface OperationsApiService {
  run(workspaceId: string, date: Date): Promise<unknown>;
  listQueue(workspaceId: string): Promise<unknown>;
  approve(workspaceId: string, id: string, actorId: string): Promise<unknown>;
  reject(
    workspaceId: string,
    id: string,
    actorId: string,
    reason: string,
  ): Promise<unknown>;
  approveBatch(
    workspaceId: string,
    ids: readonly string[],
    actorId: string,
  ): Promise<unknown>;
  schedule(
    workspaceId: string,
    id: string,
    actorId: string,
    at: Date,
  ): Promise<unknown>;
  reconcileScheduled?(workspaceId: string): Promise<unknown>;
  publishNow(
    workspaceId: string,
    id: string,
    actorId: string,
  ): Promise<unknown>;
  cancel(workspaceId: string, id: string, actorId: string): Promise<unknown>;
  retry(workspaceId: string, id: string, actorId: string): Promise<unknown>;
  status(workspaceId: string, id: string): Promise<unknown>;
  alerts(workspaceId: string): Promise<unknown>;
}
interface AnalyticsApiService {
  overview(w:string,p:{start:Date;end:Date}):Promise<unknown>; product(w:string,id:string,p:{start:Date;end:Date}):Promise<unknown>; category(w:string,id:string,p:{start:Date;end:Date}):Promise<unknown>; platform(w:string,id:"pinterest"|"facebook"|"business",p:{start:Date;end:Date}):Promise<unknown>; creativeComparison(w:string,ids:readonly string[],p:{start:Date;end:Date}):Promise<unknown>; winners(w:string,p:{start:Date;end:Date}):Promise<unknown>; underperformers(w:string,p:{start:Date;end:Date}):Promise<unknown>; insights(w:string,p:{start:Date;end:Date}):Promise<unknown>; dataQuality(w:string,p:{start:Date;end:Date}):Promise<unknown>; daily(w:string,p:{start:Date;end:Date}):Promise<unknown>; weekly(w:string,p:{start:Date;end:Date}):Promise<unknown>;
}
type ReadinessResult={status:"ready"|"degraded"|"not_ready";database:string;redis:string;worker:string;integrations:Record<string,string>};

export function buildApp(
  options: {
    aiChat?: Pick<AIChatService, "chat">;
    integrations?: Pick<
      IntegrationService,
      "list" | "status" | "connect" | "callback" | "validate" | "disconnect"
    >;
    content?: ContentApiService;
    pinterest?: PinterestApiService;
    facebook?: FacebookApiService;
    creative?: CreativeApiService;
    operations?: OperationsApiService;
    analytics?: AnalyticsApiService;
    readiness?:()=>Promise<ReadinessResult>;
    workspaceId?: string;
  } = {},
) {
  const app = Fastify({ logger: true });
  app.get("/health", async () => ({ status: "ok" as const }));
  app.get("/ready",async(_request,reply)=>{if(!options.readiness)return reply.code(503).send({status:"not_ready",database:"not_configured",redis:"not_configured",worker:"unknown",integrations:{mercadolivre:"optional",pinterest:"optional",meta:"optional"}});const result=await options.readiness();return reply.code(result.status==="not_ready"?503:200).send(result)});
  app.post("/api/ai/chat", async (request, reply) => {
    const input = chatRequestSchema.safeParse(request.body);
    if (!input.success)
      return reply
        .code(400)
        .send({ error: "invalid_request", details: input.error.issues });
    if (!options.aiChat)
      return reply.code(503).send({ error: "ai_not_configured" });
    try {
      return await options.aiChat.chat(input.data);
    } catch (error) {
      request.log.error(
        { errorCode: error instanceof Error ? error.message : "unknown_error" },
        "AI chat failed",
      );
      return reply
        .code(422)
        .send({
          error: error instanceof Error ? error.message : "ai_chat_failed",
        });
    }
  });
  const provider = (value: string): ProviderName => {
    if (!["pinterest", "facebook", "mercadolivre"].includes(value))
      throw new Error("unknown_provider");
    return value as ProviderName;
  };
  app.get("/api/integrations", async (_request, reply) =>
    options.integrations && options.workspaceId
      ? options.integrations.list(options.workspaceId)
      : reply.code(503).send({ error: "integrations_not_configured" }),
  );
  app.get<{ Params: { provider: string } }>(
    "/api/integrations/:provider/status",
    async (request, reply) =>
      options.integrations && options.workspaceId
        ? options.integrations.status(
            options.workspaceId,
            provider(request.params.provider),
          )
        : reply.code(503).send({ error: "integrations_not_configured" }),
  );
  app.get<{ Params: { provider: string }; Querystring: { test?: string } }>(
    "/api/integrations/:provider/connect",
    async (request, reply) => {
      if (!options.integrations || !options.workspaceId)
        return reply.code(503).send({ error: "integrations_not_configured" });
      if (request.query.test === "true")
        return options.integrations.validate(
          options.workspaceId,
          provider(request.params.provider),
        );
      return reply.redirect(
        await options.integrations.connect(
          options.workspaceId,
          provider(request.params.provider),
        ),
      );
    },
  );
  app.get<{
    Params: { provider: string };
    Querystring: { code?: string; state?: string };
  }>("/api/integrations/:provider/callback", async (request, reply) => {
    if (!options.integrations || !request.query.code || !request.query.state)
      return reply.code(400).send({ error: "invalid_callback" });
    return options.integrations.callback(
      provider(request.params.provider),
      request.query.code,
      request.query.state,
    );
  });
  app.post<{ Params: { provider: string } }>(
    "/api/integrations/:provider/disconnect",
    async (request, reply) => {
      if (!options.integrations || !options.workspaceId)
        return reply.code(503).send({ error: "integrations_not_configured" });
      await options.integrations.disconnect(
        options.workspaceId,
        provider(request.params.provider),
      );
      return reply.code(204).send();
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/products/:id/content",
    async (request, reply) => {
      if (!options.content || !options.workspaceId)
        return reply.code(503).send({ error: "content_engine_not_configured" });
      const parsed = z
        .object({
          platforms: z.array(contentPlatformSchema).min(1),
          variants: z.number().int().min(1).max(3).default(1),
          angles: z.array(contentAngleSchema).default([]),
        })
        .safeParse(request.body);
      if (!parsed.success)
        return reply
          .code(400)
          .send({ error: "invalid_request", details: parsed.error.issues });
      try {
        return await options.content.generateProduct({
          workspaceId: options.workspaceId,
          productId: request.params.id,
          ...parsed.data,
        });
      } catch (error) {
        return reply
          .code(
            error instanceof Error && error.message === "product_not_found"
              ? 404
              : 422,
          )
          .send({
            error:
              error instanceof Error
                ? error.message
                : "content_generation_failed",
          });
      }
    },
  );
  app.post("/api/content/utility", async (request, reply) => {
    if (!options.content || !options.workspaceId)
      return reply.code(503).send({ error: "content_engine_not_configured" });
    const parsed = z
      .object({
        platform: contentPlatformSchema,
        topic: z.string().min(3),
        angle: contentAngleSchema.optional(),
        seasonalContext: z.string().nullable().optional(),
      })
      .safeParse(request.body);
    if (!parsed.success)
      return reply
        .code(400)
        .send({ error: "invalid_request", details: parsed.error.issues });
    try {
      const { platform, topic, angle, seasonalContext } = parsed.data;
      return await options.content.generateUtility({
        workspaceId: options.workspaceId,
        platform,
        topic,
        ...(angle ? { angle } : {}),
        ...(seasonalContext !== undefined ? { seasonalContext } : {}),
      });
    } catch (error) {
      return reply
        .code(422)
        .send({
          error:
            error instanceof Error
              ? error.message
              : "content_generation_failed",
        });
    }
  });
  app.post("/api/pinterest/strategy/weekly", async (request, reply) => {
    if (!options.pinterest || !options.workspaceId)
      return reply
        .code(503)
        .send({ error: "pinterest_strategy_not_configured" });
    const parsed = z
      .object({
        start: z.coerce.date(),
        seasonalContext: z.string().nullable().optional(),
      })
      .safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "invalid_request" });
    return options.pinterest.createWeeklyStrategy(
      options.workspaceId,
      parsed.data.start,
      parsed.data.seasonalContext,
    );
  });
  app.post("/api/pinterest/plan/daily", async (request, reply) => {
    if (!options.pinterest || !options.workspaceId)
      return reply
        .code(503)
        .send({ error: "pinterest_strategy_not_configured" });
    const parsed = z
      .object({
        date: z.coerce.date(),
        requestedPins: z.number().int().min(1).max(10).default(10),
      })
      .safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "invalid_request" });
    return options.pinterest.createDailyPlan(
      options.workspaceId,
      parsed.data.date,
      parsed.data.requestedPins,
    );
  });
  app.post<{ Params: { id: string } }>(
    "/api/products/:id/pinterest/prepare",
    async (request, reply) => {
      if (!options.pinterest || !options.workspaceId)
        return reply
          .code(503)
          .send({ error: "pinterest_strategy_not_configured" });
      try {
        return await options.pinterest.preparePin(
          options.workspaceId,
          request.params.id,
        );
      } catch (error) {
        return reply
          .code(422)
          .send({
            error:
              error instanceof Error
                ? error.message
                : "pinterest_prepare_failed",
          });
      }
    },
  );
  app.get("/api/pinterest/strategy", async (_request, reply) =>
    options.pinterest && options.workspaceId
      ? options.pinterest.getStrategy(options.workspaceId)
      : reply.code(503).send({ error: "pinterest_strategy_not_configured" }),
  );
  app.get("/api/pinterest/boards/recommendations", async (request, reply) => {
    if (!options.pinterest)
      return reply
        .code(503)
        .send({ error: "pinterest_strategy_not_configured" });
    const parsed = z
      .object({
        category: z.string().optional(),
        keywords: z.string().optional(),
        content: z.string().optional(),
      })
      .safeParse(request.query);
    if (!parsed.success)
      return reply.code(400).send({ error: "invalid_request" });
    return options.pinterest.recommendBoard({
      ...(parsed.data.category ? { category: parsed.data.category } : {}),
      keywords: parsed.data.keywords?.split(",").filter(Boolean) ?? [],
      ...(parsed.data.content ? { content: parsed.data.content } : {}),
    });
  });
  app.post("/api/facebook/strategy/weekly", async (request, reply) => {
    if (!options.facebook || !options.workspaceId)
      return reply
        .code(503)
        .send({ error: "facebook_strategy_not_configured" });
    const parsed = z
      .object({
        start: z.coerce.date(),
        seasonalContext: z.string().nullable().optional(),
      })
      .safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "invalid_request" });
    return options.facebook.createWeeklyStrategy(
      options.workspaceId,
      parsed.data.start,
      parsed.data.seasonalContext,
    );
  });
  app.post("/api/facebook/plan/daily", async (request, reply) => {
    if (!options.facebook || !options.workspaceId)
      return reply
        .code(503)
        .send({ error: "facebook_strategy_not_configured" });
    const parsed = z
      .object({
        date: z.coerce.date(),
        requestedPosts: z.number().int().min(1).max(20).default(4),
      })
      .safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "invalid_request" });
    return options.facebook.createDailyPlan(
      options.workspaceId,
      parsed.data.date,
      parsed.data.requestedPosts,
    );
  });
  app.post<{ Params: { id: string } }>(
    "/api/products/:id/facebook/prepare",
    async (request, reply) => {
      if (!options.facebook || !options.workspaceId)
        return reply
          .code(503)
          .send({ error: "facebook_strategy_not_configured" });
      try {
        return await options.facebook.preparePost(
          options.workspaceId,
          request.params.id,
        );
      } catch (error) {
        return reply
          .code(422)
          .send({
            error:
              error instanceof Error
                ? error.message
                : "facebook_prepare_failed",
          });
      }
    },
  );
  app.post("/api/facebook/reuse/evaluate", async (request, reply) => {
    if (!options.facebook || !options.workspaceId)
      return reply
        .code(503)
        .send({ error: "facebook_strategy_not_configured" });
    const parsed = z
      .object({
        productId: z.string().min(1),
        proposedAngle: contentAngleSchema.optional(),
      })
      .safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "invalid_request" });
    return options.facebook.evaluateStoredReuse(
      options.workspaceId,
      parsed.data.productId,
      parsed.data.proposedAngle,
    );
  });
  app.get("/api/facebook/strategy", async (_request, reply) =>
    options.facebook && options.workspaceId
      ? options.facebook.getStrategy(options.workspaceId)
      : reply.code(503).send({ error: "facebook_strategy_not_configured" }),
  );
  app.get("/api/facebook/history", async (_request, reply) =>
    options.facebook && options.workspaceId
      ? options.facebook.getContentHistory(options.workspaceId)
      : reply.code(503).send({ error: "facebook_strategy_not_configured" }),
  );
  const creativeInput = z.object({
    platform: z.enum(["pinterest", "facebook"]),
    contentId: z.string().min(1),
    format: z.enum(["PINTEREST_2_3", "FACEBOOK_4_5", "FACEBOOK_1_1"]),
    template: z
      .enum([
        "MINIMAL_OVERLAY",
        "BOTTOM_INFO_PANEL",
        "TOP_HEADLINE",
        "SIDE_INFO",
        "PHOTO_FIRST",
      ])
      .default("PHOTO_FIRST"),
    variantCount: z.number().int().min(1).max(3).default(1),
  });
  const creativeAction =
    (action: "analyze" | "preview" | "render" | "variants") =>
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      if (!options.creative || !options.workspaceId)
        return reply
          .code(503)
          .send({ error: "creative_studio_not_configured" });
      const parsed = creativeInput.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid_request" });
      try {
        const loaded = await options.creative.request(
          options.workspaceId,
          request.params.id,
          parsed.data,
        );
        return await options.creative[action](loaded);
      } catch (error) {
        return reply
          .code(422)
          .send({
            error: error instanceof Error ? error.message : "creative_failed",
          });
      }
    };
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/api/products/:id/images/analyze",
    creativeAction("analyze"),
  );
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/api/products/:id/creative/preview",
    creativeAction("preview"),
  );
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/api/products/:id/creative/render",
    creativeAction("render"),
  );
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/api/products/:id/creative/variants",
    creativeAction("variants"),
  );
  app.get<{ Params: { id: string } }>(
    "/api/products/:id/creatives",
    async (request, reply) =>
      options.creative && options.workspaceId
        ? options.creative.getProductCreatives(
            options.workspaceId,
            request.params.id,
          )
        : reply.code(503).send({ error: "creative_studio_not_configured" }),
  );
  const ops = async (reply: FastifyReply, action: () => Promise<unknown>) => {
    if (!options.operations || !options.workspaceId)
      return reply.code(503).send({ error: "operations_not_configured" });
    try {
      return await action();
    } catch (error) {
      return reply
        .code(422)
        .send({
          error: error instanceof Error ? error.message : "operation_failed",
        });
    }
  };
  const actor = z.object({ actorId: z.string().min(1) });
  app.post("/api/operations/daily/run", async (request, reply) => {
    const parsed = z
      .object({ date: z.coerce.date().default(() => new Date()) })
      .safeParse(request.body ?? {});
    return parsed.success
      ? ops(reply, () =>
          options.operations!.run(options.workspaceId!, parsed.data.date),
        )
      : reply.code(400).send({ error: "invalid_request" });
  });
  app.get("/api/publications/queue", (_request, reply) =>
    ops(reply, () => options.operations!.listQueue(options.workspaceId!)),
  );
  app.post<{ Params: { id: string } }>(
    "/api/publications/:id/approve",
    async (request, reply) => {
      const parsed = actor.safeParse(request.body);
      return parsed.success
        ? ops(reply, () =>
            options.operations!.approve(
              options.workspaceId!,
              request.params.id,
              parsed.data.actorId,
            ),
          )
        : reply.code(400).send({ error: "invalid_request" });
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/publications/:id/reject",
    async (request, reply) => {
      const parsed = actor
        .extend({ reason: z.string().min(1) })
        .safeParse(request.body);
      return parsed.success
        ? ops(reply, () =>
            options.operations!.reject(
              options.workspaceId!,
              request.params.id,
              parsed.data.actorId,
              parsed.data.reason,
            ),
          )
        : reply.code(400).send({ error: "invalid_request" });
    },
  );
  app.post("/api/publications/approve-batch", async (request, reply) => {
    const parsed = actor
      .extend({ ids: z.array(z.string()).min(1) })
      .safeParse(request.body);
    return parsed.success
      ? ops(reply, () =>
          options.operations!.approveBatch(
            options.workspaceId!,
            parsed.data.ids,
            parsed.data.actorId,
          ),
        )
      : reply.code(400).send({ error: "invalid_request" });
  });
  app.post<{ Params: { id: string } }>(
    "/api/publications/:id/schedule",
    async (request, reply) => {
      const parsed = actor
        .extend({ scheduledAt: z.coerce.date() })
        .safeParse(request.body);
      return parsed.success
        ? ops(reply, () =>
            options.operations!.schedule(
              options.workspaceId!,
              request.params.id,
              parsed.data.actorId,
              parsed.data.scheduledAt,
            ),
          )
        : reply.code(400).send({ error: "invalid_request" });
    },
  );
  app.post("/api/publications/scheduled/reconcile", (_request, reply) =>
    ops(reply, () =>
      options.operations?.reconcileScheduled
        ? options.operations.reconcileScheduled(options.workspaceId!)
        : Promise.reject(new Error("scheduler_reconciliation_not_configured")),
    ),
  );
  for (const [path, method] of [
    ["publish-now", "publishNow"],
    ["cancel", "cancel"],
    ["retry", "retry"],
  ] as const)
    app.post<{ Params: { id: string } }>(
      `/api/publications/:id/${path}`,
      async (request, reply) => {
        const parsed = actor.safeParse(request.body);
        return parsed.success
          ? ops(reply, () =>
              options.operations![method](
                options.workspaceId!,
                request.params.id,
                parsed.data.actorId,
              ),
            )
          : reply.code(400).send({ error: "invalid_request" });
      },
    );
  app.get<{ Params: { id: string } }>(
    "/api/publications/:id",
    (request, reply) =>
      ops(reply, () =>
        options.operations!.status(options.workspaceId!, request.params.id),
      ),
  );
  app.get("/api/operations/alerts", (_request, reply) =>
    ops(reply, () => options.operations!.alerts(options.workspaceId!)),
  );
  const analyticsPeriod=z.object({from:z.coerce.date(),to:z.coerce.date()}).refine(v=>v.to>=v.from);
  const analytics=(request:FastifyRequest,reply:FastifyReply,action:(p:{start:Date;end:Date})=>Promise<unknown>)=>{if(!options.analytics||!options.workspaceId)return reply.code(503).send({error:"analytics_not_configured"});const parsed=analyticsPeriod.safeParse(request.query);return parsed.success?action({start:parsed.data.from,end:parsed.data.to}):reply.code(400).send({error:"invalid_period"})};
  app.get("/api/analytics/overview",(r,q)=>analytics(r,q,p=>options.analytics!.overview(options.workspaceId!,p)));
  app.get<{Params:{id:string}}>("/api/analytics/products/:id",(r,q)=>analytics(r,q,p=>options.analytics!.product(options.workspaceId!,r.params.id,p)));
  app.get<{Params:{id:string}}>("/api/analytics/categories/:id",(r,q)=>analytics(r,q,p=>options.analytics!.category(options.workspaceId!,r.params.id,p)));
  app.get<{Params:{id:string}}>("/api/analytics/platforms/:id",(r,q)=>analytics(r,q,p=>["pinterest","facebook","business"].includes(r.params.id)?options.analytics!.platform(options.workspaceId!,r.params.id as "pinterest"|"facebook"|"business",p):Promise.reject(new Error("invalid_platform"))));
  app.get("/api/analytics/winners",(r,q)=>analytics(r,q,p=>options.analytics!.winners(options.workspaceId!,p)));
  app.get("/api/analytics/underperformers",(r,q)=>analytics(r,q,p=>options.analytics!.underperformers(options.workspaceId!,p)));
  app.get("/api/analytics/insights",(r,q)=>analytics(r,q,p=>options.analytics!.insights(options.workspaceId!,p)));
  app.get("/api/analytics/data-quality",(r,q)=>analytics(r,q,p=>options.analytics!.dataQuality(options.workspaceId!,p)));
  app.get("/api/analytics/daily-summary",(r,q)=>analytics(r,q,p=>options.analytics!.daily(options.workspaceId!,p)));
  app.get("/api/analytics/weekly-review",(r,q)=>analytics(r,q,p=>options.analytics!.weekly(options.workspaceId!,p)));
  app.get<{Querystring:{ids?:string;from?:string;to?:string}}>("/api/analytics/creatives/compare",(r,q)=>analytics(r,q,p=>options.analytics!.creativeComparison(options.workspaceId!,r.query.ids?.split(",").filter(Boolean)??[],p)));
  return app;
}
