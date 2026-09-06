import type { HttpClient } from "../base/provider.js";
import type { ProductDiscoverySignal, ProductDiscoverySource } from "../marketplace/provider.js";

type Trend = { keyword?: string; url?: string };
type Highlight = { id?: string; position?: number; type?: string };
type HighlightResponse = Highlight[] | { content?: Highlight[] };
type CategoryPrediction = { category_id?: string };

export class MercadoLivreDiscoverySource implements ProductDiscoverySource {
  readonly marketplace = "mercadolivre";
  readonly #baseUrl = "https://api.mercadolibre.com";
  constructor(private readonly http: HttpClient, private readonly accessToken: () => Promise<string>, private readonly siteId = "MLB") {}

  async resolveCategories(terms: readonly string[]): Promise<Readonly<Record<string, string>>> {
    const entries = await Promise.all([...new Set(terms)].map(async term => {
      try {
        const predictions = await this.get<CategoryPrediction[]>(`/sites/${this.siteId}/domain_discovery/search?limit=1&q=${encodeURIComponent(term)}`);
        const category = predictions[0]?.category_id;
        return category ? [term, category] as const : null;
      } catch {
        return null;
      }
    }));
    return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null));
  }

  async discover(categoryExternalIds: readonly string[]): Promise<readonly ProductDiscoverySignal[]> {
    const categories = [...new Set(categoryExternalIds.filter(Boolean))];
    const [siteTrends, ...categoryResults] = await Promise.all([
      this.get<Trend[]>(`/trends/${this.siteId}`),
      ...categories.flatMap(category => [this.get<Trend[]>(`/trends/${this.siteId}/${encodeURIComponent(category)}`), this.get<HighlightResponse>(`/highlights/${this.siteId}/category/${encodeURIComponent(category)}`)]),
    ]);
    const result = new Map<string, ProductDiscoverySignal>();
    const addTrends = (values: readonly Trend[], categoryExternalId: string | null) => values.forEach((value, index) => {
      const term = value.keyword?.trim(); if (!term) return;
      const key = `${categoryExternalId ?? "site"}:${term.toLocaleLowerCase("pt-BR")}`;
      result.set(key, { term, categoryExternalId, trendPosition: index + 1, highlightPosition: null, highlightedItemIds: [], rawSourceReferences: [`mercadolivre:trend:${value.url ?? term}`] });
    });
    addTrends(siteTrends, null);
    categories.forEach((category, index) => {
      const trends = categoryResults[index * 2] as Trend[] ?? [], highlightResponse = categoryResults[index * 2 + 1] as HighlightResponse | undefined;
      const highlights = Array.isArray(highlightResponse) ? highlightResponse : highlightResponse?.content ?? [];
      addTrends(trends, category);
      const ids = highlights.filter(value => value.id && (!value.type || value.type === "ITEM")).sort((a,b)=>(a.position ?? Number.MAX_SAFE_INTEGER)-(b.position ?? Number.MAX_SAFE_INTEGER));
      if (ids.length) result.set(`${category}:highlights`, { term: "mais vendidos", categoryExternalId: category, trendPosition: null, highlightPosition: ids[0]?.position ?? null, highlightedItemIds: ids.flatMap(value => value.id ? [value.id] : []), rawSourceReferences: [`mercadolivre:highlights:${this.siteId}:${category}`] });
    });
    return [...result.values()];
  }
  private async get<T>(path: string): Promise<T> { const token = await this.accessToken(); return this.http.request<T>({ url: `${this.#baseUrl}${path}`, method: "GET", headers: { Authorization: `Bearer ${token}` } }); }
}
