import { OAuthProvider, type OAuthProviderConfig } from "../base/oauth-provider.js";
import type { HttpClient } from "../base/provider.js";
export function createMercadoLivreProvider(clientId: string, clientSecret: string, http: HttpClient) {
  const config: OAuthProviderConfig = { name: "mercadolivre", clientId, clientSecret, authorizationEndpoint: "https://auth.mercadolivre.com.br/authorization", tokenEndpoint: "https://api.mercadolibre.com/oauth/token", validationEndpoint: "https://api.mercadolibre.com/users/me", scopes: ["offline_access", "read"], capabilities: { search_product: { scope: "read" }, read_product: { scope: "read" }, seller_info: { scope: "read" }, affiliate_link_generation: { scope: "affiliate_link_generation", supported: false } }, pkce: true };
  return new OAuthProvider(config, http);
}
