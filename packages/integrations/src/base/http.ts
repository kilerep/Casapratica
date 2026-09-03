import type { HttpClient } from "./provider.js";
export class FetchHttpClient implements HttpClient {
  async request<T>(input: Parameters<HttpClient["request"]>[0]): Promise<T> {
    const response = await fetch(input.url, { method: input.method, ...(input.headers ? { headers: input.headers } : {}), ...(input.body ? { body: input.body } : {}) });
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}
