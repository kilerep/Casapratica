import { z } from "zod";
export const PUBLICATION_STATUSES = ["draft", "awaiting_approval", "approved", "scheduled", "publishing", "published", "failed", "cancelled"] as const;
export const publicationStatusSchema = z.enum(PUBLICATION_STATUSES);
export type PublicationStatus = z.infer<typeof publicationStatusSchema>;
const transitions: Readonly<Record<PublicationStatus, readonly PublicationStatus[]>> = {
  draft: ["awaiting_approval", "cancelled"], awaiting_approval: ["approved", "draft", "cancelled"], approved: ["scheduled", "publishing", "cancelled"],
  scheduled: ["publishing", "cancelled"], publishing: ["published", "failed"], published: [], failed: ["approved", "cancelled"], cancelled: [],
};
export function canTransitionPublication(from: PublicationStatus, to: PublicationStatus): boolean { return from === to || transitions[from].includes(to); }
export function assertPublicationTransition(from: PublicationStatus, to: PublicationStatus): void { if (!canTransitionPublication(from, to)) throw new Error(`Invalid publication status transition: ${from} -> ${to}`); }
