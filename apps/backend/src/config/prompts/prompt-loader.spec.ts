import {
  ACTIVE_PROMPT_VERSIONS,
  PROMPT_MANIFEST,
  getPromptMetadata,
  listActivePromptVersions,
  loadPrompt,
  type PromptKey,
} from './index';

describe('prompt loader', () => {
  it('resolves active semantic versions from the manifest', () => {
    expect(ACTIVE_PROMPT_VERSIONS['system-policy']).toBe('1.5.0');
    expect(ACTIVE_PROMPT_VERSIONS['rag-synthesis']).toBe('1.0.0');
    expect(ACTIVE_PROMPT_VERSIONS['eval-grounding-judge']).toBe('1.1.0');
    expect(PROMPT_MANIFEST['system-policy'].fileName).toBe('system-policy-v1.5.0.txt');
    expect(PROMPT_MANIFEST['rag-synthesis'].fileName).toBe('rag-synthesis-v1.0.0.txt');
    expect(PROMPT_MANIFEST['eval-grounding-judge'].fileName).toBe(
      'eval-grounding-judge-v1.1.0.txt',
    );
  });

  it('loads prompt metadata and disk content for known keys', () => {
    const keys: PromptKey[] = ['system-policy', 'rag-synthesis', 'eval-grounding-judge'];

    for (const key of keys) {
      const metadata = getPromptMetadata(key);
      const loaded = loadPrompt(key);

      expect(metadata.key).toBe(key);
      expect(metadata.version).toBe(ACTIVE_PROMPT_VERSIONS[key]);
      expect(loaded.metadata).toEqual(metadata);
      expect(loaded.content.length).toBeGreaterThan(0);
      expect(loaded.content).toContain('ESCALATE');
    }
  });

  it('lists active prompt versions for eval harness consumption', () => {
    expect(listActivePromptVersions()).toEqual([
      { key: 'system-policy', version: '1.5.0' },
      { key: 'rag-synthesis', version: '1.0.0' },
      { key: 'eval-grounding-judge', version: '1.1.0' },
    ]);
  });

  it('throws for unknown prompt keys', () => {
    expect(() => getPromptMetadata('missing-prompt' as PromptKey)).toThrow(/Unknown prompt key/);
  });
});
