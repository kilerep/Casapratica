import { createHash } from "node:crypto";
import type { EncryptedValue, TokenCipher } from "@casapratica/security";
import type { CapabilityMap } from "./capabilities.js";
import { createOAuthProof } from "./oauth.js";
import type { ProviderName } from "./provider.js";
import type { IntegrationProviderRegistry } from "./registry.js";

export type ConnectionStatus =
  | "not_configured"
  | "disconnected"
  | "connecting"
  | "connected"
  | "error"
  | "token_expired";
export interface StoredConnection {
  id: string;
  workspaceId: string;
  provider: ProviderName;
  externalAccountId?: string | null;
  accessToken: EncryptedValue | null;
  refreshToken: EncryptedValue | null;
  expiresAt: Date | null;
  scopes: readonly string[];
  status: ConnectionStatus;
}
export interface IntegrationRepository {
  list(workspaceId: string): Promise<readonly StoredConnection[]>;
  find(
    workspaceId: string,
    provider: ProviderName,
  ): Promise<StoredConnection | null>;
  save(connection: Omit<StoredConnection, "id">): Promise<StoredConnection>;
  saveCapabilities(
    accountId: string,
    capabilities: CapabilityMap,
  ): Promise<void>;
  disconnect(accountId: string): Promise<void>;
  appendAudit?(
    workspaceId: string,
    action: string,
    resourceId: string | null,
    metadata?: Readonly<Record<string, unknown>>,
  ): Promise<void>;
}
export interface OAuthStateRepository {
  save(value: {
    hash: string;
    workspaceId: string;
    provider: ProviderName;
    redirectUri: string;
    verifier: EncryptedValue;
    expiresAt: Date;
  }): Promise<void>;
  consume(hash: string): Promise<{
    workspaceId: string;
    provider: ProviderName;
    redirectUri: string;
    verifier: EncryptedValue;
    expiresAt: Date;
  } | null>;
}
export interface PublicConnection {
  id?: string;
  externalAccountId?: string | null;
  provider: ProviderName;
  status: ConnectionStatus;
  expiresAt: Date | null;
  scopes?: readonly string[];
  capabilities?: CapabilityMap;
}
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export class IntegrationService {
  constructor(
    private readonly providers: IntegrationProviderRegistry,
    private readonly accounts: IntegrationRepository,
    private readonly states: OAuthStateRepository,
    private readonly cipher: TokenCipher,
    private readonly redirectUris: Readonly<Record<ProviderName, string>>,
  ) {}
  async list(workspaceId: string): Promise<readonly PublicConnection[]> {
    return Promise.all(
      (["pinterest", "facebook", "mercadolivre"] as const).map((provider) =>
        this.status(workspaceId, provider),
      ),
    );
  }
  async status(
    workspaceId: string,
    provider: ProviderName,
  ): Promise<PublicConnection> {
    if (!this.providers.has(provider))
      return { provider, status: "not_configured", expiresAt: null };
    const account = await this.accounts.find(workspaceId, provider);
    if (!account) return { provider, status: "disconnected", expiresAt: null };
    const result = toPublic(account);
    if (result.status === "connected" && provider === "pinterest") {
      const capabilities = await this.providers
        .get(provider)
        .getCapabilities(
          this.cipher.decrypt(credentials(account)),
          account.scopes,
        );
      await this.accounts.saveCapabilities(account.id, capabilities);
      return {
        ...result,
        capabilities,
        status: Object.values(capabilities).some(
          (c) => c.reason === "token_invalid",
        )
          ? "error"
          : result.status,
      };
    }
    return result;
  }
  async connect(workspaceId: string, provider: ProviderName) {
    this.providers.get(provider);
    const redirectUri = this.redirectUris[provider];
    const proof = createOAuthProof();
    await this.states.save({
      hash: hash(proof.state),
      workspaceId,
      provider,
      redirectUri,
      verifier: this.cipher.encrypt(proof.codeVerifier),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    await this.accounts.appendAudit?.(
      workspaceId,
      "integration.oauth_started",
      null,
      { provider },
    );
    return this.providers
      .get(provider)
      .getAuthorizationUrl({ ...proof, redirectUri })
      .toString();
  }
  async callback(provider: ProviderName, code: string, state: string) {
    const transaction = await this.states.consume(hash(state));
    if (
      !transaction ||
      transaction.provider !== provider ||
      transaction.expiresAt <= new Date()
    )
      throw new Error("invalid_oauth_state");
    if (!code) throw new Error("oauth_denied");
    const codeVerifier = this.cipher.decrypt(transaction.verifier);
    try {
      const tokens = await this.providers.get(provider).handleCallback(code, {
        state,
        codeVerifier,
        codeChallenge: "",
        redirectUri: transaction.redirectUri,
      });
      const capabilities = await this.providers
        .get(provider)
        .getCapabilities(tokens.accessToken, tokens.scopes);
      if (provider === "pinterest" && !capabilities.read_account?.available)
        throw new Error("AUTH_INVALID");
      const account = await this.accounts.save({
        workspaceId: transaction.workspaceId,
        provider,
        externalAccountId: tokens.externalAccountId,
        accessToken: this.cipher.encrypt(tokens.accessToken),
        refreshToken: tokens.refreshToken
          ? this.cipher.encrypt(tokens.refreshToken)
          : null,
        expiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        status: "connected",
      });
      await this.accounts.saveCapabilities(account.id, capabilities);
      await this.accounts.appendAudit?.(
        transaction.workspaceId,
        "integration.oauth_completed",
        account.id,
        {
          provider,
          scopes: tokens.scopes,
          capabilities: Object.fromEntries(
            Object.entries(capabilities).map(([name, value]) => [
              name,
              value.available,
            ]),
          ),
        },
      );
      return {
        provider,
        status: account.status,
        scopes: tokens.scopes,
        capabilities,
      };
    } catch (error) {
      await this.accounts.appendAudit?.(
        transaction.workspaceId,
        "integration.oauth_failed",
        null,
        { provider, errorCode: "oauth_exchange_failed" },
      );
      throw error;
    }
  }
  async validate(workspaceId: string, provider: ProviderName) {
    const account = await this.required(workspaceId, provider);
    if (account.status !== "connected")
      return { valid: false, status: account.status };
    if (account.expiresAt === null || account.expiresAt <= new Date())
      return { valid: false, status: "token_expired" as const };
    const valid =
      account.status === "connected" &&
      (await this.providers
        .get(provider)
        .validateConnection(this.cipher.decrypt(credentials(account))));
    return { valid, status: valid ? account.status : ("error" as const) };
  }
  async refresh(workspaceId: string, provider: ProviderName) {
    const account = await this.required(workspaceId, provider);
    if (!account.refreshToken) throw new Error("AUTH_EXPIRED");
    const tokens = await this.providers
      .get(provider)
      .refreshToken(this.cipher.decrypt(account.refreshToken));
    if (
      provider === "pinterest" &&
      tokens.externalAccountId !== account.externalAccountId
    )
      throw new Error("external_identity_changed");
    const refreshToken = tokens.refreshToken
      ? this.cipher.encrypt(tokens.refreshToken)
      : account.refreshToken;
    const saved = await this.accounts.save({
      ...account,
      accessToken: this.cipher.encrypt(tokens.accessToken),
      refreshToken,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
      status: "connected",
    });
    const capabilities = await this.providers
      .get(provider)
      .getCapabilities(tokens.accessToken, tokens.scopes);
    await this.accounts.saveCapabilities(saved.id, capabilities);
    return {
      provider,
      status: "connected" as const,
      expiresAt: tokens.expiresAt,
    };
  }
  async accessToken(workspaceId: string, provider: ProviderName) {
    const account = await this.required(workspaceId, provider);
    if (account.status !== "connected") throw new Error("AUTH_INVALID");
    if (account.expiresAt === null || account.expiresAt <= new Date())
      throw new Error("AUTH_EXPIRED");
    return this.cipher.decrypt(credentials(account));
  }
  async disconnect(workspaceId: string, provider: ProviderName) {
    const account = await this.required(workspaceId, provider);
    if (account.accessToken && this.providers.has(provider))
      await this.providers
        .get(provider)
        .disconnect(this.cipher.decrypt(account.accessToken));
    await this.accounts.disconnect(account.id);
    await this.accounts.appendAudit?.(
      workspaceId,
      "integration.disconnected",
      account.id,
      { provider },
    );
  }
  private async required(workspaceId: string, provider: ProviderName) {
    const account = await this.accounts.find(workspaceId, provider);
    if (!account) throw new Error("integration_not_found");
    return account;
  }
}
const toPublic = (account: StoredConnection): PublicConnection => ({
  id: account.id,
  externalAccountId: account.externalAccountId ?? null,
  provider: account.provider,
  status:
    account.status === "connected" &&
    (account.expiresAt === null || account.expiresAt <= new Date())
      ? "token_expired"
      : account.status,
  expiresAt: account.expiresAt,
  scopes: account.scopes,
});

const credentials = (account: StoredConnection) => {
  if (!account.accessToken) throw new Error("AUTH_INVALID");
  return account.accessToken;
};
