import { z } from "zod";
import { contentAngleSchema } from "./content.js";

export const pinterestSearchIntentSchema = z.enum(["organization", "small_space", "kitchen", "bathroom", "laundry", "decoration", "cleaning", "practicality", "product_discovery", "problem_solution", "seasonal"]);
export const pinterestKeywordSchema = z.object({ value: z.string().min(2), intent: pinterestSearchIntentSchema, relation: z.enum(["product", "category", "room", "problem", "benefit", "occasion", "seasonality"]) });
export const pinterestKeywordClusterSchema = z.object({ name: z.string().min(2), intent: pinterestSearchIntentSchema, keywords: z.array(pinterestKeywordSchema).min(2) });
export const pinterestBoardRecommendationSchema = z.object({ boardSuggestion: z.string().min(2), reason: z.string().min(10), confidence: z.number().min(0).max(1) });
export const pinterestCreativeBriefSchema = z.object({ preferredProductImage: z.url().nullable(), imageSelectionReason: z.string().min(5), headline: z.string().min(3), productFacts: z.array(z.string()).max(2), priceDisplayRequested: z.boolean(), requiresPriceRefresh: z.boolean(), brandPlacement: z.string().min(3), notes: z.array(z.string()) });
const plannedPinSchema = z.object({ contentId: z.string(), productId: z.string().nullable(), title: z.string(), description: z.string(), cta: z.string(), boardSuggestion: z.string(), keywordCluster: z.string(), contentAngle: contentAngleSchema, visualBrief: z.string(), affiliateUrl: z.url().nullable(), status: z.enum(["draft", "approval_required", "ready_for_publication"]), creativeBrief: pinterestCreativeBriefSchema });
export const dailyPinterestPlanSchema = z.object({ date: z.coerce.date(), suggestedPins: z.array(plannedPinSchema).max(10), productPins: z.number().int().nonnegative(), utilityPins: z.number().int().nonnegative(), boardDistribution: z.record(z.string(), z.number().int().nonnegative()), notes: z.array(z.string()), approvalsRequired: z.boolean() });
export const weeklyPinterestStrategySchema = z.object({ period: z.object({ start: z.coerce.date(), end: z.coerce.date() }), goals: z.array(z.string()).min(1), suggestedDailyVolume: z.number().int().min(0).max(10), boardDistribution: z.record(z.string(), z.number().min(0)), keywordClusters: z.array(pinterestKeywordClusterSchema), productContent: z.number().int().nonnegative(), utilityContent: z.number().int().nonnegative(), seasonalContent: z.number().int().nonnegative(), experiments: z.array(z.string()), risks: z.array(z.string()), reasoning: z.string().min(10), confidence: z.number().min(0).max(1), futureMetrics: z.array(z.enum(["impressions", "saves", "pinClicks", "outboundClicks", "engagement"])) });
export type PinterestSearchIntent = z.infer<typeof pinterestSearchIntentSchema>;
export type PinterestKeywordCluster = z.infer<typeof pinterestKeywordClusterSchema>;
export type PinterestCreativeBrief = z.infer<typeof pinterestCreativeBriefSchema>;
export type DailyPinterestPlan = z.infer<typeof dailyPinterestPlanSchema>;
export type WeeklyPinterestStrategy = z.infer<typeof weeklyPinterestStrategySchema>;
