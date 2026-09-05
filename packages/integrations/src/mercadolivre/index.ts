import { OAuthProvider, type OAuthProviderConfig } from "../base/oauth-provider.js";
import type { HttpClient } from "../base/provider.js";
export function createMercadoLivreProvider(clientId: string, clientSecret: string, http: HttpClient) {
  const config: OAuthProviderConfig = { name: "mercadolivre", clientId, clientSecret, authorizationEndpoint: "https://auth.mercadolivre.com.br/authorization", tokenEndpoint: "https://api.mercadolibre.com/oauth/token", validationEndpoint: "https://api.mercadolibre.com/users/me", scopes: ["offline_access", "read"], capabilities: { read_identity:{scope:"read"},read_trends:{scope:"read"},read_highlights:{scope:"read"},search_products:{scope:"read"},read_items:{scope:"read"},read_sellers:{scope:"read"} }, pkce: true };
  return new OAuthProvider(config, http);
}
