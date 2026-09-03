import { describe, expect, it } from "vitest";
import { routeCommand } from "./routing.js";
describe("manager routing", () => {
  it.each([["compare o score deste produto", "ProductAnalystAgent"], ["crie um pin", "PinterestStrategistAgent"], ["analise os cliques", "PerformanceAnalystAgent"], ["pesquise organizadores", "ProductResearchAgent"]] as const)("routes %s", (message: string, expected: string) => { expect(routeCommand(message)).toBe(expected); });
});
