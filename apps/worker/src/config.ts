import { z } from "zod";
export const workerConfigSchema = z.object({ REDIS_URL: z.string().url().default("redis://localhost:6379") });
