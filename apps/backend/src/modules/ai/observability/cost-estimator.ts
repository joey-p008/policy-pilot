export interface ModelPricing {
  readonly inputPerMillionTokensUsd: number;
  readonly outputPerMillionTokensUsd: number;
}

const MODEL_PRICING: Readonly<Record<string, ModelPricing>> = {
  'gpt-4o-mini': {
    inputPerMillionTokensUsd: 0.15,
    outputPerMillionTokensUsd: 0.6,
  },
  'gpt-4o': {
    inputPerMillionTokensUsd: 2.5,
    outputPerMillionTokensUsd: 10,
  },
};

const DEFAULT_PRICING: ModelPricing = MODEL_PRICING['gpt-4o-mini'];

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillionTokensUsd;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillionTokensUsd;
  return Number((inputCost + outputCost).toFixed(8));
}
