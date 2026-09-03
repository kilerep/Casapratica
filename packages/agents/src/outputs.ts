import { z } from "zod";

const referenceSchema = z.object({ type: z.string(), id: z.string(), label: z.string().nullable() });
const evidenceSchema = z.object({ source: z.string(), observedAt: z.string(), reference: z.string().nullable() });
const scoreSchema = z.number().min(0).max(100).nullable();

export const productRecommendationSchema = z.object({ productId: z.string(), recommendation: z.enum(["approve", "test", "reject", "review"]), rationale: z.string(), confidence: z.number().min(0).max(1), missingData: z.array(z.string()), references: z.array(referenceSchema) });
export const productAnalysisSchema = z.object({ productId: z.string(), strengths: z.array(z.string()), risks: z.array(z.string()), score: scoreSchema, confidence: z.number().min(0).max(1), evidence: z.array(evidenceSchema), missingData: z.array(z.string()) });
export const dailyPlanRecommendationSchema = z.object({ date: z.string(), priorities: z.array(z.object({ title: z.string(), reason: z.string(), requiresApproval: z.boolean() })), rationale: z.string() });
export const contentRecommendationSchema = z.object({ productId: z.string().nullable(), channel: z.enum(["pinterest", "facebook", "general"]), headline: z.string(), body: z.string(), affiliateDisclosure: z.string(), unsupportedClaims: z.array(z.string()) });
export const strategyRecommendationSchema = z.object({ objective: z.string(), recommendation: z.string(), consumerBenefit: z.string(), commercialPotential: z.string(), brandImpact: z.string(), confidence: z.number().min(0).max(1), missingData: z.array(z.string()) });
export const performanceDiagnosisSchema = z.object({ period: z.object({ from: z.string(), to: z.string() }), diagnosis: z.string(), observedMetrics: z.record(z.string(), z.number().nullable()), hypotheses: z.array(z.string()), recommendedActions: z.array(z.string()), missingMetrics: z.array(z.string()) });

export type ProductRecommendation = z.infer<typeof productRecommendationSchema>;
export type ProductAnalysis = z.infer<typeof productAnalysisSchema>;
export type DailyPlanRecommendation = z.infer<typeof dailyPlanRecommendationSchema>;
export type ContentRecommendation = z.infer<typeof contentRecommendationSchema>;
export type StrategyRecommendation = z.infer<typeof strategyRecommendationSchema>;
export type PerformanceDiagnosis = z.infer<typeof performanceDiagnosisSchema>;
