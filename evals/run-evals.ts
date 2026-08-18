import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { InternalServerErrorException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { parse as parseDotenv } from 'dotenv';
import { z } from 'zod';

import { AppModule } from '../apps/backend/src/app.module';
import { listActivePromptVersions, type PromptKey } from '../apps/backend/src/config/prompts';
import { CHAT_CLIENT, type ChatClient } from '../apps/backend/src/modules/ai/chat/chat.types';
import { measureCitationGrounding } from '../apps/backend/src/modules/ai/citation-grounding';
import { DecisionEngineService } from '../apps/backend/src/modules/ai/decision-engine.service';
import type { PolicyDocumentChunk } from '../apps/backend/src/modules/ai/dto/document-ingestion.dto';
import { estimateCostUsd } from '../apps/backend/src/modules/ai/observability/cost-estimator';
import { executeWithObservability } from '../apps/backend/src/modules/ai/observability/llm-observability.wrapper';
import {
  RecommendationDecisionSchema,
  type Decision,
  type RecommendationDecision,
} from '../apps/backend/src/modules/ai/schemas/recommendation.schema';
import {
  RETRIEVAL_TOP_K,
  RetrievalService,
} from '../apps/backend/src/modules/ai/retrieval.service';

const ROOT_DIR = resolve(__dirname, '..');
const GOLDEN_DATASET_PATH = join(ROOT_DIR, 'evals', 'golden_dataset.json');
const REPORT_PATH = join(ROOT_DIR, 'evals', 'output', 'report.json');
const BACKEND_ENV_PATH = join(ROOT_DIR, 'apps', 'backend', '.env');
const EVAL_GROUNDING_JUDGE_PROMPT_KEY: PromptKey = 'eval-grounding-judge';
const DEFAULT_GROUNDING_THRESHOLD = 0.8;
const EXCERPT_MATCH_MIN_LENGTH = 40;

const PolicyCitationGoldenSchema = z.object({
  document_id: z.string().min(1),
  page_number: z.number().int().positive(),
  section_title: z.string().min(1),
});

const ExpectedRetrievedChunkSchema = z.object({
  document_id: z.string().min(1),
  page_number: z.number().int().positive(),
  section_title: z.string().min(1),
  excerpt: z.string().min(1),
});

const GoldenScenarioSchema = z.object({
  scenario_id: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  webhook_input: z.object({
    request_id: z.string().min(1),
    employee_id: z.string().min(1),
    cost_center: z.string().min(1),
    department: z.string().min(1),
    target_resource: z.string().min(1),
    requested_entitlement: z.string().min(1),
    title: z.string().min(1),
    current_entitlements: z.array(z.string()),
  }),
  // Empty arrays are valid for adversarial / non-retrieval scenarios (e.g. prompt injection).
  expected_retrieved_chunks: z.array(ExpectedRetrievedChunkSchema),
  expected_agent_output: z.object({
    decision: RecommendationDecisionSchema,
    rationale: z.string().min(1),
    policy_citations: z.array(PolicyCitationGoldenSchema),
    confidence_score: z.number().min(0).max(1),
  }),
});

const GoldenDatasetSchema = z.array(GoldenScenarioSchema).min(1);

type GoldenScenario = z.infer<typeof GoldenScenarioSchema>;
type ExpectedRetrievedChunk = z.infer<typeof ExpectedRetrievedChunkSchema>;

const JudgeResultSchema = z.object({
  score: z.number().min(0).max(1),
  decision_match: z.boolean(),
  rationale: z.string().min(1),
});

type JudgeResult = z.infer<typeof JudgeResultSchema>;

interface ScenarioReport {
  readonly scenarioId: string;
  readonly category: string;
  readonly recallAtK: number;
  readonly schemaValid: boolean;
  readonly groundingScore: number;
  readonly citationHitRate: number;
  readonly judgeRationale: string | null;
  readonly judgeDecisionMatch: boolean | null;
  readonly latencyMs: number;
  readonly estimatedCostUsd: number;
  readonly expectedDecision: RecommendationDecision;
  readonly actualDecision: RecommendationDecision | null;
  readonly expectedChunkKeys: ReadonlyArray<string>;
  readonly retrievedChunkKeys: ReadonlyArray<string>;
  readonly error: string | null;
}

interface EvalReport {
  readonly generatedAt: string;
  readonly promptVersions: ReadonlyArray<{ key: PromptKey; version: string }>;
  readonly k: number;
  readonly thresholds: {
    readonly schemaValidityMin: number;
    readonly groundingMin: number;
  };
  readonly metrics: {
    readonly scenarioCount: number;
    readonly recallAtK: number;
    readonly schemaValidityRate: number;
    readonly groundingScore: number;
    readonly citationHitRate: number;
    readonly latencyP95Ms: number;
    readonly estimatedCostUsdTotal: number;
  };
  readonly gates: {
    readonly schemaValidityPass: boolean;
    readonly groundingPass: boolean;
  };
  readonly scenarios: ReadonlyArray<ScenarioReport>;
  readonly fatalError: string | null;
}

function normalizeDocumentId(documentId: string): string {
  const match = /^POL-\d{4}-\d{2}-[A-Z]+/i.exec(documentId.trim());
  if (match !== null) {
    return match[0].toUpperCase();
  }
  return documentId.trim().toUpperCase();
}

function documentIdsMatch(expectedId: string, retrievedId: string): boolean {
  const expected = expectedId.trim();
  const retrieved = retrievedId.trim();
  if (expected === retrieved) {
    return true;
  }
  if (retrieved.startsWith(`${expected}_`)) {
    return true;
  }
  return normalizeDocumentId(expected) === normalizeDocumentId(retrieved);
}

function normalizeSectionTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

function excerptOverlapHit(excerpt: string, content: string): boolean {
  const normalizedExcerpt = excerpt.trim().toLowerCase().replace(/\s+/g, ' ');
  const normalizedContent = content.trim().toLowerCase().replace(/\s+/g, ' ');
  if (normalizedExcerpt.length === 0 || normalizedContent.length === 0) {
    return false;
  }
  if (normalizedContent.includes(normalizedExcerpt)) {
    return true;
  }
  const window = Math.min(EXCERPT_MATCH_MIN_LENGTH, normalizedExcerpt.length);
  const needle = normalizedExcerpt.slice(0, window);
  return needle.length >= 20 && normalizedContent.includes(needle);
}

function chunkMatchesExpected(
  retrieved: PolicyDocumentChunk,
  expected: ExpectedRetrievedChunk,
): boolean {
  if (!documentIdsMatch(expected.document_id, retrieved.document_id)) {
    return false;
  }
  if (retrieved.page_number !== expected.page_number) {
    return false;
  }
  if (
    normalizeSectionTitle(retrieved.section_title) === normalizeSectionTitle(expected.section_title)
  ) {
    return true;
  }
  return excerptOverlapHit(expected.excerpt, retrieved.content);
}

function recallAtK(
  retrieved: ReadonlyArray<PolicyDocumentChunk>,
  expected: ReadonlyArray<ExpectedRetrievedChunk>,
  k: number,
): number {
  if (expected.length === 0) {
    return 1;
  }
  const topK = retrieved.slice(0, k);
  let hits = 0;
  for (const expectedChunk of expected) {
    const matched = topK.some((chunk) => chunkMatchesExpected(chunk, expectedChunk));
    if (matched) {
      hits += 1;
    }
  }
  return hits / expected.length;
}

function citationKey(chunk: {
  document_id: string;
  page_number: number;
  section_title: string;
}): string {
  return `${normalizeDocumentId(chunk.document_id)}|${chunk.page_number}|${normalizeSectionTitle(chunk.section_title)}`;
}

function buildScenarioContext(scenario: GoldenScenario): {
  readonly justification: string;
  readonly title: string;
  readonly costCenter: string;
  readonly department: string;
  readonly targetResource: string;
  readonly currentEntitlements: ReadonlyArray<string>;
} {
  return {
    justification: scenario.description,
    title: scenario.webhook_input.title,
    costCenter: scenario.webhook_input.cost_center,
    department: scenario.webhook_input.department,
    targetResource: scenario.webhook_input.target_resource,
    currentEntitlements: scenario.webhook_input.current_entitlements,
  };
}

function percentileNearestRank(sortedAscending: ReadonlyArray<number>, percentile: number): number {
  if (sortedAscending.length === 0) {
    return 0;
  }
  const rank = Math.ceil((percentile / 100) * sortedAscending.length) - 1;
  const index = Math.min(sortedAscending.length - 1, Math.max(0, rank));
  return sortedAscending[index] ?? 0;
}

function mean(values: ReadonlyArray<number>): number {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

async function loadGoldenDataset(): Promise<ReadonlyArray<GoldenScenario>> {
  const raw = await readFile(GOLDEN_DATASET_PATH, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  return GoldenDatasetSchema.parse(parsed);
}

async function scoreGrounding(params: {
  readonly chatClient: ChatClient;
  readonly expected: GoldenScenario['expected_agent_output'];
  readonly actual: Decision;
  readonly retrievedChunks: ReadonlyArray<PolicyDocumentChunk>;
}): Promise<{ result: JudgeResult; estimatedCostUsd: number }> {
  if (params.actual.decision !== params.expected.decision) {
    return {
      result: {
        score: 0,
        decision_match: false,
        rationale: `Decision mismatch: expected ${params.expected.decision}, got ${params.actual.decision}`,
      },
      estimatedCostUsd: 0,
    };
  }

  const payload = {
    expected_decision: params.expected.decision,
    expected_rationale: params.expected.rationale,
    expected_citations: params.expected.policy_citations,
    actual_decision: params.actual.decision,
    actual_rationale: params.actual.rationale,
    actual_citations: params.actual.policy_citations,
    actual_confidence_score: params.actual.confidence_score,
    retrieved_chunks: params.retrievedChunks.map((chunk) => ({
      document_id: chunk.document_id,
      page_number: chunk.page_number,
      section_title: chunk.section_title,
      content: chunk.content,
    })),
  };

  const judged = await executeWithObservability(
    {
      promptKey: EVAL_GROUNDING_JUDGE_PROMPT_KEY,
      model: params.chatClient.model,
      payload,
      execute: (assembledPrompt: string) => params.chatClient.complete(assembledPrompt),
    },
    JudgeResultSchema,
  );

  if (judged.data === null || !judged.observation.schemaValid) {
    return {
      result: {
        score: 0,
        decision_match: params.actual.decision === params.expected.decision,
        rationale: `Judge schema invalid: ${judged.observation.schemaErrors.join('; ') || 'unknown'}`,
      },
      estimatedCostUsd: judged.observation.estimatedCostUsd,
    };
  }

  return {
    result: judged.data,
    estimatedCostUsd: judged.observation.estimatedCostUsd,
  };
}

function setChatComplete(chatClient: ChatClient, complete: ChatClient['complete']): void {
  (chatClient as { complete: ChatClient['complete'] }).complete = complete;
}

async function captureChatCost<T>(
  chatClient: ChatClient,
  operation: () => Promise<T>,
): Promise<{ readonly value: T; readonly estimatedCostUsd: number }> {
  let estimatedCostUsd = 0;
  const originalComplete = chatClient.complete.bind(chatClient);
  setChatComplete(chatClient, async (prompt, options) => {
    const execution = await originalComplete(prompt, options);
    estimatedCostUsd += estimateCostUsd(
      chatClient.model,
      execution.inputTokens,
      execution.outputTokens,
    );
    return execution;
  });

  try {
    const value = await operation();
    return { value, estimatedCostUsd };
  } finally {
    setChatComplete(chatClient, originalComplete);
  }
}

async function evaluateScenario(params: {
  readonly scenario: GoldenScenario;
  readonly retrievalService: RetrievalService;
  readonly decisionEngine: DecisionEngineService;
  readonly chatClient: ChatClient;
  readonly k: number;
}): Promise<ScenarioReport> {
  const { scenario, retrievalService, decisionEngine, chatClient, k } = params;
  const context = buildScenarioContext(scenario);
  const expectedChunkKeys = scenario.expected_retrieved_chunks.map((chunk) => citationKey(chunk));

  let retrieved: PolicyDocumentChunk[] = [];
  let actual: Decision | null = null;
  let schemaValid = false;
  let groundingScore = 0;
  let citationHitRate = 0;
  let judgeRationale: string | null = null;
  let judgeDecisionMatch: boolean | null = null;
  let estimatedCostUsd = 0;
  let error: string | null = null;
  let latencyMs = 0;

  const startedAt = Date.now();
  try {
    retrieved = await retrievalService.retrieve({
      requestId: scenario.webhook_input.request_id,
      targetEntitlement: scenario.webhook_input.requested_entitlement,
      justification: context.justification,
      title: context.title,
      costCenter: context.costCenter,
      department: context.department,
      targetResource: context.targetResource,
      currentEntitlements: [...context.currentEntitlements],
    });

    try {
      const captured = await captureChatCost(chatClient, () =>
        decisionEngine.decide({
          request: {
            requestId: scenario.webhook_input.request_id,
            targetEntitlement: scenario.webhook_input.requested_entitlement,
            justification: context.justification,
            title: context.title,
            costCenter: context.costCenter,
            department: context.department,
            targetResource: context.targetResource,
            currentEntitlements: [...context.currentEntitlements],
          },
          policyChunks: retrieved,
        }),
      );
      latencyMs = Date.now() - startedAt;
      actual = captured.value;
      schemaValid = true;
      estimatedCostUsd += captured.estimatedCostUsd;
      citationHitRate = measureCitationGrounding(actual, retrieved).citationHitRate;
    } catch (decisionError: unknown) {
      latencyMs = Date.now() - startedAt;
      schemaValid = false;
      actual = null;
      if (decisionError instanceof InternalServerErrorException) {
        error = `decision_schema_invalid: ${decisionError.message}`;
      } else {
        error =
          decisionError instanceof Error
            ? `decision_failed: ${decisionError.message}`
            : 'decision_failed: unknown error';
      }
    }
  } catch (retrievalError: unknown) {
    latencyMs = Date.now() - startedAt;
    error =
      retrievalError instanceof Error
        ? `retrieval_failed: ${retrievalError.message}`
        : 'retrieval_failed: unknown error';
  }

  const recall = recallAtK(retrieved, scenario.expected_retrieved_chunks, k);

  if (actual !== null && schemaValid) {
    try {
      const judged = await scoreGrounding({
        chatClient,
        expected: scenario.expected_agent_output,
        actual,
        retrievedChunks: retrieved,
      });
      groundingScore = judged.result.score;
      judgeRationale = judged.result.rationale;
      judgeDecisionMatch = judged.result.decision_match;
      estimatedCostUsd += judged.estimatedCostUsd;
    } catch (judgeError: unknown) {
      groundingScore = 0;
      const judgeMessage = judgeError instanceof Error ? judgeError.message : 'unknown judge error';
      judgeRationale = judgeMessage;
      error =
        error === null
          ? `judge_failed: ${judgeMessage}`
          : `${error}; judge_failed: ${judgeMessage}`;
    }
  } else if (actual !== null && actual.decision !== scenario.expected_agent_output.decision) {
    groundingScore = 0;
    judgeDecisionMatch = false;
    judgeRationale = `Decision mismatch: expected ${scenario.expected_agent_output.decision}, got ${actual.decision}`;
  }

  return {
    scenarioId: scenario.scenario_id,
    category: scenario.category,
    recallAtK: roundMetric(recall),
    schemaValid,
    groundingScore: roundMetric(groundingScore),
    citationHitRate: roundMetric(citationHitRate),
    judgeRationale,
    judgeDecisionMatch,
    latencyMs,
    estimatedCostUsd: roundMetric(estimatedCostUsd),
    expectedDecision: scenario.expected_agent_output.decision,
    actualDecision: actual?.decision ?? null,
    expectedChunkKeys,
    retrievedChunkKeys: retrieved.map((chunk) => citationKey(chunk)),
    error,
  };
}

function buildReport(params: {
  readonly scenarios: ReadonlyArray<ScenarioReport>;
  readonly groundingMin: number;
  readonly fatalError: string | null;
}): EvalReport {
  const latencies = params.scenarios.map((scenario) => scenario.latencyMs).sort((a, b) => a - b);
  const recallAtKScore = mean(params.scenarios.map((scenario) => scenario.recallAtK));
  const schemaValidityRate =
    params.scenarios.length === 0
      ? 0
      : params.scenarios.filter((scenario) => scenario.schemaValid).length /
        params.scenarios.length;
  const groundingScore = mean(params.scenarios.map((scenario) => scenario.groundingScore));
  const citationHitRate = mean(params.scenarios.map((scenario) => scenario.citationHitRate));
  const estimatedCostUsdTotal = params.scenarios.reduce(
    (sum, scenario) => sum + scenario.estimatedCostUsd,
    0,
  );

  const schemaValidityPass = schemaValidityRate >= 1;
  const groundingPass = groundingScore >= params.groundingMin;

  return {
    generatedAt: new Date().toISOString(),
    promptVersions: listActivePromptVersions(),
    k: RETRIEVAL_TOP_K,
    thresholds: {
      schemaValidityMin: 1,
      groundingMin: params.groundingMin,
    },
    metrics: {
      scenarioCount: params.scenarios.length,
      recallAtK: roundMetric(recallAtKScore),
      schemaValidityRate: roundMetric(schemaValidityRate),
      groundingScore: roundMetric(groundingScore),
      citationHitRate: roundMetric(citationHitRate),
      latencyP95Ms: percentileNearestRank(latencies, 95),
      estimatedCostUsdTotal: roundMetric(estimatedCostUsdTotal),
    },
    gates: {
      schemaValidityPass,
      groundingPass,
    },
    scenarios: params.scenarios,
    fatalError: params.fatalError,
  };
}

async function writeReport(report: EvalReport): Promise<void> {
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function printSummary(report: EvalReport): void {
  process.stdout.write('\n=== Policy-Pilot Eval Scorecard ===\n');
  process.stdout.write(`Report: ${REPORT_PATH}\n`);
  process.stdout.write(
    `Prompt versions: ${report.promptVersions.map((entry) => `${entry.key}@${entry.version}`).join(', ')}\n`,
  );
  process.stdout.write(`Scenarios: ${report.metrics.scenarioCount}\n`);
  process.stdout.write(`Recall@${report.k}: ${report.metrics.recallAtK}\n`);
  process.stdout.write(`Schema Validity Rate: ${report.metrics.schemaValidityRate}\n`);
  process.stdout.write(`Grounding Score: ${report.metrics.groundingScore}\n`);
  process.stdout.write(`Citation Hit Rate: ${report.metrics.citationHitRate}\n`);
  process.stdout.write(`Latency p95 (ms): ${report.metrics.latencyP95Ms}\n`);
  process.stdout.write(`Estimated USD Cost: ${report.metrics.estimatedCostUsdTotal}\n`);
  process.stdout.write(
    `Gates: schema=${report.gates.schemaValidityPass ? 'PASS' : 'FAIL'} grounding=${report.gates.groundingPass ? 'PASS' : 'FAIL'}\n`,
  );
  if (report.fatalError !== null) {
    process.stdout.write(`Fatal error: ${report.fatalError}\n`);
  }
  process.stdout.write('===================================\n');
}

function loadBackendEnv(): void {
  const parsed = parseDotenv(readFileSync(BACKEND_ENV_PATH));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined && value !== undefined) {
      process.env[key] = value;
    }
  }
}

async function main(): Promise<void> {
  loadBackendEnv();

  const groundingMinRaw = process.env.EVAL_GROUNDING_THRESHOLD;
  const groundingMin =
    groundingMinRaw === undefined || groundingMinRaw.trim().length === 0
      ? DEFAULT_GROUNDING_THRESHOLD
      : Number(groundingMinRaw);

  if (!Number.isFinite(groundingMin) || groundingMin < 0 || groundingMin > 1) {
    throw new Error(
      `EVAL_GROUNDING_THRESHOLD must be a number between 0 and 1; received: ${groundingMinRaw}`,
    );
  }

  const scenarios: ScenarioReport[] = [];
  let fatalError: string | null = null;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const retrievalService = app.get(RetrievalService);
    const decisionEngine = app.get(DecisionEngineService);
    const chatClient = app.get<ChatClient>(CHAT_CLIENT);
    const golden = await loadGoldenDataset();

    process.stdout.write(`Loaded ${golden.length} golden scenarios from ${GOLDEN_DATASET_PATH}\n`);

    for (const scenario of golden) {
      process.stdout.write(`Evaluating ${scenario.scenario_id} (${scenario.category})...\n`);
      const result = await evaluateScenario({
        scenario,
        retrievalService,
        decisionEngine,
        chatClient,
        k: RETRIEVAL_TOP_K,
      });
      scenarios.push(result);
      process.stdout.write(
        `  recall=${result.recallAtK} schema=${result.schemaValid} grounding=${result.groundingScore} citationHit=${result.citationHitRate} latencyMs=${result.latencyMs}\n`,
      );
    }
  } catch (error: unknown) {
    fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    process.stderr.write(`EVAL_FATAL ${fatalError}\n`);
  } finally {
    await app.close();
  }

  const report = buildReport({
    scenarios,
    groundingMin,
    fatalError,
  });
  await writeReport(report);
  printSummary(report);

  if (fatalError !== null || !report.gates.schemaValidityPass || !report.gates.groundingPass) {
    process.exit(1);
  }
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  process.stderr.write(`EVAL_CRASH ${message}\n`);

  const failureReport = buildReport({
    scenarios: [],
    groundingMin: DEFAULT_GROUNDING_THRESHOLD,
    fatalError: message,
  });

  try {
    await writeReport(failureReport);
  } catch (writeError: unknown) {
    const writeMessage =
      writeError instanceof Error ? writeError.message : 'failed to write failure report';
    process.stderr.write(`EVAL_REPORT_WRITE_FAILED ${writeMessage}\n`);
  }

  process.exit(1);
});
