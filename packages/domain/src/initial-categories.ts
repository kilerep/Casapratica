export const INITIAL_CATEGORIES = [
  "Organização",
  "Cozinha",
  "Banheiro",
  "Quarto",
  "Sala",
  "Lavanderia",
  "Limpeza",
  "Casa pequena",
  "Decoração",
  "Utilidades",
] as const;

export type InitialCategory = (typeof INITIAL_CATEGORIES)[number];
