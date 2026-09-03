import { z } from "zod";

export const SCORE_WEIGHTS = { demand: 25, reviews: 25, sellerReputation: 15, priceCompetitiveness: 15, listingQuality: 10, commission: 5, seasonality: 5 } as const;
export type ScoreFactor = keyof typeof SCORE_WEIGHTS;
export const scoreInputSchema = z.object({
  demand: z.number().min(0).max(100).nullish(), reviews: z.number().min(0).max(100).nullish(), sellerReputation: z.number().min(0).max(100).nullish(),
  priceCompetitiveness: z.number().min(0).max(100).nullish(), listingQuality: z.number().min(0).max(100).nullish(), commission: z.number().min(0).max(100).nullish(), seasonality: z.number().min(0).max(100).nullish(),
});
export type ScoreInput = z.input<typeof scoreInputSchema>;
export interface ScoreResult { readonly score: number | null; readonly confidence: number; readonly availableFactors: readonly ScoreFactor[]; readonly missingFactors: readonly ScoreFactor[]; readonly factorScores: Readonly<Partial<Record<ScoreFactor, number>>>; readonly explanation: string }
const round = (value: number, places = 2) => Number(value.toFixed(places));

export function calculateCasaPraticaScore(input: ScoreInput): ScoreResult {
  const parsed = scoreInputSchema.parse(input);
  const factors = Object.keys(SCORE_WEIGHTS) as ScoreFactor[];
  const availableFactors = factors.filter((factor) => parsed[factor] !== null && parsed[factor] !== undefined);
  const missingFactors = factors.filter((factor) => parsed[factor] === null || parsed[factor] === undefined);
  const availableWeight = availableFactors.reduce((total, factor) => total + SCORE_WEIGHTS[factor], 0);
  const weightedTotal = availableFactors.reduce((total, factor) => total + (parsed[factor] ?? 0) * SCORE_WEIGHTS[factor], 0);
  const factorScores = Object.fromEntries(availableFactors.map((factor) => [factor, parsed[factor]])) as Partial<Record<ScoreFactor, number>>;
  const score = availableWeight === 0 ? null : round(weightedTotal / availableWeight);
  const confidence = round(availableWeight / 100, 4);
  const explanation = availableWeight === 0
    ? "Score indisponível: nenhum fator foi informado."
    : `Score normalizado sobre ${availableFactors.length} fator(es); ${missingFactors.length} fator(es) ausente(s) não foram tratados como zero.`;
  return { score, confidence, availableFactors, missingFactors, factorScores, explanation };
}
