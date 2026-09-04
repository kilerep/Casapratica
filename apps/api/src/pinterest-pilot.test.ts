import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QueueItem } from "@casapratica/strategy";
import {
  PinterestPilotService,
  pinterestReadiness,
  type PilotRepository,
} from "./pinterest-pilot.js";
import { buildApp } from "./app.js";
beforeEach(() =>
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("real_network_forbidden");
    }),
  ),
);
afterEach(() => vi.unstubAllGlobals());
function setup() {
  let item: QueueItem = {
    id: "q",
    workspaceId: "w",
    productId: "p",
    productStatus: "approved",
    contentId: "c",
    creativeAssetId: "a",
    channel: "pinterest",
    status: "approved",
    scheduledFor: null,
    approvedAt: new Date("2026-01-01"),
    approvedBy: "human",
    attempts: 0,
    integrationAccountId: "i",
    capabilityAvailable: true,
    integrationConnected: true,
    priceDisplayed: false,
    priceFresh: true,
    creativeValid: true,
    affiliateUrl: "https://example.com/product",
    destinationId: "123",
    body: "Approved description",
    metadata: {
      title: "Approved title",
      creativeUrl: "https://example.com/creative.png",
      creativeMimeType: "image/png",
    },
  };
  const flags = { pilot: true, publishing: true };
  let reserved = false;
  const reserve = vi.fn(async () => {
    if (reserved) throw new Error("reconciliation_required");
    reserved = true;
  });
  const repository = {
    getQueueItem: vi.fn(async () => ({ ...item })),
    findPublicationByKey: vi.fn(async () => null),
    circuitState: vi.fn(async () => "CLOSED"),
    updateQueueItem: vi.fn(
      async (_w: string, _id: string, input: Partial<QueueItem>) =>
        (item = { ...item, ...input }),
    ),
    appendAudit: vi.fn(),
    savePublication: vi.fn(),
    setCircuitState: vi.fn(),
    consecutiveFailures: vi.fn(async () => 0),
    createAlert: vi.fn(),
    reservePinterestPublication: reserve,
  } as unknown as PilotRepository;
  const status = vi.fn(async () => ({
    id: "i",
    provider: "pinterest" as const,
    status: "connected" as const,
    expiresAt: new Date(Date.now() + 60000),
    capabilities: {
      create_pin: {
        available: true,
        reason: "available",
        lastCheckedAt: new Date(),
      },
      read_boards: {
        available: true,
        reason: "available",
        lastCheckedAt: new Date(),
      },
    },
  }));
  const listBoards = vi.fn(async () => [{ id: "123", name: "Real board" }]);
  const createPin = vi.fn(async () => ({
    externalId: "999",
    externalUrl: "https://www.pinterest.com/pin/999/",
    publishedAt: new Date(),
    metadata: { provider: "pinterest" },
  }));
  const service = new PinterestPilotService(
    repository,
    { status },
    { listBoards },
    { createPin },
    () => flags,
  );
  return {
    service,
    repository,
    flags,
    status,
    listBoards,
    createPin,
    reserve,
    change: (input: Partial<QueueItem>) => {
      item = { ...item, ...input };
    },
  };
}
describe("manual pilot", () => {
  it("dry-run performs no publish or persistence", async () => {
    const x = setup();
    expect(await x.service.dryRun("w", "q")).toMatchObject({
      dryRun: true,
      published: false,
      ready: true,
      boardVerified: true,
    });
    expect(x.createPin).not.toHaveBeenCalled();
    expect(x.reserve).not.toHaveBeenCalled();
    expect(x.repository.updateQueueItem).not.toHaveBeenCalled();
  });
  for (const patch of [
    { status: "awaiting_approval" },
    { status: "scheduled" },
    { status: "failed" },
    { approvedBy: null },
    { integrationConnected: false },
    { capabilityAvailable: false },
    { creativeValid: false },
    { creativeAssetId: null },
    { destinationId: "fake" },
    { affiliateUrl: "http://localhost/" },
    { metadata: {} },
    { priceDisplayed: true, priceFresh: false },
  ] as Partial<QueueItem>[])
    it(`blocks invalid item ${JSON.stringify(patch)}`, async () => {
      const x = setup();
      x.change(patch);
      expect((await x.service.dryRun("w", "q")).ready).toBe(false);
      await expect(
        x.service.publish("w", "q", "human", "a".repeat(64)),
      ).rejects.toThrow();
      expect(x.createPin).not.toHaveBeenCalled();
    });
  for (const flag of ["pilot", "publishing"] as const)
    it(`blocks flag ${flag}`, async () => {
      const x = setup();
      x.flags[flag] = false;
      expect((await x.service.dryRun("w", "q")).ready).toBe(false);
      expect(x.createPin).not.toHaveBeenCalled();
    });
  it("requires unchanged reviewed payload", async () => {
    const x = setup();
    const check = await x.service.dryRun("w", "q");
    x.change({ body: "Changed" });
    await expect(
      x.service.publish("w", "q", "human", check.fingerprint),
    ).rejects.toThrow("dry_run_changed");
    expect(x.reserve).not.toHaveBeenCalled();
  });
  it("reserves before the one real-provider call", async () => {
    const x = setup();
    const check = await x.service.dryRun("w", "q");
    await expect(
      x.service.publish("w", "q", "human", check.fingerprint),
    ).resolves.toMatchObject({ externalId: "999" });
    expect(x.reserve).toHaveBeenCalledOnce();
    expect(x.createPin).toHaveBeenCalledOnce();
    expect(x.reserve.mock.invocationCallOrder[0]).toBeLessThan(
      x.createPin.mock.invocationCallOrder[0]!,
    );
  });
  it("returns persisted real success without another POST", async () => {
    const x = setup();
    const result = {
      externalId: "999",
      externalUrl: "https://www.pinterest.com/pin/999/",
      publishedAt: new Date(),
      metadata: { provider: "pinterest" },
    };
    vi.mocked(x.repository.findPublicationByKey).mockResolvedValue(result);
    x.change({ status: "published" });
    expect(await x.service.publish("w", "q", "human", "reviewed")).toEqual(
      result,
    );
    expect(x.createPin).not.toHaveBeenCalled();
    expect(x.reserve).not.toHaveBeenCalled();
  });
  it("does not resend ambiguous attempts even after manual reapproval", async () => {
    const x = setup();
    x.createPin.mockRejectedValue(new Error("TIMEOUT"));
    const check = await x.service.dryRun("w", "q");
    await expect(
      x.service.publish("w", "q", "human", check.fingerprint),
    ).rejects.toThrow("TIMEOUT");
    x.change({ status: "approved" });
    await expect(
      x.service.publish("w", "q", "human", check.fingerprint),
    ).rejects.toThrow("reconciliation_required");
    expect(x.createPin).toHaveBeenCalledOnce();
  });
  it("requires browser origin and explicit confirmation at endpoint", async () => {
    const x = setup();
    const app = buildApp({ pinterestPilot: x.service, workspaceId: "w" });
    const url = "/api/pinterest/pilot/q/publish";
    expect(
      (await app.inject({ method: "POST", url, payload: {} })).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url,
          headers: { origin: "http://localhost:3000" },
          payload: {},
        })
      ).statusCode,
    ).toBe(400);
    expect(x.createPin).not.toHaveBeenCalled();
    await app.close();
  }, 15000);
});

