import { describe, expect, it } from "vitest";
import { publicationJobId } from "./publication-scheduler.js";

describe("publication scheduler", () => {
  it("gera jobId determinístico por workspace e item", () => {
    const first = publicationJobId("w1", "q1");
    expect(publicationJobId("w1", "q1")).toBe(first);
    expect(publicationJobId("w1", "q2")).not.toBe(first);
  });
});
