import { expect, it } from "vitest";
import type { ExternalFact } from "./index.js";
it("allows external facts to remain absent", () => { const fact: ExternalFact<number> = undefined; expect(fact).toBeUndefined(); });
