import { describe, expect, it, vi } from "vitest";
import { TokenCipher } from "@casapratica/security";
import { IntegrationProviderRegistry } from "./registry.js";
import { IntegrationService, type IntegrationRepository, type OAuthStateRepository, type StoredConnection } from "./service.js";
import type { IntegrationProvider } from "./provider.js";

describe("IntegrationService", () => {
  it("consome state uma única vez e não expõe tokens", async () => {
    let saved: StoredConnection | null = null;
    let transaction: Parameters<OAuthStateRepository["save"]>[0] | null = null;
    const states: OAuthStateRepository = {
      save: async value => { transaction = value; },
      consume: async digest => { if (!transaction || transaction.hash !== digest) return null; const value = transaction; transaction = null; return value; },
    };
    const accounts: IntegrationRepository = {
      list: async () => saved ? [saved] : [], find: async () => saved,
      save: async value => saved = { ...value, id: "account" },
      saveCapabilities: vi.fn(), disconnect: async () => { saved = null; },
    };
    const provider: IntegrationProvider = {
      name: "pinterest", getAuthorizationUrl: value => new URL(`https://oauth.example?state=${value.state}`),
      handleCallback: async () => ({ accessToken: "access-token", refreshToken: "refresh-token", expiresAt: new Date(Date.now() + 60_000), scopes: ["read"], externalAccountId: null }),
      refreshToken: vi.fn(), validateConnection: async () => true, disconnect: async () => undefined,
      getCapabilities: async () => ({ read_account: { available: true, reason: "scope_granted", lastCheckedAt: new Date() } }),
    };
    const registry = new IntegrationProviderRegistry(); registry.register(provider);
    const service = new IntegrationService(registry, accounts, states, new TokenCipher(Buffer.alloc(32, 1)), { pinterest: "https://app.example/pinterest", facebook: "https://app.example/facebook", mercadolivre: "https://app.example/ml" });
    const url = new URL(await service.connect("workspace", "pinterest")); const state = url.searchParams.get("state")!;
    await service.callback("pinterest", "code", state);
    expect(JSON.stringify(await service.list("workspace"))).not.toContain("access-token");
    await expect(service.callback("pinterest", "code", state)).rejects.toThrow("invalid_oauth_state");
  });
});
