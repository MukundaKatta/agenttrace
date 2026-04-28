export interface Pricing {
  /** USD per million input tokens. */
  input: number;
  /** USD per million output tokens. */
  output: number;
  /** USD per million cache-write tokens (Anthropic). Falls back to `input`. */
  cacheWrite?: number;
  /** USD per million cache-read tokens (Anthropic). Falls back to `input`. */
  cacheRead?: number;
}

export interface UsageRecord {
  /** Input tokens. */
  input?: number;
  /** Output tokens. */
  output?: number;
  /** Cache-write tokens (Anthropic prompt caching). */
  cacheWrite?: number;
  /** Cache-read tokens (Anthropic prompt caching). */
  cacheRead?: number;
}

export const PRICING: Record<string, Pricing>;

/** Register or override pricing for a model name. */
export function setPricing(model: string, prices: Pricing): void;

/** Compute USD cost for a usage record against the configured pricing tables. */
export function costOf(model: string, usage?: UsageRecord): number;

export interface StepOptions {
  /** Model name; used for pricing lookup. */
  model?: string;
  /** Free-form labels surfaced in JSON output. */
  tags?: string[];
}

export interface RunOptions {
  /** Display name for the run, e.g. an agent invocation id. */
  name?: string;
  /** Free-form labels surfaced in JSON output. */
  tags?: string[];
}

export class Step {
  name: string;
  model?: string;
  tags: string[];
  startTs: number;
  endTs: number | null;
  usage: Required<UsageRecord>;
  cost: number;
  error: Error | null;
  metadata: Record<string, unknown>;
  /** Latency in milliseconds, or null if step is still running. */
  readonly latencyMs: number | null;
  recordUsage(usage: UsageRecord): void;
  toJSON(): {
    name: string;
    model?: string;
    tags: string[];
    latencyMs: number | null;
    usage: Required<UsageRecord>;
    costUsd: number;
    error: { name: string; message: string } | null;
    metadata: Record<string, unknown>;
  };
}

export class Run {
  name: string;
  tags: string[];
  startTs: number;
  endTs: number | null;
  steps: Step[];
  metadata: Record<string, unknown>;
  readonly latencyMs: number;
  readonly totalUsage: Required<UsageRecord>;
  readonly totalCostUsd: number;
  addStep(step: Step): void;
  finish(): void;
  /** Plain-text summary, one line per step. */
  summary(): string;
  toJSON(): {
    name: string;
    tags: string[];
    latencyMs: number;
    totalCostUsd: number;
    totalUsage: Required<UsageRecord>;
    steps: ReturnType<Step["toJSON"]>[];
    metadata: Record<string, unknown>;
  };
}

/** Run `fn` inside a fresh Run; nested `measure` calls attach automatically. */
export function withRun<T>(
  options: RunOptions,
  fn: (run: Run) => T | Promise<T>,
): Promise<{ run: Run; value: T }>;

/** Get the run bound to the current async context, or null. */
export function currentRun(): Run | null;

/** Time `fn`. Step is attached to the current run if one exists. */
export function measure<T>(
  name: string,
  fn: (step: Step) => T | Promise<T>,
  options?: StepOptions,
): Promise<T>;

/**
 * Convenience for an LLM call that returns a response with usage info.
 * `extractUsage` defaults to a best-effort extractor for Anthropic /
 * OpenAI / Google SDK response shapes.
 */
export function measureLLM<T>(
  name: string,
  model: string,
  fn: () => Promise<T>,
  options?: { tags?: string[]; extractUsage?: (value: T) => UsageRecord | null },
): Promise<T>;

export function defaultExtractUsage(value: unknown): UsageRecord | null;
