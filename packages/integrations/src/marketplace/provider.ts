import { z } from "zod";

const nullableCount = z.number().int().nonnegative().nullable();
export const marketplaceProductSchema = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  canonicalUrl: z.url(),
  affiliateUrl: z.url().nullable().optional(),
  price: z.number().nonnegative().nullable(),
  currency: z.string().length(3).nullable(),
  categoryExternalId: z.string().nullable(),
  rating: z.number().min(0).max(5).nullable(),
  reviewCount: nullableCount,
  salesCount: nullableCount,
  sellerExternalId: z.string().nullable(),
  sellerName: z.string().nullable(),
  sellerReputation: z.number().min(0).max(100).nullable(),
  images: z.array(z.url()),
  availability: z.string().nullable(),
  commission: z.number().nonnegative().nullable(),
  freeShipping: z.boolean().nullable(),
  isBestSeller: z.boolean().nullable(),
  isMercadoLider: z.boolean().nullable(),
  isOfficialStore: z.boolean().nullable(),
  salesEvidence: z.literal("PUBLIC_VISIBLE_TEXT").nullable().optional(),
  observedAt: z.date().optional(),
  missingFields: z.array(z.string()),
  rawSourceReference: z.string().min(1),
});
export type MarketplaceProduct = z.infer<typeof marketplaceProductSchema>;
export interface MarketplaceSeller {
  externalId: string;
  name: string | null;
  reputation: number | null;
  rawSourceReference: string;
}
export interface MarketplaceCategory {
  externalId: string;
  name: string;
  parentExternalId: string | null;
}
export interface ProductSearchRequest {
  query: string;
  categoryExternalId?: string;
  limit: number;
}
export interface MarketplaceProductProvider {
  readonly marketplace: string;
  searchProducts(
    request: ProductSearchRequest,
  ): Promise<readonly MarketplaceProduct[]>;
  getProduct(externalId: string): Promise<MarketplaceProduct | null>;
  getSeller(externalId: string): Promise<MarketplaceSeller | null>;
  getCategories(): Promise<readonly MarketplaceCategory[]>;
  refreshProductData(externalId: string): Promise<MarketplaceProduct | null>;
  getProducts?(
    externalIds: readonly string[],
  ): Promise<readonly MarketplaceProduct[]>;
  getSellers?(
    externalIds: readonly string[],
  ): Promise<readonly MarketplaceSeller[]>;
}

export interface ProductDiscoverySignal {
  readonly term: string;
  readonly categoryExternalId: string | null;
  readonly trendPosition: number | null;
  readonly highlightPosition: number | null;
  readonly highlightedItemIds: readonly string[];
  readonly rawSourceReferences: readonly string[];
}

export interface ProductDiscoverySource {
  readonly marketplace: string;
  resolveCategories?(
    terms: readonly string[],
  ): Promise<Readonly<Record<string, string>>>;
  discover(
    categoryExternalIds: readonly string[],
  ): Promise<readonly ProductDiscoverySignal[]>;
  lastDiscoveryDiagnostics?(): {
    status:
      | "success"
      | "partial_success"
      | "no_results"
      | "no_structured_products"
      | "source_unavailable";
    requests: number;
    accessibleResponses: number;
    failedResponses: number;
    noResultResponses: number;
    unstructuredResponses: number;
    candidates: number;
  };
}
