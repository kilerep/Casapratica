import { describe, expect, it, vi } from "vitest";
import {
  publicationJobSchema,
  processScheduledPublication,
} from "./publication-job.js";
describe("scheduled publication job", () => {
  it("accepts only identifiers and adds the worker actor", () => {
    expect(
      publicationJobSchema.parse({
        workspaceId: "11111111-1111-4111-8111-111111111111",
        publicationQueueItemId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toMatchObject({ actorId: "scheduled-worker" });
    expect(() =>
      publicationJobSchema.parse({
        workspaceId: "w",
        publicationQueueItemId: "q",
        accessToken: "secret",
      }),
    ).toThrow();
  });
});
describe("scheduled publication processing", () => {
  it("delega ao PublishingService, que revalida approval e capabilities", async () => {
    const publishing = {
      publishNow: vi.fn().mockRejectedValue(new Error("capability_missing")),
    };
    await expect(
      processScheduledPublication(
        {
          workspaceId: "11111111-1111-4111-8111-111111111111",
          publicationQueueItemId: "22222222-2222-4222-8222-222222222222",
        },
        publishing,
      ),
    ).rejects.toThrow("capability_missing");
    expect(publishing.publishNow).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "scheduled-worker",
    );
  });
});
