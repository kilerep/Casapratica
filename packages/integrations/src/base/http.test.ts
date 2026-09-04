import { describe, expect, it, vi } from "vitest";
import { FetchHttpClient } from "./http.js";
import { ProviderError } from "./provider.js";

describe("FetchHttpClient", () => {
  it.each([[401,"AUTH_INVALID"],[403,"CAPABILITY_MISSING"],[404,"NOT_FOUND"],[429,"RATE_LIMITED"],[500,"PROVIDER_UNAVAILABLE"]] as const)("maps %s safely", async (status, code) => {
    const client = new FetchHttpClient({ maxRetries: 0, fetch: vi.fn(async () => new Response("{}", { status, headers: status === 429 ? { "retry-after": "1" } : {} })) as typeof fetch });
    const error = await client.request({ url: "https://provider.invalid", method: "GET" }).catch(value => value);
    expect(error).toBeInstanceOf(ProviderError); expect((error as ProviderError).code).toBe(code); expect(JSON.stringify(error)).not.toContain("Bearer");
  });
  it("tracks LOW/EXHAUSTED and blocks non-essential calls without a loop", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200, headers: { "x-ratelimit-limit": "100", "x-ratelimit-remaining": "5" } }));
    const client = new FetchHttpClient({ fetch: fetchMock as typeof fetch }); await client.request({ url: "https://provider.invalid", method: "GET" });
    expect(client.rateLimit.snapshot.state).toBe("LOW"); await expect(client.request({ url: "https://provider.invalid", method: "GET", essential: false })).rejects.toMatchObject({ code: "RATE_LIMITED" }); expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("maps aborts to TIMEOUT", async () => { const client = new FetchHttpClient({ timeoutMs: 1, maxRetries: 0, fetch: vi.fn((_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as typeof fetch }); await expect(client.request({ url: "https://provider.invalid", method: "GET" })).rejects.toMatchObject({ code: "TIMEOUT" }); });
});
