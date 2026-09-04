import { Worker } from "bullmq";
import { Redis } from "ioredis";
import pino from "pino";
import { canUseTestPublishingProvider } from "@casapratica/config";
import { workerConfigSchema } from "./config.js";
import {
  createPrismaClient,
  PrismaOperationsRepository,
} from "@casapratica/database";
import { PublishingService,TestPublishingProvider } from "@casapratica/strategy";
import { processScheduledPublication } from "./publication-job.js";

const logger = pino({
  name: "casapratica-worker",
  redact: ["password", "token", "accessToken", "refreshToken", "authorization"],
});
const config = workerConfigSchema.parse(process.env);
const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const prisma = createPrismaClient(),
  publishing = new PublishingService(
    new PrismaOperationsRepository(prisma),
    canUseTestPublishingProvider(process.env)?{pinterest:new TestPublishingProvider(),facebook:new TestPublishingProvider()}:{},
  );
const worker = new Worker(
  "casapratica",
  async (job) => {
    logger.info({ operationId:job.id, jobName: job.name,publicationQueueItemId:typeof job.data?.publicationQueueItemId==="string"?job.data.publicationQueueItemId:null,workspaceId:typeof job.data?.workspaceId==="string"?job.data.workspaceId:null }, "Processing job");
    if (job.name !== "publish-scheduled") return;
    await processScheduledPublication(job.data, publishing);
  },
  { connection },
);
worker.on("failed", (job, error) =>
  logger.error({ err: error, jobId: job?.id }, "Job failed"),
);

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  await worker.close();
  await connection.quit();
  await prisma.$disconnect();
}
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void shutdown(signal).catch((error: unknown) => {
      logger.error({ err: error }, "Shutdown failed");
      process.exitCode = 1;
    });
  });
logger.info("Worker started");
