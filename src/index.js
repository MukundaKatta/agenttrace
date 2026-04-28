// @mukundakatta/agenttrace — cost and latency tracking for AI agent runs.
//
// Zero-deps, sync default-priced. Wrap an LLM call (or any tool call) with
// `bench.measure(name, fn)`; results aggregate into a Run that you can
// `summary()` or `toJSON()` for dashboards/logs.
//
// Pricing tables live in `PRICING` and are user-extensible via `setPricing`.
// Costs are computed in USD millicents (1/1000 of a cent) for sub-cent
// precision, then surfaced as USD floats in summaries.

import { performance } from "node:perf_hooks";
import { AsyncLocalStorage } from "node:async_hooks";

/** Built-in pricing per million tokens (USD). Override via `setPricing`. */
export const PRICING = {
  // Anthropic (input, output, cache_write, cache_read).
  "claude-opus-4": { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  "claude-sonnet-4": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "claude-haiku-4": {
    input: 0.8,
    output: 4,
    cacheWrite: 1,
    cacheRead: 0.08,
  },
  "claude-sonnet-3-7": {
    input: 3,
    output: 15,
    cacheWrite: 3.75,
    cacheRead: 0.3,
  },
  "claude-haiku-3-5": {
    input: 0.8,
    output: 4,
    cacheWrite: 1,
    cacheRead: 0.08,
  },
  // OpenAI.
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "o1": { input: 15, output: 60 },
  "o1-mini": { input: 3, output: 12 },
  "o3": { input: 2, output: 8 },
  "o3-mini": { input: 1.1, output: 4.4 },
  // Google.
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  // xAI.
  "grok-4": { input: 3, output: 15 },
  // Free providers — record-only, cost stays 0.
  "groq-llama-3.3-70b": { input: 0, output: 0 },
  "groq-llama-4-scout": { input: 0, output: 0 },
  "cerebras-llama-3.3-70b": { input: 0, output: 0 },
  "openrouter-free": { input: 0, output: 0 },
  "ollama": { input: 0, output: 0 },
  "default": { input: 0, output: 0 },
};

const customPricing = new Map();

/**
 * Register or override pricing for a model name.
 *
 * @param {string} model
 * @param {{input:number, output:number, cacheWrite?:number, cacheRead?:number}} prices
 *   Per-million-token USD prices.
 */
export function setPricing(model, prices) {
  if (typeof model !== "string" || !model) {
    throw new TypeError("setPricing: model must be a non-empty string");
  }
  if (!prices || typeof prices !== "object") {
    throw new TypeError("setPricing: prices must be an object");
  }
  customPricing.set(model, {
    input: prices.input ?? 0,
    output: prices.output ?? 0,
    cacheWrite: prices.cacheWrite ?? prices.input ?? 0,
    cacheRead: prices.cacheRead ?? prices.input ?? 0,
  });
}

function lookupPricing(model) {
  if (!model) return PRICING.default;
  if (customPricing.has(model)) return customPricing.get(model);
  if (PRICING[model]) return PRICING[model];
  // Try a longest-prefix match so "claude-opus-4-5-20260101" maps to
  // "claude-opus-4" without forcing the user to register every variant.
  let best = null;
  for (const key of Object.keys(PRICING)) {
    if (model.startsWith(key) && (!best || key.length > best.length)) {
      best = key;
    }
  }
  return best ? PRICING[best] : PRICING.default;
}

/**
 * Compute USD cost (as a float) for a usage record.
 *
 * @param {string} model
 * @param {{input?:number, output?:number, cacheWrite?:number, cacheRead?:number}} usage
 *   Token counts.
 */
export function costOf(model, usage = {}) {
  const p = lookupPricing(model);
  const input = (usage.input ?? 0) * p.input;
  const output = (usage.output ?? 0) * p.output;
  const cacheWrite = (usage.cacheWrite ?? 0) * (p.cacheWrite ?? p.input ?? 0);
  const cacheRead = (usage.cacheRead ?? 0) * (p.cacheRead ?? p.input ?? 0);
  // Total in USD (per-million token prices, so divide by 1e6).
  return (input + output + cacheWrite + cacheRead) / 1e6;
}

const RUN_CONTEXT = new AsyncLocalStorage();

/** A single timed step (LLM call, tool call, etc.). */
class Step {
  /**
   * @param {string} name
   * @param {{model?:string, tags?:string[], input?:any, output?:any}} options
   */
  constructor(name, options = {}) {
    this.name = name;
    this.model = options.model;
    this.tags = options.tags ?? [];
    this.startTs = performance.now();
    this.endTs = null;
    this.usage = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
    this.cost = 0;
    this.error = null;
    this.metadata = {};
  }

  /**
   * Attach token usage to this step. Costs are recomputed against the
   * current pricing tables.
   *
   * @param {{input?:number, output?:number, cacheWrite?:number, cacheRead?:number}} u
   */
  recordUsage(u) {
    this.usage = {
      input: (this.usage.input ?? 0) + (u.input ?? 0),
      output: (this.usage.output ?? 0) + (u.output ?? 0),
      cacheWrite: (this.usage.cacheWrite ?? 0) + (u.cacheWrite ?? 0),
      cacheRead: (this.usage.cacheRead ?? 0) + (u.cacheRead ?? 0),
    };
    this.cost = costOf(this.model ?? "default", this.usage);
  }

  /** Latency in milliseconds (or null if step is still running). */
  get latencyMs() {
    if (this.endTs === null) return null;
    return this.endTs - this.startTs;
  }

  toJSON() {
    return {
      name: this.name,
      model: this.model,
      tags: this.tags,
      latencyMs: this.latencyMs,
      usage: this.usage,
      costUsd: this.cost,
      error: this.error ? { name: this.error.name, message: this.error.message } : null,
      metadata: this.metadata,
    };
  }
}

/** A run is a collection of steps, typically one agent invocation. */
class Run {
  /** @param {{name?:string, tags?:string[]}} options */
  constructor(options = {}) {
    this.name = options.name ?? "run";
    this.tags = options.tags ?? [];
    this.startTs = performance.now();
    this.endTs = null;
    this.steps = [];
    this.metadata = {};
  }

  addStep(step) {
    this.steps.push(step);
  }

  /** Mark the run as complete. Idempotent. */
  finish() {
    if (this.endTs === null) this.endTs = performance.now();
  }

  /** Wall-clock duration of the run in ms (uses the latest step end if still open). */
  get latencyMs() {
    if (this.endTs !== null) return this.endTs - this.startTs;
    return performance.now() - this.startTs;
  }

  /** Aggregate token usage across all steps. */
  get totalUsage() {
    const acc = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
    for (const s of this.steps) {
      acc.input += s.usage.input ?? 0;
      acc.output += s.usage.output ?? 0;
      acc.cacheWrite += s.usage.cacheWrite ?? 0;
      acc.cacheRead += s.usage.cacheRead ?? 0;
    }
    return acc;
  }

  /** Total cost of the run in USD. */
  get totalCostUsd() {
    return this.steps.reduce((sum, s) => sum + (s.cost ?? 0), 0);
  }

  /**
   * Plain-text summary suitable for logs / Slack messages.
   *
   * @returns {string}
   */
  summary() {
    const lines = [
      `Run "${this.name}" — ${this.steps.length} steps, ${
        formatMs(this.latencyMs)
      }, $${this.totalCostUsd.toFixed(6)}`,
    ];
    for (const s of this.steps) {
      const lat = s.latencyMs === null ? "running" : formatMs(s.latencyMs);
      const cost = s.cost ? `$${s.cost.toFixed(6)}` : "$0";
      const errMark = s.error ? " ERR" : "";
      lines.push(
        `  • ${s.name}${s.model ? ` [${s.model}]` : ""} — ${lat} — ${cost}${errMark}`,
      );
    }
    return lines.join("\n");
  }

  toJSON() {
    return {
      name: this.name,
      tags: this.tags,
      latencyMs: this.latencyMs,
      totalCostUsd: this.totalCostUsd,
      totalUsage: this.totalUsage,
      steps: this.steps.map((s) => s.toJSON()),
      metadata: this.metadata,
    };
  }
}

function formatMs(ms) {
  if (ms === null) return "-";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Start a new Run and bind it to async context. Steps created inside
 * `fn` automatically attach to this run via `currentRun()`.
 *
 * @template T
 * @param {{name?:string, tags?:string[]}} options
 * @param {() => T | Promise<T>} fn
 * @returns {Promise<{run: Run, value: T}>}
 */
export async function withRun(options, fn) {
  const run = new Run(options);
  const value = await RUN_CONTEXT.run(run, async () => fn(run));
  run.finish();
  return { run, value };
}

/** Get the run bound to the current async context, or null. */
export function currentRun() {
  return RUN_CONTEXT.getStore() ?? null;
}

/**
 * Time a function and (optionally) record token usage. Returns the
 * function's return value. Step is attached to the active run if one
 * exists.
 *
 * @template T
 * @param {string} name
 * @param {() => T | Promise<T>} fn
 * @param {{model?:string, tags?:string[]}} options
 */
export async function measure(name, fn, options = {}) {
  const step = new Step(name, options);
  const run = currentRun();
  if (run) run.addStep(step);
  try {
    const value = await fn(step);
    step.endTs = performance.now();
    return value;
  } catch (err) {
    step.endTs = performance.now();
    step.error = err instanceof Error ? err : new Error(String(err));
    throw err;
  }
}

/**
 * Convenience wrapper for the very common case: an LLM call that
 * returns `{ usage, ... }` Anthropic-style. Records latency + usage in
 * one go.
 *
 * @template T
 * @param {string} name
 * @param {string} model
 * @param {() => Promise<T & { usage?: any }>} fn
 * @param {{tags?:string[], extractUsage?:(value:T)=>any}} options
 */
export async function measureLLM(name, model, fn, options = {}) {
  const extract = options.extractUsage ?? defaultExtractUsage;
  return measure(
    name,
    async (step) => {
      const value = await fn();
      const usage = extract(value);
      if (usage) step.recordUsage(usage);
      return value;
    },
    { model, tags: options.tags },
  );
}

/**
 * Best-effort usage extraction across the major SDK shapes. Returns
 * null if no recognizable shape is found.
 */
export function defaultExtractUsage(value) {
  if (!value || typeof value !== "object") return null;
  // Anthropic: { usage: { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens } }
  const u = value.usage ?? value.response?.usage ?? null;
  if (!u) return null;
  return {
    input: u.input_tokens ?? u.prompt_tokens ?? u.promptTokens ?? 0,
    output: u.output_tokens ?? u.completion_tokens ?? u.completionTokens ?? 0,
    cacheWrite: u.cache_creation_input_tokens ?? u.cacheCreationInputTokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? u.cacheReadInputTokens ?? 0,
  };
}

export { Run, Step };
