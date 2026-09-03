import { expect, it } from "vitest";
import { productAnalysisSchema } from "./outputs.js";
it("keeps unknown structured output data explicit", () => { const output = productAnalysisSchema.parse({ productId: "p1", strengths: [], risks: [], score: null, confidence: 0, evidence: [], missingData: ["price"] }); expect(output.score).toBeNull(); expect(output.missingData).toContain("price"); });
