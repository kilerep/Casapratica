import {
  OAuthProvider,
  type OAuthProviderConfig,
} from "../base/oauth-provider.js";
import type { HttpClient, OAuthContext } from "../base/provider.js";
export function createPinterestProvider(
  clientId: string,
  clientSecret: string,
  http: HttpClient,
  options: { realPublishingEnabled?: boolean; pilotEnabled?: boolean } = {},
) {
  const c: OAuthProviderConfig = {
    name: "pinterest",
    clientId,
    clientSecret,
    authorizationEndpoint: "https://www.pinterest.com/oauth/",
    tokenEndpoint: "https://api.pinterest.com/v5/oauth/token",
    validationEndpoint: "https://api.pinterest.com/v5/user_account",
    scopes: ["user_accounts:read", "boards:read", "pins:read", "pins:write"],
    capabilities: {
      read_account: { scope: "user_accounts:read" },
      read_boards: { scope: "boards:read" },
      write_boards: { scope: "boards:write", supported: false },
      read_pins: { scope: "pins:read" },
      create_pin: {
        scope: "pins:write",
        enabled:
          options.pilotEnabled === true &&
          options.realPublishingEnabled === true,
      },
      read_analytics: { scope: "pins:read", supported: false },
    },
    pkce: false,
  };
  return new PinterestOAuthProvider(c, http);
}

export class PinterestBoardProvider {
  constructor(
    private readonly http: HttpClient,
    private readonly accessToken: () => Promise<string>,
  ) {}
  async listBoards(): Promise<readonly { id: string; name: string }[]> {
    const token = await this.accessToken(),
      boards: Array<{ id: string; name: string }> = [],
      seen = new Set<string>();
    let bookmark: string | undefined;
    do {
      const url = new URL("https://api.pinterest.com/v5/boards");
      url.searchParams.set("page_size", "100");
      if (bookmark) url.searchParams.set("bookmark", bookmark);
      const response = await this.http.request<{
        items?: Array<{ id?: string; name?: string }>;
        bookmark?: string | null;
      }>({
        url: url.toString(),
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!Array.isArray(response.items))
        throw new Error("invalid_boards_response");
      boards.push(
        ...response.items
          .filter((item): item is { id: string; name: string } =>
            Boolean(item.id && item.name),
          )
          .map(({ id, name }) => ({ id, name })),
      );
      bookmark = response.bookmark ?? undefined;
      if (bookmark) {
        if (seen.has(bookmark) || seen.size >= 100)
          throw new Error("boards_pagination_incomplete");
        seen.add(bookmark);
      }
    } while (bookmark);
    return boards;
  }
}

class PinterestOAuthProvider extends OAuthProvider {
  constructor(
    private readonly config: OAuthProviderConfig,
    private readonly client: HttpClient,
  ) {
    super(config, client);
  }
  override getAuthorizationUrl(context: OAuthContext) {
    const url = super.getAuthorizationUrl(context);
    url.searchParams.set("scope", this.config.scopes.join(","));
    return url;
  }
  override handleCallback(code: string, context: OAuthContext) {
    return this.exchangePinterest(
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: context.redirectUri,
        continuous_refresh: "true",
      }),
    );
  }
  override refreshToken(refresh_token: string) {
    return this.exchangePinterest(
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token,
        continuous_refresh: "true",
      }),
    );
  }
  private async exchangePinterest(body: URLSearchParams) {
    const response = await this.client.request<{
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    }>({
      url: this.config.tokenEndpoint,
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (
      !response.access_token ||
      !Number.isFinite(response.expires_in) ||
      response.expires_in! <= 0
    )
      throw new Error("invalid_token_response");
    const scopes = (response.scope ?? "").split(/[ ,]+/).filter(Boolean);
    if (!scopes.includes("user_accounts:read"))
      throw new Error("account_scope_missing");
    const account = await this.client.request<{ id?: string }>({
      url: this.config.validationEndpoint,
      method: "GET",
      headers: { Authorization: `Bearer ${response.access_token}` },
    });
    if (!account.id || !/^\d+$/.test(account.id))
      throw new Error("external_identity_missing");
    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token ?? null,
      expiresAt: new Date(Date.now() + response.expires_in! * 1000),
      scopes,
      externalAccountId: account.id,
    };
  }
}

export interface PinterestPinInput {
  board_id: string;
  title: string;
  description: string;
  link: string;
  media_source: { source_type: "image_url"; url: string };
}
export class PinterestPinProvider {
  constructor(
    private readonly http: HttpClient,
    private readonly token: () => Promise<string>,
    private readonly enabled: () => boolean,
  ) {}
  async createPin(input: PinterestPinInput) {
    if (!this.enabled()) throw new Error("pinterest_publishing_disabled");
    const token = await this.token();
    const result = await this.http.request<{ id?: string }>({
      url: "https://api.pinterest.com/v5/pins",
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    if (!result.id || !/^\d+$/.test(result.id))
      throw new Error("reconciliation_required");
    return {
      externalId: result.id,
      externalUrl: `https://www.pinterest.com/pin/${result.id}/`,
      publishedAt: new Date(),
      metadata: { provider: "pinterest" },
    };
  }
}
