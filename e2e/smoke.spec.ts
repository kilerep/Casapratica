import { expect, test } from "@playwright/test";
test("home identifies CasaPrática OS", async ({ page }) => { await page.goto("/"); await expect(page.getByText("CASAPRÁTICA OS")).toBeVisible(); });
