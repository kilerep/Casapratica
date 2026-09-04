import { describe, expect, it, vi } from "vitest";
import type { HttpClient } from "../base/provider.js";
import { PinterestBoardProvider } from "./index.js";
describe("PinterestBoardProvider", () => { it("lista somente boards retornados pela API real mockada", async () => { const request = vi.fn().mockResolvedValue({ items: [{ id: "b1", name: "Cozinha" }, { id: "", name: "inválido" }] }); const provider = new PinterestBoardProvider({ request } as HttpClient, async () => "token"); await expect(provider.listBoards()).resolves.toEqual([{ id: "b1", name: "Cozinha" }]); expect(request.mock.calls[0]?.[0].headers.Authorization).toBe("Bearer token"); }); });
