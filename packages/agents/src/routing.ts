export const SPECIALIST_NAMES = ["ProductResearchAgent", "ProductAnalystAgent", "PinterestStrategistAgent", "FacebookStrategistAgent", "ContentAgent", "CreativeDirectorAgent", "PerformanceAnalystAgent", "GrowthStrategistAgent"] as const;
export type SpecialistName = (typeof SPECIALIST_NAMES)[number];
export function routeCommand(message: string): SpecialistName {
  const text = message.toLocaleLowerCase("pt-BR");
  if (/pinterest|pin\b/.test(text)) return "PinterestStrategistAgent";
  if (/facebook|meta\b/.test(text)) return "FacebookStrategistAgent";
  if (/criativ|imagem|visual/.test(text)) return "CreativeDirectorAgent";
  if (/conte[uú]do|texto|legenda|copy/.test(text)) return "ContentAgent";
  if (/m[eé]trica|performance|clique|convers[aã]o/.test(text)) return "PerformanceAnalystAgent";
  if (/crescimento|estrat[eé]gia|experimento/.test(text)) return "GrowthStrategistAgent";
  if (/compar|analis|score|avali/.test(text)) return "ProductAnalystAgent";
  return "ProductResearchAgent";
}
