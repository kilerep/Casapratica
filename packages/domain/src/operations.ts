import { z } from "zod";

export const operationalAlertTypeSchema = z.enum([
  "PUBLISHING_FAILURE",
  "INTEGRATION_FAILURE",
  "CIRCUIT_OPEN",
  "TOKEN_EXPIRED",
  "CAPABILITY_MISSING",
  "PRICE_STALE",
  "CREATIVE_INVALID",
  "DUPLICATE_BLOCKED",
]);
export const approvalStatusSchema = z.enum([
  "DRAFT",
  "READY_FOR_REVIEW",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);
export const dailyOperationsItemSchema = z.object({
  platform: z.enum(["pinterest", "facebook"]),
  productId: z.string().nullable(),
  contentId: z.string(),
  creativeAssetId: z.string(),
  scheduledAt: z.coerce.date().nullable(),
  status: z.string(),
  approvalStatus: approvalStatusSchema,
  publicationQueueItemId: z.string(),
  notes: z.array(z.string()),
});
export const dailyOperationsPlanSchema = z.object({
  date: z.coerce.date(),
  goals: z.record(z.string(), z.unknown()),
  pinterestItems: z.array(dailyOperationsItemSchema).max(10),
  facebookItems: z.array(dailyOperationsItemSchema).max(20),
  utilityItems: z.array(dailyOperationsItemSchema),
  totalItems: z.number().int().nonnegative(),
  summary: z.object({
    prepared: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    needsReview: z.number().int().nonnegative(),
  }),
  warnings: z.array(z.string()),
  approvalsRequired: z.literal(true),
  reasoning: z.string(),
});
export const operationalAlertSchema = z.object({
  id: z.string(),
  type: operationalAlertTypeSchema,
  message: z.string(),
  provider: z.string().nullable(),
  accountId: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type DailyOperationsItem = z.infer<typeof dailyOperationsItemSchema>;
export type DailyOperationsPlan = z.infer<typeof dailyOperationsPlanSchema>;
export type OperationalAlert = z.infer<typeof operationalAlertSchema>;
export type OperationalAlertType = z.infer<typeof operationalAlertTypeSchema>;
