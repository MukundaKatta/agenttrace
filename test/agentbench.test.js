import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PRICING,
  Run,
  costOf,
  currentRun,
  defaultExtractUsage,
  measure,
  measureLLM,
  setPricing,
  withRun,
} from "../src/index.js";

test("costOf returns 0 for unknown model", () => {
  assert.equal(costOf("unknown-model", { input: 1000, output: 500 }), 0);
});

test("costOf computes USD per million tokens correctly", () => {
  // claude-sonnet-4: input $3/M, output $15/M
  assert.equal(
    costOf("claude-sonnet-4", { input: 1_000_000, output: 1_000_000 }),
    18,
  );
  assert.equal(
    costOf("claude-sonnet-4", { input: 100, output: 100 }),
    18 / 10_000,
  );
});

test("costOf handles cache tokens with fallback to input price", () => {
  // gpt-4.1 has no cacheRead; should fall back to input price ($2/M)
  assert.equal(
    costOf("gpt-4.1", { cacheRead: 1_000_000 }),
    2,
  );
});

test("costOf handles longest-prefix match for variant model names", () => {
  // "claude-sonnet-4-5-20260101" should match "claude-sonnet-4"
  assert.equal(
    costOf("claude-sonnet-4-5-20260101", { input: 1_000_000, output: 0 }),
    3,
  );
});

test("setPricing registers a custom model", () => {
  setPricing("my-custom-model", { input: 10, output: 20 });
  assert.equal(
    costOf("my-custom-model", { input: 1_000_000, output: 1_000_000 }),
    30,
  );
});

test("setPricing rejects bad inputs", () => {
  assert.throws(() => setPricing("", { input: 1, output: 1 }), TypeError);
  assert.throws(() => setPricing("foo", null), TypeError);
});

test("PRICING table exposes well-known models", () => {
  assert.ok(PRICING["claude-opus-4"]);
  assert.ok(PRICING["gpt-4o"]);
  assert.ok(PRICING["gemini-2.5-pro"]);
  assert.ok(PRICING["groq-llama-3.3-70b"]);
});

test("measure tracks latency", async () => {
  const start = performance.now();
  const value = await measure("test-step", async () => {
    await new Promise((r) => setTimeout(r, 5));
    return 42;
  });
  const elapsed = performance.now() - start;
  assert.equal(value, 42);
  assert.ok(elapsed >= 5);
});

test("measure attaches steps to the active run", async () => {
  const { run, value } = await withRun({ name: "agent-1" }, async () => {
    const v1 = await measure("step-1", async () => 1, {
      model: "claude-haiku-4",
    });
    const v2 = await measure("step-2", async () => 2);
    return v1 + v2;
  });
  assert.equal(value, 3);
  assert.equal(run.steps.length, 2);
  assert.equal(run.steps[0].name, "step-1");
  assert.equal(run.steps[0].model, "claude-haiku-4");
  assert.equal(run.steps[1].name, "step-2");
  assert.equal(run.steps[0].latencyMs !== null, true);
});

test("measure records error on the step but rethrows", async () => {
  await assert.rejects(
    withRun({}, async () => {
      await measure("boom", async () => {
        throw new Error("nope");
      });
    }),
    { message: "nope" },
  );
});

test("currentRun returns null outside a run", () => {
  assert.equal(currentRun(), null);
});

test("currentRun returns the active run inside withRun", async () => {
  const { run } = await withRun({ name: "x" }, async () => {
    const inner = currentRun();
    assert.ok(inner);
    assert.equal(inner.name, "x");
  });
  assert.equal(currentRun(), null); // out again
  assert.equal(run.name, "x");
});

test("Step.recordUsage accumulates and recomputes cost", async () => {
  const { run } = await withRun({}, async () => {
    await measure(
      "accum",
      async (step) => {
        step.recordUsage({ input: 500, output: 250 });
        step.recordUsage({ input: 500, output: 250 });
      },
      { model: "claude-sonnet-4" },
    );
  });
  const step = run.steps[0];
  assert.equal(step.usage.input, 1000);
  assert.equal(step.usage.output, 500);
  // 1000 input @ $3/M + 500 output @ $15/M = 0.003 + 0.0075 = 0.0105 / 1000 (per token)
  // Actually: 1000 * 3 / 1e6 = 0.003. 500 * 15 / 1e6 = 0.0075. Total = 0.0105.
  assert.equal(step.cost.toFixed(6), "0.010500");
});

