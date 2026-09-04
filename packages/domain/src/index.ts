export * from "./entities.js";
export * from "./initial-categories.js";
export * from "./product.js";
export * from "./publication.js";
export * from "./repositories.js";
export * from "./score.js";
export * from "./content.js";
export * from "./pinterest.js";
export * from "./facebook.js";

export type ExternalFact<T> = { readonly value: T; readonly source: string; readonly observedAt: Date } | undefined;