describe("pilot readiness and OAuth routes", () => {
  it("reports runtime state without hiding unavailable credentials", async () => {
    const status = vi.fn().mockResolvedValue({ status: "token_expired" });
    expect(await pinterestReadiness(false, { status }, "w")).toBe(
      "pilot_disabled",
    );
    expect(status).not.toHaveBeenCalled();
    expect(await pinterestReadiness(true, undefined, "w")).toBe(
      "not_configured",
    );
    expect(await pinterestReadiness(true, { status }, "w")).toBe(
      "token_expired",
    );
    status.mockRejectedValue(new Error("private failure"));
    expect(await pinterestReadiness(true, { status }, "w")).toBe("error");
  });
  it("binds Pinterest callback to initiating browser and hides query secrets", async () => {
    const callback = vi.fn(async () => ({
      provider: "pinterest" as const,
      status: "connected" as const,
      scopes: [],
      capabilities: {},
    }));
    const integrations = {
      list: vi.fn(),
      status: vi.fn(),
      connect: vi.fn(
        async () =>
          "https://www.pinterest.com/oauth/?state=opaque-state&redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fcallback",
      ),
      callback,
      validate: vi.fn(),
      disconnect: vi.fn(),
    };
    const app = buildApp({ integrations, workspaceId: "w" });
    const start = await app.inject({
      url: "/api/integrations/pinterest/connect",
    });
    const cookie = String(start.headers["set-cookie"]);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("opaque-state");
    const url =
      "/api/integrations/pinterest/callback?code=private-code&state=opaque-state";
    expect((await app.inject({ url })).statusCode).toBe(400);
    expect(callback).not.toHaveBeenCalled();
    const result = await app.inject({
      url,
      headers: { cookie: cookie.split(";")[0]! },
    });
    expect(result.statusCode).toBe(302);
    expect(result.headers.location).toBe(
      "http://localhost:3000/integrations?oauth=connected",
    );
    expect(result.headers["cache-control"]).toBe("no-store");
    expect(result.body).not.toContain("private-code");
    await app.close();
  }, 15000);
});
