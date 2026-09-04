import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
describe("GET /health", () => {
  it(
    "reports service health",
    async () => {
      const app = buildApp();
      apps.push(app);
      const response = await app.inject({ method: "GET", url: "/health" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
    },
    15_000,
  );
  it("generates product and utility content through the service", async () => {
    const content = {
      generateProduct: vi.fn().mockResolvedValue({ id: "c1", status: "draft" }),
      generateUtility: vi.fn().mockResolvedValue({ id: "c2", status: "draft" }),
    };
    const app = buildApp({ content, workspaceId: "w1" });
    apps.push(app);
    const product = await app.inject({
      method: "POST",
      url: "/api/products/p1/content",
      payload: {
        platforms: ["pinterest", "facebook"],
        variants: 2,
        angles: ["organization"],
      },
    });
    const utility = await app.inject({
      method: "POST",
      url: "/api/content/utility",
      payload: { platform: "facebook", topic: "organização da casa" },
    });
    expect(product.statusCode).toBe(200);
    expect(utility.statusCode).toBe(200);
    expect(content.generateProduct).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "p1", variants: 2 }),
    );
  });
  it("exposes Pinterest strategy, daily plan, prepare and board recommendation endpoints", async () => {
    const pinterest = {
      createWeeklyStrategy: vi
        .fn()
        .mockResolvedValue({ suggestedDailyVolume: 3 }),
      createDailyPlan: vi.fn().mockResolvedValue({ suggestedPins: [] }),
      preparePin: vi.fn().mockResolvedValue({ status: "approval_required" }),
      getStrategy: vi.fn().mockResolvedValue({ active: true }),
      recommendBoard: vi
        .fn()
        .mockReturnValue({ boardSuggestion: "Cozinha Prática" }),
    };
    const app = buildApp({ pinterest, workspaceId: "w1" });
    apps.push(app);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/pinterest/strategy/weekly",
          payload: { start: "2026-09-07" },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/pinterest/plan/daily",
          payload: { date: "2026-09-07", requestedPins: 10 },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/products/c1/pinterest/prepare",
        })
      ).json(),
    ).toEqual({ status: "approval_required" });
    expect(
      (await app.inject({ method: "GET", url: "/api/pinterest/strategy" }))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/pinterest/boards/recommendations?category=Cozinha",
        })
      ).json(),
    ).toEqual({ boardSuggestion: "Cozinha Prática" });
  });
  it("exposes Facebook strategy, planning, preparation, reuse and history endpoints", async () => {
    const facebook = {
      createWeeklyStrategy: vi
        .fn()
        .mockResolvedValue({ suggestedDailyVolume: 3 }),
      createDailyPlan: vi.fn().mockResolvedValue({ suggestedPosts: [] }),
      preparePost: vi
        .fn()
        .mockResolvedValue({
          status: "approval_required",
          commentAction: "MANUAL_REQUIRED",
        }),
      evaluateStoredReuse: vi.fn().mockResolvedValue({ reuseAllowed: true }),
      getStrategy: vi.fn().mockResolvedValue({ active: true }),
      getContentHistory: vi.fn().mockResolvedValue([]),
    };
    const app = buildApp({ facebook, workspaceId: "w1" });
    apps.push(app);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/facebook/strategy/weekly",
          payload: { start: "2026-09-07" },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/facebook/plan/daily",
          payload: { date: "2026-09-07", requestedPosts: 4 },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/products/p1/facebook/prepare",
        })
      ).json(),
    ).toMatchObject({
      status: "approval_required",
      commentAction: "MANUAL_REQUIRED",
    });
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/facebook/reuse/evaluate",
          payload: { productId: "p1", proposedAngle: "practicality" },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: "GET", url: "/api/facebook/strategy" }))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({ method: "GET", url: "/api/facebook/history" })
      ).json(),
    ).toEqual([]);
  });
  it("exposes and validates Creative Studio analyze, preview, render, variants and list endpoints", async () => {
    const creative = {
      request: vi.fn().mockResolvedValue({ id: "request" }),
      analyze: vi.fn().mockReturnValue([]),
      preview: vi.fn().mockResolvedValue({ status: "READY" }),
      render: vi.fn().mockResolvedValue({ status: "READY" }),
      variants: vi.fn().mockReturnValue([]),
      getProductCreatives: vi.fn().mockResolvedValue([]),
    };
    const app = buildApp({ creative, workspaceId: "w1" });
    apps.push(app);
    const payload = {
      platform: "pinterest",
      contentId: "c1",
      format: "PINTEREST_2_3",
      template: "PHOTO_FIRST",
      variantCount: 1,
    };
    for (const path of [
      "images/analyze",
      "creative/preview",
      "creative/render",
      "creative/variants",
    ])
      expect(
        (
          await app.inject({
            method: "POST",
            url: `/api/products/p1/${path}`,
            payload,
          })
        ).statusCode,
      ).toBe(200);
    expect(creative.request).toHaveBeenCalledTimes(4);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/products/p1/creative/render",
          payload: { ...payload, variantCount: 4 },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({ method: "GET", url: "/api/products/p1/creatives" })
      ).json(),
    ).toEqual([]);
  });
  it("exposes daily operations, approval queue and protected publishing endpoints", async () => {
    const operations = {
      run: vi.fn().mockResolvedValue({ approvalsRequired: true }),
      listQueue: vi.fn().mockResolvedValue([]),
      approve: vi.fn().mockResolvedValue({ status: "approved" }),
      reject: vi.fn(),
      approveBatch: vi.fn(),
      schedule: vi.fn(),
      publishNow: vi
        .fn()
        .mockRejectedValue(new Error("blocked_by_integration")),
      cancel: vi.fn(),
      retry: vi.fn(),
      status: vi.fn().mockResolvedValue({ id: "q1" }),
      alerts: vi.fn().mockResolvedValue([]),
    };
    const app = buildApp({ operations, workspaceId: "w1" });
    apps.push(app);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/operations/daily/run",
          payload: {},
        })
      ).json(),
    ).toMatchObject({ approvalsRequired: true });
    expect(
      (
        await app.inject({ method: "GET", url: "/api/publications/queue" })
      ).json(),
    ).toEqual([]);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/publications/q1/approve",
          payload: { actorId: "u1" },
        })
      ).json(),
    ).toMatchObject({ status: "approved" });
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/publications/q1/publish-now",
          payload: { actorId: "u1" },
        })
      ).json(),
    ).toEqual({ error: "blocked_by_integration" });
  });
});
