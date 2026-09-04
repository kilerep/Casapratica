import { describe, expect, it } from "vitest";
import { Prisma, PrismaClient, ProductStatus } from "@prisma/client";

describe("generated Prisma Client", () => {
  it("exports the generated client, Prisma namespace and schema enums", () => {
    expect(typeof PrismaClient).toBe("function");
    expect(Prisma.prismaVersion.client).toBe("6.19.3");
    expect(ProductStatus.under_review).toBe("under_review");
  });
});
