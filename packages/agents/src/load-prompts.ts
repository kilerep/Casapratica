import { readFile } from "node:fs/promises";
import type { AgentPrompts } from "./agent-system.js";

async function read(name: string): Promise<string> { return readFile(new URL(`../prompts/${name}`, import.meta.url), "utf8"); }
export async function loadAgentPrompts(): Promise<AgentPrompts> {
  const [manager, productResearch, productAnalyst, pinterestStrategist, facebookStrategist, content, creativeDirector, performanceAnalyst, growthStrategist] = await Promise.all([
    read("manager.md"), read("product-research.md"), read("product-analyst.md"), read("pinterest-strategist.md"), read("facebook-strategist.md"), read("content.md"), read("creative-director.md"), read("performance-analyst.md"), read("growth-strategist.md"),
  ]);
  return { manager, productResearch, productAnalyst, pinterestStrategist, facebookStrategist, content, creativeDirector, performanceAnalyst, growthStrategist };
}
