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
export {
  EMBEDDING_CLIENT,
  EMBEDDING_DIMENSIONS,
  type EmbeddingClient,
} from './embedding/embedding.types';
export { OpenAiEmbeddingClient } from './embedding/openai-embedding.client';

export {
  PolicyCitationSchema,
  RecommendationDecisionSchema,
  RecommendationSchema,
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
