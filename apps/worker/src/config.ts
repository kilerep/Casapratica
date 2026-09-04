import { z } from "zod";
export const workerConfigSchema = z.object({ REDIS_URL: z.string().url().default("redis://localhost:6379"),NODE_ENV:z.enum(["development","test","production"]).default("development"),INTEGRATION_MODE:z.enum(["TEST","SANDBOX","PRODUCTION"]).default("TEST"),ENABLE_TEST_PUBLISHING_PROVIDER:z.enum(["true","false"]).default("false") });
