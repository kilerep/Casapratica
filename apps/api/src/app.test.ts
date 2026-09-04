import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });
describe("GET /health", () => {
  it("reports service health", async () => { const app = buildApp(); apps.push(app); const response = await app.inject({ method: "GET", url: "/health" }); expect(response.statusCode).toBe(200); expect(response.json()).toEqual({ status: "ok" }); });
  it("generates product and utility content through the service", async () => { const content = { generateProduct: vi.fn().mockResolvedValue({ id: "c1", status: "draft" }), generateUtility: vi.fn().mockResolvedValue({ id: "c2", status: "draft" }) }; const app = buildApp({ content, workspaceId: "w1" }); apps.push(app); const product = await app.inject({ method: "POST", url: "/api/products/p1/content", payload: { platforms: ["pinterest", "facebook"], variants: 2, angles: ["organization"] } }); const utility = await app.inject({ method: "POST", url: "/api/content/utility", payload: { platform: "facebook", topic: "organização da casa" } }); expect(product.statusCode).toBe(200); expect(utility.statusCode).toBe(200); expect(content.generateProduct).toHaveBeenCalledWith(expect.objectContaining({ productId: "p1", variants: 2 })); });
});
