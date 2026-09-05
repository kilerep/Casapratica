import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

describe("dashboard API", () => {
  it("serves the read-only snapshot without invoking operations", async () => {
    const snapshot = vi.fn().mockResolvedValue({ products: { awaitingReview: 0 }, queue: { approved: 2 }, creatives: [] });
    const operations = { run: vi.fn() };
    const app = buildApp({ dashboard: { snapshot }, workspaceId: "w1" });
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/api/dashboard" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ queue: { approved: 2 } });
    expect(snapshot).toHaveBeenCalledWith("w1");
    expect(operations.run).not.toHaveBeenCalled();
  });

  it("does not expose an unconfigured dashboard", async () => {
    const app = buildApp();
    apps.push(app);
    expect((await app.inject({ url: "/api/dashboard" })).statusCode).toBe(503);
  });
});
