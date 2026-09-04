export interface CreativePriceConfig { creativePriceFreshnessHours: number }
export const DEFAULT_CREATIVE_PRICE_CONFIG: CreativePriceConfig = { creativePriceFreshnessHours: 24 };
export function isPriceFresh(price: number | null, checkedAt: Date | null, now: Date, config: CreativePriceConfig): boolean { const age = checkedAt === null ? Number.POSITIVE_INFINITY : now.getTime() - checkedAt.getTime(); return price !== null && age >= 0 && age <= config.creativePriceFreshnessHours * 3_600_000; }
