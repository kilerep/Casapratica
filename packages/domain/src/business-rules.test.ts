import { describe, expect, it } from "vitest";
import { INITIAL_CATEGORIES } from "./initial-categories.js";
import { productSchema } from "./product.js";

describe("CasaPrática business rules", () => {
  it("defines the ten initial home categories without duplicates", () => { expect(INITIAL_CATEGORIES).toHaveLength(10); expect(new Set(INITIAL_CATEGORIES).size).toBe(10); });
  it("does not invent absent marketplace facts", () => {
    const result = productSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
