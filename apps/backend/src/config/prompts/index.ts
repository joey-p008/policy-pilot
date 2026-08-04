import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type PromptKey = 'system-policy' | 'rag-synthesis';

export interface PromptManifestEntry {
  readonly version: string;
  readonly fileName: string;
}

export const PROMPT_MANIFEST = {
  'system-policy': {
    version: '1.0.0',
    fileName: 'system-policy-v1.0.0.txt',
  },
  'rag-synthesis': {
    version: '1.0.0',
    fileName: 'rag-synthesis-v1.0.0.txt',
  },
} as const satisfies Record<PromptKey, PromptManifestEntry>;

export const ACTIVE_PROMPT_VERSIONS: Readonly<Record<PromptKey, string>> = {
  'system-policy': PROMPT_MANIFEST['system-policy'].version,
  'rag-synthesis': PROMPT_MANIFEST['rag-synthesis'].version,
};

export interface PromptMetadata {
  readonly key: PromptKey;
  readonly version: string;
  readonly fileName: string;
}

function isPromptKey(key: string): key is PromptKey {
  return Object.prototype.hasOwnProperty.call(PROMPT_MANIFEST, key);
}

export function getPromptMetadata(key: PromptKey): PromptMetadata {
  if (!isPromptKey(key)) {
    throw new Error(`Unknown prompt key: ${key}`);
  }

  const entry = PROMPT_MANIFEST[key];
  return {
    key,
    version: entry.version,
    fileName: entry.fileName,
  };
}

export function loadPrompt(key: PromptKey): { metadata: PromptMetadata; content: string } {
  const metadata = getPromptMetadata(key);
  const filePath = join(__dirname, metadata.fileName);

  if (!existsSync(filePath)) {
    throw new Error(`Prompt file not found for key "${key}": ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf8');
  return { metadata, content };
}

export function listActivePromptVersions(): ReadonlyArray<{ key: PromptKey; version: string }> {
  return (Object.keys(ACTIVE_PROMPT_VERSIONS) as PromptKey[]).map((key) => ({
    key,
    version: ACTIVE_PROMPT_VERSIONS[key],
  }));
}
