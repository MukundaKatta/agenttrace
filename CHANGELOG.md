# Changelog

## [Unreleased]

Production-polish branch (this PR): adds `SECURITY.md` (with cost-under-reporting / PRICING-mutation / numeric-overflow surfaces called out), `CODE_OF_CONDUCT.md`, `CODEOWNERS`, Dependabot config, issue + PR templates, release workflow with npm provenance OIDC + zero-deps gate, full CI (this repo had no GH Actions before — adds Node 20/22/24 matrix on Ubuntu plus macOS + Windows spot-checks, coverage gate, cost-under-reporting smoke, `npm pack` content check, zero-runtime-deps gate). Hygiene: untracks `node_modules/` and `coverage/` that leaked into the v0.1.0 tree. No source changes.

### Fixed
- Rename the test file `test/agentbench.test.js` to `test/agenttrace.test.js`, the last leftover from the original `agentbench` -> `agenttrace` project rename. Test suite stays 26/26 green (the `node --test test/*.test.js` glob is unaffected).

## [0.1.0] — 2026-04-28

Initial release. Sixth in the @mukundakatta agent-stack
(agentfit / agentguard / agentsnap / agentvet / agentcast / agenttrace).

### Added
- `withRun(options, fn)` — bind a Run to AsyncLocalStorage. Steps
  created inside `fn` (across `await`s) attach automatically.
- `measure(name, fn, options)` — time a function, record errors,
  attach to the active run.
- `measureLLM(name, model, fn, options)` — convenience wrapper that
  also extracts token usage from common SDK response shapes.
- `defaultExtractUsage(value)` — best-effort extractor for Anthropic /
  OpenAI / Google SDK response shapes.
- `costOf(model, usage)` — USD cost for a usage record. Built-in
  pricing for Anthropic Claude 4 (Opus / Sonnet / Haiku) and 3.x
  (Sonnet 3.7 / Haiku 3.5), OpenAI GPT-4.1 / GPT-4o / o1 / o3
  families, Google Gemini 2.5 (Pro / Flash / Lite), Gemini 2.0,
  xAI Grok 4, plus zero-cost entries for free-tier providers
  (Groq, Cerebras, Ollama, OpenRouter `:free`).
- `setPricing(model, prices)` — register or override pricing for a
  custom model.
- `Run` and `Step` classes with `latencyMs`, `usage`, `cost`,
  `summary()`, `toJSON()` (round-trippable for logs/dashboards).
- TypeScript types via `src/index.d.ts`.
- 26 tests, zero runtime dependencies, ESM, Node ≥20.
