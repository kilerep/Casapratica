import { z } from "zod";

export const PRODUCT_STATUSES = ["candidate", "under_review", "approved", "test", "rejected", "active", "paused", "retired"] as const;
export const productStatusSchema = z.enum(PRODUCT_STATUSES);
export type ProductStatus = z.infer<typeof productStatusSchema>;

const nullableUrl = z.url().nullable();
const nullableNonNegative = z.number().nonnegative().nullable();
const nullableNonNegativeInteger = z.number().int().nonnegative().nullable();

export const productSchema = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  marketplace: z.string().trim().min(1),
  externalId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().nullable(),
  categoryId: z.uuid().nullable(),
  canonicalUrl: z.url(),
  affiliateUrl: nullableUrl,
  price: nullableNonNegative,
  currency: z.string().length(3).nullable(),
  rating: z.number().min(0).max(5).nullable(),
  reviewCount: nullableNonNegativeInteger,
  salesCount: nullableNonNegativeInteger,
  sellerId: z.uuid().nullable(),
  availability: z.string().nullable(),
  thumbnailUrl: nullableUrl,
  status: productStatusSchema,
  firstSeenAt: z.date(),
  lastCheckedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
}).superRefine((product, context) => {
  if ((product.price === null) !== (product.currency === null)) context.addIssue({ code: "custom", message: "price and currency must both be present or absent", path: ["currency"] });
  if (product.lastCheckedAt !== null && product.lastCheckedAt < product.firstSeenAt) context.addIssue({ code: "custom", message: "lastCheckedAt cannot precede firstSeenAt", path: ["lastCheckedAt"] });
});
export type Product = z.infer<typeof productSchema>;

const transitions: Readonly<Record<ProductStatus, readonly ProductStatus[]>> = {
  candidate: ["under_review", "rejected"], under_review: ["approved", "rejected"], approved: ["test", "active", "paused"],
  test: ["active", "paused", "rejected"], rejected: ["under_review", "retired"], active: ["paused", "retired"], paused: ["active", "retired"], retired: [],
};
export function canTransitionProduct(from: ProductStatus, to: ProductStatus): boolean { return from === to || transitions[from].includes(to); }
export function assertProductTransition(from: ProductStatus, to: ProductStatus): void { if (!canTransitionProduct(from, to)) throw new Error(`Invalid product status transition: ${from} -> ${to}`); }
