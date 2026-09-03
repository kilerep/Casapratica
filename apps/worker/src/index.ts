import { Worker } from "bullmq";
import { Redis } from "ioredis";
import pino from "pino";
import { workerConfigSchema } from "./config.js";

const logger = pino({ name: "casapratica-worker", redact: ["password", "token", "accessToken", "refreshToken", "authorization"] });
const config = workerConfigSchema.parse(process.env);
const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const worker = new Worker("casapratica", async (job) => { logger.info({ jobId: job.id, jobName: job.name }, "Processing job"); }, { connection });
worker.on("failed", (job, error) => logger.error({ err: error, jobId: job?.id }, "Job failed"));

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  await worker.close();
  await connection.quit();
}
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => {
  void shutdown(signal).catch((error: unknown) => { logger.error({ err: error }, "Shutdown failed"); process.exitCode = 1; });
});
logger.info("Worker started");
