---
name: Feature request
about: Propose a new aggregation, a new pricing entry, or a behavior change.
title: "[feat] "
labels: enhancement
assignees: ''
---

## Scope check

Before opening, please confirm this proposal fits the project scope:

- [ ] It does **not** add a runtime dependency. (Zero deps is a hard line.)
- [ ] It does **not** perform I/O. (agenttrace is in-process observability; OTel exporters / file writers / network sinks belong in a separate sibling package.)
- [ ] It does **not** make `PRICING` lookups asynchronous. (Cost compute must remain sync so callers can `console.log(summary(run))` inline.)

If any of those are unchecked, the right home is probably a separate adapter package.

## What you want

A clear description of the proposed feature.

## Why

What real-world observability workflow does this address? Concrete example of the run shape that would benefit.

## Proposed API shape

```jsonc
// new export, option, or aggregation:
// signature:
// behavior at edge cases (empty run, missing usage, unknown model):
```

## Pricing entry

If this is "add model X to `PRICING`", please also:

- [ ] Link to the provider's public pricing page.
- [ ] State the per-million-token input, output, cache-write, cache-read rates.

## Threat-model impact

Does this change the surfaces in `SECURITY.md`?

- [ ] No — orthogonal feature, no new under-reporting / corruption surface.
- [ ] Yes — and here is what I'd add to SECURITY.md: ...

## Alternatives considered

What workarounds exist today (hand-rolled `Date.now()` deltas, OTel SDK, custom Anthropic SDK middleware) and why aren't they good enough?
