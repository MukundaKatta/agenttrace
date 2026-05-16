# @mukundakatta/agenttrace

[![CI](https://github.com/MukundaKatta/agenttrace/actions/workflows/ci.yml/badge.svg)](https://github.com/MukundaKatta/agenttrace/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/tests-26%2F26-brightgreen.svg)](./test)
[![runtime deps](https://img.shields.io/badge/runtime%20deps-0-brightgreen)](./package.json)

> **Not yet published to npm.** Install directly from GitHub until v0.1.0 ships:
> `npm install github:MukundaKatta/agenttrace`. The npm-version and downloads
> badges will return once the first npm release lands.

Cost and latency tracking for AI agent runs. Wrap your LLM call, get a per-step + per-run breakdown that you can ship to a logger, dashboard, or post-mortem.

Zero dependencies. Async-context aware (steps inside `withRun` attach automatically). Built-in pricing for Anthropic, OpenAI, Google, xAI, and free-tier providers (Groq, Cerebras, Ollama, OpenRouter).

```sh
npm install github:MukundaKatta/agenttrace
```

## Why

Agents accumulate cost in places you don't expect — a tool call retry, a misrouted prompt, a forgotten model bump. `agenttrace` is the lightweight bookkeeping layer that records what each call cost and how long it took, with no external dependency.

It pairs naturally with the rest of the [@mukundakatta agent-stack](#sibling-libraries):
- `agentfit` shapes the prompt to fit your context window
- `agentguard` blocks unauthorized network egress from tools
- `agentvet` validates tool args before execution
- `agentsnap` captures regression snapshots
- `agentcast` enforces structured output
- **`agenttrace` (this lib) tracks the cost & latency of all of the above**

## Quick start

```js
import { withRun, measureLLM } from "@mukundakatta/agenttrace";

const { run, value } = await withRun({ name: "summarize-doc" }, async () => {
  const reply = await measureLLM(
    "summarize",
    "claude-sonnet-4",
    async () => anthropic.messages.create({
      model: "claude-sonnet-4-5",
      messages: [{ role: "user", content: "..." }],
    }),
  );
  return reply.content[0].text;
});

console.log(run.summary());
// Run "summarize-doc" — 1 steps, 842ms, $0.001870
//   • summarize [claude-sonnet-4] — 842ms — $0.001870
```

## Patterns

### Mix LLM and tool calls

```js
import { withRun, measure, measureLLM } from "@mukundakatta/agenttrace";

const { run } = await withRun({ name: "research" }, async () => {
  const docs = await measure("retrieve", () => ragStore.fetch("..."));
  const summary = await measureLLM("summarize", "gpt-4.1-mini", () => openai.chat.completions.create({...}));
  await measure("write", () => fs.writeFile("out.md", summary));
});

console.log(JSON.stringify(run.toJSON(), null, 2));
```

### Manual usage tracking when you don't have a standard SDK shape

```js
await measure("custom", async (step) => {
  const result = await callMyLLM("...");
  step.recordUsage({ input: result.in_tokens, output: result.out_tokens });
  return result;
}, { model: "my-custom-model" });
```

### Custom pricing

```js
import { setPricing, costOf } from "@mukundakatta/agenttrace";

setPricing("my-private-llm", { input: 1.5, output: 6 });
costOf("my-private-llm", { input: 10_000, output: 5_000 }); // → 0.045
```

### Ship to a logger or trace store

```js
const { run } = await withRun({ name: "agent-1" }, async () => { /* ... */ });
logger.info({ kind: "agent_run", ...run.toJSON() });
```

## API

### `withRun(options, fn)`
Run `fn` inside a fresh `Run`. Steps created via `measure`/`measureLLM` inside `fn` attach to it automatically (across `await`s, via AsyncLocalStorage).
- `options.name?: string` — display name (default `"run"`).
- `options.tags?: string[]` — free-form labels.
- Returns `{ run: Run, value: T }`.

### `measure(name, fn, options?)`
Time `fn`, record errors, attach to the active run.
- `options.model?: string` — used for pricing lookup if you `step.recordUsage(...)`.
- `options.tags?: string[]`.
- Returns the value `fn` resolved to.

### `measureLLM(name, model, fn, options?)`
Convenience wrapper for an LLM call. Calls `fn`, awaits, then runs `defaultExtractUsage` over the response and records it.
- `options.extractUsage?: (value) => UsageRecord | null` — override for non-standard SDKs.
- `options.tags?: string[]`.

### `costOf(model, usage)`
Compute USD cost for a usage record. Recognizes longest-prefix matches (e.g. `claude-sonnet-4-5-20260101` → `claude-sonnet-4`).

### `setPricing(model, prices)`
Register or override pricing for a model. Prices are USD per million tokens.

### `currentRun()`
Returns the active `Run` (from AsyncLocalStorage) or `null`.

### `Run`
- `run.steps: Step[]`
- `run.latencyMs: number`
- `run.totalUsage: { input, output, cacheWrite, cacheRead }`
- `run.totalCostUsd: number`
- `run.summary(): string` — one line per step
- `run.toJSON()` — round-trippable JSON for logs/dashboards

### `Step`
- `step.name: string`
- `step.model?: string`
- `step.latencyMs: number | null`
- `step.usage: { input, output, cacheWrite, cacheRead }`
- `step.cost: number`
- `step.error: Error | null`
- `step.recordUsage(usage)` — accumulates and recomputes cost
- `step.toJSON()`

## Built-in pricing

Anthropic (Claude Opus 4 / Sonnet 4 / Haiku 4 / Sonnet 3.7 / Haiku 3.5), OpenAI (GPT-4.1 family, GPT-4o family, o1, o3), Google (Gemini 2.5 Pro/Flash/Lite, Gemini 2.0), xAI Grok 4, plus free-tier providers (Groq, Cerebras, Ollama, OpenRouter `:free`). Override or extend any with `setPricing`.

## Status

26/26 tests passing. Zero dependencies. ESM-only, Node 20+.

## Sibling libraries

This is the sixth in the @mukundakatta agent-stack:

- [@mukundakatta/agentfit](https://github.com/MukundaKatta/agentfit) — fit messages to LLM context window
- [@mukundakatta/agentguard](https://github.com/MukundaKatta/agentguard) — network egress firewall
- [@mukundakatta/agentvet](https://github.com/MukundaKatta/agentvet) — validate tool args before execution
- [@mukundakatta/agentsnap](https://github.com/MukundaKatta/agentsnap) — snapshot tests for tool-call traces
- [@mukundakatta/agentcast](https://github.com/MukundaKatta/agentcast) — structured output enforcer
- **agenttrace** (this lib) — cost + latency tracking

## License

MIT — see [LICENSE](./LICENSE).
