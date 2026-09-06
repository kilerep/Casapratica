import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { HttpClient } from "../base/provider.js";
import { ProviderError } from "../base/provider.js";
import {
  PublicWebProductDiscoverySource,
  parsePublicProducts,
} from "./index.js";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const sourceUrl = "https://lista.mercadolivre.com.br/organizador";

describe("PublicWebProductDiscoverySource", () => {
  it("prefere JSON-LD e preserva somente vendas com evidência explícita", () => {
    const [product] = parsePublicProducts(
      fixture("search.html"),
      sourceUrl,
      new Date("2026-09-06T12:00:00Z"),
    );
    expect(product).toMatchObject({
      externalId: "MLB1234567890",
      name: "Organizador de Cozinha",
      price: 79.9,
      rating: 4.8,
      reviewCount: 321,
      salesCount: 10_000,
      salesEvidence: "PUBLIC_VISIBLE_TEXT",
    });
  });

  it("extrai JSON embutido quando JSON-LD não existe", () => {
    expect(parsePublicProducts(fixture("embedded.html"), sourceUrl)[0]).toMatchObject({
      externalId: "MLB2234567890",
      name: "Cesto Organizador",
      price: 129.9,
      rating: 4.7,
      reviewCount: 88,
    });
  });

  it("associa preço, avaliação, vendas e badge somente ao container HTML", () => {
    const [product] = parsePublicProducts(fixture("fallback.html"), sourceUrl);
    expect(product).toMatchObject({
      externalId: "MLB3234567890",
      price: 1299.9,
      rating: 4.8,
      reviewCount: 321,
      salesCount: 10_000,
      freeShipping: true,
      isOfficialStore: null,
    });
    expect(product?.canonicalUrl).not.toContain("tracking_id");
  });

  it("mantém campos ausentes como null quando URL, título e item id existem", () => {
    expect(parsePublicProducts(fixture("missing.html"), sourceUrl)[0]).toMatchObject({
      externalId: "MLB9999999999",
      price: null,
      rating: null,
      reviewCount: null,
      salesCount: null,
      sellerName: null,
      images: [],
    });
    expect(parsePublicProducts('<script type="application/ld+json">{"@type":"Product","name":"Sem identidade","url":"https://www.mercadolivre.com.br/oferta"}</script>', sourceUrl)).toEqual([]);
  });

  it("trata captcha e intersticial como indisponibilidade, nunca zero resultados", async () => {
    expect(() => parsePublicProducts("<html>Robot Verification CAPTCHA</html>", sourceUrl)).toThrow(ProviderError);
    const source = new PublicWebProductDiscoverySource({
      request: vi.fn().mockResolvedValue(fixture("interstitial.html")),
    } as HttpClient);
    await expect(source.searchProducts({ query: "organizador", limit: 5 })).rejects.toMatchObject({
      code: "CAPABILITY_MISSING",
    });
  });

  it("distingue página sem resultados de HTML sem estrutura", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(fixture("no-results.html"))
      .mockResolvedValue(fixture("no-results.html"));
    const source = new PublicWebProductDiscoverySource({ request } as HttpClient);
    await source.discover(["cozinha"]);
    expect(source.lastDiscoveryDiagnostics()).toMatchObject({
      status: "no_results",
      accessibleResponses: 2,
      noResultResponses: 2,
    });
  });

  it("classifica sucesso parcial e reutiliza cache normalizado", async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(new ProviderError("TIMEOUT"))
      .mockResolvedValue(fixture("search.html"));
    const source = new PublicWebProductDiscoverySource({ request } as HttpClient);
    const signals = await source.discover(["cozinha"]);
    expect(signals).toHaveLength(1);
    expect(source.lastDiscoveryDiagnostics().status).toBe("partial_success");
    await source.searchProducts({ query: "utensílios cozinha", limit: 5 });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("deduplica por item id", () => {
    const html = fixture("search.html").replace("</body>", `${fixture("search.html")}</body>`);
    expect(parsePublicProducts(html, sourceUrl)).toHaveLength(1);
  });
});
