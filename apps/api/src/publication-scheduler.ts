import { createHash } from "node:crypto";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type {
  PublicationScheduler,
  SchedulerResult,
} from "@casapratica/strategy";

export const publicationJobId = (
  workspaceId: string,
  publicationQueueItemId: string,
) =>
  `publication-${createHash("sha256").update(`${workspaceId}:${publicationQueueItemId}`).digest("hex")}`;

export class BullMqPublicationScheduler implements PublicationScheduler {
  private readonly connection: Redis;
  private readonly queue: Queue;
  constructor(redisUrl: string) {
    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    this.queue = new Queue("casapratica", { connection: this.connection });
  }
  async schedule(input: {
    workspaceId: string;
    publicationQueueItemId: string;
    scheduledFor: Date;
  }): Promise<SchedulerResult> {
    const jobId = publicationJobId(
      input.workspaceId,
      input.publicationQueueItemId,
    );
    try {
      if (await this.queue.getJob(jobId))
        return {
          status: "already_enqueued",
          jobId,
          scheduledFor: input.scheduledFor,
        };
      await this.queue.add(
        "publish-scheduled",
        {
          workspaceId: input.workspaceId,
          publicationQueueItemId: input.publicationQueueItemId,
        },
        {
          jobId,
          delay: Math.max(0, input.scheduledFor.getTime() - Date.now()),
          removeOnComplete: 100,
          removeOnFail: false,
        },
      );
      return { status: "enqueued", jobId, scheduledFor: input.scheduledFor };
    } catch {
      return {
        status: "scheduler_unavailable",
        jobId: null,
        scheduledFor: input.scheduledFor,
      };
    }
  }
  async close() {
    await this.queue.close();
    await this.connection.quit();
  }
}
