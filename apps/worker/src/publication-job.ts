import { z } from "zod";
export const publicationJobSchema = z
  .object({
    workspaceId: z.string().uuid(),
    publicationQueueItemId: z.string().uuid(),
    actorId: z.string().default("scheduled-worker"),
  })
  .strict();
export interface ScheduledPublishingService {
  publishNow(
    workspaceId: string,
    publicationQueueItemId: string,
    actorId: string,
  ): Promise<unknown>;
}
export async function processScheduledPublication(
  value: unknown,
  publishing: ScheduledPublishingService,
) {
  const data = publicationJobSchema.parse(value);
  return publishing.publishNow(
    data.workspaceId,
    data.publicationQueueItemId,
    data.actorId,
  );
}