test("measureLLM extracts Anthropic usage shape", async () => {
  const { run } = await withRun({}, async () => {
    await measureLLM("anthropic-call", "claude-sonnet-4", async () => ({
      content: [{ type: "text", text: "hi" }],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 200,
        cache_read_input_tokens: 300,
      },
    }));
  });
  const step = run.steps[0];
  assert.equal(step.usage.input, 100);
  assert.equal(step.usage.output, 50);
  assert.equal(step.usage.cacheWrite, 200);
  assert.equal(step.usage.cacheRead, 300);
  assert.ok(step.cost > 0);
});

test("measureLLM extracts OpenAI usage shape", async () => {
  const { run } = await withRun({}, async () => {
    await measureLLM("openai-call", "gpt-4o", async () => ({
      choices: [{ message: { content: "hi" } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    }));
  });
  const step = run.steps[0];
  assert.equal(step.usage.input, 100);
  assert.equal(step.usage.output, 50);
});

test("measureLLM tolerates a response without usage", async () => {
  const { run } = await withRun({}, async () => {
    await measureLLM("no-usage", "gpt-4o", async () => ({ result: "ok" }));
  });
  const step = run.steps[0];
  assert.equal(step.usage.input, 0);
  assert.equal(step.usage.output, 0);
  assert.equal(step.cost, 0);
});

test("defaultExtractUsage returns null for unknown shapes", () => {
  assert.equal(defaultExtractUsage(null), null);
  assert.equal(defaultExtractUsage(undefined), null);
  assert.equal(defaultExtractUsage({}), null);
  assert.equal(defaultExtractUsage("string"), null);
  assert.equal(defaultExtractUsage(42), null);
});

test("Run.totalUsage sums across steps", async () => {
  const { run } = await withRun({}, async () => {
    await measure("a", async (s) => s.recordUsage({ input: 100, output: 50 }), {
      model: "claude-haiku-4",
    });
    await measure("b", async (s) => s.recordUsage({ input: 200, output: 100 }), {
      model: "claude-haiku-4",
    });
  });
  assert.deepEqual(run.totalUsage, {
    input: 300,
    output: 150,
    cacheWrite: 0,
    cacheRead: 0,
  });
  assert.ok(run.totalCostUsd > 0);
});

test("Run.summary returns a multi-line string", async () => {
  const { run } = await withRun({ name: "summary-run" }, async () => {
    await measure("step-1", async () => null, { model: "gpt-4o" });
  });
  const summary = run.summary();
  assert.match(summary, /Run "summary-run"/);
  assert.match(summary, /step-1/);
});

test("Run.toJSON is round-trippable through JSON.parse", async () => {
  const { run } = await withRun({ name: "json", tags: ["t1"] }, async () => {
    await measure(
      "ll",
      async (s) => s.recordUsage({ input: 10, output: 20 }),
      { model: "claude-haiku-4", tags: ["llm"] },
    );
  });
  const json = JSON.stringify(run);
  const parsed = JSON.parse(json);
  assert.equal(parsed.name, "json");
  assert.deepEqual(parsed.tags, ["t1"]);
  assert.equal(parsed.steps.length, 1);
  assert.equal(parsed.steps[0].tags[0], "llm");
});

test("nested measures inside withRun all attach to the same run", async () => {
  const { run } = await withRun({}, async () => {
    await Promise.all([
      measure("a", async () => null),
      measure("b", async () => null),
      measure("c", async () => null),
    ]);
  });
  assert.equal(run.steps.length, 3);
});

test("measure outside a run still tracks latency but does not add to any run", async () => {
  // No active run.
  const value = await measure("orphan", async () => 7);
  assert.equal(value, 7);
  // No throw, no run side-effect — verified by absence of an active run.
  assert.equal(currentRun(), null);
});

test("Run.finish is idempotent", async () => {
  const run = new Run({ name: "idempotent" });
  run.finish();
  const firstEnd = run.endTs;
  await new Promise((r) => setTimeout(r, 5));
  run.finish();
  assert.equal(run.endTs, firstEnd);
});

test("Step.error is captured with name and message in toJSON", async () => {
  const { run } = await withRun({}, async () => {
    try {
      await measure("err-step", async () => {
        const e = new Error("kaboom");
        e.name = "MyError";
        throw e;
      });
    } catch {
      // swallow
    }
  });
  const json = run.steps[0].toJSON();
  assert.equal(json.error.name, "MyError");
  assert.equal(json.error.message, "kaboom");
});

test("PRICING contains free-tier records with zero cost", () => {
  assert.equal(costOf("groq-llama-3.3-70b", { input: 1e9, output: 1e9 }), 0);
  assert.equal(costOf("ollama", { input: 1e9, output: 1e9 }), 0);
});

test("Run.latencyMs is non-negative even before finish", () => {
  const r = new Run({ name: "running" });
  assert.ok(r.latencyMs >= 0);
});
