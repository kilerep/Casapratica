import type { HttpClient } from "../base/provider.js";
import { ProviderError } from "../base/provider.js";
import type {
  MarketplaceProduct,
  MarketplaceProductProvider,
  MarketplaceSeller,
  ProductDiscoverySignal,
  ProductDiscoverySource,
  ProductSearchRequest,
} from "../marketplace/provider.js";

type JsonRecord = Record<string, unknown>;
type CacheEntry = { html: string; observedAt: Date; expiresAt: number };
const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const number = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" &&
        value.trim() &&
        Number.isFinite(Number(value.replace(",", ".")))
      ? Number(value.replace(",", "."))
      : null;
const array = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];
const record = (value: unknown): JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
const absolute = (value: string | null) => {
  if (!value) return null;
  try {
    const url = new URL(value, "https://www.mercadolivre.com.br");
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};
const idFromUrl = (url: string) =>
  url
    .match(/MLB-?(\d{6,})/i)?.[0]
    ?.replace("-", "")
    .toUpperCase() ??
  `WEB-${Buffer.from(url).toString("base64url").slice(0, 32)}`;
const visible = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");
const explicitSales = (value: string) => {
  const match = value.match(
    /(?:\+\s*)?([\d.,]+)\s*(mil|milh(?:ão|oes|ões))?\s+vendidos?/i,
  );
  if (!match) return null;
  const base = Number((match[1] ?? "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(base)) return null;
  return Math.round(
    base *
      (match[2]?.toLowerCase().startsWith("milh")
        ? 1_000_000
        : match[2]
          ? 1_000
          : 1),
  );
};
function jsonLd(html: string): JsonRecord[] {
  const values: JsonRecord[] = [];
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(match[1] ?? "");
      for (const value of array(parsed).length ? array(parsed) : [parsed])
        values.push(record(value));
    } catch {
      /* HTML público alterado: ignorar bloco inválido. */
    }
  }
  return values;
}
function productNodes(html: string): JsonRecord[] {
  const output: JsonRecord[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    const node = record(value);
    if (!Object.keys(node).length) return;
    if (node["@type"] === "Product") output.push(node);
    if (node.item) visit(node.item);
    if (node.itemListElement) visit(node.itemListElement);
    if (node["@graph"]) visit(node["@graph"]);
  };
  jsonLd(html).forEach(visit);
  return output;
}
export function parsePublicProducts(
  html: string,
  sourceUrl: string,
  observedAt = new Date(),
): MarketplaceProduct[] {
  if (/captcha|robot verification|acesso negado/i.test(visible(html)))
    throw new ProviderError("CAPABILITY_MISSING", 403);
  return productNodes(html).flatMap((node) => {
    const offers = record(
        Array.isArray(node.offers) ? node.offers[0] : node.offers,
      ),
      aggregate = record(node.aggregateRating),
      brand = record(node.brand),
      seller = record(offers.seller),
      url = absolute(text(node.url) ?? text(offers.url) ?? sourceUrl),
      name = text(node.name),
      image = array(node.image).length
        ? absolute(text(array(node.image)[0]))
        : absolute(text(node.image)),
      price = number(offers.price ?? offers.lowPrice),
      rating = number(aggregate.ratingValue),
      reviewCount = number(aggregate.reviewCount ?? aggregate.ratingCount),
      productText = JSON.stringify(node),
      salesCount = explicitSales(productText);
    if (!url || !name) return [];
    const official = /loja oficial/i.test(productText),
      leader = /mercado\s*l[ií]der/i.test(productText),
      best = /mais vendido/i.test(productText);
    const missingFields = [
      ...[
        price === null ? "price" : null,
        rating === null ? "rating" : null,
        reviewCount === null ? "reviewCount" : null,
        text(seller.name) === null ? "seller" : null,
        salesCount === null ? "salesCount" : null,
        image === null ? "images" : null,
      ],
    ].filter((v): v is string => v !== null);
    return [
      {
        externalId: idFromUrl(url),
        name,
        description: text(node.description),
        canonicalUrl: url,
        price,
        currency: text(offers.priceCurrency),
        categoryExternalId: text(node.category),
        rating,
        reviewCount: reviewCount === null ? null : Math.round(reviewCount),
        salesCount,
        salesEvidence: salesCount === null ? null : "PUBLIC_VISIBLE_TEXT",
        observedAt,
        sellerExternalId: null,
        sellerName: text(seller.name) ?? text(brand.name),
        sellerReputation: null,
        images: image ? [image] : [],
        availability: text(offers.availability),
        commission: null,
        freeShipping: /frete gr[aá]tis/i.test(productText) ? true : null,
        isBestSeller: best ? true : null,
        isMercadoLider: leader ? true : null,
        isOfficialStore: official ? true : null,
        missingFields,
        rawSourceReference: `public_web:${sourceUrl}#observedAt=${observedAt.toISOString()}`,
      },
    ];
  });
}

export class PublicWebProductDiscoverySource
  implements ProductDiscoverySource, MarketplaceProductProvider
{
  readonly marketplace = "public_web";
  private readonly cache = new Map<string, CacheEntry>();
  private active = 0;
  private readonly waiters: (() => void)[] = [];
  constructor(
    private readonly http: HttpClient,
    private readonly now = () => new Date(),
    private readonly ttlMs = 30 * 60_000,
  ) {}
  async resolveCategories(terms: readonly string[]) {
    return Object.fromEntries(
      terms.map((term) => [term, term.replace(/^produtos para /i, "")]),
    );
  }
  async discover(
    categories: readonly string[],
  ): Promise<readonly ProductDiscoverySignal[]> {
    const unique = [...new Set(categories)],
      offset =
        Math.floor(this.now().getTime() / 86_400_000) %
        Math.max(unique.length, 1),
      selected = Array.from(
        { length: Math.min(5, unique.length) },
        (_, index) => unique[(offset + index * 2) % unique.length]!,
      ),
      results = await this.mapLimited(selected, (category) =>
        this.searchProducts({
          query: `produtos para ${category}`,
          limit: 5,
        }).catch(() => []),
      );
    return selected.flatMap((category, index) => {
      const products = results[index] ?? [];
      return products.length
        ? [
            {
              term: `produtos para ${category}`,
              categoryExternalId: category,
              trendPosition: null,
              highlightPosition: products.some(
                (product) => product.isBestSeller,
              )
                ? 1
                : null,
              highlightedItemIds: products.map((p) => p.externalId),
              rawSourceReferences: [
                ...new Set(products.map((p) => p.rawSourceReference)),
              ],
            },
          ]
        : [];
    });
  }
  async searchProducts(request: ProductSearchRequest) {
    const url = `https://lista.mercadolivre.com.br/${encodeURIComponent(request.query).replace(/%20/g, "-")}`,
      entry = await this.load(url);
    return parsePublicProducts(entry.html, url, entry.observedAt).slice(
      0,
      request.limit,
    );
  }
  async getProduct(externalId: string) {
    for (const entry of this.cache.values()) {
      const found = parsePublicProducts(
        entry.html,
        "https://www.mercadolivre.com.br",
        entry.observedAt,
      ).find((p) => p.externalId === externalId);
      if (found) return found;
    }
    return null;
  }
  async getProducts(ids: readonly string[]) {
    return (await Promise.all(ids.map((id) => this.getProduct(id)))).filter(
      (v): v is MarketplaceProduct => v !== null,
    );
  }
  async getSeller(_id: string): Promise<MarketplaceSeller | null> {
    return null;
  }
  async getSellers(_ids: readonly string[]) {
    return [];
  }
  async getCategories() {
    return [];
  }
  refreshProductData(id: string) {
    return this.getProduct(id);
  }
  private async load(url: string) {
    const cached = this.cache.get(url),
      now = this.now();
    if (cached && cached.expiresAt > now.getTime()) return cached;
    const html = await this.limited(() =>
      this.http.request<string>({
        url,
        method: "GET",
        responseType: "text",
        timeoutMs: 5_000,
        headers: {
          "User-Agent":
            "CasaPratica/1.0 (+https://casapratica-web.vercel.app/)",
        },
      }),
    );
    const entry = {
      html,
      observedAt: now,
      expiresAt: now.getTime() + this.ttlMs,
    };
    this.cache.set(url, entry);
    return entry;
  }
  private async limited<T>(fn: () => Promise<T>) {
    if (this.active >= 2)
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.waiters.shift()?.();
    }
  }
  private async mapLimited<T, R>(
    values: readonly T[],
    fn: (v: T) => Promise<R>,
  ) {
    const result: R[] = [];
    for (const value of values) result.push(await fn(value));
    return result;
  }
}
