import type { CapabilityMap } from "./capabilities.js";
import type { HttpClient, IntegrationProvider, OAuthContext, OAuthTokens, ProviderName } from "./provider.js";
export type CapabilityRequirement = { scope: string; supported?: boolean; enabled?: boolean };
export type OAuthProviderConfig = { name: ProviderName; clientId: string; clientSecret: string; authorizationEndpoint: string; tokenEndpoint: string; validationEndpoint: string; revocationEndpoint?: string; scopes: readonly string[]; capabilities: Readonly<Record<string, CapabilityRequirement>>; pkce: boolean };
type R = { access_token: string; refresh_token?: string; expires_in: number; scope?: string; user_id?: string | number };
export class OAuthProvider implements IntegrationProvider {
  readonly name;
  constructor(private readonly c: OAuthProviderConfig, private readonly http: HttpClient) { this.name = c.name; }
  getAuthorizationUrl(x: OAuthContext) { const u = new URL(this.c.authorizationEndpoint); u.search = new URLSearchParams({ response_type: "code", client_id: this.c.clientId, redirect_uri: x.redirectUri, state: x.state, scope: this.c.scopes.join(" "), ...(this.c.pkce ? { code_challenge: x.codeChallenge, code_challenge_method: "S256" } : {}) }).toString(); return u; }
  handleCallback(code: string, x: OAuthContext):Promise<OAuthTokens> { return this.exchange(new URLSearchParams({ grant_type: "authorization_code", client_id: this.c.clientId, client_secret: this.c.clientSecret, code, redirect_uri: x.redirectUri, ...(this.c.pkce ? { code_verifier: x.codeVerifier } : {}) })); }
  refreshToken(t: string):Promise<OAuthTokens> { return this.exchange(new URLSearchParams({ grant_type: "refresh_token", client_id: this.c.clientId, client_secret: this.c.clientSecret, refresh_token: t })); }
  async validateConnection(t: string) { try { await this.http.request({ url: this.c.validationEndpoint, method: "GET", headers: { Authorization: `Bearer ${t}` } }); return true; } catch { return false; } }
  async disconnect(t: string) { if (this.c.revocationEndpoint) await this.http.request({ url: this.c.revocationEndpoint, method: "DELETE", headers: { Authorization: `Bearer ${t}` } }); }
  async getCapabilities(token: string, scopes: readonly string[]): Promise<CapabilityMap> {
    const checked = new Date(), tokenValid = await this.validateConnection(token);
    return Object.fromEntries(Object.entries(this.c.capabilities).map(([name, requirement]) => {
      const scopeGranted = scopes.includes(requirement.scope), supported = requirement.supported !== false, enabled = requirement.enabled !== false;
      const available = tokenValid && scopeGranted && supported && enabled;
      const reason = !tokenValid ? "token_invalid" : !supported ? "provider_unsupported" : !enabled ? "feature_disabled" : !scopeGranted ? `missing_scope:${requirement.scope}` : "available";
      return [name, { available, reason, lastCheckedAt: checked }];
    }));
  }
  private async exchange(body: URLSearchParams) { const r = await this.http.request<R>({ url: this.c.tokenEndpoint, method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });if(!r.access_token||!Number.isFinite(r.expires_in)||r.expires_in<=0)throw new Error("invalid_token_response");const identity=await this.http.request<{id?:string|number;nickname?:string;status?:string}>({url:this.c.validationEndpoint,method:"GET",headers:{Authorization:`Bearer ${r.access_token}`}}),externalAccountId=identity.id===undefined?(r.user_id===undefined?null:String(r.user_id)):String(identity.id);if(!externalAccountId)throw new Error("external_identity_missing");return { accessToken: r.access_token, refreshToken: r.refresh_token ?? null, expiresAt: new Date(Date.now() + r.expires_in * 1000), scopes: (r.scope ?? "").split(/[ ,]+/).filter(Boolean), externalAccountId,displayName:identity.nickname??null } satisfies OAuthTokens; }
}
