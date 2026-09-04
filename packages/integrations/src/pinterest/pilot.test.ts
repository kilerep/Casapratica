import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPinterestProvider,
  PinterestBoardProvider,
  PinterestPinProvider,
} from "./index.js";
const context = {
  redirectUri: "http://localhost:3001/callback",
  state: "opaque",
  codeChallenge: "",
  codeVerifier: "",
};
beforeEach(() =>
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("real_network_forbidden");
    }),
  ),
);
afterEach(() => vi.unstubAllGlobals());
describe("Pinterest pilot transport", () => {
  it("uses Basic auth, comma scopes and real external identity", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        access_token: "secret-access",
        refresh_token: "secret-refresh",
        expires_in: 3600,
        scope: "user_accounts:read,boards:read",
      })
      .mockResolvedValueOnce({ id: "123" });
    const provider = createPinterestProvider("client", "secret", { request });
    expect(
      provider.getAuthorizationUrl(context).searchParams.get("scope"),
    ).toContain(",");
    expect(await provider.handleCallback("code", context)).toMatchObject({
      externalAccountId: "123",
      scopes: ["user_accounts:read", "boards:read"],
    });
    const input = request.mock.calls[0]![0];
    expect(input.headers.Authorization).toBe(
      `Basic ${Buffer.from("client:secret").toString("base64")}`,
    );
    expect(input.body.has("client_secret")).toBe(false);
    expect(input.body.get("continuous_refresh")).toBe("true");
  });
  it("never infers absent grants", async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ access_token: "token", expires_in: 3600 });
    await expect(
      createPinterestProvider("c", "s", { request }).handleCallback(
        "code",
        context,
      ),
    ).rejects.toThrow("account_scope_missing");
  });
  it("rejects missing external identity", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        access_token: "token",
        expires_in: 3600,
        scope: "user_accounts:read",
      })
      .mockResolvedValueOnce({ username: "name" });
    await expect(
      createPinterestProvider("c", "s", { request }).handleCallback(
        "code",
        context,
      ),
    ).rejects.toThrow("external_identity_missing");
  });
  for (const options of [
    {},
    { pilotEnabled: true },
    { realPublishingEnabled: true },
  ])
    it("requires both publishing flags", async () => {
      const provider = createPinterestProvider(
        "c",
        "s",
        { request: vi.fn().mockResolvedValue({ id: "123" }) },
        options,
      );
      expect(
        (await provider.getCapabilities("t", ["pins:write"])).create_pin
          ?.available,
      ).toBe(false);
    });
  it("requires scope even with flags enabled", async () => {
    const provider = createPinterestProvider(
      "c",
      "s",
      { request: vi.fn().mockResolvedValue({ id: "123" }) },
      { pilotEnabled: true, realPublishingEnabled: true },
    );
    expect(
      (await provider.getCapabilities("t", [])).create_pin?.available,
    ).toBe(false);
    expect(
      (await provider.getCapabilities("t", ["pins:write"])).create_pin
        ?.available,
    ).toBe(true);
  });
  it("paginates real boards and rejects repeated bookmark", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: "1", name: "One" }],
        bookmark: "next",
      })
      .mockResolvedValueOnce({ items: [{ id: "2", name: "Two" }] });
    expect(
      await new PinterestBoardProvider(
        { request },
        async () => "t",
      ).listBoards(),
    ).toHaveLength(2);
    expect(request.mock.calls[1]![0].url).toContain("bookmark=next");
    request.mockResolvedValue({ items: [], bookmark: "loop" });
    await expect(
      new PinterestBoardProvider({ request }, async () => "t").listBoards(),
    ).rejects.toThrow("boards_pagination_incomplete");
  });
  it("does not POST when disabled and validates returned pin", async () => {
    const request = vi.fn().mockResolvedValue({ id: "999" }),
      token = vi.fn(async () => "token"),
      input = {
        board_id: "1",
        title: "Title",
        description: "Body",
        link: "https://example.com/product",
        media_source: {
          source_type: "image_url" as const,
          url: "https://example.com/image.png",
        },
      };
    await expect(
      new PinterestPinProvider({ request }, token, () => false).createPin(
        input,
      ),
    ).rejects.toThrow("pinterest_publishing_disabled");
    expect(request).not.toHaveBeenCalled();
    expect(token).not.toHaveBeenCalled();
    expect(
      await new PinterestPinProvider({ request }, token, () => true).createPin(
        input,
      ),
    ).toMatchObject({ externalId: "999" });
    expect(request.mock.calls[0]![0]).toMatchObject({
      method: "POST",
      url: "https://api.pinterest.com/v5/pins",
      body: JSON.stringify(input),
    });
    request.mockResolvedValue({});
    await expect(
      new PinterestPinProvider({ request }, token, () => true).createPin(input),
    ).rejects.toThrow("reconciliation_required");
  });
});
