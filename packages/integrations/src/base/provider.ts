import type { CapabilityMap } from "./capabilities.js";
export type ProviderName = "pinterest" | "facebook" | "mercadolivre";
export type IntegrationMode = "TEST" | "SANDBOX" | "PRODUCTION";
export type IntegrationErrorCode = "AUTH_EXPIRED" | "AUTH_INVALID" | "CAPABILITY_MISSING" | "RATE_LIMITED" | "PROVIDER_UNAVAILABLE" | "INVALID_REQUEST" | "NOT_FOUND" | "TIMEOUT" | "UNKNOWN_PROVIDER_ERROR";
export class ProviderError extends Error {
  constructor(readonly code: IntegrationErrorCode, readonly status: number | null = null, readonly retryAfterMs: number | null = null) { super(code); this.name = "ProviderError"; }
}
export interface OAuthTokens { accessToken: string; refreshToken: string | null; expiresAt: Date; scopes: readonly string[]; externalAccountId: string | null; displayName?: string | null }
export interface OAuthContext { redirectUri: string; state: string; codeChallenge: string; codeVerifier: string }
export interface IntegrationProvider { readonly name: ProviderName; getAuthorizationUrl(c: OAuthContext): URL; handleCallback(code: string, c: OAuthContext): Promise<OAuthTokens>; refreshToken(token: string): Promise<OAuthTokens>; validateConnection(token: string): Promise<boolean>; disconnect(token: string): Promise<void>; getCapabilities(token: string, scopes: readonly string[]): Promise<CapabilityMap> }
export interface HttpClient { request<T>(i: { url: string; method: "GET" | "POST" | "DELETE"; headers?: Readonly<Record<string, string>>; body?: URLSearchParams | string; timeoutMs?: number; essential?: boolean }): Promise<T> }
