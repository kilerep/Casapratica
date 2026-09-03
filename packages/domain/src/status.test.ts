import { describe, expect, it } from "vitest";
import { assertProductTransition, canTransitionProduct } from "./product.js";
import { assertPublicationTransition, canTransitionPublication } from "./publication.js";

describe("status rules", () => {
  it("allows the product review and approval flow", () => { expect(canTransitionProduct("candidate", "under_review")).toBe(true); expect(canTransitionProduct("under_review", "approved")).toBe(true); });
  it("rejects activation directly from candidate", () => { expect(() => assertProductTransition("candidate", "active")).toThrow("Invalid product status transition"); });
  it("requires publication approval before publishing", () => { expect(canTransitionPublication("awaiting_approval", "approved")).toBe(true); expect(() => assertPublicationTransition("draft", "published")).toThrow("Invalid publication status transition"); });
  it("does not allow a published item to be reopened", () => { expect(canTransitionPublication("published", "draft")).toBe(false); });
});
