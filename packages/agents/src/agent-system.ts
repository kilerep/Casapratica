import { Agent, Runner, tool } from "@openai/agents";
import { z } from "zod";
import type { ToolRegistry } from "./tool-registry.js";

export const managerOutputSchema = z.object({
  message: z.string(),
  actions: z.array(z.object({ type: z.string(), status: z.enum(["completed", "failed", "proposed"]), description: z.string() })),
  approvalsRequired: z.array(z.object({ action: z.string(), reason: z.string() })),
  references: z.array(z.object({ type: z.string(), id: z.string(), label: z.string().nullable() })),
});
export type ManagerOutput = z.infer<typeof managerOutputSchema>;

export interface AgentPrompts {
  readonly manager: string; readonly productResearch: string; readonly productAnalyst: string; readonly pinterestStrategist: string;
  readonly facebookStrategist: string; readonly content: string; readonly creativeDirector: string; readonly performanceAnalyst: string; readonly growthStrategist: string;
}

export function createCasaPraticaAgentSystem(prompts: AgentPrompts, registry: ToolRegistry) {
  const operationalTools = registry.list().map((registered) => tool({
    name: registered.name, description: registered.description, parameters: registered.parameters,
    execute: async (input) => registry.execute(registered.name, input, "SpecialistAgent"),
  }));
  const specialist = (name: string, instructions: string) => new Agent({ name, instructions, tools: operationalTools });
  const specialists = {
    ProductResearchAgent: specialist("ProductResearchAgent", prompts.productResearch),
    ProductAnalystAgent: specialist("ProductAnalystAgent", prompts.productAnalyst),
    PinterestStrategistAgent: specialist("PinterestStrategistAgent", prompts.pinterestStrategist),
    FacebookStrategistAgent: specialist("FacebookStrategistAgent", prompts.facebookStrategist),
    ContentAgent: specialist("ContentAgent", prompts.content),
    CreativeDirectorAgent: specialist("CreativeDirectorAgent", prompts.creativeDirector),
    PerformanceAnalystAgent: specialist("PerformanceAnalystAgent", prompts.performanceAnalyst),
    GrowthStrategistAgent: specialist("GrowthStrategistAgent", prompts.growthStrategist),
  };
  const specialistTools = Object.values(specialists).map((agent) => agent.asTool({ toolName: agent.name.replace(/Agent$/, "").replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase(), toolDescription: `Use ${agent.name} for this specialist task.` }));
  const manager = new Agent({ name: "CasaPraticaManagerAgent", instructions: prompts.manager, tools: specialistTools, outputType: managerOutputSchema });
  return { manager, specialists };
}

export interface ManagerRunner { run(message: string, history: readonly { role: "user" | "assistant"; content: string }[]): Promise<{ output: ManagerOutput; usage: { inputTokens?: number; outputTokens?: number } | null }> }
export class OpenAIManagerRunner implements ManagerRunner {
  readonly #runner = new Runner({ workflowName: "CasaPraticaManagerAgent", traceIncludeSensitiveData: false });
  constructor(private readonly manager: ReturnType<typeof createCasaPraticaAgentSystem>["manager"]) {}
  async run(message: string, history: readonly { role: "user" | "assistant"; content: string }[]) {
    const context = history.map((item) => `${item.role}: ${item.content}`).join("\n");
    const result = await this.#runner.run(this.manager, `${context}${context ? "\n" : ""}user: ${message}`, { maxTurns: 8 });
    return { output: managerOutputSchema.parse(result.finalOutput), usage: { inputTokens: result.state.usage.inputTokens, outputTokens: result.state.usage.outputTokens } };
  }
}
