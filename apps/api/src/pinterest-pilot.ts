import { createHash } from "node:crypto";
import type {
  IntegrationService,
  PinterestBoardProvider,
  PinterestPinProvider,
  PinterestPinInput,
} from "@casapratica/integrations";
import {
  PublishingService,
  type OperationsRepository,
  type QueueItem,
  type PublishResult,
} from "@casapratica/strategy";

export interface PilotRepository extends OperationsRepository {
  selectPinterestBoard(
    workspaceId: string,
    id: string,
    boardId: string,
    accountId: string,
  ): Promise<void>;
  reservePinterestPublication(
    workspaceId: string,
    item: QueueItem,
    key: string,
  ): Promise<void>;
}
export class PinterestPilotService {
  constructor(
    private readonly repository: PilotRepository,
    private readonly integrations: Pick<IntegrationService, "status">,
    private readonly boards: Pick<PinterestBoardProvider, "listBoards">,
    private readonly pins: Pick<PinterestPinProvider, "createPin">,
    private readonly flags: () => { pilot: boolean; publishing: boolean },
  ) {}
  async listBoards(workspaceId: string) {
    if (!this.flags().pilot) throw new Error("pinterest_pilot_disabled");
    const connection = await this.integrations.status(workspaceId, "pinterest");
    if (
      connection.status !== "connected" ||
      !connection.capabilities?.read_boards?.available
    )
      throw new Error("boards_unavailable");
    return this.boards.listBoards();
  }
  async selectBoard(workspaceId: string, id: string, boardId: string) {
    const boards = await this.listBoards(workspaceId);
    if (!boards.some((b) => b.id === boardId))
      throw new Error("real_board_required");
    const connection = await this.integrations.status(workspaceId, "pinterest");
    if (connection.status !== "connected" || !connection.id)
      throw new Error("integration_disconnected");
    await this.repository.selectPinterestBoard(
      workspaceId,
      id,
      boardId,
      connection.id,
    );
    return { status: "awaiting_approval" };
  }
  dryRun(workspaceId: string, id: string) {
    return this.inspect(workspaceId, id);
  }
  private async inspect(workspaceId: string, id: string, publishing = false) {
    const item = await this.repository.getQueueItem(workspaceId, id);
    if (!item) throw new Error("publication_item_not_found");
    const blockers: string[] = [];
    const flags = this.flags();
    if (!flags.pilot) blockers.push("pinterest_pilot_disabled");
    if (!flags.publishing) blockers.push("pinterest_publishing_disabled");
    if (item.channel !== "pinterest") blockers.push("wrong_channel");
    if (
      item.status !== (publishing ? "publishing" : "approved") ||
      !item.approvedAt ||
      !item.approvedBy
    )
      blockers.push("approval_required");
    if (!item.creativeValid || !item.creativeAssetId)
      blockers.push("creative_invalid");
    if (item.priceDisplayed && !item.priceFresh) blockers.push("price_stale");
    if (
      item.productId &&
      !["approved", "active", "test"].includes(item.productStatus ?? "")
    )
      blockers.push("product_not_approved");
    const connection = await this.integrations.status(workspaceId, "pinterest");
    if (
      connection.status !== "connected" ||
      connection.id !== item.integrationAccountId ||
      !item.integrationConnected
    )
      blockers.push("integration_disconnected");
    if (
      !connection.capabilities?.create_pin?.available ||
      !item.capabilityAvailable
    )
      blockers.push("capability_missing");
    let boardVerified = false;
    if (
      flags.pilot &&
      connection.status === "connected" &&
      connection.capabilities?.read_boards?.available
    ) {
      try {
        boardVerified = (await this.boards.listBoards()).some(
          (board) => board.id === item.destinationId,
        );
      } catch {
        blockers.push("boards_unavailable");
      }
    }
    if (!boardVerified) blockers.push("real_board_required");
    if (
      !publicHttps(item.metadata.creativeUrl) ||
      !["image/png", "image/jpeg"].includes(
        String(item.metadata.creativeMimeType),
      )
    )
      blockers.push("creative_public_image_required");
    if (!publicHttps(item.affiliateUrl))
      blockers.push("destination_url_invalid");
    const title =
      typeof item.metadata.title === "string" ? item.metadata.title : "";
    if (
      !title.trim() ||
      title.length > 100 ||
      !item.body.trim() ||
      item.body.length > 800
    )
      blockers.push("pin_copy_invalid");
    const payload: PinterestPinInput = {
      board_id: item.destinationId ?? "",
      title,
      description: item.body,
      link: item.affiliateUrl ?? "",
      media_source: {
        source_type: "image_url",
        url: String(item.metadata.creativeUrl ?? ""),
      },
    };
    return {
      dryRun: true,
      published: false,
      ready: blockers.length === 0,
      blockers,
      boardVerified,
      payload,
      fingerprint: createHash("sha256")
        .update(
          JSON.stringify({
            id: item.id,
            account: item.integrationAccountId,
            creative: item.creativeAssetId,
            approvedAt: item.approvedAt,
            payload,
          }),
        )
        .digest("hex"),
    };
  }
  async publish(
    workspaceId: string,
    id: string,
    actorId: string,
    fingerprint: string,
  ): Promise<PublishResult> {
    const item = await this.repository.getQueueItem(workspaceId, id);
    if (!item) throw new Error("publication_item_not_found");
    const key = createHash("sha256")
      .update(`${workspaceId}:${id}:${item.contentId}:${item.creativeAssetId}`)
      .digest("hex");
    const existing = await this.repository.findPublicationByKey(
      workspaceId,
      key,
    );
    if (existing?.metadata.provider === "pinterest") return existing;
    const check = await this.dryRun(workspaceId, id);
    if (!check.ready) throw new Error(check.blockers[0] ?? "pilot_blocked");
    if (check.fingerprint !== fingerprint) throw new Error("dry_run_changed");
    await this.repository.reservePinterestPublication(workspaceId, item, key);
    const publishing = new PublishingService(this.repository, {
      pinterest: {
        reconcile: async () => null,
        publish: async () => {
          const latest = await this.inspect(workspaceId, id, true);
          if (!latest.ready || latest.fingerprint !== fingerprint)
            throw new Error("dry_run_changed");
          if (!this.flags().pilot || !this.flags().publishing)
            throw new Error("pinterest_publishing_disabled");
          return this.pins.createPin(check.payload);
        },
      },
    });
    return publishing.publishNow(workspaceId, id, actorId);
  }
}
function publicHttps(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      u.hostname.includes(".") &&
      !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
        u.hostname,
      ) &&
      !u.hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

export async function pinterestReadiness(
  enabled: boolean,
  integrations: Pick<IntegrationService, "status"> | undefined,
  workspaceId: string | undefined,
): Promise<string> {
  if (!enabled) return "pilot_disabled";
  if (!integrations || !workspaceId) return "not_configured";
  try {
    return (await integrations.status(workspaceId, "pinterest")).status;
  } catch {
    return "error";
  }
}
