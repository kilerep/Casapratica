import { describe, expect, it, vi } from "vitest";
import { ProductDiscoveryRoutingService } from "./product-discovery-routing.js";
const service = (result: unknown) => ({
  run: vi.fn().mockResolvedValue(result),
  latest: vi.fn(),
  opportunities: vi.fn(),
});
describe("ProductDiscoveryRoutingService", () => {
  it("usa web sem OAuth e no fallback auto", async () => {
    const web = service({ run: { provider: "public_web" } }),
      official = service({ connected: false });
    const router = new ProductDiscoveryRoutingService(web, official);
    await router.run("w", "auto");
    expect(official.run).toHaveBeenCalled();
    expect(web.run).toHaveBeenCalled();
  });
  it("respeita seleção official e não faz fallback", async () => {
    const web = service({}),
      official = service({ connected: false });
    await new ProductDiscoveryRoutingService(web, official).run(
      "w",
      "official",
    );
    expect(web.run).not.toHaveBeenCalled();
  });
});
