export type DiscoveryChoice = "auto" | "official" | "public_web";
type Service = {
  run(workspaceId: string): Promise<unknown>;
  latest(workspaceId: string): Promise<unknown>;
  opportunities(workspaceId: string): Promise<unknown>;
};
export class ProductDiscoveryRoutingService {
  constructor(
    private readonly publicWeb: Service,
    private readonly official: Service | null,
  ) {}
  async run(workspaceId: string, source: DiscoveryChoice = "auto") {
    if (source === "public_web" || !this.official)
      return this.publicWeb.run(workspaceId);
    const result = await this.official.run(workspaceId);
    return source === "auto" &&
      (result as { connected?: boolean }).connected === false
      ? this.publicWeb.run(workspaceId)
      : result;
  }
  latest(workspaceId: string) {
    return this.publicWeb.latest(workspaceId);
  }
  opportunities(workspaceId: string) {
    return this.publicWeb.opportunities(workspaceId);
  }
}
