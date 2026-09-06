import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
const apps: ReturnType<typeof buildApp>[] = [];
afterEach(() => Promise.all(apps.splice(0).map((app) => app.close())));
describe("product discovery endpoints", () => {
  it("expõe fonte indisponível como estado de negócio e aceita preflight local", async () => {
    const app = buildApp({ workspaceId: "w" });
    apps.push(app);
    const preflight = await app.inject({
      method: "OPTIONS",
      url: "/api/product-discovery/run",
      headers: {
        origin: "http://127.0.0.1:3000",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    expect(preflight.statusCode).toBe(204);
    const response = await app.inject({
      method: "POST",
      url: "/api/product-discovery/run",
      headers: { origin: "http://127.0.0.1:3000" },
    });
    expect(response.json()).toMatchObject({
      status: "source_unavailable",
      connected: false,
    });
  });
  it("rejeita origem externa", async () => {
    const app = buildApp({ workspaceId: "w" });
    apps.push(app);
    expect(
      (
        await app.inject({
          method: "OPTIONS",
          url: "/api/product-discovery/run",
          headers: { origin: "https://malicioso.example" },
        })
      ).statusCode,
    ).toBe(403);
  });
  it("encaminha auto, official e public_web sem serviços sociais", async () => {
    const service = {
        run: vi.fn().mockResolvedValue({ connected: true, run: { id: "r" } }),
        latest: vi.fn().mockResolvedValue({ id: "r" }),
        opportunities: vi.fn().mockResolvedValue([]),
      },
      app = buildApp({ workspaceId: "w", productDiscovery: service });
    apps.push(app);
    for (const source of ["auto", "official", "public_web"]) {
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/product-discovery/run",
            headers: { origin: "http://localhost:3000" },
            payload: { source },
          })
        ).statusCode,
      ).toBe(200);
    }
    expect(service.run.mock.calls.map((call) => call[1])).toEqual([
      "auto",
      "official",
      "public_web",
    ]);
    expect(
      (await app.inject({ url: "/api/product-discovery/latest" })).json(),
    ).toEqual({ id: "r" });
    expect(
      (
        await app.inject({ url: "/api/product-discovery/opportunities" })
      ).json(),
    ).toEqual([]);
  });
});
