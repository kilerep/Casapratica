import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  CapabilityMap,
  IntegrationRepository,
  OAuthStateRepository,
  ProviderName,
  StoredConnection,
} from "@casapratica/integrations";
import type { EncryptedValue } from "@casapratica/security";

const encrypted = (
  ciphertext: Uint8Array | null,
  iv: Uint8Array | null,
  authTag: Uint8Array | null,
): EncryptedValue | null =>
  ciphertext && iv && authTag
    ? {
        ciphertext: Buffer.from(ciphertext),
        iv: Buffer.from(iv),
        authTag: Buffer.from(authTag),
      }
    : null;
const bytes = (value: Buffer): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(value);

export class PrismaIntegrationRepository implements IntegrationRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async list(workspaceId: string) {
    return Promise.all(
      (
        await this.prisma.integrationAccount.findMany({
          where: { workspaceId },
        })
      ).map((row) => this.map(row)),
    );
  }
  async find(workspaceId: string, provider: ProviderName) {
    const row = await this.prisma.integrationAccount.findFirst({
      where: { workspaceId, provider },
      orderBy: { updatedAt: "desc" },
    });
    return row ? this.map(row) : null;
  }
  async save(connection: Omit<StoredConnection, "id"> | StoredConnection) {
    const current = await this.prisma.integrationAccount.findFirst({
      where: {
        workspaceId: connection.workspaceId,
        provider: connection.provider,
      },
      orderBy: { updatedAt: "desc" },
    });
    const data = {
      status:
        connection.status === "connected"
          ? ("connected" as const)
          : ("disconnected" as const),
      externalAccountId: connection.externalAccountId ?? null,
      accessTokenCiphertext: connection.accessToken
        ? bytes(connection.accessToken.ciphertext)
        : null,
      accessTokenIv: connection.accessToken
        ? bytes(connection.accessToken.iv)
        : null,
      accessTokenAuthTag: connection.accessToken
        ? bytes(connection.accessToken.authTag)
        : null,
      refreshTokenCiphertext: connection.refreshToken
        ? bytes(connection.refreshToken.ciphertext)
        : null,
      refreshTokenIv: connection.refreshToken
        ? bytes(connection.refreshToken.iv)
        : null,
      refreshTokenAuthTag: connection.refreshToken
        ? bytes(connection.refreshToken.authTag)
        : null,
      tokenExpiresAt: connection.expiresAt,
      scopes: [...connection.scopes],
    };
    if (
      current &&
      connection.externalAccountId &&
      current.externalAccountId !== connection.externalAccountId
    )
      await this.disconnect(current.id);
    const row =
      current &&
      (!connection.externalAccountId ||
        current.externalAccountId === connection.externalAccountId)
        ? await this.prisma.integrationAccount.update({
            where: { id: current.id },
            data,
          })
        : await this.prisma.integrationAccount.create({
            data: {
              workspaceId: connection.workspaceId,
              provider: connection.provider,
              ...data,
            },
          });
    return this.map(row);
  }
  async saveCapabilities(accountId: string, capabilities: CapabilityMap) {
    await this.prisma.$transaction(
      Object.entries(capabilities).map(([capability, value]) =>
        this.prisma.integrationCapability.upsert({
          where: {
            integrationAccountId_capability: {
              integrationAccountId: accountId,
              capability,
            },
          },
          create: {
            integrationAccountId: accountId,
            capability,
            status: value.available ? "available" : "unavailable",
            checkedAt: value.lastCheckedAt,
            details: { reason: value.reason },
          },
          update: {
            status: value.available ? "available" : "unavailable",
            checkedAt: value.lastCheckedAt,
            details: { reason: value.reason },
          },
        }),
      ),
    );
  }
  async disconnect(accountId: string) {
    await this.prisma.$transaction([
      this.prisma.integrationCapability.updateMany({
        where: { integrationAccountId: accountId },
        data: { status: "unavailable", details: { reason: "disconnected" } },
      }),
      this.prisma.integrationAccount.update({
        where: { id: accountId },
        data: {
          status: "disconnected",
          accessTokenCiphertext: null,
          accessTokenIv: null,
          accessTokenAuthTag: null,
          refreshTokenCiphertext: null,
          refreshTokenIv: null,
          refreshTokenAuthTag: null,
          tokenExpiresAt: null,
          selectedPageId:null,selectedPageName:null,selectedPageCategory:null,selectedPageTasks:[],selectedPageSelectedAt:null,pageTokenCiphertext:null,pageTokenIv:null,pageTokenAuthTag:null,
        },
      }),
    ]);
  }
  async disconnectByExternalIdentity(provider:ProviderName,externalAccountId:string){const rows=await this.prisma.integrationAccount.findMany({where:{provider,externalAccountId}});for(const row of rows)await this.disconnect(row.id);return rows.length}
  async appendAudit(
    workspaceId: string,
    action: string,
    resourceId: string | null,
    metadata: Readonly<Record<string, unknown>> = {},
  ) {
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        actorType: "system",
        action,
        resourceType: "IntegrationAccount",
        resourceId,
        metadata: JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue,
      },
    });
  }
  private map(row: {
    id: string;
    workspaceId: string;
    provider: string;
    externalAccountId: string | null;
    accessTokenCiphertext: Uint8Array | null;
    accessTokenIv: Uint8Array | null;
    accessTokenAuthTag: Uint8Array | null;
    refreshTokenCiphertext: Uint8Array | null;
    refreshTokenIv: Uint8Array | null;
    refreshTokenAuthTag: Uint8Array | null;
    tokenExpiresAt: Date | null;
    scopes: string[];
    status: string;
  }): StoredConnection {
    const accessToken = encrypted(
      row.accessTokenCiphertext,
      row.accessTokenIv,
      row.accessTokenAuthTag,
    );
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      provider: row.provider as ProviderName,
      externalAccountId: row.externalAccountId,
      accessToken,
      refreshToken: encrypted(
        row.refreshTokenCiphertext,
        row.refreshTokenIv,
        row.refreshTokenAuthTag,
      ),
      expiresAt: row.tokenExpiresAt,
      scopes: row.scopes,
      status: row.status === "connected" ? "connected" : "disconnected",
    };
  }
}

export class PrismaOAuthStateRepository implements OAuthStateRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async save(value: {
    hash: string;
    workspaceId: string;
    provider: ProviderName;
    redirectUri: string;
    verifier: EncryptedValue;
    expiresAt: Date;
  }) {
    await this.prisma.oAuthState.create({
      data: {
        stateHash: value.hash,
        workspaceId: value.workspaceId,
        provider: value.provider,
        redirectUri: value.redirectUri,
        verifierCiphertext: bytes(value.verifier.ciphertext),
        verifierIv: bytes(value.verifier.iv),
        verifierAuthTag: bytes(value.verifier.authTag),
        expiresAt: value.expiresAt,
      },
    });
  }
  async consume(hash: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.oAuthState.findUnique({
        where: { stateHash: hash },
      });
      if (!row || row.consumedAt) return null;
      const claimed = await tx.oAuthState.updateMany({
        where: { id: row.id, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (claimed.count !== 1) return null;
      return {
        workspaceId: row.workspaceId,
        provider: row.provider as ProviderName,
        redirectUri: row.redirectUri,
        verifier: {
          ciphertext: Buffer.from(row.verifierCiphertext),
          iv: Buffer.from(row.verifierIv),
          authTag: Buffer.from(row.verifierAuthTag),
        },
        expiresAt: row.expiresAt,
      };
    });
  }
}
