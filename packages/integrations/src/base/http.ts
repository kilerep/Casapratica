import type { HttpClient } from "./provider.js";
import { ProviderError } from "./provider.js";
import { RateLimitGuard, retryAfterMs } from "./rate-limit.js";
export class FetchHttpClient implements HttpClient {
  readonly rateLimit = new RateLimitGuard();
  constructor(private readonly options: { timeoutMs?: number; maxRetries?: number; fetch?: typeof fetch; wait?: (ms: number) => Promise<void> } = {}) {}
  async request<T>(input: Parameters<HttpClient["request"]>[0]): Promise<T> {
    this.rateLimit.assertAllowed(input.essential ?? true);
    const maxRetries = input.method === "GET" ? this.options.maxRetries ?? 2 : 0;
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), input.timeoutMs ?? this.options.timeoutMs ?? 10_000);
      try {
        const response = await (this.options.fetch ?? fetch)(input.url, { method: input.method, signal: controller.signal, ...(input.headers ? { headers: input.headers } : {}), ...(input.body ? { body: input.body } : {}) });
        this.rateLimit.observe(response.headers, response.status);
        if (response.ok) return response.status === 204 ? undefined as T : (input.responseType === "text" ? response.text() : response.json()) as Promise<T>;
        const error = mapStatus(response.status, retryAfterMs(response.headers));
        if (attempt < maxRetries && ["RATE_LIMITED", "PROVIDER_UNAVAILABLE"].includes(error.code)) { await (this.options.wait ?? wait)(error.retryAfterMs ?? 250 * 2 ** attempt); continue; }
        throw error;
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        const mapped = error instanceof Error && error.name === "AbortError" ? new ProviderError("TIMEOUT") : new ProviderError("PROVIDER_UNAVAILABLE");
        if (attempt < maxRetries) { await (this.options.wait ?? wait)(250 * 2 ** attempt); continue; }
        throw mapped;
      } finally { clearTimeout(timer); }
    }
  }
}
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, Math.min(ms, 30_000)));
const mapStatus = (status: number, retry: number | null) => status === 401 ? new ProviderError("AUTH_INVALID", status) : status === 403 ? new ProviderError("CAPABILITY_MISSING", status) : status === 404 ? new ProviderError("NOT_FOUND", status) : status === 429 ? new ProviderError("RATE_LIMITED", status, retry) : status >= 500 ? new ProviderError("PROVIDER_UNAVAILABLE", status) : status >= 400 ? new ProviderError("INVALID_REQUEST", status) : new ProviderError("UNKNOWN_PROVIDER_ERROR", status);
