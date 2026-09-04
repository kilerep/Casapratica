import { ProviderError } from "./provider.js";

export type RateLimitState = "NORMAL" | "LOW" | "EXHAUSTED";
export interface RateLimitSnapshot { state: RateLimitState; limit: number | null; remaining: number | null; resetAt: Date | null }

export class RateLimitGuard {
  #snapshot: RateLimitSnapshot = { state: "NORMAL", limit: null, remaining: null, resetAt: null };
  get snapshot(): RateLimitSnapshot { return this.#snapshot; }
  assertAllowed(essential = true) {
    if (this.#snapshot.state === "EXHAUSTED" && this.#snapshot.resetAt && this.#snapshot.resetAt <= new Date()) this.#snapshot = { state: "NORMAL", limit: this.#snapshot.limit, remaining: null, resetAt: null };
    if (!essential && this.#snapshot.state !== "NORMAL") throw new ProviderError("RATE_LIMITED", 429, this.retryAfterMs());
  }
  observe(headers: Headers, status: number) {
    const limit = numberHeader(headers, "x-ratelimit-limit"), remaining = numberHeader(headers, "x-ratelimit-remaining");
    const retryAfter = retryAfterMs(headers), reset = numberHeader(headers, "x-ratelimit-reset");
    const resetAt = retryAfter !== null ? new Date(Date.now() + retryAfter) : reset !== null ? new Date(reset > 1_000_000_000 ? reset * 1000 : Date.now() + reset * 1000) : null;
    const state: RateLimitState = status === 429 || remaining === 0 ? "EXHAUSTED" : limit !== null && remaining !== null && remaining / limit <= 0.1 ? "LOW" : "NORMAL";
    this.#snapshot = { state, limit, remaining, resetAt };
  }
  retryAfterMs() { return this.#snapshot.resetAt ? Math.max(0, this.#snapshot.resetAt.getTime() - Date.now()) : null; }
}
const numberHeader = (headers: Headers, name: string) => { const raw = headers.get(name)?.split(/[;,]/)[0]?.trim(); const value = raw === undefined ? NaN : Number(raw); return Number.isFinite(value) ? value : null; };
export const retryAfterMs = (headers: Headers) => { const raw = headers.get("retry-after"); if (!raw) return null; const seconds = Number(raw); if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000); const date = Date.parse(raw); return Number.isNaN(date) ? null : Math.max(0, date - Date.now()); };
