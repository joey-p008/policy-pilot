export const EMBEDDING_CLIENT = Symbol('EMBEDDING_CLIENT');

export const EMBEDDING_DIMENSIONS = 1536;

export interface EmbeddingClient {
  embedTexts(texts: string[]): Promise<number[][]>;
}
