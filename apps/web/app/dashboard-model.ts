export type QueueSummary = Record<"awaiting_approval" | "approved" | "scheduled" | "failed", number>;

export const emptyQueueSummary = (): QueueSummary => ({ awaiting_approval: 0, approved: 0, scheduled: 0, failed: 0 });

export function integrationMessage(provider: string, status: string) {
  if (provider === "pinterest" && ["disconnected", "not_configured", "pilot_disabled"].includes(status)) return "Pinterest ainda não conectado";
  if (status === "connected") return "Conectado";
  if (status === "token_expired") return "Conexão expirada";
  if (status === "error") return "Atenção necessária";
  return "Ainda não conectado";
}

export function hasAnalyticsData(value: unknown): value is { dataCoverage: number; topProducts: unknown[]; promisingProducts: unknown[]; weakProducts: unknown[]; message?: string | null } {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return data.message !== "Dados insuficientes" && typeof data.dataCoverage === "number" && data.dataCoverage > 0;
}
