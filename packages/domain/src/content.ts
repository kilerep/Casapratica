import { z } from "zod";

export const contentAngleSchema = z.enum(["utility", "problem_solution", "space_saving", "organization", "price_opportunity", "social_proof", "comparison", "seasonal", "practicality", "small_home"]);
export const contentPlatformSchema = z.enum(["pinterest", "facebook"]);
export const linkPlacementSchema = z.enum(["BODY", "COMMENT", "NONE"]);
export const affiliateDisclosureSchema = z.string().min(10).refine(value => /afiliad|comiss/i.test(value), "affiliate_disclosure_required");
const visualBriefSchema = z.string().min(10);

export const pinterestContentSchema = z.object({
  title: z.string().min(5), description: z.string().min(20), cta: z.string().min(3), keywords: z.array(z.string().min(2)).min(2), keywordCluster: z.string().min(2), boardSuggestion: z.string().min(2), contentAngle: contentAngleSchema, visualBrief: visualBriefSchema, affiliateDisclosure: affiliateDisclosureSchema,
});
export const facebookCommentSchema = z.object({ body: z.string().min(3), affiliateUrl: z.url(), affiliateDisclosure: affiliateDisclosureSchema });
export const facebookContentSchema = z.object({
  copy: z.string().min(20), cta: z.string().min(3), contentPillar: z.string().min(2), contentAngle: contentAngleSchema, visualBrief: visualBriefSchema, affiliateDisclosure: affiliateDisclosureSchema, linkPlacement: linkPlacementSchema, comment: facebookCommentSchema.nullable(),
});
export const utilityContentSchema = z.object({ platform: contentPlatformSchema, title: z.string().min(5), body: z.string().min(20), cta: z.string().min(3), contentPillar: z.string().min(2), contentAngle: contentAngleSchema, visualBrief: visualBriefSchema, keywords: z.array(z.string()).default([]), seasonalContext: z.string().nullable(), linkPlacement: z.literal("NONE") });
export type ContentAngle = z.infer<typeof contentAngleSchema>;
export type PinterestContent = z.infer<typeof pinterestContentSchema>;
export type FacebookContent = z.infer<typeof facebookContentSchema>;
export type UtilityContent = z.infer<typeof utilityContentSchema>;

export const PROHIBITED_CLAIMS = ["menor preço do mercado", "melhor produto", "garantido", "imperdível", "o mais barato", "melhor do brasil"] as const;
export function assertSafeContent(...texts: readonly string[]): void { const normalized = texts.join(" ").toLocaleLowerCase("pt-BR"); const claim = PROHIBITED_CLAIMS.find(value => normalized.includes(value)); if (claim) throw new Error(`prohibited_claim:${claim}`); }
