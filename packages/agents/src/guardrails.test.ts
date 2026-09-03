import { describe, expect, it } from "vitest";
import { validateInput, validateOutput } from "./guardrails.js";
describe("AI guardrails", () => {
  it("blocks credentials", () => { expect(validateInput("senha=minha-senha").code).toBe("credentials_detected"); });
  it("requires approval for publication", () => { expect(validateInput("publique este pin").approvalsRequired[0]?.action).toBe("publication"); });
  it("blocks unsupported commercial claims", () => { expect(validateOutput("Este é o menor preço garantido").code).toBe("unsupported_commercial_claim"); });
  it("accepts transparent, qualified language", () => { expect(validateOutput("Preço não informado; confirme no marketplace.").allowed).toBe(true); });
});
