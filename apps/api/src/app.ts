import { createHash } from "node:crypto";
import type { PinterestPilotService } from "./pinterest-pilot.js";
import type { FacebookPilotService } from "./facebook-pilot.js";
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
  overview(w: string, p: { start: Date; end: Date }): Promise<unknown>;
  product(
    w: string,
    id: string,
    p: { start: Date; end: Date },
  ): Promise<unknown>;
  category(
    w: string,
    id: string,
    p: { start: Date; end: Date },
  ): Promise<unknown>;
  platform(
    w: string,
    id: "pinterest" | "facebook" | "business",
    p: { start: Date; end: Date },
  ): Promise<unknown>;
  creativeComparison(
    w: string,
    ids: readonly string[],
    p: { start: Date; end: Date },
  ): Promise<unknown>;
  winners(w: string, p: { start: Date; end: Date }): Promise<unknown>;
  underperformers(w: string, p: { start: Date; end: Date }): Promise<unknown>;
  insights(w: string, p: { start: Date; end: Date }): Promise<unknown>;
  dataQuality(w: string, p: { start: Date; end: Date }): Promise<unknown>;
  daily(w: string, p: { start: Date; end: Date }): Promise<unknown>;
  weekly(w: string, p: { start: Date; end: Date }): Promise<unknown>;
}
interface DashboardApiService {
  snapshot(workspaceId: string): Promise<unknown>;
}
interface ProductReviewApiService {
  list(workspaceId: string): Promise<unknown>;
  detail(workspaceId: string, id: string): Promise<unknown>;
  decide(workspaceId: string, id: string, status: "approved" | "test" | "rejected", actorId: string, comment: string | null): Promise<unknown>;
}
interface SettingsOverviewApiService {
  overview(): Promise<unknown>;
}
interface AssistedPublicationApiService {
  products(workspaceId:string):Promise<unknown>;
  manualProduct(workspaceId:string,input:{productUrl:string;affiliateUrl?:string|null|undefined;name:string;category:string;price?:number|null|undefined;rating?:number|null|undefined;reviewCount?:number|null|undefined;seller?:string|null|undefined;imageUrl?:string|null|undefined;confirmedFacts?:string|null|undefined}):Promise<unknown>;
  prepare(workspaceId:string,productId:string,platform:"pinterest"|"facebook"):Promise<unknown>;
  markPublished(workspaceId:string,id:string,actor:string,date:Date):Promise<unknown>;
  history(workspaceId:string):Promise<unknown>;
}
interface ProductDiscoveryApiService { run(workspaceId:string):Promise<unknown>; latest(workspaceId:string):Promise<unknown>; opportunities(workspaceId:string):Promise<unknown> }
type ReadinessResult = {
  status: "ready" | "degraded" | "not_ready";
  database: string;
  redis: string;
  worker: string;
  integrations: Record<string, string>;
  externalPublishing?: "enabled" | "disabled";
};

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
    dashboard?: DashboardApiService;
    productReview?: ProductReviewApiService;
    settingsOverview?: SettingsOverviewApiService;
    assistedPublication?: AssistedPublicationApiService;
    productDiscovery?: ProductDiscoveryApiService;
    mercadoLivreEnabled?: boolean;
    readiness?: () => Promise<ReadinessResult>;
    pinterestPilot?: PinterestPilotService;
    facebookPilot?: FacebookPilotService;
    metaCompliance?: { handle(signedRequest:string):Promise<{confirmationCode:string}> };
    webOrigin?: string;
    workspaceId?: string;
  } = {},
) {
  const app = Fastify({
    logger: {
      serializers: {
        req: (request) => ({
          method: request.method,
          url: request.url.split("?")[0] ?? "/",
        }),
        err: (error) => ({ type: error.name, message: "request_failed", stack:"" }),
      },
    },
  });
  const webOrigin = options.webOrigin ?? "http://localhost:3000";
  const allowedWebOrigins=new Set([webOrigin,...(/^http:\/\/(?:localhost|127\.0\.0\.1):3000$/.test(webOrigin)?["http://localhost:3000","http://127.0.0.1:3000"]:[])]);
  app.addHook("onRequest",async(request,reply)=>{if(!request.url.startsWith("/api/")&&!request.url.startsWith("/health")&&!request.url.startsWith("/ready"))return;const origin=request.headers.origin;if(origin&&allowedWebOrigins.has(origin))reply.header("Access-Control-Allow-Origin",origin).header("Vary","Origin");if(request.method==="OPTIONS"){if(!origin||!allowedWebOrigins.has(origin))return reply.code(403).send({error:"origin_required"});return reply.header("Access-Control-Allow-Methods","GET, POST, DELETE, OPTIONS").header("Access-Control-Allow-Headers","Content-Type").header("Access-Control-Max-Age","600").code(204).send()}});
  app.addHook("onRequest",async(request,reply)=>{if(request.method==="POST"&&request.url.startsWith("/api/integrations/mercadolivre/")&&!allowedWebOrigins.has(request.headers.origin??""))return reply.code(403).send({error:"origin_required"})});
  app.addHook("onRequest",async(request,reply)=>{if(request.url.startsWith("/api/product-discovery")){reply.header("Cache-Control","no-store");const origin=request.headers.origin;if(origin&&allowedWebOrigins.has(origin))reply.header("Access-Control-Allow-Origin",origin).header("Vary","Origin");if(request.method==="OPTIONS"){if(!origin||!allowedWebOrigins.has(origin))return reply.code(403).send({error:"origin_required"});return reply.header("Access-Control-Allow-Methods","GET, POST, OPTIONS").header("Access-Control-Allow-Headers","Content-Type").header("Access-Control-Max-Age","600").code(204).send()}if(request.method==="POST"&&(!origin||!allowedWebOrigins.has(origin)))return reply.code(403).send({error:"origin_required"})}});
  app.addHook("onRequest",async(request,reply)=>{if(request.url.startsWith("/api/assisted-publication")){reply.header("Cache-Control","no-store");if(request.method==="POST"&&!allowedWebOrigins.has(request.headers.origin??""))return reply.code(403).send({error:"origin_required"})}});
  app.addHook("onRequest",async(request,reply)=>{if(request.url.startsWith("/api/facebook/pilot")){reply.header("Cache-Control","no-store").header("Referrer-Policy","no-referrer");if(request.method==="POST"&&!allowedWebOrigins.has(request.headers.origin??""))return reply.code(403).send({error:"origin_required"})}});
  app.addHook("onRequest", async (request, reply) => {
    if (request.url.includes("/review")) {
      reply.header("Cache-Control", "no-store");
      if (request.method === "POST" && !allowedWebOrigins.has(request.headers.origin??""))
        return reply.code(403).send({ error: "origin_required" });
    }
  });
  app.addHook("onRequest", async (request, reply) => {
    if (
      request.url.startsWith("/api/integrations") ||
      request.url.startsWith("/api/pinterest/pilot")
    ) {
      reply
        .header("Cache-Control", "no-store")
        .header("Referrer-Policy", "no-referrer");
      if (
        request.method === "POST" &&
        (request.url.startsWith("/api/integrations/pinterest/") ||
          request.url.startsWith("/api/pinterest/pilot")) &&
        !allowedWebOrigins.has(request.headers.origin??"")
      )
        return reply.code(403).send({ error: "origin_required" });
    }
  });
  app.get("/api/pinterest/pilot/boards", async (_request, reply) => {
    if (!options.pinterestPilot || !options.workspaceId)
      return reply.code(503).send({ error: "pinterest_pilot_disabled" });
    try {
      return await options.pinterestPilot.listBoards(options.workspaceId);
    } catch {
      return reply.code(422).send({ error: "boards_unavailable" });
    }
  });
  app.post<{ Params: { id: string } }>(
    "/api/pinterest/pilot/:id/board",
    async (request, reply) => {
      if (!options.pinterestPilot || !options.workspaceId)
        return reply.code(503).send({ error: "pinterest_pilot_disabled" });
      const input = z
        .object({ boardId: z.string().regex(/^\d+$/) })
        .safeParse(request.body);
      if (!input.success)
        return reply.code(400).send({ error: "invalid_board" });
      try {
        return await options.pinterestPilot.selectBoard(
          options.workspaceId,
          request.params.id,
          input.data.boardId,
        );
      } catch {
        return reply.code(422).send({ error: "board_change_blocked" });
      }
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/pinterest/pilot/:id/dry-run",
    async (request, reply) => {
      if (!options.pinterestPilot || !options.workspaceId)
        return reply.code(503).send({ error: "pinterest_pilot_disabled" });
      try {
        return await options.pinterestPilot.dryRun(
          options.workspaceId,
          request.params.id,
        );
      } catch {
        return reply.code(422).send({ error: "dry_run_failed" });
      }
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/pinterest/pilot/:id/publish",
    async (request, reply) => {
      if (!options.pinterestPilot || !options.workspaceId)
        return reply.code(503).send({ error: "pinterest_pilot_disabled" });
      const input = z
        .object({
          confirmation: z.literal("PUBLISH_PINTEREST_PIN"),
          fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
          actorId: z.string().min(1).max(100),
        })
        .safeParse(request.body);
      if (!input.success)
        return reply.code(400).send({ error: "manual_confirmation_required" });
      try {
        return await options.pinterestPilot.publish(
          options.workspaceId,
          request.params.id,
          input.data.actorId,
          input.data.fingerprint,
        );
      } catch {
        return reply
          .code(422)
          .send({ error: "publication_blocked_or_reconciliation_required" });
      }
    },
  );
  app.get("/health", async () => ({ status: "ok" as const }));
  for(const path of ["/api/integrations/meta/deauthorize","/api/integrations/meta/data-deletion"]){app.post(path,async(request,reply)=>{const input=z.object({signed_request:z.string().min(1)}).safeParse(request.body);if(!input.success||!options.metaCompliance)return reply.code(400).send({error:"invalid_signed_request"});try{const result=await options.metaCompliance.handle(input.data.signed_request);return path.endsWith("data-deletion")?{url:`${webOrigin}/privacidade?deletion=${result.confirmationCode}`,confirmation_code:result.confirmationCode}:{status:"disconnected"}}catch{return reply.code(400).send({error:"invalid_signed_request"})}})}
  app.get("/ready", async (_request, reply) => {
    if (!options.readiness)
      return reply
        .code(503)
        .send({
          status: "not_ready",
          database: "not_configured",
          redis: "not_configured",
          worker: "unknown",
          integrations: {
            mercadolivre: "optional",
            pinterest: "optional",
            meta: "optional",
          },
        });
    const result = await options.readiness();
    return reply.code(result.status === "not_ready" ? 503 : 200).send(result);
  });
  app.get("/api/facebook/pilot/pages",async(_request,reply)=>options.facebookPilot&&options.workspaceId?options.facebookPilot.listPages(options.workspaceId).catch(()=>reply.code(422).send({error:"pages_unavailable"})):reply.code(503).send({error:"meta_pilot_disabled"}));
  app.post("/api/facebook/pilot/page",async(request,reply)=>{const input=z.object({pageId:z.string().regex(/^\d+$/)}).safeParse(request.body);if(!input.success)return reply.code(400).send({error:"invalid_page"});if(!options.facebookPilot||!options.workspaceId)return reply.code(503).send({error:"meta_pilot_disabled"});try{return await options.facebookPilot.selectPage(options.workspaceId,input.data.pageId)}catch{return reply.code(422).send({error:"page_selection_blocked"})}});
  app.post<{Params:{id:string}}>("/api/facebook/pilot/:id/dry-run",async(request,reply)=>{if(!options.facebookPilot||!options.workspaceId)return reply.code(503).send({error:"meta_pilot_disabled"});try{return await options.facebookPilot.dryRun(options.workspaceId,request.params.id)}catch{return reply.code(422).send({error:"dry_run_failed"})}});
  app.post<{Params:{id:string}}>("/api/facebook/pilot/:id/publish",async(request,reply)=>{const input=z.object({confirmation:z.literal("PUBLISH_FACEBOOK_PAGE_POST"),fingerprint:z.string().regex(/^[a-f0-9]{64}$/),actorId:z.string().min(1).max(100)}).safeParse(request.body);if(!input.success)return reply.code(400).send({error:"manual_confirmation_required"});if(!options.facebookPilot||!options.workspaceId)return reply.code(503).send({error:"meta_pilot_disabled"});try{return await options.facebookPilot.publish(options.workspaceId,request.params.id,input.data.actorId,input.data.fingerprint)}catch{return reply.code(422).send({error:"publication_blocked_or_reconciliation_required"})}});
  app.get("/api/dashboard", async (_request, reply) => {
    if (!options.dashboard || !options.workspaceId)
      return reply.code(503).send({ error: "dashboard_not_configured" });
    try {
      return await options.dashboard.snapshot(options.workspaceId);
    } catch {
      return reply.code(503).send({ error: "dashboard_unavailable" });
    }
  });
  app.get("/api/settings/overview", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!options.settingsOverview)
      return reply.code(503).send({ error: "settings_overview_not_configured" });
    try {
      return await options.settingsOverview.overview();
    } catch {
      return reply.code(503).send({ error: "settings_overview_unavailable" });
    }
  });
  const assistedUnavailable=(reply:FastifyReply)=>reply.code(503).send({error:"assisted_publication_not_configured"});
  app.get("/api/assisted-publication/products",async(_request,reply)=>options.assistedPublication&&options.workspaceId?options.assistedPublication.products(options.workspaceId):assistedUnavailable(reply));
  const discoveryUnavailable=(_reply:FastifyReply)=>({status:"not_connected",connected:false,message:"Mercado Livre ainda não conectado.",run:null,opportunities:[]});
  app.post("/api/product-discovery/run",async(_request,reply)=>options.productDiscovery&&options.workspaceId?options.productDiscovery.run(options.workspaceId):discoveryUnavailable(reply));
  app.get("/api/product-discovery/latest",async(_request,reply)=>options.productDiscovery&&options.workspaceId?options.productDiscovery.latest(options.workspaceId):discoveryUnavailable(reply));
  app.get("/api/product-discovery/opportunities",async(_request,reply)=>options.productDiscovery&&options.workspaceId?options.productDiscovery.opportunities(options.workspaceId):discoveryUnavailable(reply));
  app.get("/api/assisted-publication/history",async(_request,reply)=>options.assistedPublication&&options.workspaceId?options.assistedPublication.history(options.workspaceId):assistedUnavailable(reply));
  app.post("/api/assisted-publication/manual-product",async(request,reply)=>{const input=z.object({productUrl:z.url(),affiliateUrl:z.url().nullable().optional(),name:z.string().trim().min(2).max(200),category:z.string().trim().min(2).max(100),price:z.number().nonnegative().nullable().optional(),rating:z.number().min(0).max(5).nullable().optional(),reviewCount:z.number().int().nonnegative().nullable().optional(),seller:z.string().trim().max(160).nullable().optional(),imageUrl:z.url().nullable().optional(),confirmedFacts:z.string().trim().max(2000).nullable().optional()}).safeParse(request.body);if(!input.success)return reply.code(400).send({error:"invalid_manual_product",issues:input.error.issues});if(!options.assistedPublication||!options.workspaceId)return assistedUnavailable(reply);return options.assistedPublication.manualProduct(options.workspaceId,input.data)});
  for(const platform of ["pinterest","facebook"] as const)app.post<{Params:{productId:string}}>(`/api/assisted-publication/:productId/${platform}`,async(request,reply)=>{if(!options.assistedPublication||!options.workspaceId)return assistedUnavailable(reply);try{return await options.assistedPublication.prepare(options.workspaceId,request.params.productId,platform)}catch(error){return reply.code(422).send({error:error instanceof Error?error.message:"assisted_preparation_failed"})}});
  app.post<{Params:{id:string}}>("/api/assisted-publication/:id/manual-published",async(request,reply)=>{const input=z.object({actor:z.string().trim().min(2).max(100),date:z.iso.datetime().optional()}).safeParse(request.body);if(!input.success)return reply.code(400).send({error:"invalid_manual_publication"});if(!options.assistedPublication||!options.workspaceId)return assistedUnavailable(reply);try{return await options.assistedPublication.markPublished(options.workspaceId,request.params.id,input.data.actor,new Date(input.data.date??Date.now()))}catch(error){return reply.code(404).send({error:error instanceof Error?error.message:"assisted_pack_not_found"})}});
  const review = async (reply: FastifyReply, action: () => Promise<unknown>) => {
    if (!options.productReview || !options.workspaceId) return reply.code(503).send({ error: "product_review_not_configured" });
    try { return await action(); } catch (error) { return reply.code(error instanceof Error && error.message === "product_not_found" ? 404 : 422).send({ error: error instanceof Error ? error.message : "product_review_failed" }); }
  };
  app.get("/api/products/review", (_request, reply) => review(reply, () => options.productReview!.list(options.workspaceId!)));
  app.get<{ Params: { id: string } }>("/api/products/:id/review", (request, reply) => review(reply, () => options.productReview!.detail(options.workspaceId!, request.params.id)));
  const decisionBody = z.object({ actorId: z.string().trim().min(1).max(100), comment: z.string().trim().max(1000).nullable().optional() });
  for (const status of ["approved", "test", "rejected"] as const) {
    const path = status === "approved" ? "approve" : status === "rejected" ? "reject" : "test";
    app.post<{ Params: { id: string } }>(`/api/products/:id/review/${path}`, (request, reply) => {
      const parsed = decisionBody.safeParse(request.body);
      return parsed.success ? review(reply, () => options.productReview!.decide(options.workspaceId!, request.params.id, status, parsed.data.actorId, parsed.data.comment || null)) : reply.code(400).send({ error: "invalid_request" });
    });
  }
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
      return reply.code(422).send({
        error: error instanceof Error ? error.message : "ai_chat_failed",
      });
    }
  });
  const provider = (value: string): ProviderName => {
    if(value==="meta")return "facebook";
    if (!["pinterest", "facebook", "mercadolivre"].includes(value))
      throw new Error("unknown_provider");
    return value as ProviderName;
  };
  app.get("/api/integrations", async () => {if(!options.integrations||!options.workspaceId)return[{provider:"mercadolivre",status:"integration_disabled",connected:false,capabilities:{}},{provider:"pinterest",status:"not_configured",connected:false,capabilities:{}},{provider:"facebook",status:"not_configured",connected:false,capabilities:{}}];const values=await options.integrations.list(options.workspaceId);return values.map(value=>value.provider==="mercadolivre"&&options.mercadoLivreEnabled===false?{provider:"mercadolivre",status:"integration_disabled",connected:false,userId:null,nickname:null,expiresAt:null,capabilities:{},lastSafeError:null}:value)});
  app.get<{ Params: { provider: string } }>(
    "/api/integrations/:provider/status",
    async (request, reply) => {
      if(request.params.provider==="mercadolivre"&&options.mercadoLivreEnabled===false)return {provider:"mercadolivre",status:"integration_disabled",connected:false,userId:null,nickname:null,expiresAt:null,capabilities:{},lastSafeError:null};
      if(!options.integrations||!options.workspaceId)return reply.code(503).send({error:"integrations_not_configured"});
      const result=await options.integrations.status(
            options.workspaceId,
            provider(request.params.provider),
          );
      const identity=result as typeof result&{displayName?:string|null;connectedAt?:Date|null};return request.params.provider==="mercadolivre"?{provider:"mercadolivre",status:result.status,connected:result.status==="connected",userId:result.externalAccountId??null,nickname:identity.displayName??null,connectedAt:identity.connectedAt??null,expiresAt:result.expiresAt,capabilities:result.capabilities??{},lastSafeError:result.status==="error"?"Falha ao validar a conexão.":null}:result;
    },
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
      const url = await options.integrations.connect(
        options.workspaceId,
        provider(request.params.provider),
      );
      if (request.params.provider === "pinterest" || request.params.provider === "mercadolivre") {
        const state = new URL(url).searchParams.get("state");
        reply.header(
          "Set-Cookie",
          `${request.params.provider}_oauth=${createHash("sha256")
            .update(state ?? "")
            .digest(
              "hex",
            )}; HttpOnly; SameSite=Lax; Path=/api/integrations/${request.params.provider}; Max-Age=600${url.includes("redirect_uri=https") ? "; Secure" : ""}`,
        );
      }
      if(request.params.provider==="meta"||request.params.provider==="facebook"){const state=new URL(url).searchParams.get("state");reply.header("Set-Cookie",`meta_oauth=${createHash("sha256").update(state??"").digest("hex")}; HttpOnly; SameSite=Lax; Path=/api/integrations; Max-Age=600${url.includes("redirect_uri=https")?"; Secure":""}`)}
      return reply.redirect(url);
    },
  );
  app.get<{
    Params: { provider: string };
    Querystring: { code?: string; state?: string; error?: string };
  }>("/api/integrations/:provider/callback", async (request, reply) => {
    if (!options.integrations || !request.query.state)
      return reply.code(400).send({ error: "invalid_callback" });
    if (request.params.provider === "pinterest" || request.params.provider === "mercadolivre") {
      const cookieName=`${request.params.provider}_oauth=`;
      const cookie = request.headers.cookie
        ?.split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith(cookieName))
        ?.slice(cookieName.length);
      if (
        cookie !==
        createHash("sha256").update(request.query.state).digest("hex")
      )
        return reply.code(400).send({ error: "invalid_oauth_browser" });
      reply.header(
        "Set-Cookie",
        `${request.params.provider}_oauth=; HttpOnly; SameSite=Lax; Path=/api/integrations/${request.params.provider}; Max-Age=0`,
      );
    }
    if(request.params.provider==="meta"||request.params.provider==="facebook"){const cookie=request.headers.cookie?.split(";").map(v=>v.trim()).find(v=>v.startsWith("meta_oauth="))?.slice(11);if(cookie!==createHash("sha256").update(request.query.state).digest("hex"))return reply.code(400).send({error:"invalid_oauth_browser"});reply.header("Set-Cookie","meta_oauth=; HttpOnly; SameSite=Lax; Path=/api/integrations; Max-Age=0")}
    try {
      const result = await options.integrations.callback(
        provider(request.params.provider),
        request.query.error ? "" : (request.query.code ?? ""),
        request.query.state,
      );
      return request.params.provider === "pinterest"||request.params.provider === "meta"||request.params.provider === "mercadolivre"
        ? reply.redirect(`${webOrigin}/integrations?oauth=connected`)
        : result;
    } catch {
      return reply.code(400).send({ error: "oauth_failed_restart_connection" });
    }
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
