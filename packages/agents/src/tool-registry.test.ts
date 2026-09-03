import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "./tool-registry.js";
describe("ToolRegistry", () => {
  it("validates and calls an application service-backed tool", async () => { const execute = vi.fn(async ({ id }: { id: string }) => ({ id })); const registry = new ToolRegistry(); registry.register({ name: "lookup", description: "lookup", parameters: z.object({ id: z.string() }), externalAction: false, execute }); await expect(registry.execute("lookup", { id: "p1" })).resolves.toEqual({ id: "p1" }); expect(execute).toHaveBeenCalledOnce(); });
  it("propagates a tool failure without fabricating a result", async () => { const registry = new ToolRegistry(); registry.register({ name: "failing", description: "fails", parameters: z.object({}), externalAction: false, execute: async () => { throw new Error("repository_unavailable"); } }); await expect(registry.execute("failing", {})).rejects.toThrow("repository_unavailable"); });
});
