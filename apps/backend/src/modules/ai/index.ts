export {
  ACTIVE_PROMPT_VERSIONS,
  PROMPT_MANIFEST,
  getPromptMetadata,
  listActivePromptVersions,
  loadPrompt,
  type PromptKey,
  type PromptManifestEntry,
  type PromptMetadata,
} from '../../config/prompts';

export { AiModule } from './ai.module';
export {
  DEFAULT_SECTION_TITLE,
  DOCUMENT_CHUNK_OVERLAP,
  DOCUMENT_CHUNK_SIZE,
  DocumentChunker,
} from './document-chunker';
export { DocumentIngestionService } from './document-ingestion.service';
export {
  ChunkDocumentInputSchema,
  IngestPoliciesResultSchema,
  PolicyDocumentChunkSchema,
  type ChunkDocumentInput,
  type IngestPoliciesResult,
  type PolicyDocumentChunk,
} from './dto/document-ingestion.dto';
export { CHAT_CLIENT, type ChatClient } from './chat/chat.types';
export { OpenAiChatClient } from './chat/openai-chat.client';
export { DecisionEngineService, type DecisionEngineInput } from './decision-engine.service';
export {
  EMBEDDING_CLIENT,
  EMBEDDING_DIMENSIONS,
  type EmbeddingClient,
} from './embedding/embedding.types';
export { OpenAiEmbeddingClient } from './embedding/openai-embedding.client';
export {
  ACCESS_DECISION_PROMPT_KEY,
  loadAccessDecisionSystemPrompt,
} from './prompts/access-decision.prompt';
export { RETRIEVAL_TOP_K, RetrievalService } from './retrieval.service';

export {
  DecisionSchema,
  PolicyCitationSchema,
  RecommendationDecisionSchema,
  RecommendationSchema,
  type Decision,
  type PolicyCitation,
  type Recommendation,
  type RecommendationDecision,
} from './schemas/recommendation.schema';

export { estimateCostUsd } from './observability/cost-estimator';
export {
  ConsoleLlmObservabilityLogger,
  defaultLlmObservabilityLogger,
  type LlmObservabilityLogger,
} from './observability/llm-observability.logger';
export { executeWithObservability } from './observability/llm-observability.wrapper';
export type {
  LlmExecutionResult,
  LlmObservation,
  LlmObservabilityRequest,
  LlmObservabilityResult,
} from './observability/llm-observability.types';
