---
name: Bug report (non-security)
about: Run summary aggregates wrong, AsyncLocalStorage attribution misfires, examples don't run. Not for cost-under-reporting / PRICING-corruption reports.
title: "[bug] "
labels: bug
assignees: ''
---

> ⚠ **Found a case where the reported cost is lower than what the provider actually charges, or a way to corrupt PRICING across other consumers in the same process?** Stop. Use [GitHub's private vulnerability reporting](https://github.com/MukundaKatta/agenttrace/security/advisories/new) instead of this template. See `SECURITY.md`.

## What happened

A clear, concise description of the actual behavior.

## What you expected

A clear, concise description of what should have happened.

## Reproduction

Minimal repro using only this library:

```js
import { measure, summary, setPricing } from '@mukundakatta/agenttrace';

const run = await measure('llm.call', async () => {
  // simulate a span; return usage so cost is computed
  return { usage: { inputTokens: 100, outputTokens: 50 }, model: 'claude-sonnet-4' };
});

console.log(summary(run));
// observed: ...
// expected: ...
```

## Environment

- agenttrace version: (`cat package.json | grep version`)
- Node version: (`node --version` — agenttrace requires Node 20+)
- OS: (macOS 14 / Ubuntu 22.04 / Windows 11)
- Provider model id involved (if pricing-related):

## Notes

Anything else — whether you call `setPricing()` to override the default table, whether the failing run was inside or outside an `AsyncLocalStorage`-spawned async context, anything else suspicious.
