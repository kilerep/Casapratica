import { describe, expect, it } from "vitest";
import { calculateCasaPraticaScore, SCORE_WEIGHTS } from "./score.js";

describe("CasaPrática score", () => {
  it("calculates a complete weighted score", () => {
    const result = calculateCasaPraticaScore({ demand: 80, reviews: 90, sellerReputation: 70, priceCompetitiveness: 60, listingQuality: 100, commission: 40, seasonality: 50 });
    expect(result.score).toBe(76.5);
    expect(result.confidence).toBe(1);
    expect(result.availableFactors).toHaveLength(Object.keys(SCORE_WEIGHTS).length);
    expect(result.missingFactors).toEqual([]);
  });

  it("normalizes only available factors without silently penalizing missing data", () => {
    const result = calculateCasaPraticaScore({ demand: 80, reviews: null });
    expect(result.score).toBe(80);
    expect(result.confidence).toBe(0.25);
    expect(result.availableFactors).toEqual(["demand"]);
    expect(result.missingFactors).toContain("reviews");
  });

  it("treats zero as available data", () => {
    const result = calculateCasaPraticaScore({ demand: 0 });
    expect(result.score).toBe(0);
    expect(result.confidence).toBe(0.25);
    expect(result.factorScores).toEqual({ demand: 0 });
  });

  it("returns an unavailable score when every factor is unknown", () => {
    const result = calculateCasaPraticaScore({});
    expect(result.score).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.availableFactors).toEqual([]);
  });
});
