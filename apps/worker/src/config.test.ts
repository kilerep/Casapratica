import { expect, it } from "vitest";
import { workerConfigSchema } from "./config.js";
it("uses a local Redis default", () => { expect(workerConfigSchema.parse({}).REDIS_URL).toBe("redis://localhost:6379"); });
