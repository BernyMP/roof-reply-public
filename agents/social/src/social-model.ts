// Approved standard-tier Gateway tariffs, USD per million tokens.
// The provider is pinned to OpenAI; a tariff increase stops generation.
export const EDITORIAL_MODEL = {
  id: "openai/gpt-5.4",
  inputUsdPerMillion: 2.5,
  outputUsdPerMillion: 15,
  contextTokens: 128000,
  outputTokens: 8192,
  reserveUsd: 0.45,
} as const;
export const RESEARCH_MODEL = {
  id: "openai/gpt-4o-mini",
  inputUsdPerMillion: 0.15,
  outputUsdPerMillion: 0.6,
  contextTokens: 128000,
  outputTokens: 2400,
  reserveUsd: 0.035,
} as const;
export function socialModelPolicy(model: string = RESEARCH_MODEL.id) {
  if (model === EDITORIAL_MODEL.id) return EDITORIAL_MODEL;
  if (model === RESEARCH_MODEL.id) return RESEARCH_MODEL;
  throw new Error("Unapproved social model.");
}
