import { OAuthProvider, type OAuthProviderConfig } from "../base/oauth-provider.js";
import type { HttpClient } from "../base/provider.js";
export function createMetaProvider(clientId: string, clientSecret: string, graphApiVersion: string, http: HttpClient) {
  if (!/^v\d+\.\d+$/.test(graphApiVersion)) throw new Error("invalid_meta_graph_api_version");
  const config: OAuthProviderConfig = { name: "facebook", clientId, clientSecret, authorizationEndpoint: `https://www.facebook.com/${graphApiVersion}/dialog/oauth`, tokenEndpoint: `https://graph.facebook.com/${graphApiVersion}/oauth/access_token`, validationEndpoint: `https://graph.facebook.com/${graphApiVersion}/me`, revocationEndpoint: `https://graph.facebook.com/${graphApiVersion}/me/permissions`, scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "read_insights"], capabilities: { read_page: "pages_show_list", create_post: "pages_manage_posts", read_posts: "pages_read_engagement", read_insights: "read_insights" }, pkce: true };
  return new OAuthProvider(config, http);
}

export class FacebookPageProvider {
  constructor(private readonly graphApiVersion: string, private readonly http: HttpClient, private readonly accessToken: () => Promise<string>) { if (!/^v\d+\.\d+$/.test(graphApiVersion)) throw new Error("invalid_meta_graph_api_version"); }
  async listPages(): Promise<readonly { id: string; name: string }[]> { const token = await this.accessToken(); const response = await this.http.request<{ data?: Array<{ id?: string; name?: string }> }>({ url: `https://graph.facebook.com/${this.graphApiVersion}/me/accounts?fields=id,name`, method: "GET", headers: { Authorization: `Bearer ${token}` } }); return (response.data ?? []).filter((page): page is { id: string; name: string } => Boolean(page.id && page.name)).map(page => ({ id: page.id, name: page.name })); }
}
