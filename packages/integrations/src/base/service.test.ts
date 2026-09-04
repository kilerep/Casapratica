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
  it("persiste access e refresh rotacionados juntos", async () => {
    const cipher = new TokenCipher(Buffer.alloc(32, 2)); let saved: StoredConnection = { id:"account",workspaceId:"workspace",provider:"mercadolivre",accessToken:cipher.encrypt("old-access"),refreshToken:cipher.encrypt("old-refresh"),expiresAt:new Date(Date.now()+1000),scopes:["read"],status:"connected" };
    const save=vi.fn(async(value:Omit<StoredConnection,"id">|StoredConnection)=>saved={...value,id:"account"}),saveCapabilities=vi.fn();
    const accounts:IntegrationRepository={list:async()=>[saved],find:async()=>saved,save,saveCapabilities,disconnect:vi.fn()};
    const provider:IntegrationProvider={name:"mercadolivre",getAuthorizationUrl:()=>new URL("https://example.invalid"),handleCallback:vi.fn(),refreshToken:vi.fn(async()=>({accessToken:"new-access",refreshToken:"new-refresh",expiresAt:new Date(Date.now()+60_000),scopes:["read"],externalAccountId:null})),validateConnection:async()=>true,disconnect:vi.fn(),getCapabilities:async()=>({read_product:{available:true,reason:"available",lastCheckedAt:new Date()}})};
    const registry=new IntegrationProviderRegistry();registry.register(provider);const service=new IntegrationService(registry,accounts,{save:vi.fn(),consume:vi.fn()},cipher,{pinterest:"https://app.invalid/p",facebook:"https://app.invalid/f",mercadolivre:"https://app.invalid/m"});
    await service.refresh("workspace","mercadolivre");expect(save).toHaveBeenCalledOnce();expect(cipher.decrypt(saved.accessToken)).toBe("new-access");expect(cipher.decrypt(saved.refreshToken!)).toBe("new-refresh");expect(saveCapabilities).toHaveBeenCalledOnce();expect(JSON.stringify(saved)).not.toContain("new-access");
  });
});
