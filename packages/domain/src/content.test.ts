import { describe, expect, it } from "vitest";
import { assertSafeContent, facebookContentSchema, pinterestContentSchema } from "./content.js";
describe("content contracts", () => {
  it("rejeita claims proibidos", () => expect(() => assertSafeContent("O melhor produto do Brasil")).toThrow("prohibited_claim"));
  it("rejeita structured outputs incompletos", () => { expect(pinterestContentSchema.safeParse({ title: "livre" }).success).toBe(false); expect(facebookContentSchema.safeParse({ copy: "texto livre" }).success).toBe(false); });
});
