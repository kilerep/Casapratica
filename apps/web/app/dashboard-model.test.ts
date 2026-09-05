import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { emptyQueueSummary, hasAnalyticsData, integrationMessage } from "./dashboard-model";

describe("dashboard presentation", () => {
  it("keeps queue summary explicit", () => expect(emptyQueueSummary()).toEqual({ awaiting_approval: 0, approved: 0, scheduled: 0, failed: 0 }));
  it("shows analytics unavailable instead of invented metrics", () => expect(hasAnalyticsData({ dataCoverage: 0, message: "Dados insuficientes" })).toBe(false));
  it("uses a clear Pinterest empty state", () => expect(integrationMessage("pinterest", "disconnected")).toBe("Pinterest ainda não conectado"));
  it("includes a mobile dashboard layout", () => {
    const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    expect(css).toContain("@media (max-width:760px)");
    expect(css).toContain(".dashboard-columns { grid-template-columns:1fr");
  });
});
