import { z } from "zod";
export const workerConfigSchema = z.object({ REDIS_URL: z.string().url().default("redis://localhost:6379"),ENABLE_TEST_PUBLISHING_PROVIDER:z.enum(["true","false"]).default("false") });
