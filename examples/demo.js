// Demo: simulate an agent that does a retrieval, an LLM call, and a write.
// Run with: node examples/demo.js
import { measure, measureLLM, withRun } from "../src/index.js";

const { run } = await withRun({ name: "demo-agent", tags: ["example"] }, async () => {
  await measure("retrieve", async () => {
    await new Promise((r) => setTimeout(r, 30));
    return ["doc1", "doc2"];
  });

  await measureLLM(
    "summarize",
    "claude-sonnet-4",
    async () => {
      await new Promise((r) => setTimeout(r, 80));
      return {
        content: [{ type: "text", text: "Short summary." }],
        usage: {
          input_tokens: 1500,
          output_tokens: 120,
          cache_read_input_tokens: 800,
        },
      };
    },
  );

  await measure("write", async () => {
    await new Promise((r) => setTimeout(r, 10));
    return "ok";
  });
});

console.log(run.summary());
console.log("\nJSON:");
console.log(JSON.stringify(run.toJSON(), null, 2));
