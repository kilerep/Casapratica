export interface CreativePriceConfig { creativePriceFreshnessHours: number }
export const DEFAULT_CREATIVE_PRICE_CONFIG: CreativePriceConfig = { creativePriceFreshnessHours: 24 };
export function isPriceFresh(price: number | null, checkedAt: Date | null, now: Date, config: CreativePriceConfig): boolean { return price !== null && checkedAt !== null && now.getTime() - checkedAt.getTime() <= config.creativePriceFreshnessHours * 3_600_000; }
