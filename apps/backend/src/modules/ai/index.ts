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
  PolicyDocumentChunkSchema,
  type ChunkDocumentInput,
  type PolicyDocumentChunk,
} from './dto/document-ingestion.dto';

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
