import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });
describe("POST /api/ai/chat", () => {
  it("returns the structured service response", async () => { const responseBody = { message: "ok", sessionId: randomUUID(), actions: [], approvalsRequired: [], references: [] }; const chat = vi.fn(async () => responseBody); const app = buildApp({ aiChat: { chat } }); apps.push(app); const response = await app.inject({ method: "POST", url: "/api/ai/chat", payload: { message: "Olá" } }); expect(response.statusCode).toBe(200); expect(response.json()).toEqual(responseBody); expect(chat).toHaveBeenCalledOnce(); });
  it("rejects invalid input before invoking AI", async () => { const app = buildApp(); apps.push(app); const response = await app.inject({ method: "POST", url: "/api/ai/chat", payload: { message: "" } }); expect(response.statusCode).toBe(400); });
});
