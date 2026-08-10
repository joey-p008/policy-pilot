import { loadPrompt, type PromptKey } from '../../../config/prompts';

export const ACCESS_DECISION_PROMPT_KEY: PromptKey = 'system-policy';

export function loadAccessDecisionSystemPrompt(): ReturnType<typeof loadPrompt> {
  return loadPrompt(ACCESS_DECISION_PROMPT_KEY);
}
